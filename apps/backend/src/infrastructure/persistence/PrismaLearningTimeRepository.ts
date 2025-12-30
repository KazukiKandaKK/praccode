import { prisma } from '../../lib/prisma';
import {
  ILearningTimeRepository,
  LearningTimeDailyTotal,
  LearningTimeLogInput,
} from '../../domain/ports/ILearningTimeRepository';

export class PrismaLearningTimeRepository implements ILearningTimeRepository {
  async logSession(data: LearningTimeLogInput): Promise<void> {
    const durationSec = Math.max(0, Math.floor(data.durationSec));
    if (!durationSec) return;

    const startedAt = data.startedAt ?? new Date();
    const endedAt =
      data.endedAt ?? new Date(startedAt.getTime() + durationSec * 1000);

    await prisma.learningTimeLog.create({
      data: {
        userId: data.userId,
        source: data.source,
        durationSec,
        startedAt,
        endedAt,
      },
    });
  }

  async getDailyTotals(userId: string, days: number): Promise<LearningTimeDailyTotal[]> {
    const limitDays = Math.max(1, Math.min(days, 60));
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startDate = new Date(startOfToday);
    startDate.setDate(startOfToday.getDate() - (limitDays - 1));

    const logs = await prisma.learningTimeLog.findMany({
      where: {
        userId,
        startedAt: {
          gte: startDate,
        },
      },
      select: {
        durationSec: true,
        startedAt: true,
      },
    });

    const totals = new Map<string, number>();
    for (const log of logs) {
      const key = log.startedAt.toISOString().slice(0, 10);
      totals.set(key, (totals.get(key) ?? 0) + log.durationSec);
    }

    const results: LearningTimeDailyTotal[] = [];
    for (let i = 0; i < limitDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const key = date.toISOString().slice(0, 10);
      results.push({
        date,
        durationSec: totals.get(key) ?? 0,
      });
    }

    return results;
  }
}
