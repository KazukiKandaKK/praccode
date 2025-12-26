import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyRequest, type FastifyReply, FastifyInstance } from 'fastify';
import { writingRoutes, WritingRouteDeps } from '@/routes/writing';
import { prisma } from '@/lib/prisma';

type MockFn = ReturnType<typeof vi.fn>;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    writingChallenge: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    writingSubmission: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    submission: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    userLearningAnalysis: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as any;

describe('writingRoutes', () => {
  let app: ReturnType<typeof Fastify>;
  let deps: WritingRouteDeps;

  beforeEach(() => {
    deps = {
      codeExecutor: { execute: vi.fn() },
      writingChallengeGenerator: { generate: vi.fn() },
      codeFeedbackGenerator: { generate: vi.fn() },
      llmHealthChecker: { isHealthy: vi.fn() },
      learningAnalysisScheduler: { trigger: vi.fn() },
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
      mockPrisma.writingChallenge.findMany.mockResolvedValue([{ id: 'challenge-1' }]);

      const response = await app.inject({
        method: 'GET',
        url: `/writing/challenges?userId=${userId}`,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /writing/challenges/auto', () => {
    it('正常系: 202を返し、バックグラウンドで課題を生成する', async () => {
      (deps.llmHealthChecker.isHealthy as MockFn).mockResolvedValue(true);
      mockPrisma.writingChallenge.create.mockResolvedValue({ id: 'new-challenge' });
      (deps.writingChallengeGenerator.generate as MockFn).mockResolvedValue({
        title: 'New one',
        description: '',
        difficulty: 1,
        testCode: '',
        starterCode: '',
        sampleCode: '',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/writing/challenges/auto',
        payload: { userId: 'd2d3b878-348c-4f70-9a57-7988351f5c69', language: 'go', difficulty: 1 },
      });

      expect(response.statusCode).toBe(202);

      await tick();

      expect(deps.writingChallengeGenerator.generate).toHaveBeenCalled();
      expect(mockPrisma.writingChallenge.update).toHaveBeenCalled();
    });
  });

  describe('POST /writing/submissions', () => {
    it('正常系: 202を返し、バックグラウンドでコードを実行する', async () => {
      const userId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
      const challengeId = 'd2d3b878-348c-4f70-9a57-7988351f5c6a';
      mockPrisma.writingChallenge.findUnique.mockResolvedValue({
        id: challengeId,
        assignedToId: userId,
      });
      mockPrisma.writingSubmission.create.mockResolvedValue({ id: 'new-sub', userId });
      (deps.codeExecutor.execute as MockFn).mockResolvedValue({
        stdout: 'ok',
        stderr: '',
        exitCode: 0,
        passed: true,
      });
      mockPrisma.writingSubmission.update.mockResolvedValue({ userId });
      // Mocks for triggerLearningAnalysis
      mockPrisma.userLearningAnalysis.findUnique.mockResolvedValue(null);
      mockPrisma.submission.count.mockResolvedValue(0);
      mockPrisma.writingSubmission.count.mockResolvedValue(1);
      mockPrisma.submission.findMany.mockResolvedValue([]);
      mockPrisma.writingSubmission.findMany.mockResolvedValue([]);

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

      expect(deps.codeExecutor.execute).toHaveBeenCalled();
    });
  });
});
