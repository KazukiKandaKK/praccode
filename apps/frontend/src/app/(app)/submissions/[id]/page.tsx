'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CodeViewer } from '@/components/code-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getScoreLevelColor, getScoreLevelBgColor, getLearningGoalLabel } from '@/lib/utils';
import { ChevronLeft, Trophy, Target, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';

type ScoreLevel = 'A' | 'B' | 'C' | 'D';
type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'EVALUATED';

interface SubmissionDto {
  id: string;
  exerciseId: string;
  status: SubmissionStatus;
  exercise: {
    title: string;
    code: string;
    language: string;
    questions: Array<{
      questionIndex: number;
      questionText: string;
    }>;
  };
  answers: Array<{
    questionIndex: number;
    answerText: string;
    score: number | null;
    level: ScoreLevel | null;
    llmFeedback: string | null;
    aspects: Record<string, number> | null;
  }>;
}

export default function SubmissionResultPage() {
  const params = useParams();
  const submissionId = params.id as string;
  const [submission, setSubmission] = useState<SubmissionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // サブミッションデータを取得
  const fetchSubmission = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/submissions/${submissionId}`, { cache: 'no-store' });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`取得に失敗しました: ${res.status} ${t}`);
      }
      const data = (await res.json()) as SubmissionDto;
      setSubmission(data);
      setError(null);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : '取得に失敗しました');
      return null;
    }
  }, [apiUrl, submissionId]);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    const init = async () => {
      // 初回データ取得
      const data = await fetchSubmission();
      if (cancelled) return;

      if (!data) {
        setLoading(false);
        return;
      }

      // 既に評価済みの場合はローディング解除
      if (data.status === 'EVALUATED') {
        setLoading(false);
        return;
      }

      // 評価中の場合はSSE接続
      setLoading(true);

      eventSource = new EventSource(`${apiUrl}/submissions/${submissionId}/events`);

      eventSource.addEventListener('evaluated', async () => {
        if (cancelled) return;
        // 評価完了イベントを受信したらデータを再取得
        const updated = await fetchSubmission();
        if (updated && updated.status === 'EVALUATED') {
          setLoading(false);
        }
        eventSource?.close();
      });

      eventSource.addEventListener('failed', async () => {
        if (cancelled) return;
        // 評価失敗でもデータを再取得
        await fetchSubmission();
        setLoading(false);
        eventSource?.close();
      });

      eventSource.addEventListener('timeout', () => {
        if (cancelled) return;
        setError('評価がタイムアウトしました。リロードしてください。');
        setLoading(false);
        eventSource?.close();
      });

      eventSource.onerror = () => {
        if (cancelled) return;
        // SSE接続エラー時はフォールバックとしてポーリング
        console.warn('SSE connection error, falling back to polling');
        eventSource?.close();

        // ポーリングにフォールバック
        pollInterval = setInterval(async () => {
          const polledData = await fetchSubmission();
          if (polledData?.status === 'EVALUATED') {
            if (pollInterval) clearInterval(pollInterval);
            setLoading(false);
          }
        }, 2000);

        // 30秒でポーリングを打ち切り
        setTimeout(() => {
          if (pollInterval) clearInterval(pollInterval);
        }, 30000);
      };
    };

    init();

    return () => {
      cancelled = true;
      eventSource?.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [submissionId, apiUrl, fetchSubmission]);

  // Mobile top bar offset (sidebar layout)
  // On md+ there's no top bar; on mobile, the menu bar is fixed (h-14)
  const topOffsetClass = 'pt-14 md:pt-0';

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${topOffsetClass}`}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
          <p className="text-slate-400 mt-4">LLMが評価中です…（数十秒かかる場合があります）</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${topOffsetClass}`}>
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link
            href="/exercises"
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
          >
            <ChevronLeft className="w-4 h-4" />
            学習一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${topOffsetClass}`}>
        <p className="text-slate-400">結果が見つかりません</p>
      </div>
    );
  }

  const evaluatedAnswers = submission.answers.filter(
    (a) => typeof a.score === 'number' && a.level && a.llmFeedback
  ) as Array<{
    questionIndex: number;
    answerText: string;
    score: number;
    level: ScoreLevel;
    llmFeedback: string;
    aspects: Record<string, number> | null;
  }>;

  // Calculate overall stats
  const overallScore =
    evaluatedAnswers.length > 0
      ? Math.round(evaluatedAnswers.reduce((sum, a) => sum + a.score, 0) / evaluatedAnswers.length)
      : 0;
  const overallLevel =
    overallScore >= 90 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 50 ? 'C' : 'D';

  // Aggregate aspect scores
  const aspectTotals: Record<string, { total: number; count: number }> = {};
  evaluatedAnswers.forEach((a) => {
    if (a.aspects) {
      Object.entries(a.aspects).forEach(([key, value]) => {
        if (!aspectTotals[key]) {
          aspectTotals[key] = { total: 0, count: 0 };
        }
        aspectTotals[key].total += value;
        aspectTotals[key].count += 1;
      });
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Link
        href="/exercises"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        学習一覧に戻る
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">{submission.exercise.title}</h1>
        <p className="text-slate-400">評価結果</p>
      </div>

      {/* Overall Score Card */}
      <Card className="mb-8 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-500/20 to-violet-500/20 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Score */}
            <div className="flex items-center gap-6">
              <div
                className={`w-24 h-24 rounded-2xl flex items-center justify-center border ${getScoreLevelBgColor(
                  overallLevel
                )}`}
              >
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getScoreLevelColor(overallLevel)}`}>
                    {overallLevel}
                  </div>
                  <div className="text-sm text-slate-400">{overallScore}点</div>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {overallLevel === 'A'
                    ? '素晴らしい！'
                    : overallLevel === 'B'
                      ? 'よくできました！'
                      : overallLevel === 'C'
                        ? '改善の余地があります'
                        : 'もう一度挑戦しましょう'}
                </h2>
                <p className="text-slate-400">
                  {submission.answers.length}問中
                  {evaluatedAnswers.filter((a) => a.score >= 70).length}
                  問で良好な評価を獲得
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4">
              <QuickStat
                icon={<Trophy />}
                label="最高スコア"
                value={`${evaluatedAnswers.length > 0 ? Math.max(...evaluatedAnswers.map((a) => a.score)) : 0}点`}
              />
              <QuickStat icon={<Target />} label="平均スコア" value={`${overallScore}点`} />
            </div>
          </div>
        </div>
      </Card>

      {/* Aspect Scores */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>あなたのスコアマップ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(aspectTotals).map(([aspect, data]) => {
              const avgScore = Math.round(data.total / data.count);
              return (
                <div key={aspect} className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{avgScore}</div>
                  <div className="text-sm text-slate-400 mb-2">{getLearningGoalLabel(aspect)}</div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                      style={{ width: `${avgScore}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Code Reference */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>コード</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CodeViewer code={submission.exercise.code} language={submission.exercise.language} />
            </CardContent>
          </Card>
        </div>

        {/* Question Results */}
        <div className="space-y-6">
          {submission.answers.map((answer) => {
            const question = submission.exercise.questions.find(
              (q) => q.questionIndex === answer.questionIndex
            );
            const level = answer.level ?? 'D';
            const score = answer.score ?? 0;
            return (
              <Card key={answer.questionIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">問題 {answer.questionIndex + 1}</CardTitle>
                    <Badge
                      className={`${getScoreLevelBgColor(level)} ${getScoreLevelColor(level)}`}
                    >
                      {level} ({score}点)
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Question */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-1">問題</h4>
                    <p className="text-white">
                      {question?.questionText ?? '（問題文を取得できませんでした）'}
                    </p>
                  </div>

                  {/* Your Answer */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-1">あなたの回答</h4>
                    <p className="text-slate-300 bg-slate-700/30 p-3 rounded-lg">
                      {answer.answerText}
                    </p>
                  </div>

                  {/* Feedback */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-1">フィードバック</h4>
                    <p className="text-cyan-200 bg-cyan-500/10 border border-cyan-500/30 p-3 rounded-lg">
                      {answer.llmFeedback ?? '評価中...'}
                    </p>
                  </div>

                  {/* Aspect breakdown */}
                  {answer.aspects && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">観点別評価</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(answer.aspects).map(([aspect, score]) => (
                          <span
                            key={aspect}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/50 rounded text-xs"
                          >
                            <span className="text-slate-400">{getLearningGoalLabel(aspect)}:</span>
                            <span className="text-white font-medium">{score}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Actions */}
          <div className="flex gap-4">
            <Link href={`/exercises/${submission.exerciseId}`} className="flex-1">
              <Button variant="secondary" className="w-full">
                <TrendingUp className="w-4 h-4 mr-2" />
                もう一度挑戦
              </Button>
            </Link>
            <Link href="/exercises" className="flex-1">
              <Button className="w-full">
                次の学習へ
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center mx-auto mb-2 text-slate-400">
        {icon}
      </div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}
