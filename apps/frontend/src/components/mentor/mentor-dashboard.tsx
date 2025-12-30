'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, LearningPlan, LearningPlanRecord } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { findLlmInputViolation } from '@/lib/llm-input-guard';
import {
  CalendarCheck,
  ClipboardCheck,
  Flag,
  Loader2,
  MessageSquareQuote,
  NotebookPen,
  Sparkles,
  Target,
  Bell,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { MentorWorkflowNav } from '@/components/mentor/mentor-workflow-nav';

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

export function MentorPlan({ userId, userName }: Props) {
  const [presetAnswers, setPresetAnswers] = useState<PresetQA[]>(defaultPresets);
  const [targetLanguage, setTargetLanguage] = useState('');
  const [latestPlan, setLatestPlan] = useState<LearningPlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showLatestPanel, setShowLatestPanel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const latest = await api.getLatestLearningPlan(userId);
        if (!cancelled) {
          setLatestPlan(latest);
        }
      } catch (e) {
        if (
          e instanceof ApiError &&
          e.statusCode === 404
        ) {
          if (!cancelled) {
            setLatestPlan(null);
          }
        } else if (!cancelled) {
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

    const inputViolation = findLlmInputViolation([
      { field: '重点言語/テーマ', value: targetLanguage },
      ...presetAnswers.flatMap((qa, idx) => [
        { field: `質問${idx + 1}`, value: qa.question },
        { field: `回答${idx + 1}`, value: qa.answer },
      ]),
    ]);

    if (inputViolation) {
      setError(`入力に禁止表現が含まれています: ${inputViolation.field}`);
      return;
    }

    setGenerating(true);
    try {
      await api.generateLearningPlan({
        userId,
        presetAnswers: filteredQA,
        targetLanguage: targetLanguage.trim() || undefined,
      });
      const latest = await api.getLatestLearningPlan(userId);
      setLatestPlan(latest);
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
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Sparkles className="w-4 h-4 text-slate-300" />
          <span>AIメンター</span>
        </div>
        <h1 className="text-3xl font-bold text-white">学習計画の作成</h1>
        <p className="text-slate-400 max-w-2xl">
          {userName ?? 'あなた'} の目標に合わせた学習計画を作成します。
        </p>
        <p className="text-sm text-slate-400">
          生成には数十秒かかります。学習履歴を反映して計画を更新します。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {generating && (
            <Badge variant="default" className="gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              作成中...
            </Badge>
          )}
          {toast && <Badge variant="success">{toast}</Badge>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setShowLatestPanel(true)}
            disabled={!latestPlan || loading}
          >
            最新プランを開く
          </Button>
          <Link href="/mentor/plan/history">
            <Button variant="outline">履歴を見る</Button>
          </Link>
          {latestPlan?.updatedAt && (
            <span className="text-xs text-slate-500">
              更新: {formatDate(latestPlan.updatedAt)}
            </span>
          )}
          {!loading && !latestPlan && (
            <span className="text-xs text-slate-500">最新の学習計画はまだありません</span>
          )}
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
      </header>
      <MentorWorkflowNav userId={userId} />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2 text-white">
                <NotebookPen className="w-5 h-5 text-slate-300" />
                事前質問への回答
              </CardTitle>
              <Badge
                variant="default"
                className="text-xs"
              >
                Step 1
              </Badge>
            </div>
            <p className="text-sm text-slate-300">
              いくつかの事前質問に答えると、学習計画があなたの課題に合わせて最適化されます。
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-200">重点言語/テーマ</label>
                  <Input
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    placeholder="例: TypeScriptでテスト設計を強化したい"
                  />
                </div>

                <div className="space-y-4">
                  {presetAnswers.map((qa, idx) => (
                    <div
                      key={idx}
                      className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-4"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="uppercase tracking-[0.2em]">Question {idx + 1}</span>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                          AIメンターが参照
                        </Badge>
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
              </div>

              <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
                  <MessageSquareQuote className="w-4 h-4 text-slate-300" />
                  回答のヒント
                </div>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                    直近で躓いた点や復習したい領域を具体的に
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                    週の学習可能時間と理想ペースを記載
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
                    興味のあるプロジェクト/領域を添えると効果的
                  </li>
                </ul>
              </div>
            </div>

            <Button
              className="w-full"
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

      </div>
      {showLatestPanel && latestPlan && (
        <MentorPlanSidePanel
          planRecord={latestPlan}
          onClose={() => setShowLatestPanel(false)}
        />
      )}
    </div>
  );
}

function PlanView({ plan, meta }: { plan: LearningPlan; meta: LearningPlanRecord | null }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {meta?.targetLanguage && <Badge variant="default">{meta.targetLanguage}</Badge>}
        {meta?.modelId && (
          <Badge variant="default">
            model: {meta.modelId}
          </Badge>
        )}
        {typeof meta?.temperature === 'number' && (
          <Badge variant="default">
            temp: {meta.temperature}
          </Badge>
        )}
        {meta && (
          <span className="text-slate-400">更新: {formatDate(meta.updatedAt)}</span>
        )}
      </div>

      <PlanSection
        title="サマリ"
        icon={<Sparkles className="w-4 h-4 text-slate-300" />}
        description="この計画で目指す到達イメージを簡潔にまとめています。"
      >
        <p className="text-slate-200 leading-relaxed">{plan.summary}</p>
      </PlanSection>

      <PlanSection
        title="フォーカス"
        icon={<Target className="w-4 h-4 text-slate-300" />}
        description="重点的に伸ばす観点や領域。"
      >
        <div className="flex flex-wrap gap-2">
          {plan.focusAreas.map((area, idx) => (
            <Badge key={idx} variant="secondary" className="bg-slate-800 text-slate-100">
              {area}
            </Badge>
          ))}
        </div>
      </PlanSection>

      <PlanSection
        title="週ごとのプラン"
        icon={<CalendarCheck className="w-4 h-4 text-slate-300" />}
        description="毎週のテーマとアウトプットを明確にします。"
      >
        <div className="space-y-3">
          {plan.weeklyPlan.map((week, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-slate-100 font-semibold">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-200">
                  {idx + 1}
                </span>
                <span>{week.title}</span>
              </div>
              <PlanList label="ゴール" items={week.goals} />
              <PlanList label="アクティビティ" items={week.activities} />
              <PlanList label="アウトプット" items={week.deliverables} />
            </div>
          ))}
        </div>
      </PlanSection>

      <PlanSection
        title="即席テスト"
        icon={<ClipboardCheck className="w-4 h-4 text-slate-300" />}
        description="理解度を測るチェックポイント用テスト。"
      >
        <div className="grid md:grid-cols-2 gap-3">
          {plan.quickTests.map((test, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-4 space-y-2"
            >
              <div className="text-slate-100 font-semibold">{test.name}</div>
              <p className="text-slate-300 text-sm">タスク: {test.task}</p>
              <p className="text-slate-400 text-sm">期待する答え: {test.expectedAnswer}</p>
              <PlanList label="評価観点" items={test.evaluationCriteria} compact />
            </div>
          ))}
        </div>
      </PlanSection>

      <PlanSection
        title="チェックポイント"
        icon={<Flag className="w-4 h-4 text-slate-300" />}
        description="成長の見える化に使うマイルストーン。"
      >
        <div className="grid md:grid-cols-2 gap-3">
          {plan.checkpoints.map((cp, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-700/60 bg-slate-900/30 p-3 space-y-1"
            >
              <div className="text-slate-100 font-semibold">{cp.metric}</div>
              <p className="text-slate-300 text-sm">目標: {cp.target}</p>
              <p className="text-slate-400 text-xs">タイミング: {cp.when}</p>
            </div>
          ))}
        </div>
      </PlanSection>

      {plan.reminders && plan.reminders.length > 0 && (
        <PlanSection
          title="リマインダー"
          icon={<Bell className="w-4 h-4 text-slate-300" />}
          description="継続のための小さな注意点。"
        >
          <PlanList items={plan.reminders} compact />
        </PlanSection>
      )}
    </div>
  );
}

function PlanSection({
  title,
  icon,
  description,
  children,
}: {
  title: string;
  icon: ReactNode;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-4 md:p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && <p className="text-sm text-slate-400">{description}</p>}
        </div>
      </div>
      {children}
    </section>
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
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500" />
            <span className={cn('leading-snug', compact && 'text-slate-300')}>{item}</span>
          </li>
        ))}
      </ul>
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

function MentorPlanSidePanel({
  planRecord,
  onClose,
}: {
  planRecord: LearningPlanRecord;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto shadow-2xl animate-slide-in-right">
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">最新の学習計画</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <PlanView plan={planRecord.plan} meta={planRecord} />
        </div>
      </div>
    </>
  );
}
