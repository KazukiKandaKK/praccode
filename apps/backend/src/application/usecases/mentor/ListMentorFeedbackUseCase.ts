import type { IMentorFeedbackRepository } from '@/domain/ports/IMentorFeedbackRepository';

export class ListMentorFeedbackUseCase {
  constructor(private readonly mentorFeedbackRepository: IMentorFeedbackRepository) {}

  async execute(userId: string, limit = 20) {
    return this.mentorFeedbackRepository.listByUser(userId, limit);
  }
}
