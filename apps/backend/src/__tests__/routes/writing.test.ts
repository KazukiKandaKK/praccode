import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyRequest, type FastifyReply, FastifyInstance } from 'fastify';
import { writingRoutes, WritingRouteDeps } from '@/infrastructure/web/writingRoutes';

type MockFn = ReturnType<typeof vi.fn>;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// No prisma usage; routes are exercised via use cases injected as deps

describe('writingRoutes', () => {
  let app: ReturnType<typeof Fastify>;
  let deps: WritingRouteDeps;

  beforeEach(() => {
    deps = {
      listChallenges: { execute: vi.fn() },
      getChallenge: { execute: vi.fn() },
      autoGenerateChallenge: { execute: vi.fn() },
      createChallenge: { execute: vi.fn() },
      submitCode: { execute: vi.fn() },
      listSubmissions: { execute: vi.fn() },
      getSubmission: { execute: vi.fn() },
      requestFeedback: { execute: vi.fn() },
    };
    app = Fastify();
    app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
      if (error && typeof error === 'object' && 'validation' in error) {
        return reply.status(400).send({ error: 'Invalid input' });
      }
      console.error(error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    });
    app.register((instance: FastifyInstance) => writingRoutes(instance, deps), {
      prefix: '/writing',
    });
    vi.clearAllMocks();
  });

  describe('GET /writing/challenges', () => {
    it('正常系: ユーザーに割り当てられた課題一覧を返す', async () => {
      const userId = 'user-123';
      (deps.listChallenges.execute as MockFn).mockResolvedValue([{ id: 'challenge-1' }]);

      const response = await app.inject({
        method: 'GET',
        url: `/writing/challenges?userId=${userId}`,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /writing/challenges/auto', () => {
    it('正常系: 202を返し、バックグラウンドで課題を生成する', async () => {
      (deps.autoGenerateChallenge.execute as MockFn).mockResolvedValue({
        challengeId: 'new-challenge',
        status: 'GENERATING',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/writing/challenges/auto',
        payload: { userId: 'd2d3b878-348c-4f70-9a57-7988351f5c69', language: 'go', difficulty: 1 },
      });

      expect(response.statusCode).toBe(202);

      await tick();

      expect(deps.autoGenerateChallenge.execute).toHaveBeenCalled();
    });
  });

  describe('POST /writing/submissions', () => {
    it('正常系: 202を返し、バックグラウンドでコードを実行する', async () => {
      const userId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
      const challengeId = 'd2d3b878-348c-4f70-9a57-7988351f5c6a';
      (deps.submitCode.execute as MockFn).mockResolvedValue({
        submissionId: 'new-sub',
        status: 'PENDING',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/writing/submissions',
        payload: {
          userId,
          challengeId,
          language: 'javascript',
          code: 'console.log("Hello World")',
        },
      });

      expect(response.statusCode).toBe(202);

      await tick();

      expect(deps.submitCode.execute).toHaveBeenCalled();
    });
  });
});
