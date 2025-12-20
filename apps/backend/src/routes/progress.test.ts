import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { progressRoutes } from './progress';
import { prisma } from '../lib/prisma';

// Mock Prisma
vi.mock('../lib/prisma', () => ({
  prisma: {
    exercise: {
      count: vi.fn(),
    },
    submission: {
      findMany: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as any;

describe('progressRoutes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
    app.register(progressRoutes, { prefix: '/me' }); // Assuming it's mounted under /me
    vi.clearAllMocks();
  });

  describe('GET /me/progress', () => {
    const userId = 'user-123';

    it('正常系: ユーザーの進捗データが正しく計算されて返される', async () => {
      mockPrisma.exercise.count.mockResolvedValue(10);
      mockPrisma.submission.findMany.mockResolvedValue([
        { // Submission 1
          exerciseId: 'ex-1',
          updatedAt: new Date(),
          exercise: { id: 'ex-1', title: 'Exercise 1' },
          answers: [
            { score: 80, aspects: { 'Logic': 7, 'Readability': 9 } },
            { score: 90, aspects: { 'Logic': 8, 'Readability': 10 } },
          ],
        },
        { // Submission 2
            exerciseId: 'ex-2',
            updatedAt: new Date(),
            exercise: { id: 'ex-2', title: 'Exercise 2' },
            answers: [
              { score: 70, aspects: { 'Logic': 6, 'Performance': 8 } },
            ],
        },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/me/progress?userId=${userId}`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.payload);

      expect(data.userId).toBe(userId);
      expect(data.totalExercises).toBe(10);
      expect(data.completedExercises).toBe(2); // ex-1 and ex-2
      expect(data.averageScore).toBe(80); // (80 + 90 + 70) / 3
      expect(data.aspectScores).toEqual({
        'Logic': 7, // (7 + 8 + 6) / 3
        'Readability': 10, // (9 + 10) / 2
        'Performance': 8,
      });
      expect(data.recentSubmissions).toHaveLength(2);
      expect(data.recentSubmissions[0].averageScore).toBe(85); // (80+90)/2
    });

    it('エッジケース: 完了したサブミッションがない場合、ゼロ値を返す', async () => {
        mockPrisma.exercise.count.mockResolvedValue(10);
        mockPrisma.submission.findMany.mockResolvedValue([]);
  
        const response = await app.inject({
          method: 'GET',
          url: `/me/progress?userId=${userId}`,
        });
  
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.payload);
  
        expect(data.completedExercises).toBe(0);
        expect(data.averageScore).toBe(0);
        expect(data.aspectScores).toEqual({});
        expect(data.recentSubmissions).toEqual([]);
      });

      it('エッジケース: スコアやアスペクトがnullの場合でも計算が正しく行われる', async () => {
        mockPrisma.exercise.count.mockResolvedValue(10);
        mockPrisma.submission.findMany.mockResolvedValue([
          {
            exerciseId: 'ex-1',
            updatedAt: new Date(),
            exercise: { id: 'ex-1', title: 'Exercise 1' },
            answers: [
              { score: 100, aspects: { 'Logic': 10 } },
              { score: null, aspects: null }, // Null score/aspect
            ],
          },
        ]);
  
        const response = await app.inject({
          method: 'GET',
          url: `/me/progress?userId=${userId}`,
        });
  
        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.payload);
  
        expect(data.completedExercises).toBe(1);
        expect(data.averageScore).toBe(100); // Only the non-null score is counted
        expect(data.aspectScores).toEqual({ 'Logic': 10 });
      });

    it('異常系: userIdがない場合400エラーを返す', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/me/progress',
        });
        expect(response.statusCode).toBe(400);
        expect(JSON.parse(response.payload)).toEqual({ error: 'userId is required' });
    });
  });
});
