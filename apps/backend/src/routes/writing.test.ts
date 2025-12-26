import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { writingRoutes } from './writing';
import { prisma } from '../lib/prisma';
import * as llmClient from '../llm/llm-client';
import * as executor from '../runner/executor';
import * as codeReviewer from '../llm/code-reviewer';
import * as writingGenerator from '../llm/writing-generator';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// Mock dependencies
vi.mock('../lib/prisma', () => ({
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
vi.mock('../llm/llm-client');
vi.mock('../runner/executor');
vi.mock('../llm/code-reviewer');
vi.mock('../llm/writing-generator');

const mockPrisma = prisma as any;
const mockLlmClient = llmClient as any;
const mockExecutor = executor as any;
const mockCodeReviewer = codeReviewer as any;
const mockWritingGenerator = writingGenerator as any;

describe('writingRoutes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    app = Fastify();
    app.setErrorHandler((error, request, reply) => {
      if (error.validation) {
        reply.status(400).send({ error: 'Invalid input' });
      }
      console.error(error);
      reply.status(500).send({ error: 'Internal Server Error' });
    });
    app.register(writingRoutes, { prefix: '/writing' });
    vi.clearAllMocks();
  });

  // ... (synchronous tests) ...
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
      mockLlmClient.checkOllamaHealth.mockResolvedValue(true);
      mockPrisma.writingChallenge.create.mockResolvedValue({ id: 'new-challenge' });
      mockWritingGenerator.generateWritingChallenge.mockResolvedValue({ title: 'New one' });

      const response = await app.inject({
        method: 'POST',
        url: '/writing/challenges/auto',
        payload: { userId: 'd2d3b878-348c-4f70-9a57-7988351f5c69', language: 'go', difficulty: 1 },
      });

      expect(response.statusCode).toBe(202);

      await tick();

      expect(mockWritingGenerator.generateWritingChallenge).toHaveBeenCalled();
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
      mockExecutor.executeCode.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
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
        payload: { userId, challengeId, language: 'go', code: '...' },
      });

      expect(response.statusCode).toBe(202);

      await tick();

      expect(mockExecutor.executeCode).toHaveBeenCalled();

      // Check for specific update calls by inspecting the mock's calls
      const updateCalls = mockPrisma.writingSubmission.update.mock.calls;
      expect(updateCalls).toHaveLength(2);
      expect(updateCalls[0][0].data.status).toBe('RUNNING');
      expect(updateCalls[1][0].data.status).toBe('COMPLETED');
      expect(updateCalls[1][0].data.passed).toBe(true);
    });
  });

  describe('POST /writing/submissions/:id/feedback', () => {
    it('正常系: 202を返し、バックグラウンドでレビューを生成する', async () => {
      const submissionId = 'sub-1';
      mockLlmClient.checkOllamaHealth.mockResolvedValue(true);
      mockPrisma.writingSubmission.findUnique.mockResolvedValue({
        id: submissionId,
        executedAt: new Date(),
        challenge: {},
      });
      mockCodeReviewer.generateCodeReview.mockResolvedValue('Good code!');

      const response = await app.inject({
        method: 'POST',
        url: `/writing/submissions/${submissionId}/feedback`,
      });

      expect(response.statusCode).toBe(202);

      await tick();

      expect(mockCodeReviewer.generateCodeReview).toHaveBeenCalled();
      expect(mockPrisma.writingSubmission.update).toHaveBeenCalledWith({
        where: { id: submissionId },
        data: { llmFeedbackStatus: 'GENERATING' },
      });
      expect(mockPrisma.writingSubmission.update).toHaveBeenCalledWith({
        where: { id: submissionId },
        data: {
          llmFeedback: 'Good code!',
          llmFeedbackStatus: 'COMPLETED',
          llmFeedbackAt: expect.any(Date),
        },
      });
    });
  });
});
