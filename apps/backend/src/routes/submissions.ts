import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { evaluateAnswer } from '../llm/evaluator.js';

const answerInputSchema = z.object({
  answers: z.array(
    z.object({
      questionIndex: z.number(),
      answerText: z.string(),
    })
  ),
});

export async function submissionRoutes(fastify: FastifyInstance) {
  // GET /submissions/:id - サブミッション詳細取得
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        answers: {
          orderBy: { questionIndex: 'asc' },
        },
        exercise: {
          include: {
            questions: {
              orderBy: { questionIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!submission) {
      return reply.status(404).send({ error: 'Submission not found' });
    }

    return reply.send(submission);
  });

  // PUT /submissions/:id/answers - 回答保存
  fastify.put('/:id/answers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = answerInputSchema.parse(request.body);

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: { answers: true },
    });

    if (!submission) {
      return reply.status(404).send({ error: 'Submission not found' });
    }

    if (submission.status === 'EVALUATED') {
      return reply.status(400).send({ error: 'Submission already evaluated' });
    }

    // 各回答を更新
    await Promise.all(
      body.answers.map((answer) =>
        prisma.submissionAnswer.updateMany({
          where: {
            submissionId: id,
            questionIndex: answer.questionIndex,
          },
          data: {
            answerText: answer.answerText,
          },
        })
      )
    );

    const updated = await prisma.submission.findUnique({
      where: { id },
      include: { answers: { orderBy: { questionIndex: 'asc' } } },
    });

    return reply.send(updated);
  });

  // POST /submissions/:id/evaluate - LLM評価実行（非同期）
  fastify.post('/:id/evaluate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        // ここではステータス確認が主目的。詳細はジョブ側で再取得する
        answers: { select: { id: true }, take: 1 },
        exercise: { select: { id: true } },
      },
    });

    if (!submission) {
      return reply.status(404).send({ error: 'Submission not found' });
    }

    if (submission.status === 'EVALUATED') {
      return reply.status(400).send({ error: 'Already evaluated' });
    }

    if (submission.status === 'SUBMITTED') {
      // すでに評価キューに乗っている想定
      return reply.status(202).send({ submissionId: id, status: 'queued' });
    }

    // 二重起動防止: 先に SUBMITTED に遷移
    await prisma.submission.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    // バックグラウンドで評価実行（ジョブ風）
    setImmediate(async () => {
      try {
        const jobSubmission = await prisma.submission.findUnique({
          where: { id },
          include: {
            answers: { orderBy: { questionIndex: 'asc' } },
            exercise: {
              include: {
                questions: { orderBy: { questionIndex: 'asc' } },
              },
            },
          },
        });

        if (!jobSubmission) return;

        for (const answer of jobSubmission.answers) {
          const question = jobSubmission.exercise.questions.find(
            (q) => q.questionIndex === answer.questionIndex
          );

          if (!question || !answer.answerText) {
            continue;
          }

          try {
            const result = await evaluateAnswer({
              code: jobSubmission.exercise.code,
              question: question.questionText,
              idealPoints: question.idealAnswerPoints as string[],
              userAnswer: answer.answerText,
            });

            await prisma.submissionAnswer.update({
              where: { id: answer.id },
              data: {
                score: result.score,
                level: result.level,
                llmFeedback: result.feedback,
                aspects: result.aspects || {},
              },
            });
          } catch (error) {
            fastify.log.error(error, `Failed to evaluate answer ${answer.id}`);
            await prisma.submissionAnswer.update({
              where: { id: answer.id },
              data: {
                score: 0,
                level: 'D',
                llmFeedback: '評価中にエラーが発生しました。',
                aspects: {},
              },
            });
          }
        }

        await prisma.submission.update({
          where: { id },
          data: { status: 'EVALUATED' },
        });
      } catch (error) {
        fastify.log.error(error, `Evaluation job failed for submission ${id}`);
        // 失敗してもEVALUATEDにしてUIを進める（フィードバックは各設問に入れてある想定）
        await prisma.submission.update({
          where: { id },
          data: { status: 'EVALUATED' },
        });
      }
    });

    return reply.status(202).send({ submissionId: id, status: 'queued' });
  });
}

