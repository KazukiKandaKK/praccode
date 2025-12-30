import { ILearningTimeRepository } from '../../../domain/ports/ILearningTimeRepository';

interface GetDailyLearningTimeInput {
  userId: string;
  days?: number;
}

export class GetDailyLearningTimeUseCase {
  constructor(private readonly learningTimeRepo: ILearningTimeRepository) {}

  async execute(input: GetDailyLearningTimeInput) {
    const days = input.days ?? 14;
    return this.learningTimeRepo.getDailyTotals(input.userId, days);
  }
}
