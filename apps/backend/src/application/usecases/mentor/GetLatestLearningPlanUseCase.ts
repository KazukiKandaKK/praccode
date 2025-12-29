import type { ILearningPlanRepository } from '@/domain/ports/ILearningPlanRepository';

export class GetLatestLearningPlanUseCase {
  constructor(private readonly learningPlanRepository: ILearningPlanRepository) {}

  async execute(userId: string) {
    return this.learningPlanRepository.getLatestByUser(userId);
  }
}
