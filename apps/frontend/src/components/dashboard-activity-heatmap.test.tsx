import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardActivityHeatmap } from './dashboard-activity-heatmap';

describe('DashboardActivityHeatmap', () => {
  describe('カラースケール', () => {
    it('0件の場合、slate-800を返す', () => {
      const activity = [
        { date: '2024-01-01', count: 0 },
        { date: '2024-01-02', count: 0 },
      ];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const cells = container.querySelectorAll('.bg-slate-800');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('1件の場合、emerald-500/20を返す', () => {
      const activity = [{ date: '2024-01-01', count: 1 }];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const cells = container.querySelectorAll('.bg-emerald-500\\/20');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('2-3件の場合、emerald-500/40を返す', () => {
      const activity = [
        { date: '2024-01-01', count: 2 },
        { date: '2024-01-02', count: 3 },
      ];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const cells = container.querySelectorAll('.bg-emerald-500\\/40');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('4-6件の場合、emerald-500/60を返す', () => {
      const activity = [
        { date: '2024-01-01', count: 4 },
        { date: '2024-01-02', count: 5 },
        { date: '2024-01-03', count: 6 },
      ];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const cells = container.querySelectorAll('.bg-emerald-500\\/60');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('7件以上の場合、emerald-500/80を返す', () => {
      const activity = [
        { date: '2024-01-01', count: 7 },
        { date: '2024-01-02', count: 10 },
        { date: '2024-01-03', count: 20 },
      ];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const cells = container.querySelectorAll('.bg-emerald-500\\/80');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  describe('ツールチップ表示', () => {
    it('各セルに日付と件数のツールチップが表示される', () => {
      const activity = [
        { date: '2024-01-15', count: 3 },
        { date: '2024-01-16', count: 5 },
      ];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const cells = container.querySelectorAll('[title]');

      // ツールチップが存在することを確認
      expect(cells.length).toBeGreaterThan(0);

      // ツールチップの内容を確認
      const firstCell = cells[0] as HTMLElement;
      expect(firstCell.getAttribute('title')).toContain('2024年');
      expect(firstCell.getAttribute('title')).toContain('件の提出');
    });

    it('件数0の場合もツールチップが表示される', () => {
      const activity = [{ date: '2024-01-01', count: 0 }];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const cells = container.querySelectorAll('[title*="0件の提出"]');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  describe('境界値テスト', () => {
    it('空配列の場合、エラーなくレンダリングされる', () => {
      const { container } = render(<DashboardActivityHeatmap activity={[]} />);
      expect(container).toBeTruthy();
    });

    it('365日分のデータを正しく表示する', () => {
      const activity = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365);

      for (let i = 0; i < 366; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        activity.push({
          date: date.toISOString().split('T')[0],
          count: Math.floor(Math.random() * 10),
        });
      }

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      expect(container).toBeTruthy();
    });

    it('最大件数が正しく計算される', () => {
      const activity = [
        { date: '2024-01-01', count: 1 },
        { date: '2024-01-02', count: 5 },
        { date: '2024-01-03', count: 10 },
        { date: '2024-01-04', count: 3 },
      ];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const maxCountText = container.textContent;
      expect(maxCountText).toContain('最大: 10件/日');
    });

    it('全て0件の場合、最大件数が表示されない', () => {
      const activity = [
        { date: '2024-01-01', count: 0 },
        { date: '2024-01-02', count: 0 },
      ];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const maxCountText = container.textContent;
      expect(maxCountText).not.toContain('最大:');
    });
  });

  describe('レイアウト', () => {
    it('タイトルと説明が表示される', () => {
      const activity = [{ date: '2024-01-01', count: 1 }];

      render(<DashboardActivityHeatmap activity={activity} />);

      expect(screen.getByText('学習アクティビティ')).toBeTruthy();
      expect(screen.getByText(/過去1年間のリーディング・ライティング提出回数/)).toBeTruthy();
    });

    it('凡例が表示される', () => {
      const activity = [{ date: '2024-01-01', count: 1 }];

      const { container } = render(<DashboardActivityHeatmap activity={activity} />);
      const legendText = container.textContent;
      expect(legendText).toContain('少ない');
      expect(legendText).toContain('多い');
    });
  });
});

