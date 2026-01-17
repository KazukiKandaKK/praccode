import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { autopilotController } from '@/infrastructure/web/autopilotController';
import { EnqueueAutopilotTriggerUseCase } from '@/application/usecases/autopilot/EnqueueAutopilotTriggerUseCase';
import { ListAutopilotRunsUseCase } from '@/application/usecases/autopilot/ListAutopilotRunsUseCase';
import { GetAutopilotRunUseCase } from '@/application/usecases/autopilot/GetAutopilotRunUseCase';
import { ApplicationError } from '@/application/errors/ApplicationError';

const mockEnqueue = {
  execute: vi.fn(),
} as unknown as Mocked<EnqueueAutopilotTriggerUseCase>;

const mockListRuns = {
  execute: vi.fn(),
} as unknown as Mocked<ListAutopilotRunsUseCase>;

const mockGetRun = {
  execute: vi.fn(),
} as unknown as Mocked<GetAutopilotRunUseCase>;

describe('autopilotController', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      autopilotController(instance, {
        enqueueTrigger: mockEnqueue,
        listRuns: mockListRuns,
        getRun: mockGetRun,
      });
      done();
    });
    vi.clearAllMocks();
    await app.ready();
  });

  it('should enqueue autopilot trigger', async () => {
    mockEnqueue.execute.mockResolvedValue({ dedupKey: 'SubmissionEvaluated:sub-1' });

    const response = await app.inject({
      method: 'POST',
      url: '/autopilot/trigger',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
      payload: { triggerType: 'submission_evaluated', submissionId: '7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ dedupKey: 'SubmissionEvaluated:sub-1' });
  });

  it('should return 404 when accessing another user run', async () => {
    mockGetRun.execute.mockRejectedValue(new ApplicationError('Autopilot run not found', 404));

    const response = await app.inject({
      method: 'GET',
      url: '/autopilot/runs/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(404);
  });
});
