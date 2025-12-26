import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { exerciseController } from './exerciseController';
import { ListExercisesUseCase } from '../../application/usecases/ListExercisesUseCase';
import { GetExerciseByIdUseCase } from '../../application/usecases/GetExerciseByIdUseCase';

const mockListExercisesUseCase = {
  execute: vi.fn(),
} as unknown as Mocked<ListExercisesUseCase>;

const mockGetExerciseByIdUseCase = {
  execute: vi.fn(),
} as unknown as Mocked<GetExerciseByIdUseCase>;

describe('exerciseController', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      exerciseController(instance, mockListExercisesUseCase, mockGetExerciseByIdUseCase);
      done();
    });
    vi.clearAllMocks();
    await app.ready();
  });

  describe('GET /', () => {
    it('should call ListExercisesUseCase and return the result', async () => {
      mockListExercisesUseCase.execute.mockResolvedValue({ exercises: [], pagination: {} as any });
      const response = await app.inject({
        method: 'GET',
        url: '/?userId=d2d3b878-348c-4f70-9a57-7988351f5c69',
      });
      expect(response.statusCode).toBe(200);
      expect(mockListExercisesUseCase.execute).toHaveBeenCalled();
    });
  });

  describe('GET /:id', () => {
    it('should call GetExerciseByIdUseCase and return the result', async () => {
      mockGetExerciseByIdUseCase.execute.mockResolvedValue({} as any);
      const response = await app.inject({
        method: 'GET',
        url: '/123?userId=d2d3b878-348c-4f70-9a57-7988351f5c69',
      });
      expect(response.statusCode).toBe(200);
      expect(mockGetExerciseByIdUseCase.execute).toHaveBeenCalledWith({
        exerciseId: '123',
        userId: 'd2d3b878-348c-4f70-9a57-7988351f5c69',
      });
    });
  });
});
