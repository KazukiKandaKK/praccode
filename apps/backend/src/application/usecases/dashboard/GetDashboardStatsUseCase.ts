import { IDashboardRepository } from '../../../domain/ports/IDashboardRepository';
import { ILearningTimeRepository } from '../../../domain/ports/ILearningTimeRepository';

export class GetDashboardStatsUseCase {
  constructor(
    private readonly dashboardRepo: IDashboardRepository,
    private readonly learningTimeRepo?: ILearningTimeRepository
  ) {}

  async execute(userId: string) {
    const [readingSubmissions, writingSubmissions, learningTimeDaily] = await Promise.all([
      this.dashboardRepo.getReadingSubmissions(userId),
      this.dashboardRepo.getWritingSubmissions(userId),
      this.learningTimeRepo?.getDailyTotals(userId, 14) ?? Promise.resolve([]),
    ]);

    const totalReadingSubmissions = readingSubmissions.length;
    const completedWritingSubmissions = writingSubmissions.filter((s) => s.status === 'COMPLETED');
    const totalWritingSubmissions = completedWritingSubmissions.length;

    let avgReadingScore = 0;
    let totalScore = 0;
    let scoreCount = 0;

    for (const sub of readingSubmissions) {
      for (const ans of sub.answers) {
        if (ans.score !== null) {
          totalScore += ans.score;
          scoreCount++;
        }
      }
    }

    if (scoreCount > 0) {
      avgReadingScore = Math.round(totalScore / scoreCount);
    }

    const writingPassedCount = completedWritingSubmissions.filter((s) => s.passed === true).length;
    const writingPassRate =
      totalWritingSubmissions > 0
        ? Math.round((writingPassedCount / totalWritingSubmissions) * 100)
        : 0;

    const aspectScores: Record<string, { total: number; count: number }> = {};
    for (const sub of readingSubmissions) {
      for (const ans of sub.answers) {
        if (ans.aspects && typeof ans.aspects === 'object') {
          for (const [aspect, score] of Object.entries(ans.aspects)) {
            if (!aspectScores[aspect]) {
              aspectScores[aspect] = { total: 0, count: 0 };
            }
            aspectScores[aspect].total += score;
            aspectScores[aspect].count++;
          }
        }
      }
    }

    const aspectAverages: Record<string, number> = {};
    for (const [aspect, data] of Object.entries(aspectScores)) {
      aspectAverages[aspect] = Math.round(data.total / data.count);
    }

    const recentReading = readingSubmissions.slice(0, 5).map((s) => ({
      type: 'reading' as const,
      id: s.id,
      title: s.exercise.title,
      language: s.exercise.language,
      score:
        s.answers.length > 0
          ? Math.round(
              s.answers.reduce((sum, a) => sum + (a.score || 0), 0) / Math.max(s.answers.length, 1)
            )
          : null,
      passed: null,
      date: s.updatedAt,
    }));

    const recentWriting = completedWritingSubmissions.slice(0, 5).map((s) => ({
      type: 'writing' as const,
      id: s.id,
      title: s.challenge.title,
      language: s.challenge.language,
      score: null,
      passed: s.passed,
      date: s.createdAt,
    }));

    const recentActivity = [...recentReading, ...recentWriting]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const thisWeekReadingCount = readingSubmissions.filter(
      (s) => new Date(s.updatedAt) >= oneWeekAgo
    ).length;
    const thisWeekWritingCount = writingSubmissions.filter(
      (s) => new Date(s.createdAt) >= oneWeekAgo
    ).length;
    const weeklyLearningTimeSec = learningTimeDaily
      .slice(-7)
      .reduce((sum, entry) => sum + entry.durationSec, 0);

    return {
      totalReadingSubmissions,
      totalWritingSubmissions,
      avgReadingScore,
      writingPassRate,
      aspectAverages,
      recentActivity,
      thisWeekCount: thisWeekReadingCount + thisWeekWritingCount,
      weeklyLearningTimeSec,
      learningTimeDaily: learningTimeDaily.map((entry) => ({
        date: entry.date.toISOString(),
        durationSec: entry.durationSec,
      })),
    };
  }
}
