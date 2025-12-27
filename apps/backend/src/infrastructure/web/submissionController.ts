import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ListSubmissionsUseCase } from '../../application/usecases/submissions/ListSubmissionsUseCase.js';
import { GetSubmissionUseCase } from '../../application/usecases/submissions/GetSubmissionUseCase.js';
import { UpdateSubmissionAnswersUseCase } from '../../application/usecases/submissions/UpdateSubmissionAnswersUseCase.js';
import { EvaluateSubmissionUseCase } from '../../application/usecases/submissions/EvaluateSubmissionUseCase.js';
import { IEvaluationEventPublisher } from '../../domain/ports/IEvaluationEventPublisher.js';
import { ApplicationError } from '../../application/errors/ApplicationError.js';

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

export interface SubmissionControllerDeps {
  listSubmissions: ListSubmissionsUseCase;
  getSubmission: GetSubmissionUseCase;
  updateSubmissionAnswers: UpdateSubmissionAnswersUseCase;
  evaluateSubmission: EvaluateSubmissionUseCase;
  eventPublisher: IEvaluationEventPublisher;
}

export function submissionController(fastify: FastifyInstance, deps: SubmissionControllerDeps) {
  // GET /submissions - ユーザーのサブミッション一覧
  fastify.get('/', async (request, reply) => {
    const query = submissionListQuerySchema.parse(request.query);
    const result = await deps.listSubmissions.execute(query);
    return reply.send(result);
  });

  // GET /submissions/:id - サブミッション詳細取得
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const submission = await deps.getSubmission.execute(id);
      return reply.send(submission);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // PUT /submissions/:id/answers - 回答保存
  fastify.put('/:id/answers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = answerInputSchema.parse(request.body);

    try {
      const updated = await deps.updateSubmissionAnswers.execute({
        submissionId: id,
        answers: body.answers,
      });
      return reply.send(updated);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // POST /submissions/:id/evaluate - LLM評価実行（非同期）
  fastify.post('/:id/evaluate', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await deps.evaluateSubmission.execute(id);
      return reply.status(202).send(result);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // GET /submissions/:id/events - SSEストリーム（評価完了通知）
  fastify.get('/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const submission = await deps.getSubmission.execute(id);

      // 既に評価済みの場合は即座にイベントを送信して終了
      if (submission.status === 'EVALUATED') {
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        reply.raw.write(
          `event: evaluated\ndata: ${JSON.stringify({ submissionId: id, status: 'EVALUATED' })}\n\n`
        );
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
      const cleanup = deps.eventPublisher.onEvaluationEvent(id, (event) => {
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
      const timeout = setTimeout(
        () => {
          reply.raw.write(
            `event: timeout\ndata: ${JSON.stringify({ message: 'Connection timeout' })}\n\n`
          );
          reply.raw.end();
          cleanup();
        },
        5 * 60 * 1000
      );

      request.raw.on('close', () => {
        clearTimeout(timeout);
      });
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
