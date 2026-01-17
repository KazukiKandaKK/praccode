import type { IAutopilotOutboxRepository } from '@/domain/ports/IAutopilotOutboxRepository';

export class EnqueueAutopilotTriggerUseCase {
  constructor(private readonly outbox: IAutopilotOutboxRepository) {}

  async execute(params: {
    userId: string;
    triggerType: 'submission_evaluated';
    submissionId: string;
  }): Promise<{ dedupKey: string }> {
    const dedupKey = `SubmissionEvaluated:${params.submissionId}`;
    await this.outbox.enqueue({
      type: 'SubmissionEvaluated',
      payloadJson: { userId: params.userId, submissionId: params.submissionId },
      dedupKey,
    });
    return { dedupKey };
  }
}
