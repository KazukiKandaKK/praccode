import { ILearningTimeRepository } from '../../../domain/ports/ILearningTimeRepository';

interface LogLearningTimeInput {
  userId: string;
  durationSec: number;
  source: string;
  startedAt?: Date | string;
  endedAt?: Date | string;
}

export class LogLearningTimeUseCase {
  constructor(private readonly learningTimeRepo: ILearningTimeRepository) {}

  async execute(input: LogLearningTimeInput): Promise<void> {
    const durationSec = Math.max(0, Math.floor(input.durationSec));

    if (!input.userId) {
      throw new Error('userId is required');
    }

    if (!input.source) {
      throw new Error('source is required');
    }

    if (durationSec <= 0) {
      // Skip logging extremely short or invalid sessions
      return;
    }

    const startedAt = input.startedAt ? new Date(input.startedAt) : undefined;
    const endedAt = input.endedAt ? new Date(input.endedAt) : undefined;

    await this.learningTimeRepo.logSession({
      userId: input.userId,
      durationSec,
      source: input.source,
      startedAt,
      endedAt,
    });
  }
}
