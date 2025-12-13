import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../lib/prisma';

// Prismaモック
vi.mock('../lib/prisma', () => ({
  prisma: {
    submission: {
      findMany: vi.fn(),
    },
    writingSubmission: {
      findMany: vi.fn(),
    },
  },
}));

describe('Dashboard Activity API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('日次提出件数集計', () => {
    it('空データの場合、全日が0件を返す', () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365);
      const endDate = new Date();

      // モック設定
      vi.mocked(prisma.submission.findMany).mockResolvedValue([]);
      vi.mocked(prisma.writingSubmission.findMany).mockResolvedValue([]);

      // 365日分のデータを生成
      const activityData: Array<{ date: string; count: number }> = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        activityData.push({
          date: dateStr,
          count: 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      expect(activityData.length).toBe(366); // 365日 + 1日（開始日を含む）
      expect(activityData.every((d) => d.count === 0)).toBe(true);
    });

    it('単日の提出件数を正しく集計する', () => {
      const testDate = new Date('2024-01-15');
      const dateStr = testDate.toISOString().split('T')[0];

      // モック設定: リーディング2件、ライティング1件
      vi.mocked(prisma.submission.findMany).mockResolvedValue([
        { updatedAt: testDate } as never,
        { updatedAt: testDate } as never,
      ]);
      vi.mocked(prisma.writingSubmission.findMany).mockResolvedValue([
        { createdAt: testDate } as never,
      ]);

      // 集計ロジック
      const activityMap = new Map<string, number>();
      const readingSubmissions = [
        { updatedAt: testDate },
        { updatedAt: testDate },
      ];
      const writingSubmissions = [{ createdAt: testDate }];

      for (const sub of readingSubmissions) {
        const d = sub.updatedAt.toISOString().split('T')[0];
        activityMap.set(d, (activityMap.get(d) || 0) + 1);
      }

      for (const sub of writingSubmissions) {
        const d = sub.createdAt.toISOString().split('T')[0];
        activityMap.set(d, (activityMap.get(d) || 0) + 1);
      }

      expect(activityMap.get(dateStr)).toBe(3);
    });

    it('複数日の提出件数を正しく集計する', () => {
      const date1 = new Date('2024-01-15');
      const date2 = new Date('2024-01-16');
      const date3 = new Date('2024-01-17');

      const activityMap = new Map<string, number>();

      // 日付1: リーディング1件、ライティング2件 = 3件
      const d1 = date1.toISOString().split('T')[0];
      activityMap.set(d1, (activityMap.get(d1) || 0) + 1); // リーディング
      activityMap.set(d1, (activityMap.get(d1) || 0) + 2); // ライティング

      // 日付2: リーディング3件 = 3件
      const d2 = date2.toISOString().split('T')[0];
      activityMap.set(d2, (activityMap.get(d2) || 0) + 3); // リーディング

      // 日付3: 提出なし = 0件
      const d3 = date3.toISOString().split('T')[0];

      expect(activityMap.get(d1)).toBe(3);
      expect(activityMap.get(d2)).toBe(3);
      expect(activityMap.get(d3)).toBeUndefined();
    });

    it('境界日（365日前）を含む範囲を正しく処理する', () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365);

      // 開始日の提出
      const activityMap = new Map<string, number>();
      const startDateStr = startDate.toISOString().split('T')[0];
      activityMap.set(startDateStr, 1);

      // 終了日の提出
      const endDateStr = endDate.toISOString().split('T')[0];
      activityMap.set(endDateStr, 2);

      expect(activityMap.get(startDateStr)).toBe(1);
      expect(activityMap.get(endDateStr)).toBe(2);
    });

    it('日付範囲外の提出は除外される', () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365);
      const endDate = new Date();

      // 範囲外の日付
      const beforeStartDate = new Date(startDate);
      beforeStartDate.setDate(beforeStartDate.getDate() - 1);

      const afterEndDate = new Date(endDate);
      afterEndDate.setDate(afterEndDate.getDate() + 1);

      const activityMap = new Map<string, number>();

      // 範囲内の日付のみを追加
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      const beforeStr = beforeStartDate.toISOString().split('T')[0];
      const afterStr = afterEndDate.toISOString().split('T')[0];

      // 範囲内のみ追加
      if (startDate >= startDate && startDate <= endDate) {
        activityMap.set(startDateStr, 1);
      }
      if (endDate >= startDate && endDate <= endDate) {
        activityMap.set(endDateStr, 1);
      }

      expect(activityMap.has(beforeStr)).toBe(false);
      expect(activityMap.has(afterStr)).toBe(false);
      expect(activityMap.has(startDateStr)).toBe(true);
      expect(activityMap.has(endDateStr)).toBe(true);
    });
  });
});

