import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import dashboardRoutes from './dashboard';
import { prisma } from '../lib/prisma';
import * as learningAnalyzer from '../llm/learning-analyzer';
import * as writingGenerator from '../llm/writing-generator';
import * as generator from '../llm/generator';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    submission: { findMany: vi.fn() },
    writingSubmission: { findMany: vi.fn() },
    userLearningAnalysis: { findUnique: vi.fn(), upsert: vi.fn() },
    exercise: { create: vi.fn() },
    writingChallenge: { create: vi.fn() },
  },
}));

// Mock LLM modules
vi.mock('../llm/learning-analyzer');
vi.mock('../llm/writing-generator');
vi.mock('../llm/generator');

const mockPrisma = prisma as any;
const mockLearningAnalyzer = learningAnalyzer as any;

describe('dashboardRoutes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    app = Fastify();
    app.register(dashboardRoutes);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ... (stats and activity tests remain the same) ...

  describe('GET /dashboard/stats', () => {
    const userId = 'user-123';

    it('正常系: ユーザーの統計情報を正しく計算して返す', async () => {
      mockPrisma.submission.findMany.mockResolvedValue([
        {
          id: 'reading-sub-1',
          exercise: { title: 'Reading 1', language: 'ts', genre: 'test' },
          answers: [{ score: 80, aspects: { Logic: 8 } }],
          updatedAt: new Date(),
        },
      ]);
      mockPrisma.writingSubmission.findMany.mockResolvedValue([
        {
          id: 'writing-sub-1',
          challenge: { title: 'Writing 1', language: 'py' },
          passed: true,
          createdAt: new Date(),
        },
        {
          id: 'writing-sub-2',
          challenge: { title: 'Writing 2', language: 'py' },
          passed: false,
          createdAt: new Date(),
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/dashboard/stats?userId=${userId}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);

      expect(data.totalReadingSubmissions).toBe(1);
      expect(data.totalWritingSubmissions).toBe(2);
      expect(data.avgReadingScore).toBe(80);
      expect(data.writingPassRate).toBe(50);
      expect(data.aspectAverages).toEqual({ Logic: 8 });
      expect(data.recentActivity).toHaveLength(3);
    });
  });

  describe('GET /dashboard/activity', () => {
    const userId = 'user-123';
    const today = new Date('2024-01-10T12:00:00Z');
    const yesterday = new Date('2024-01-09T12:00:00Z');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(today);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('正常系: ユーザーの活動記録を日付ごとに集計して返す', async () => {
      mockPrisma.submission.findMany.mockResolvedValue([
        { updatedAt: today },
        { updatedAt: yesterday },
        { updatedAt: yesterday },
      ]);
      mockPrisma.writingSubmission.findMany.mockResolvedValue([{ createdAt: today }]);

      const response = await app.inject({
        method: 'GET',
        url: `/dashboard/activity?userId=${userId}`,
      });

      expect(response.statusCode).toBe(200);
      const { activity } = JSON.parse(response.payload);

      expect(activity).toHaveLength(366);

      const todayActivity = activity.find((a: any) => a.date === '2024-01-10');
      const yesterdayActivity = activity.find((a: any) => a.date === '2024-01-09');

      expect(todayActivity?.count).toBe(2);
      expect(yesterdayActivity?.count).toBe(2);
    });
  });

  describe('GET /dashboard/analysis and POST /dashboard/analyze', () => {
    const userId = 'user-123';
    const mockAnalysis = {
      strengths: ['a'],
      weaknesses: ['b'],
      recommendations: ['c'],
      summary: 'd',
    };

    beforeEach(() => {
      mockLearningAnalyzer.analyzeLearningProgress.mockResolvedValue(mockAnalysis);
      mockPrisma.userLearningAnalysis.upsert.mockResolvedValue(mockAnalysis);
      mockPrisma.submission.findMany.mockResolvedValue([]);
      mockPrisma.writingSubmission.findMany.mockResolvedValue([]);
    });

    it('GET /analysis: should return new analysis if not cached', async () => {
      mockPrisma.userLearningAnalysis.findUnique.mockResolvedValue(null);
      const response = await app.inject({
        method: 'GET',
        url: `/dashboard/analysis?userId=${userId}`,
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).cached).toBe(false);
    });

    it('POST /analyze: should force a new analysis', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/analyze',
        payload: { userId },
      });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).summary).toBe('d');
    });
  });

  describe('POST /dashboard/generate-recommendation', () => {
    const userId = 'user-123';

    beforeEach(() => {
      mockLearningAnalyzer.getRecommendedProblemContext.mockReturnValue({
        difficulty: 3,
        focusAreas: ['testing'],
      });
      mockPrisma.userLearningAnalysis.findUnique.mockResolvedValue({
        strengths: [],
        weaknesses: [],
        recommendations: [],
        summary: '',
      });
    });

    it('should generate a reading recommendation', async () => {
      mockPrisma.exercise.create.mockResolvedValue({ id: 'new-reading-ex' });
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/generate-recommendation',
        payload: { userId, type: 'reading' },
      });
      expect(response.statusCode).toBe(200);
      expect(mockPrisma.exercise.create).toHaveBeenCalled();
    });

    it('should generate a writing recommendation', async () => {
      mockPrisma.writingChallenge.create.mockResolvedValue({ id: 'new-writing-ch' });
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/generate-recommendation',
        payload: { userId, type: 'writing' },
      });
      expect(response.statusCode).toBe(200);
      expect(mockPrisma.writingChallenge.create).toHaveBeenCalled();
    });
  });
});
