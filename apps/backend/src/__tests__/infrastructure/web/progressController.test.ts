import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { progressController } from '@/infrastructure/web/progressController';
import { GetUserProgressUseCase } from '@/application/usecases/GetUserProgressUseCase';

const mockGetUserProgressUseCase = {
  execute: vi.fn(),
} as unknown as Mocked<GetUserProgressUseCase>;

describe('progressController', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      progressController(instance, mockGetUserProgressUseCase);
      done();
    });
    vi.clearAllMocks();
    await app.ready();
  });

  describe('GET /progress', () => {
    it('should call the use case and return progress', async () => {
      const progressData = { totalExercises: 10, completedExercises: 1 };
      mockGetUserProgressUseCase.execute.mockResolvedValue(progressData as any);

      const response = await app.inject({
        method: 'GET',
        url: '/progress?userId=d2d3b878-348c-4f70-9a57-7988351f5c69',
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual(progressData);
      expect(mockGetUserProgressUseCase.execute).toHaveBeenCalledWith(
        'd2d3b878-348c-4f70-9a57-7988351f5c69'
      );
    });

    it('should return 400 if userId is invalid', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/progress?userId=invalid',
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
