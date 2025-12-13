'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface ActivityData {
  date: string;
  count: number;
}

interface DashboardActivityHeatmapProps {
  activity: ActivityData[];
}

// GitHub風のカラースケール（5段階）
const getColorClass = (count: number): string => {
  if (count === 0) return 'bg-slate-800';
  if (count === 1) return 'bg-emerald-500/20';
  if (count >= 2 && count <= 3) return 'bg-emerald-500/40';
  if (count >= 4 && count <= 6) return 'bg-emerald-500/60';
  return 'bg-emerald-500/80';
};

// 日付をフォーマット
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export function DashboardActivityHeatmap({ activity }: DashboardActivityHeatmapProps) {
  // 週ごとにグループ化（GitHub風のレイアウト）
  const weeks = useMemo(() => {
    const weeksData: Array<Array<ActivityData | null>> = [];
    let currentWeek: Array<ActivityData | null> = [];

    // 最初の日が週の何日目かを計算（日曜日=0）
    const firstDate = new Date(activity[0]?.date || new Date());
    const firstDayOfWeek = firstDate.getDay();

    // 週の最初の日までnullで埋める
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }

    // 各日を週に追加
    for (const day of activity) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weeksData.push(currentWeek);
        currentWeek = [];
      }
    }

    // 最後の週が7日未満の場合はnullで埋める
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeksData.push(currentWeek);
    }

    return weeksData;
  }, [activity]);


  // 最大件数を計算（ツールチップ用）
  const maxCount = useMemo(() => {
    return Math.max(...activity.map((a) => a.count), 0);
  }, [activity]);

  // 曜日ラベル（日曜日から）
  const dayLabels = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>学習アクティビティ</CardTitle>
        <p className="text-sm text-slate-400 mt-1">
          過去1年間のリーディング・ライティング提出回数
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex gap-1 items-start">
            {/* 曜日ラベル */}
            <div className="flex flex-col gap-1 pt-6">
              {dayLabels.map((day, idx) => (
                <div key={idx} className="text-xs text-slate-400 h-3 leading-3 text-center w-3">
                  {idx % 2 === 0 ? day : ''}
                </div>
              ))}
            </div>

            {/* 月のラベルとカレンダーグリッド */}
            <div className="flex gap-1">
              {weeks.map((week, weekIndex) => {
                // この週の最初の日が含まれる月を取得
                const firstDay = week.find((day) => day !== null);
                const weekMonth =
                  firstDay &&
                  new Date(firstDay.date).toLocaleDateString('ja-JP', { month: 'short' });
                const prevWeekMonth =
                  weekIndex > 0 &&
                  weeks[weekIndex - 1].find((day) => day !== null) &&
                  new Date(
                    weeks[weekIndex - 1].find((day) => day !== null)!.date
                  ).toLocaleDateString('ja-JP', { month: 'short' });
                const showMonth = weekMonth && weekMonth !== prevWeekMonth;

                return (
                  <div key={weekIndex} className="flex flex-col gap-1">
                    {/* 月のラベル */}
                    {showMonth && (
                      <div className="text-xs text-slate-400 h-3 leading-3 text-center">
                        {weekMonth}
                      </div>
                    )}
                    {!showMonth && <div className="h-3" />}

                    {/* 週の各日 */}
                    {week.map((day, dayIndex) => {
                      if (day === null) {
                        return <div key={dayIndex} className="w-3 h-3" />;
                      }

                      return (
                        <div
                          key={dayIndex}
                          className={`w-3 h-3 rounded-sm ${getColorClass(day.count)} hover:ring-2 hover:ring-emerald-400 cursor-pointer transition-all`}
                          title={`${formatDate(day.date)}: ${day.count}件の提出`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 凡例 */}
          <div className="flex items-center gap-4 mt-4 text-xs text-slate-400">
            <span>少ない</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-slate-800" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/20" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/40" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
              <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
            </div>
            <span>多い</span>
            {maxCount > 0 && (
              <span className="ml-auto text-slate-500">
                最大: {maxCount}件/日
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

