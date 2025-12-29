'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  ApiError,
  LearningPlan,
  LearningPlanRecord,
  MentorFeedbackRecord,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Brain,
  History,
  ListChecks,
  Loader2,
  NotebookPen,
  Sparkles,
  Target,
} from 'lucide-react';

type PresetQA = { question: string; answer: string };

const defaultPresets: PresetQA[] = [
  { question: 'いまの課題や伸ばしたい領域は？', answer: '' },
  { question: '好きな/得意な言語・フレームワークは？', answer: '' },
  { question: '週あたりの学習時間は？', answer: '' },
];

type Props = {
  userId: string;
  userName?: string | null;
};

export function MentorDashboard({ userId, userName }: Props) {
  const [presetAnswers, setPresetAnswers] = useState<PresetQA[]>(defaultPresets);
  const [targetLanguage, setTargetLanguage] = useState('');
  const [latestPlan, setLatestPlan] = useState<LearningPlanRecord | null>(null);
  const [planHistory, setPlanHistory] = useState<LearningPlanRecord[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<MentorFeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const plan = latestPlan?.plan ?? null;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [latest, plans, feedback] = await Promise.allSettled([
          api.getLatestLearningPlan(userId),
          api.getLearningPlanHistory(userId, 20),
          api.getMentorFeedbackHistory(userId, 20),
        ]);

        if (!cancelled) {
          if (latest.status === 'fulfilled') {
            setLatestPlan(latest.value);
          } else if (
            latest.status === 'rejected' &&
            latest.reason instanceof ApiError &&
            latest.reason.statusCode === 404
          ) {
            setLatestPlan(null);
          }

          if (plans.status === 'fulfilled') {
            setPlanHistory(plans.value);
          }
          if (feedback.status === 'fulfilled') {
            setFeedbackHistory(feedback.value);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError('データの取得に失敗しました');
          console.error(e);
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

  const filteredQA = useMemo(
    () => presetAnswers.filter((qa) => qa.question.trim() || qa.answer.trim()),
    [presetAnswers]
  );

  const handleGenerate = async () => {
    setError(null);
    setToast(null);
    setGenerating(true);
    try {
      const newPlan = await api.generateLearningPlan({
        userId,
        presetAnswers: filteredQA,
        targetLanguage: targetLanguage.trim() || undefined,
      });
      // Refresh history after generation
      const [latest, plans] = await Promise.all([
        api.getLatestLearningPlan(userId),
        api.getLearningPlanHistory(userId, 20),
      ]);
      setLatestPlan(latest);
      setPlanHistory(plans);
      setToast('学習計画を生成しました');
    } catch (e) {
      console.error(e);
      if (e instanceof ApiError) {
        setError(e.message || '生成に失敗しました');
      } else {
        setError('生成に失敗しました');
      }
    } finally {
      setGenerating(false);
    }
  };

  const addQuestion = () => {
    setPresetAnswers((prev) => [...prev, { question: '', answer: '' }]);
  };

  const updateQA = (index: number, field: 'question' | 'answer', value: string) => {
    setPresetAnswers((prev) => prev.map((qa, i) => (i === index ? { ...qa, [field]: value } : qa)));
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-sm text-cyan-300">
          <Sparkles className="w-4 h-4" />
          <span>メンターエージェント</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">学習プラン & フィードバック</h1>
            <p className="text-slate-400">
              {userName ?? 'あなた'} 専用の学習計画を生成し、履歴とフィードバックをまとめて確認できます。
            </p>
          </div>
          <div className="flex items-center gap-2">
            {generating && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-500/30 text-cyan-200 text-sm bg-cyan-500/10">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>作成中...</span>
              </div>
            )}
            {toast && <Badge variant="outline">{toast}</Badge>}
          </div>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
      </header>

      <div className="flex flex-col gap-6">
        <Card className="border-cyan-500/20 bg-slate-950/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <NotebookPen className="w-5 h-5 text-cyan-300" />
              プリセット回答
            </CardTitle>
            <p className="text-sm text-slate-400">
              いくつかの質問に答えると、より精度の高い学習計画を生成できます。
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">重点言語/テーマ</label>
              <Input
                value={targetLanguage}
                onChange={(e) => setTargetLanguage(e.target.value)}
                placeholder="例: TypeScriptでテスト設計を強化したい"
              />
            </div>

            <div className="space-y-3">
              {presetAnswers.map((qa, idx) => (
                <div key={idx} className="space-y-2 rounded-lg border border-slate-800 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>質問 {idx + 1}</span>
                    <Badge variant="outline">メンターが参照</Badge>
                  </div>
                  <Input
                    value={qa.question}
                    onChange={(e) => updateQA(idx, 'question', e.target.value)}
                    placeholder="質問を入力"
                  />
                  <Textarea
                    value={qa.answer}
                    onChange={(e) => updateQA(idx, 'answer', e.target.value)}
                    placeholder="あなたの回答を書いてください"
                    rows={3}
                  />
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={addQuestion}>
                質問を追加
              </Button>
            </div>

            <Button
              className="w-full bg-cyan-500 text-white hover:bg-cyan-400"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </div>
              ) : (
                '学習計画を生成する'
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-cyan-500/20 bg-slate-950/60">
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-slate-300">
                <Brain className="w-5 h-5 text-cyan-300" />
                <CardTitle className="text-xl text-white">最新の学習計画</CardTitle>
              </div>
              <p className="text-sm text-slate-400">
                生成後すぐに最新計画がここに表示されます。週ごとのゴールと確認課題を含みます。
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-slate-400 text-sm">読み込み中...</div>
              ) : plan ? (
                <PlanView plan={plan} meta={latestPlan} />
              ) : (
                <div className="text-slate-500 text-sm">
                  まだ学習計画がありません。プリセット回答を入力して生成してください。
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <HistoryCard
              title="学習計画の履歴"
              icon={<History className="w-5 h-5 text-cyan-300" />}
              emptyText="まだ履歴がありません"
              items={planHistory.map((p) => ({
                id: p.id,
                headline: p.plan.summary,
                timestamp: p.createdAt,
                meta: `${p.targetLanguage ?? '言語指定なし'} / ${p.modelId ?? 'model'}`,
              }))}
            />
            <HistoryCard
              title="フィードバック履歴"
              icon={<ListChecks className="w-5 h-5 text-emerald-300" />}
              emptyText="まだフィードバックがありません"
              items={feedbackHistory.map((f) => ({
                id: f.id,
                headline: f.feedback.overall,
                timestamp: f.createdAt,
                meta: `Submission: ${f.submissionId.slice(0, 8)} / ${f.modelId ?? 'model'}`,
              }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanView({ plan, meta }: { plan: LearningPlan; meta: LearningPlanRecord | null }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        {meta?.targetLanguage && (
          <Badge variant="outline" className="border-cyan-500/40 text-cyan-200">
            {meta.targetLanguage}
          </Badge>
        )}
        {meta?.modelId && (
          <Badge variant="outline" className="border-slate-700 text-slate-200">
            model: {meta.modelId}
          </Badge>
        )}
        {typeof meta?.temperature === 'number' && (
          <Badge variant="outline" className="border-slate-700 text-slate-200">
            temp: {meta.temperature}
          </Badge>
        )}
        {meta && (
          <span className="text-xs text-slate-400">
            更新: {formatDate(meta.updatedAt)}
          </span>
        )}
      </div>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-white">サマリ</h3>
        <p className="text-slate-300 leading-relaxed">{plan.summary}</p>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold text-white">フォーカス</h3>
        <div className="flex flex-wrap gap-2">
          {plan.focusAreas.map((area, idx) => (
            <Badge key={idx} variant="secondary" className="bg-slate-800 text-slate-100">
              {area}
            </Badge>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">週ごとのプラン</h3>
        <div className="space-y-3">
          {plan.weeklyPlan.map((week, idx) => (
            <div key={idx} className="rounded-lg border border-slate-800 p-4 space-y-2">
              <div className="flex items-center gap-2 text-slate-200">
                <Target className="w-4 h-4 text-cyan-300" />
                <span className="font-semibold">{week.title}</span>
              </div>
              <PlanList label="ゴール" items={week.goals} />
              <PlanList label="アクティビティ" items={week.activities} />
              <PlanList label="アウトプット" items={week.deliverables} />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">即席テスト</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {plan.quickTests.map((test, idx) => (
            <div key={idx} className="rounded-lg border border-slate-800 p-4 space-y-2">
              <div className="text-slate-200 font-semibold">{test.name}</div>
              <p className="text-slate-300 text-sm">タスク: {test.task}</p>
              <p className="text-slate-400 text-sm">期待する答え: {test.expectedAnswer}</p>
              <PlanList label="評価観点" items={test.evaluationCriteria} compact />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-white">チェックポイント</h3>
        <div className="grid md:grid-cols-2 gap-3">
          {plan.checkpoints.map((cp, idx) => (
            <div key={idx} className="rounded-lg border border-slate-800 p-3 space-y-1">
              <div className="text-slate-200 font-semibold">{cp.metric}</div>
              <p className="text-slate-300 text-sm">目標: {cp.target}</p>
              <p className="text-slate-400 text-xs">タイミング: {cp.when}</p>
            </div>
          ))}
        </div>
      </section>

      {plan.reminders && plan.reminders.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-semibold text-white">リマインダー</h3>
          <PlanList items={plan.reminders} compact />
        </section>
      )}
    </div>
  );
}

function PlanList({
  label,
  items,
  compact,
}: {
  label?: string;
  items: string[];
  compact?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-1">
      {label && <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>}
      <ul className={cn('space-y-1', compact && 'text-sm')}>
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-slate-200">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-400" />
            <span className={cn('leading-snug', compact && 'text-slate-300')}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HistoryCard({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: ReactNode;
  items: Array<{ id: string; headline: string; timestamp: string; meta?: string }>;
  emptyText: string;
}) {
  return (
    <Card className="bg-slate-950/60 border-slate-800">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        {icon}
        <CardTitle className="text-white text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyText}</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-slate-800 bg-slate-900/40">
                <div className="text-sm font-semibold text-slate-100 line-clamp-2">
                  {item.headline}
                </div>
                <div className="text-xs text-slate-400 flex flex-wrap gap-2 mt-1">
                  <span>{formatDate(item.timestamp)}</span>
                  {item.meta && <Badge variant="outline">{item.meta}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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
