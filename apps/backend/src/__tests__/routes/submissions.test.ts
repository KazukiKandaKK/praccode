import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { submissionRoutes, SubmissionRouteDeps } from '@/routes/submissions';
import { prisma } from '@/lib/prisma';

type MockFn = ReturnType<typeof vi.fn>;

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    submission: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    submissionAnswer: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as any;

describe('submissionRoutes', () => {
  let app: ReturnType<typeof Fastify>;
  let deps: SubmissionRouteDeps;

  beforeEach(() => {
    deps = {
      evaluationService: { evaluate: vi.fn() },
      evaluationEventPublisher: {
        emitEvaluationComplete: vi.fn(),
        emitEvaluationFailed: vi.fn(),
        onEvaluationEvent: vi.fn().mockReturnValue(() => {}),
      },
      learningAnalysisScheduler: { trigger: vi.fn() },
    };
    app = Fastify();
    app.register((instance: FastifyInstance) => submissionRoutes(instance, deps), {
      prefix: '/submissions',
    });
    vi.clearAllMocks();
  });

  describe('GET /submissions', () => {
    it('正常系: ユーザーのサブミッション一覧と統計情報を返す', async () => {
      mockPrisma.submission.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          status: 'EVALUATED',
          createdAt: new Date(),
          updatedAt: new Date(),
          exercise: { id: 'ex-1', title: 'Ex 1', language: 'ts', difficulty: 1, genre: 'test' },
          answers: [
            { score: 80, level: 'B' },
            { score: 90, level: 'A' },
          ],
        },
      ]);
      mockPrisma.submission.count.mockResolvedValue(1);

      const response = await app.inject({
        method: 'GET',
        url: '/submissions?userId=d2d3b878-348c-4f70-9a57-7988351f5c69',
      });

      expect(response.statusCode).toBe(200);
      const { submissions, pagination } = JSON.parse(response.payload);
      expect(submissions).toHaveLength(1);
      expect(pagination.total).toBe(1);
      expect(submissions[0].avgScore).toBe(85);
      expect(submissions[0].overallLevel).toBe('B');
    });
  });

  describe('GET /submissions/:id', () => {
    it('正常系: サブミッション詳細を返す', async () => {
      const mockSubmission = { id: 'sub-1', status: 'DRAFT' };
      mockPrisma.submission.findUnique.mockResolvedValue(mockSubmission);

      const response = await app.inject({
        method: 'GET',
        url: '/submissions/sub-1',
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(mockSubmission);
    });
  });

  describe('PUT /submissions/:id/answers', () => {
    const submissionId = 'sub-1';
    const answersPayload = {
      answers: [{ questionIndex: 0, answerText: 'New Answer' }],
    };

    it('正常系: 回答を更新する', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        id: submissionId,
        status: 'DRAFT',
        answers: [],
      });
      mockPrisma.submissionAnswer.updateMany.mockResolvedValue({});
      mockPrisma.submission.findUnique.mockResolvedValueOnce({ id: submissionId, status: 'DRAFT' });
      mockPrisma.submission.findUnique.mockResolvedValueOnce({
        id: submissionId,
        status: 'DRAFT',
        answers: [{ ...answersPayload.answers[0] }],
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/submissions/${submissionId}/answers`,
        payload: answersPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.submissionAnswer.updateMany).toHaveBeenCalled();
    });
  });

  describe('POST /submissions/:id/evaluate', () => {
    const submissionId = 'sub-1';

    it('正常系: 評価をキューに入れ、バックグラウンドで実行する', async () => {
      const mockSubmission = {
        id: submissionId,
        status: 'DRAFT',
        userId: 'user-1',
        answers: [{ id: 'ans-1', questionIndex: 0, answerText: 'My Answer' }],
        exercise: {
          code: 'console.log("hello")',
          questions: [{ questionIndex: 0, questionText: 'Q1', idealAnswerPoints: [] }],
        },
      };
      mockPrisma.submission.findUnique.mockResolvedValue(mockSubmission);
      (deps.evaluationService.evaluate as MockFn).mockResolvedValue({
        score: 95,
        level: 'A',
        feedback: 'Good',
        aspects: {},
      });
      (deps.learningAnalysisScheduler.trigger as MockFn).mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: `/submissions/${submissionId}/evaluate`,
      });

      expect(response.statusCode).toBe(202);
      expect(mockPrisma.submission.update).toHaveBeenCalledWith({
        where: { id: submissionId },
        data: { status: 'SUBMITTED' },
      });

      await new Promise((resolve) => setTimeout(resolve, 50)); // allow setImmediate to run

      expect(deps.evaluationService.evaluate).toHaveBeenCalled();
      expect(mockPrisma.submissionAnswer.update).toHaveBeenCalled();
      expect(mockPrisma.submission.update).toHaveBeenCalledWith({
        where: { id: submissionId },
        data: { status: 'EVALUATED' },
      });
      expect(deps.evaluationEventPublisher.emitEvaluationComplete).toHaveBeenCalledWith(submissionId);
      expect(deps.learningAnalysisScheduler.trigger).toHaveBeenCalledWith('user-1');
    });

    it('異常系: 評価済みのサブミッションはキューに入れない', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({ id: submissionId, status: 'EVALUATED' });
      const response = await app.inject({
        method: 'POST',
        url: `/submissions/${submissionId}/evaluate`,
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
