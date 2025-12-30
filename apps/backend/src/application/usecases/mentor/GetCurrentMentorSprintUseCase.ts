import type { IMentorSprintRepository } from '@/domain/ports/IMentorSprintRepository';

export class GetCurrentMentorSprintUseCase {
  constructor(private readonly mentorSprintRepository: IMentorSprintRepository) {}

  async execute(userId: string) {
    if (!userId) {
      throw new Error('userId is required');
    }
    return this.mentorSprintRepository.getCurrent(userId);
  }
}
