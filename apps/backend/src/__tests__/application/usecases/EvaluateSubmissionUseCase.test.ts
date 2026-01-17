import { describe, it, expect, vi } from 'vitest';
import { EvaluateSubmissionUseCase } from '@/application/usecases/submissions/EvaluateSubmissionUseCase';
import type { ISubmissionRepository, EvaluationTarget } from '@/domain/ports/ISubmissionRepository';
import type { IAnswerEvaluationService } from '@/domain/ports/IAnswerEvaluationService';
import type { IEvaluationEventPublisher } from '@/domain/ports/IEvaluationEventPublisher';
import type { ILearningAnalysisScheduler } from '@/domain/ports/ILearningAnalysisScheduler';
import type { IEvaluationMetricRepository } from '@/domain/ports/IEvaluationMetricRepository';
import type { IAutopilotOutboxRepository } from '@/domain/ports/IAutopilotOutboxRepository';

const createTarget = (): EvaluationTarget => ({
  id: 'submission-1',
  userId: 'user-1',
  status: 'DRAFT',
  answers: [
    { id: 'answer-1', questionIndex: 1, answerText: 'answer' },
  ],
  exercise: {
    code: 'console.log("test")',
    questions: [
      {
        questionIndex: 1,
        questionText: 'What does this do?',
        idealAnswerPoints: ['prints'],
      },
    ],
  },
});

describe('EvaluateSubmissionUseCase', () => {
  it('should enqueue autopilot outbox after evaluation completes', async () => {
    let currentStatus: EvaluationTarget['status'] = 'DRAFT';

    const submissions: Partial<ISubmissionRepository> = {
      getEvaluationTarget: vi.fn(async () => {
        const target = createTarget();
        return { ...target, status: currentStatus };
      }),
      markStatus: vi.fn(async (_id, status) => {
        currentStatus = status;
      }),
      updateAnswerEvaluation: vi.fn(async () => undefined),
    };

    const evaluationService: Partial<IAnswerEvaluationService> = {
      evaluate: vi.fn(async () => ({
        score: 4,
        level: 'B',
        feedback: 'ok',
        aspects: {},
      })),
    };

    const eventPublisher: Partial<IEvaluationEventPublisher> = {
      emitEvaluationComplete: vi.fn(),
      emitEvaluationFailed: vi.fn(),
      onEvaluationEvent: vi.fn(),
    };

    const scheduler: Partial<ILearningAnalysisScheduler> = {
      trigger: vi.fn(async () => undefined),
    };

    const metrics: Partial<IEvaluationMetricRepository> = {
      saveMetrics: vi.fn(async () => undefined),
    };

    const outbox: Partial<IAutopilotOutboxRepository> = {
      enqueue: vi.fn(async () => ({ id: 'outbox-1', dedupKey: 'SubmissionEvaluated:submission-1', enqueued: true })),
      leaseNextBatch: vi.fn(),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    };

    const logger = { info: vi.fn(), error: vi.fn() };

    const useCase = new EvaluateSubmissionUseCase(
      submissions as ISubmissionRepository,
      evaluationService as IAnswerEvaluationService,
      eventPublisher as IEvaluationEventPublisher,
      scheduler as ILearningAnalysisScheduler,
      metrics as IEvaluationMetricRepository,
      outbox as IAutopilotOutboxRepository,
      logger
    );

    await useCase.execute('submission-1');

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(outbox.enqueue).toHaveBeenCalledWith({
      type: 'SubmissionEvaluated',
      payloadJson: { userId: 'user-1', submissionId: 'submission-1' },
      dedupKey: 'SubmissionEvaluated:submission-1',
    });
  });
});
