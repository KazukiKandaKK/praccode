'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, LearningPlanRecord } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarCheck, ChevronDown, ChevronUp, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MentorWorkflowNav } from '@/components/mentor/mentor-workflow-nav';

type Props = {
  userId: string;
  userName?: string | null;
};

export function MentorPlanHistory({ userId, userName }: Props) {
  const [plans, setPlans] = useState<LearningPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getLearningPlanHistory(userId, 50);
        if (!cancelled) {
          setPlans(result);
        }
      } catch (e) {
        if (e instanceof ApiError && e.statusCode === 404) {
          setPlans([]);
        } else if (!cancelled) {
          setError('履歴の取得に失敗しました');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const summaryStats = useMemo(() => {
    if (plans.length === 0) return null;
    const languages = new Set(plans.map((p) => p.targetLanguage).filter(Boolean));
    return {
      count: plans.length,
      languages: Array.from(languages).slice(0, 3),
    };
  }, [plans]);

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <History className="w-4 h-4 text-slate-300" />
          <span>AIメンター</span>
        </div>
        <h1 className="text-3xl font-bold text-white">学習計画の履歴</h1>
        <p className="text-slate-400 max-w-2xl">
          {userName ?? 'あなた'} の過去の学習計画を振り返り、成果を確認できます。
        </p>
        {summaryStats && (
          <div className="flex flex-wrap gap-2 text-xs text-slate-400">
            <Badge variant="default">合計 {summaryStats.count} 件</Badge>
            {summaryStats.languages.map((lang) => (
              <Badge key={lang} variant="default">
                {lang}
              </Badge>
            ))}
          </div>
        )}
      </header>
      <MentorWorkflowNav userId={userId} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-lg">履歴一覧</CardTitle>
            <Link href="/mentor/plan">
              <Button variant="outline" size="sm">
                新しい計画を作成
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-slate-400">履歴がありません。</p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => {
                const isExpanded = expandedId === plan.id;
                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="text-sm text-slate-400">
                          {formatDate(plan.createdAt)}
                        </div>
                        <div className="text-slate-100 font-semibold">{plan.plan.summary}</div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                          {plan.targetLanguage && (
                            <Badge variant="default">{plan.targetLanguage}</Badge>
                          )}
                          {plan.modelId && <Badge variant="default">{plan.modelId}</Badge>}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                      >
                        {isExpanded ? (
                          <>
                            閉じる <ChevronUp className="w-4 h-4 ml-1" />
                          </>
                        ) : (
                          <>
                            詳細 <ChevronDown className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </Button>
                    </div>

                    {isExpanded && <PlanDetail plan={plan} />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanDetail({ plan }: { plan: LearningPlanRecord }) {
  return (
    <div className="grid md:grid-cols-2 gap-4 border-t border-slate-800 pt-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <CalendarCheck className="w-4 h-4 text-slate-300" />
          週ごとのテーマ
        </div>
        <ul className="space-y-2 text-sm text-slate-300">
          {plan.plan.weeklyPlan.map((week, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
              <span>{week.title}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-slate-200 font-semibold">フォーカス</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {plan.plan.focusAreas.map((area, idx) => (
              <Badge key={idx} variant="secondary" className="bg-slate-800 text-slate-100">
                {area}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <div className="text-slate-200 font-semibold">即席テスト</div>
          <div className="mt-2 space-y-1 text-sm text-slate-300">
            {plan.plan.quickTests.map((test, idx) => (
              <div key={idx} className={cn('rounded-lg bg-slate-900/60 p-2')}>
                {test.name}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-slate-200 font-semibold">チェックポイント</div>
          <div className="mt-2 space-y-1 text-sm text-slate-300">
            {plan.plan.checkpoints.map((cp, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span>{cp.metric}</span>
                <span className="text-xs text-slate-400">{cp.when}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: string | number | Date) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
