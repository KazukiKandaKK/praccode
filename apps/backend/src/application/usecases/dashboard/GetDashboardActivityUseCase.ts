import { IDashboardRepository } from '../../../domain/ports/IDashboardRepository';

export class GetDashboardActivityUseCase {
  constructor(private readonly dashboardRepo: IDashboardRepository) {}

  async execute(userId: string) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 365);

    const [readingDates, writingDates] = await Promise.all([
      this.dashboardRepo.getReadingActivityDates(userId, startDate, endDate),
      this.dashboardRepo.getWritingActivityDates(userId, startDate, endDate),
    ]);

    const activityMap = new Map<string, number>();

    for (const date of readingDates) {
      const dateStr = date.toISOString().split('T')[0];
      activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
    }

    for (const date of writingDates) {
      const dateStr = date.toISOString().split('T')[0];
      activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
    }

    const activityData: Array<{ date: string; count: number }> = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      activityData.push({
        date: dateStr,
        count: activityMap.get(dateStr) || 0,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return { activity: activityData };
  }
}
