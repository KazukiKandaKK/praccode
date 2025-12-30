'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, MentorFeedbackRecord } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, ListChecks, Loader2, MessageSquareQuote } from 'lucide-react';
import { MentorWorkflowNav } from '@/components/mentor/mentor-workflow-nav';

type Props = {
  userId: string;
  userName?: string | null;
};

export function MentorFeedbackHistory({ userId, userName }: Props) {
  const [feedback, setFeedback] = useState<MentorFeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.getMentorFeedbackHistory(userId, 50);
        if (!cancelled) {
          setFeedback(result);
        }
      } catch (e) {
        if (e instanceof ApiError && e.statusCode === 404) {
          setFeedback([]);
        } else if (!cancelled) {
          setError('フィードバックの取得に失敗しました');
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

  const canGenerateNextPlan = !loading && feedback.length > 0 && !generatingPlan;

  const handleGenerateNextPlan = async () => {
    if (!canGenerateNextPlan) return;
    setPlanMessage(null);
    setPlanError(null);
    setGeneratingPlan(true);
    try {
      await api.generateNextLearningPlan({ userId });
      setPlanMessage('次の学習計画を作成しました');
    } catch (e) {
      if (e instanceof ApiError) {
        setPlanError(e.message || '次の学習計画の作成に失敗しました');
      } else {
        setPlanError('次の学習計画の作成に失敗しました');
      }
    } finally {
      setGeneratingPlan(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <ListChecks className="w-4 h-4 text-slate-300" />
          <span>AIメンター</span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">フィードバック履歴</h1>
            <p className="text-slate-400 max-w-2xl">
              {userName ?? 'あなた'} へのレビュー履歴を整理して確認できます。
            </p>
            {planError && <p className="text-sm text-rose-300">{planError}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            {generatingPlan && (
              <Badge variant="default" className="gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                次の学習計画を作成中...
              </Badge>
            )}
            {planMessage && <Badge variant="default">{planMessage}</Badge>}
            <Button onClick={handleGenerateNextPlan} disabled={!canGenerateNextPlan}>
              次の学習計画を作成
            </Button>
            {!loading && feedback.length === 0 && (
              <span className="text-xs text-slate-500">
                フィードバックが集まると作成できます
              </span>
            )}
          </div>
        </div>
      </header>
      <MentorWorkflowNav userId={userId} />

      <Card>
        <CardHeader>
          <CardTitle className="text-white text-lg">フィードバック一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : error ? (
            <p className="text-sm text-rose-300">{error}</p>
          ) : feedback.length === 0 ? (
            <p className="text-sm text-slate-400">フィードバックがありません。</p>
          ) : (
            <div className="space-y-4">
              {feedback.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="text-sm text-slate-400">
                        {formatDate(entry.createdAt)}
                      </div>
                      <div className="text-slate-100 font-semibold">{entry.feedback.overall}</div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                        <Badge variant="default">
                          Submission {entry.submissionId.slice(0, 8)}
                        </Badge>
                        {entry.modelId && (
                          <Badge variant="default">{entry.modelId}</Badge>
                        )}
                      </div>
                    </div>
                    <Link href={`/submissions/${entry.submissionId}`}>
                      <Button variant="outline" size="sm">
                        提出を見る
                        <ArrowUpRight className="w-4 h-4 ml-1" />
                      </Button>
                    </Link>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-slate-200 font-semibold">
                        <MessageSquareQuote className="w-4 h-4 text-slate-300" />
                        強み
                      </div>
                      <ul className="space-y-1 text-sm text-slate-300">
                        {entry.feedback.strengths.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm text-slate-200 font-semibold">改善ポイント</div>
                      <ul className="space-y-2 text-sm text-slate-300">
                        {entry.feedback.improvements.map((item, idx) => (
                          <li key={idx} className="space-y-1">
                            <div className="font-medium text-slate-100">{item.area}</div>
                            <div className="text-slate-300">{item.advice}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
