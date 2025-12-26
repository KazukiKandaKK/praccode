import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { hintController } from './hintController';
import { GenerateHintUseCase } from '../../application/usecases/GenerateHintUseCase';
import { ApplicationError } from '../../application/errors/ApplicationError';

// Mock the use case
const mockGenerateHintUseCase = {
  execute: vi.fn(),
} as unknown as GenerateHintUseCase;

describe('hintController', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(() => {
    app = Fastify();
    // Register the controller with the mocked use case
    app.register((instance, opts, done) => {
      hintController(instance, mockGenerateHintUseCase);
      done();
    });
    vi.clearAllMocks();
  });

  it('should call the use case and return a hint on success', async () => {
    mockGenerateHintUseCase.execute.mockResolvedValue('This is a great hint!');

    const response = await app.inject({
      method: 'POST',
      url: '/hints',
      payload: {
        exerciseId: 'd2d3b878-348c-4f70-9a57-7988351f5c69',
        questionIndex: 0,
        userId: 'user-123',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ hint: 'This is a great hint!' });
    expect(mockGenerateHintUseCase.execute).toHaveBeenCalledWith({
      exerciseId: 'd2d3b878-348c-4f70-9a57-7988351f5c69',
      questionIndex: 0,
      userId: 'user-123',
    });
  });

  it('should return a 404 if the use case throws a not found error', async () => {
    mockGenerateHintUseCase.execute.mockRejectedValue(new ApplicationError('Not Found', 404));

    const response = await app.inject({
      method: 'POST',
      url: '/hints',
      payload: {
        exerciseId: 'd2d3b878-348c-4f70-9a57-7988351f5c69',
        questionIndex: 0,
        userId: 'user-123',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return a 400 for an invalid request body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/hints',
      payload: { exerciseId: 'not-a-uuid' },
    });

    expect(response.statusCode).toBe(400);
    expect(mockGenerateHintUseCase.execute).not.toHaveBeenCalled();
  });
});
