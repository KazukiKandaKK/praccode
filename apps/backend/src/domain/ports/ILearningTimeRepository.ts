export interface LearningTimeLogInput {
  userId: string;
  durationSec: number;
  source: string;
  startedAt?: Date;
  endedAt?: Date;
}

export interface LearningTimeDailyTotal {
  date: Date;
  durationSec: number;
}

export interface ILearningTimeRepository {
  logSession(data: LearningTimeLogInput): Promise<void>;
  getDailyTotals(userId: string, days: number): Promise<LearningTimeDailyTotal[]>;
}
