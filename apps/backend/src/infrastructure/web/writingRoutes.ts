import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ApplicationError } from '../../application/errors/ApplicationError.js';
import { PromptInjectionError } from '../llm/prompt-injection-error.js';
import { PromptSanitizer } from '../llm/prompt-sanitizer.js';
import type { WritingChallenge } from '../../domain/entities/WritingChallenge.js';
import type { WritingSubmission } from '../../domain/entities/WritingSubmission.js';

// ========== Schemas ==========
const createChallengeSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  language: z.enum(['javascript', 'typescript', 'python', 'go']),
  difficulty: z.number().int().min(1).max(5),
  testCode: z.string().min(1),
  sampleCode: z.string().optional(),
});

const submitCodeSchema = z.object({
  userId: z.string().uuid(),
  challengeId: z.string().uuid(),
  language: z.enum(['javascript', 'typescript', 'python', 'go']),
  code: z.string().min(1),
});

const autoGenerateChallengeSchema = z.object({
  userId: z.string().uuid(),
  language: z.enum(['javascript', 'typescript', 'python', 'go']),
  difficulty: z.number().int().min(1).max(5),
  topic: z.string().optional(),
});

type UseCaseExecutor<I, O> = {
  execute: (input: I) => Promise<O>;
};

export interface WritingRouteDeps {
  listChallenges: UseCaseExecutor<string, WritingChallenge[]>;
  getChallenge: UseCaseExecutor<{ id: string; userId: string }, WritingChallenge>;
  autoGenerateChallenge: UseCaseExecutor<
    {
      userId: string;
      language: 'javascript' | 'typescript' | 'python' | 'go';
      difficulty: number;
      topic?: string;
    },
    { challengeId: string; status: 'GENERATING' }
  >;
  createChallenge: UseCaseExecutor<
    {
      title: string;
      description: string;
      language: 'javascript' | 'typescript' | 'python' | 'go';
      difficulty: number;
      testCode: string;
      sampleCode?: string;
    },
    WritingChallenge
  >;
  submitCode: UseCaseExecutor<
    { userId: string; challengeId: string; language: string; code: string },
    { submissionId: string; status: 'PENDING' }
  >;
  listSubmissions: UseCaseExecutor<string, WritingSubmission[]>;
  getSubmission: UseCaseExecutor<string, WritingSubmission>;
  requestFeedback: UseCaseExecutor<string, { id: string; status: 'GENERATING' }>;
}

export async function writingRoutes(fastify: FastifyInstance, deps: WritingRouteDeps) {
  // GET /writing/challenges - お題一覧（READY状態のもののみ、ユーザーに割り当てられたもののみ）
  fastify.get('/challenges', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request.query as { userId?: string }).userId;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    const challenges = await deps.listChallenges.execute(userId);
    return reply.send({ challenges });
  });

  // GET /writing/challenges/:id - お題詳細
  fastify.get(
    '/challenges/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const userId = (request.query as { userId?: string }).userId;

      if (!userId) {
        return reply.status(400).send({ error: 'userId is required' });
      }

      try {
        const challenge = await deps.getChallenge.execute({ id, userId });
        // assignedToIdはレスポンスに含めない
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { assignedToId, ...challengeResponse } = challenge;
        return reply.send(challengeResponse);
      } catch (error) {
        if (error instanceof ApplicationError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch challenge' });
      }
    }
  );

  // POST /writing/challenges - お題作成（管理者用）
  fastify.post('/challenges', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createChallengeSchema.parse(request.body);

    const challenge = await deps.createChallenge.execute(body);
    return reply.status(201).send(challenge);
  });

  // POST /writing/challenges/auto - LLMでお題を自動生成
  fastify.post('/challenges/auto', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = autoGenerateChallengeSchema.parse(request.body);
    try {
      const result = await deps.autoGenerateChallenge.execute(body);
      return reply.status(202).send({
        challengeId: result.challengeId,
        status: result.status,
        message: 'Challenge generation started',
      });
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to start generation' });
    }
  });

  // POST /writing/submissions - コード提出
  fastify.post('/submissions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = submitCodeSchema.parse(request.body);
      PromptSanitizer.sanitize(body.code, 'code', { allowBase64: true });

      const result = await deps.submitCode.execute(body);

      return reply.status(202).send({
        submissionId: result.submissionId,
        status: result.status,
        message: 'Submission queued for execution',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: 'Invalid input', issues: error.issues });
      }
      if (error instanceof PromptInjectionError) {
        return reply.status(400).send({
          error: 'Invalid input',
          message: '入力に禁止表現が含まれています',
          field: error.fieldName,
          reasons: error.detectedPatterns,
        });
      }
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Code submission failed' });
    }
  });

  // GET /writing/submissions/:id - 提出結果取得
  fastify.get(
    '/submissions/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      try {
        const submission = await deps.getSubmission.execute(id);
        return reply.send(submission);
      } catch (error) {
        if (error instanceof ApplicationError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Failed to fetch submission' });
      }
    }
  );

  // GET /writing/submissions - ユーザーの提出履歴
  fastify.get(
    '/submissions',
    async (request: FastifyRequest<{ Querystring: { userId?: string } }>, reply: FastifyReply) => {
      const { userId } = request.query;

      if (!userId) {
        return reply.status(400).send({ error: 'userId is required' });
      }

      const submissions = await deps.listSubmissions.execute(userId);

      return reply.send({ submissions });
    }
  );

  // POST /writing/submissions/:id/feedback - LLMフィードバックをリクエスト
  fastify.post(
    '/submissions/:id/feedback',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      try {
        const result = await deps.requestFeedback.execute(id);

        return reply.status(202).send({
          id: result.id,
          status: result.status,
          message: 'Feedback generation started',
        });
      } catch (error) {
        if (error instanceof PromptInjectionError) {
          return reply.status(400).send({
            error: 'Invalid input',
            message: '入力に禁止表現が含まれています',
            field: error.fieldName,
            reasons: error.detectedPatterns,
          });
        }
        if (error instanceof ApplicationError) {
          return reply.status(error.statusCode).send({ error: error.message });
        }
        fastify.log.error(error);
        return reply.status(500).send({ error: 'Feedback generation failed' });
      }
    }
  );
}
