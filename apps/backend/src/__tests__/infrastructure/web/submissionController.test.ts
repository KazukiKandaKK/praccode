import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { submissionController } from '@/infrastructure/web/submissionController';
import { ListSubmissionsUseCase } from '@/application/usecases/submissions/ListSubmissionsUseCase';
import { GetSubmissionUseCase } from '@/application/usecases/submissions/GetSubmissionUseCase';
import { UpdateSubmissionAnswersUseCase } from '@/application/usecases/submissions/UpdateSubmissionAnswersUseCase';
import { EvaluateSubmissionUseCase } from '@/application/usecases/submissions/EvaluateSubmissionUseCase';
import { IEvaluationEventPublisher } from '@/domain/ports/IEvaluationEventPublisher';
import { ApplicationError } from '@/application/errors/ApplicationError';

const validUserId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
const validSubmissionId = 'd2d3b878-348c-4f70-9a57-7988351f5c6a';

const mockListSubmissions = { execute: vi.fn() } as unknown as Mocked<ListSubmissionsUseCase>;
const mockGetSubmission = { execute: vi.fn() } as unknown as Mocked<GetSubmissionUseCase>;
const mockUpdateSubmissionAnswers = {
  execute: vi.fn(),
} as unknown as Mocked<UpdateSubmissionAnswersUseCase>;
const mockEvaluateSubmission = { execute: vi.fn() } as unknown as Mocked<EvaluateSubmissionUseCase>;
const mockEventPublisher = {
  emitEvaluationComplete: vi.fn(),
  emitEvaluationFailed: vi.fn(),
  onEvaluationEvent: vi.fn().mockReturnValue(vi.fn()),
} as unknown as Mocked<IEvaluationEventPublisher>;

const deps = {
  listSubmissions: mockListSubmissions,
  getSubmission: mockGetSubmission,
  updateSubmissionAnswers: mockUpdateSubmissionAnswers,
  evaluateSubmission: mockEvaluateSubmission,
  eventPublisher: mockEventPublisher,
};

describe('submissionController', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      submissionController(instance, deps);
      done();
    });
    vi.resetAllMocks();
    await app.ready();
  });

  describe('GET /submissions', () => {
    it('should list submissions for valid query', async () => {
      mockListSubmissions.execute.mockResolvedValue({
        submissions: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: `/?userId=${validUserId}&status=SUBMITTED&page=1&limit=20`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockListSubmissions.execute).toHaveBeenCalledWith({
        userId: validUserId,
        status: 'SUBMITTED',
        page: 1,
        limit: 20,
      });
    });

    it('should return 400 for invalid userId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/?userId=bad-id',
      });

      expect(response.statusCode).toBe(400);
      expect(mockListSubmissions.execute).not.toHaveBeenCalled();
    });
  });

  describe('GET /submissions/:id', () => {
    it('should get submission by valid id', async () => {
      mockGetSubmission.execute.mockResolvedValue({
        id: validSubmissionId,
        status: 'DRAFT',
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: `/${validSubmissionId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(mockGetSubmission.execute).toHaveBeenCalledWith(validSubmissionId);
    });

    it('should return 400 for invalid id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/not-uuid',
      });

      expect(response.statusCode).toBe(400);
      expect(mockGetSubmission.execute).not.toHaveBeenCalled();
    });
  });

  describe('PUT /submissions/:id/answers', () => {
    it('should update answers', async () => {
      mockUpdateSubmissionAnswers.execute.mockResolvedValue({ id: validSubmissionId } as any);

      const response = await app.inject({
        method: 'PUT',
        url: `/${validSubmissionId}/answers`,
        payload: {
          answers: [{ questionIndex: 0, answerText: 'answer' }],
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockUpdateSubmissionAnswers.execute).toHaveBeenCalledWith({
        submissionId: validSubmissionId,
        answers: [{ questionIndex: 0, answerText: 'answer' }],
      });
    });

    it('should return 400 for invalid answers payload', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/${validSubmissionId}/answers`,
        payload: { answers: 'not-an-array' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /submissions/:id/evaluate', () => {
    it('should trigger evaluation', async () => {
      mockEvaluateSubmission.execute.mockResolvedValue({
        submissionId: validSubmissionId,
        status: 'queued',
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: `/${validSubmissionId}/evaluate`,
      });

      expect(response.statusCode).toBe(202);
      expect(mockEvaluateSubmission.execute).toHaveBeenCalledWith(validSubmissionId);
    });

    it('should return ApplicationError status', async () => {
      mockEvaluateSubmission.execute.mockRejectedValue(new ApplicationError('Not found', 404));

      const response = await app.inject({
        method: 'POST',
        url: `/${validSubmissionId}/evaluate`,
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
