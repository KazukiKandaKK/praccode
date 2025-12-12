import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { evaluateAnswer } from '../llm/evaluator.js';
import {
  emitEvaluationComplete,
  emitEvaluationFailed,
  onEvaluationEvent,
} from '../lib/evaluation-events.js';

const answerInputSchema = z.object({
  answers: z.array(
    z.object({
      questionIndex: z.number(),
      answerText: z.string(),
    })
  ),
});

const submissionListQuerySchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'EVALUATED']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function submissionRoutes(fastify: FastifyInstance) {
  // GET /submissions - ユーザーのサブミッション一覧
  fastify.get('/', async (request, reply) => {
    const query = submissionListQuerySchema.parse(request.query);
    const { userId, status, page, limit } = query;

    const where = {
      userId,
      ...(status && { status }),
    };

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          exercise: {
            select: {
              id: true,
              title: true,
              language: true,
              difficulty: true,
              genre: true,
            },
          },
          answers: {
            select: {
              score: true,
              level: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.submission.count({ where }),
    ]);

    // 各サブミッションの平均スコアと評価レベルを計算
    const submissionsWithStats = submissions.map((sub) => {
      const evaluatedAnswers = sub.answers.filter(
        (a) => a.score !== null && a.level !== null
      );
      const avgScore =
        evaluatedAnswers.length > 0
          ? Math.round(
              evaluatedAnswers.reduce((sum, a) => sum + (a.score || 0), 0) /
                evaluatedAnswers.length
            )
          : null;
      const overallLevel =
        avgScore !== null
          ? avgScore >= 90
            ? 'A'
            : avgScore >= 70
            ? 'B'
            : avgScore >= 50
            ? 'C'
            : 'D'
          : null;

      return {
        id: sub.id,
        status: sub.status,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        exercise: sub.exercise,
        avgScore,
        overallLevel,
        answerCount: sub.answers.length,
      };
    });

    return reply.send({
      submissions: submissionsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

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

        // 評価完了イベントを発行（SSE通知用）
        emitEvaluationComplete(id);
        fastify.log.info(`Evaluation completed for submission ${id}`);
      } catch (error) {
        fastify.log.error(error, `Evaluation job failed for submission ${id}`);
        // 失敗してもEVALUATEDにしてUIを進める（フィードバックは各設問に入れてある想定）
        await prisma.submission.update({
          where: { id },
          data: { status: 'EVALUATED' },
        });

        // 評価失敗イベントを発行
        emitEvaluationFailed(id);
      }
    });

    return reply.status(202).send({ submissionId: id, status: 'queued' });
  });

  // GET /submissions/:id/events - SSEストリーム（評価完了通知）
  fastify.get('/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };

    // サブミッションの存在確認
    const submission = await prisma.submission.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!submission) {
      return reply.status(404).send({ error: 'Submission not found' });
    }

    // 既に評価済みの場合は即座にイベントを送信して終了
    if (submission.status === 'EVALUATED') {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      reply.raw.write(`event: evaluated\ndata: ${JSON.stringify({ submissionId: id, status: 'EVALUATED' })}\n\n`);
      reply.raw.end();
      return;
    }

    // SSEヘッダー設定
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // 接続確認用のコメントを送信
    reply.raw.write(': connected\n\n');

    // 評価イベントをリスン
    const cleanup = onEvaluationEvent(id, (event) => {
      const eventType = event.type === 'evaluated' ? 'evaluated' : 'failed';
      reply.raw.write(`event: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`);
      // イベント送信後に接続を閉じる
      setTimeout(() => {
        reply.raw.end();
      }, 100);
    });

    // クライアント切断時のクリーンアップ
    request.raw.on('close', () => {
      cleanup();
      fastify.log.info(`SSE connection closed for submission ${id}`);
    });

    // タイムアウト（5分）
    const timeout = setTimeout(() => {
      reply.raw.write(`event: timeout\ndata: ${JSON.stringify({ message: 'Connection timeout' })}\n\n`);
      reply.raw.end();
      cleanup();
    }, 5 * 60 * 1000);

    request.raw.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

