import type { ILearningPlanRepository } from '@/domain/ports/ILearningPlanRepository';

export class ListLearningPlansUseCase {
  constructor(private readonly learningPlanRepository: ILearningPlanRepository) {}

  async execute(userId: string, limit = 20) {
    return this.learningPlanRepository.listByUser(userId, limit);
  }
}
