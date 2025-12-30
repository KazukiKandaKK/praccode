import type { IMentorWorkflowRepository } from '@/domain/ports/IMentorWorkflowRepository';

export class GetMentorWorkflowStepUseCase {
  constructor(private readonly mentorWorkflowRepository: IMentorWorkflowRepository) {}

  async execute(userId: string) {
    if (!userId) {
      throw new Error('userId is required');
    }
    return this.mentorWorkflowRepository.getByUser(userId);
  }
}
