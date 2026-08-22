import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { dashboardController } from '@/infrastructure/web/dashboardController';
import { GetDashboardStatsUseCase } from '@/application/usecases/dashboard/GetDashboardStatsUseCase';
import { GetDashboardActivityUseCase } from '@/application/usecases/dashboard/GetDashboardActivityUseCase';
import { GetLearningAnalysisUseCase } from '@/application/usecases/dashboard/GetLearningAnalysisUseCase';
import { GenerateRecommendationUseCase } from '@/application/usecases/dashboard/GenerateRecommendationUseCase';
import { ApplicationError } from '@/application/errors/ApplicationError';

const validUserId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';

const mockGetStats = { execute: vi.fn() } as unknown as Mocked<GetDashboardStatsUseCase>;
const mockGetActivity = { execute: vi.fn() } as unknown as Mocked<GetDashboardActivityUseCase>;
const mockGetLearningAnalysis = {
  execute: vi.fn(),
} as unknown as Mocked<GetLearningAnalysisUseCase>;
const mockGenerateRecommendation = {
  execute: vi.fn(),
} as unknown as Mocked<GenerateRecommendationUseCase>;

const deps = {
  getStats: mockGetStats,
  getActivity: mockGetActivity,
  getLearningAnalysis: mockGetLearningAnalysis,
  generateRecommendation: mockGenerateRecommendation,
};

describe('dashboardController', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      dashboardController(instance, deps);
      done();
    });
    vi.clearAllMocks();
    await app.ready();
  });

  describe('GET /dashboard/stats', () => {
    it('should call getStats and return the result', async () => {
      const stats = { totalSubmissions: 10 } as any;
      mockGetStats.execute.mockResolvedValue(stats);

      const response = await app.inject({
        method: 'GET',
        url: `/dashboard/stats?userId=${validUserId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(stats);
      expect(mockGetStats.execute).toHaveBeenCalledWith(validUserId);
    });

    it('should return 400 for invalid userId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/stats?userId=not-a-uuid',
      });

      expect(response.statusCode).toBe(400);
      expect(mockGetStats.execute).not.toHaveBeenCalled();
    });

    it('should return use case status on ApplicationError', async () => {
      mockGetStats.execute.mockRejectedValue(new ApplicationError('Not found', 404));

      const response = await app.inject({
        method: 'GET',
        url: `/dashboard/stats?userId=${validUserId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Not found' });
    });
  });

  describe('GET /dashboard/activity', () => {
    it('should return 400 for invalid userId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/dashboard/activity?userId=bad-id',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /dashboard/analysis', () => {
    it('should return cached analysis', async () => {
      mockGetLearningAnalysis.execute.mockResolvedValue({ summary: 'great' } as any);

      const response = await app.inject({
        method: 'GET',
        url: `/dashboard/analysis?userId=${validUserId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetLearningAnalysis.execute).toHaveBeenCalledWith({
        userId: validUserId,
        force: false,
      });
    });
  });

  describe('POST /dashboard/analyze', () => {
    it('should force analysis for valid input', async () => {
      mockGetLearningAnalysis.execute.mockResolvedValue({ summary: 'updated' } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/analyze',
        payload: { userId: validUserId },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetLearningAnalysis.execute).toHaveBeenCalledWith({
        userId: validUserId,
        force: true,
      });
    });

    it('should return 400 for missing userId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/analyze',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      expect(mockGetLearningAnalysis.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /dashboard/generate-recommendation', () => {
    it('should return recommendation for valid input', async () => {
      mockGenerateRecommendation.execute.mockResolvedValue({ recommendation: 'try X' } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/generate-recommendation',
        payload: { userId: validUserId, language: 'typescript', type: 'writing' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockGenerateRecommendation.execute).toHaveBeenCalledWith({
        userId: validUserId,
        language: 'typescript',
        type: 'writing',
      });
    });

    it('should return 400 for invalid userId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/dashboard/generate-recommendation',
        payload: { userId: 'invalid' },
      });

      expect(response.statusCode).toBe(400);
      expect(mockGenerateRecommendation.execute).not.toHaveBeenCalled();
    });
  });
});
