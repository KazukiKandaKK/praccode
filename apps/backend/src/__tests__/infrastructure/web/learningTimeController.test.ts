import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { learningTimeController } from '@/infrastructure/web/learningTimeController';
import { LogLearningTimeUseCase } from '@/application/usecases/learning-time/LogLearningTimeUseCase';
import { GetDailyLearningTimeUseCase } from '@/application/usecases/learning-time/GetDailyLearningTimeUseCase';
import { ApplicationError } from '@/application/errors/ApplicationError';

const validUserId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';

const mockLogLearningTime = { execute: vi.fn() } as unknown as Mocked<LogLearningTimeUseCase>;
const mockGetDailyLearningTime = {
  execute: vi.fn(),
} as unknown as Mocked<GetDailyLearningTimeUseCase>;

describe('learningTimeController', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      learningTimeController(instance, {
        logLearningTime: mockLogLearningTime,
        getDailyLearningTime: mockGetDailyLearningTime,
      });
      done();
    });
    vi.clearAllMocks();
    await app.ready();
  });

  describe('POST /learning-time', () => {
    it('should log learning time and return 201', async () => {
      mockLogLearningTime.execute.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/learning-time',
        payload: {
          userId: validUserId,
          durationSec: 120,
          source: 'reading',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload)).toEqual({ ok: true });
      expect(mockLogLearningTime.execute).toHaveBeenCalledWith({
        userId: validUserId,
        durationSec: 120,
        source: 'reading',
        startedAt: undefined,
        endedAt: undefined,
      });
    });

    it('should return 400 for invalid userId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/learning-time',
        payload: {
          userId: 'not-a-uuid',
          durationSec: 120,
          source: 'reading',
        },
      });

      expect(response.statusCode).toBe(400);
      expect(mockLogLearningTime.execute).not.toHaveBeenCalled();
    });

    it('should return use case status on ApplicationError', async () => {
      mockLogLearningTime.execute.mockRejectedValue(new ApplicationError('User not found', 404));

      const response = await app.inject({
        method: 'POST',
        url: '/learning-time',
        payload: {
          userId: validUserId,
          durationSec: 120,
          source: 'reading',
        },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'User not found' });
    });
  });

  describe('GET /learning-time/daily', () => {
    it('should return daily learning time', async () => {
      mockGetDailyLearningTime.execute.mockResolvedValue([
        { date: new Date('2026-08-20T00:00:00.000Z'), durationSec: 120 },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/learning-time/daily?userId=${validUserId}&days=7`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual([
        { date: '2026-08-20T00:00:00.000Z', durationSec: 120 },
      ]);
      expect(mockGetDailyLearningTime.execute).toHaveBeenCalledWith({
        userId: validUserId,
        days: 7,
      });
    });

    it('should return 400 for invalid days', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/learning-time/daily?userId=${validUserId}&days=0`,
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
