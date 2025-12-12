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

  // POST /submissions/:id/evaluate - LLM評価実行
  fastify.post('/:id/evaluate', async (request, reply) => {
    const { id } = request.params as { id: string };

    const submission = await prisma.submission.findUnique({
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

    if (!submission) {
      return reply.status(404).send({ error: 'Submission not found' });
    }

    if (submission.status === 'EVALUATED') {
      return reply.status(400).send({ error: 'Already evaluated' });
    }

    const scores = [];

    // 各設問を評価
    for (const answer of submission.answers) {
      const question = submission.exercise.questions.find(
        (q) => q.questionIndex === answer.questionIndex
      );

      if (!question || !answer.answerText) {
        continue;
      }

      try {
        const result = await evaluateAnswer({
          code: submission.exercise.code,
          question: question.questionText,
          idealPoints: question.idealAnswerPoints as string[],
          userAnswer: answer.answerText,
        });

        // 結果をDBに保存
        await prisma.submissionAnswer.update({
          where: { id: answer.id },
          data: {
            score: result.score,
            level: result.level,
            llmFeedback: result.feedback,
            aspects: result.aspects || {},
          },
        });

        scores.push({
          questionIndex: answer.questionIndex,
          ...result,
        });
      } catch (error) {
        fastify.log.error(error, `Failed to evaluate answer ${answer.id}`);
        scores.push({
          questionIndex: answer.questionIndex,
          score: 0,
          level: 'D' as const,
          feedback: '評価中にエラーが発生しました。',
          aspects: {},
        });
      }
    }

    // ステータスを更新
    await prisma.submission.update({
      where: { id },
      data: { status: 'EVALUATED' },
    });

    return reply.send({
      submissionId: id,
      scores,
    });
  });
}

