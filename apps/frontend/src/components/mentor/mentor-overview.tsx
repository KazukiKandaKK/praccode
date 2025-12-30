'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  ApiError,
  LearningPlanRecord,
  MentorAssessmentStatus,
  MentorFeedbackRecord,
  MentorSummary,
  MentorSprint,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GenerateRecommendationButton } from '@/components/generate-recommendation-button';
import {
  Sparkles,
  Brain,
  ListChecks,
  ArrowUpRight,
  Clock,
  BookOpen,
  ClipboardCheck,
} from 'lucide-react';
import { cn, getDifficultyLabel, getLanguageLabel } from '@/lib/utils';
import { MentorWorkflowNav } from '@/components/mentor/mentor-workflow-nav';

type Props = {
  userId: string;
  userName?: string | null;
};

export function MentorOverview({ userId, userName }: Props) {
  const [latestPlan, setLatestPlan] = useState<LearningPlanRecord | null>(null);
  const [planHistory, setPlanHistory] = useState<LearningPlanRecord[]>([]);
  const [feedbackHistory, setFeedbackHistory] = useState<MentorFeedbackRecord[]>([]);
  const [summary, setSummary] = useState<MentorSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [sprint, setSprint] = useState<MentorSprint | null>(null);
  const [sprintError, setSprintError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<MentorAssessmentStatus | null>(null);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [
          latest,
          plans,
          feedback,
          summaryResult,
          sprintResult,
          assessmentResult,
        ] = await Promise.allSettled([
          api.getLatestLearningPlan(userId),
          api.getLearningPlanHistory(userId, 5),
          api.getMentorFeedbackHistory(userId, 5),
          api.getMentorSummary(userId),
          api.getCurrentMentorSprint(userId),
          api.getMentorAssessmentStatus(userId),
        ]);

        if (cancelled) return;

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

        if (summaryResult.status === 'fulfilled') {
          setSummary(summaryResult.value);
          setSummaryError(null);
        } else {
          setSummaryError('成長サマリの取得に失敗しました');
        }

        if (sprintResult.status === 'fulfilled') {
          setSprint(sprintResult.value);
          setSprintError(null);
        } else if (
          sprintResult.status === 'rejected' &&
          sprintResult.reason instanceof ApiError &&
          sprintResult.reason.statusCode === 404
        ) {
          setSprint(null);
          setSprintError(null);
        } else {
          setSprintError('スプリント情報の取得に失敗しました');
        }

        if (assessmentResult.status === 'fulfilled') {
          setAssessment(assessmentResult.value);
          setAssessmentError(null);
        } else {
          setAssessmentError('初回レベルチェックの取得に失敗しました');
        }
      } catch (error) {
        console.error('Failed to load mentor overview:', error);
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

  const readingAssessments = assessment?.tasks.filter((task) => task.type === 'reading') ?? [];
  const writingAssessments = assessment?.tasks.filter((task) => task.type === 'writing') ?? [];
  const assessmentReady =
    assessment !== null &&
    assessment.summary.total > 0 &&
    assessment.summary.completed >= assessment.summary.total;

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Sparkles className="w-4 h-4 text-slate-300" />
          <span>AIメンター</span>
        </div>
        <h1 className="text-3xl font-bold text-white">AIメンターサマリ</h1>
        <p className="text-slate-400 max-w-2xl">
          {userName ?? 'あなた'} の学習計画とフィードバックを一覧で管理します。
        </p>
      </header>
      <MentorWorkflowNav userId={userId} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-slate-300" />
            <CardTitle className="text-white text-lg">初回レベルチェック</CardTitle>
          </div>
          {assessment && (
            <Badge variant="default">
              {assessment.summary.completed}/{assessment.summary.total} 完了
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-400">
            初回はコードリーディングとコードライティングを数問解いて、AIメンターがレベル感を把握します。
          </p>
          {assessmentError && <p className="text-sm text-rose-300">{assessmentError}</p>}
          {loading ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : assessment && assessment.tasks.length > 0 ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span>
                  コードリーディング {assessment.summary.reading.completed}/
                  {assessment.summary.reading.total}
                </span>
                <span>
                  コードライティング {assessment.summary.writing.completed}/
                  {assessment.summary.writing.total}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <AssessmentTaskList
                  title="コードリーディング"
                  tasks={readingAssessments}
                  emptyText="まだリーディング課題がありません"
                />
                <AssessmentTaskList
                  title="コードライティング"
                  tasks={writingAssessments}
                  emptyText="まだライティング課題がありません"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href="/exercises?from=mentor">
                  <Button variant="outline">リーディングへ</Button>
                </Link>
                <Link href="/writing?from=mentor">
                  <Button variant="outline">ライティングへ</Button>
                </Link>
                {assessmentReady && (
                  <>
                    <GenerateRecommendationButton userId={userId} />
                    <Link href="/mentor/plan">
                      <Button>学習計画を作成</Button>
                    </Link>
                  </>
                )}
              </div>
              {assessmentReady ? (
                <p className="text-xs text-slate-400">
                  レベルチェックが完了しました。次の課題や学習計画を提案します。
                </p>
              ) : (
                <p className="text-xs text-slate-500">
                  全て完了するとAIメンターのレコメンドが表示されます。
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              まだ初回レベルチェックが割り当てられていません。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-300" />
            <CardTitle className="text-white text-lg">今週のスプリント</CardTitle>
          </div>
          {sprint && (
            <Badge variant="default">
              Sprint {sprint.sequence}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {sprintError && <p className="text-sm text-rose-300">{sprintError}</p>}
          {loading ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : sprint ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-400">スプリント期間</p>
                <p className="text-slate-200 font-medium">
                  {formatDate(sprint.startDate)} - {formatDate(sprint.endDate)}
                  <span className="text-xs text-slate-500 ml-2">
                    残り {getRemainingDays(sprint.endDate)} 日
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">スプリントゴール</p>
                <p className="text-slate-200 font-medium">{sprint.goal}</p>
              </div>
              {sprint.focusAreas.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sprint.focusAreas.map((area) => (
                    <Badge key={area} variant="default">
                      {area}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              まだスプリントがありません。学習計画を作成すると開始されます。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-slate-300" />
            <CardTitle className="text-white text-lg">成長サマリ</CardTitle>
          </div>
          <Badge variant="default">履歴を集計</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {summaryError && <p className="text-sm text-rose-300">{summaryError}</p>}
          {loading ? (
            <p className="text-sm text-slate-400">読み込み中...</p>
          ) : summary &&
            (summary.metrics.length > 0 ||
              summary.strengths.length > 0 ||
              summary.improvements.length > 0) ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div className="text-sm text-slate-200 font-semibold">評価の伸び</div>
                <div className="space-y-2">
                  {summary.metrics.slice(0, 6).map((metric) => (
                    <div
                      key={metric.aspect}
                      className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-sm"
                    >
                      <span className="text-slate-200">{metric.aspect}</span>
                      <span className="flex items-center gap-2 text-slate-300">
                        {metric.currentAvg}
                        {typeof metric.delta === 'number' && (
                          <span
                            className={cn(
                              'text-xs',
                              metric.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            )}
                          >
                            {metric.delta >= 0 ? `+${metric.delta}` : metric.delta}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {summary.metrics.length === 0 && (
                    <p className="text-sm text-slate-500">評価が集まると表示されます。</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm text-slate-200 font-semibold">強みの傾向</div>
                  <div className="flex flex-wrap gap-2">
                    {summary.strengths.length > 0 ? (
                      summary.strengths.map((item) => (
                        <Badge key={item.label} variant="default">
                          {item.label} ({item.count})
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        まだ強みのデータがありません。
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-slate-200 font-semibold">改善アドバイスの傾向</div>
                  <div className="flex flex-wrap gap-2">
                    {summary.improvements.length > 0 ? (
                      summary.improvements.map((item) => (
                        <Badge key={item.label} variant="default">
                          {item.label} ({item.count})
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-slate-500">
                        まだ改善アドバイスがありません。
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {summary.recentAdvice.length > 0 && (
                <div className="md:col-span-2 space-y-2">
                  <div className="text-sm text-slate-200 font-semibold">最近のアドバイス</div>
                  <div className="space-y-2">
                    {summary.recentAdvice.map((advice) => (
                      <div
                        key={`${advice.area}-${advice.createdAt}`}
                        className="rounded-lg border border-slate-700/60 bg-slate-800/40 p-3 text-sm text-slate-200"
                      >
                        <div className="text-xs text-slate-400 mb-1">
                          {formatDate(advice.createdAt)} / {advice.area}
                        </div>
                        <p className="text-slate-300">{advice.advice}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              まだ成長サマリがありません。提出やフィードバックが集まると表示されます。
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-slate-300" />
              <CardTitle className="text-white text-lg">学習計画</CardTitle>
            </div>
            <Badge variant="default">{planHistory.length}件</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-400">読み込み中...</p>
            ) : latestPlan ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400">最新サマリ</p>
                  <p className="text-slate-200 font-medium line-clamp-2">
                    {latestPlan.plan.summary}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(latestPlan.updatedAt)}
                  </span>
                  {latestPlan.targetLanguage && (
                    <Badge variant="default">{latestPlan.targetLanguage}</Badge>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                まだ学習計画がありません。事前質問に回答して作成しましょう。
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Link href="/mentor/plan">
                <Button>
                  学習計画を作成
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/mentor/plan/history">
                <Button variant="outline">履歴を見る</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-slate-300" />
              <CardTitle className="text-white text-lg">フィードバック</CardTitle>
            </div>
            <Badge variant="default">{feedbackHistory.length}件</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-slate-400">読み込み中...</p>
            ) : feedbackHistory.length > 0 ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-slate-400">最新フィードバック</p>
                  <p className="text-slate-200 font-medium line-clamp-2">
                    {feedbackHistory[0].feedback.overall}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(feedbackHistory[0].createdAt)}
                  </span>
                  <Badge variant="default">
                    Submission {feedbackHistory[0].submissionId.slice(0, 8)}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                まだフィードバックがありません。提出後にAIメンターがレビューします。
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Link href="/mentor/feedback">
                <Button variant="outline">
                  フィードバック履歴
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <BookOpen className="w-4 h-4 text-slate-300" />
            <CardTitle className="text-white text-base">最近の学習計画</CardTitle>
          </CardHeader>
          <CardContent>
            {planHistory.length === 0 ? (
              <p className="text-sm text-slate-500">まだ履歴がありません</p>
            ) : (
              <div className="space-y-3">
                {planHistory.map((planItem) => (
                  <div
                    key={planItem.id}
                    className="rounded-xl border border-slate-700/60 bg-slate-800/40 p-3"
                  >
                    <div className="text-sm font-semibold text-slate-100 line-clamp-2">
                      {planItem.plan.summary}
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap gap-2 mt-1">
                      <span>{formatDate(planItem.createdAt)}</span>
                      {planItem.targetLanguage && (
                        <Badge variant="default">{planItem.targetLanguage}</Badge>
                      )}
                    </div>
                  </div>
                ))}
                <Link href="/mentor/plan/history" className="inline-flex">
                  <Button variant="ghost">
                    すべて見る
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <ListChecks className="w-4 h-4 text-slate-300" />
            <CardTitle className="text-white text-base">最近のフィードバック</CardTitle>
          </CardHeader>
          <CardContent>
            {feedbackHistory.length === 0 ? (
              <p className="text-sm text-slate-500">まだフィードバックがありません</p>
            ) : (
              <div className="space-y-3">
                {feedbackHistory.slice(0, 3).map((feedback) => (
                  <div
                    key={feedback.id}
                    className={cn('rounded-xl border border-slate-700/60 bg-slate-800/40 p-3', 'space-y-1')}
                  >
                    <div className="text-sm font-semibold text-slate-100 line-clamp-2">
                      {feedback.feedback.overall}
                    </div>
                    <div className="text-xs text-slate-400 flex flex-wrap gap-2">
                      <span>{formatDate(feedback.createdAt)}</span>
                      <Badge variant="default">{feedback.submissionId.slice(0, 8)}</Badge>
                    </div>
                  </div>
                ))}
                <Link href="/mentor/feedback" className="inline-flex">
                  <Button variant="ghost">
                    すべて見る
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDate(date: string | number | Date) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

function getRemainingDays(endDate: string) {
  const end = new Date(endDate);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function AssessmentTaskList({
  title,
  tasks,
  emptyText,
}: {
  title: string;
  tasks: MentorAssessmentStatus['tasks'];
  emptyText: string;
}) {
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const href =
              task.type === 'reading'
                ? `/exercises/${task.id}?from=mentor`
                : `/writing/${task.id}?from=mentor`;
            return (
              <Link
                key={task.id}
                href={href}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-700/60 bg-slate-800/40 p-3 transition-colors hover:border-slate-500/70 hover:bg-slate-800/60"
              >
                <div>
                  <div className="text-sm text-slate-100 font-semibold line-clamp-1">
                    {task.title}
                  </div>
                  <div className="text-xs text-slate-400">
                    {getLanguageLabel(task.language)} ・ {getDifficultyLabel(task.difficulty)}
                  </div>
                </div>
                <AssessmentStatusBadge status={task.status} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AssessmentStatusBadge({ status }: { status: MentorAssessmentStatus['tasks'][number]['status'] }) {
  const labels: Record<string, string> = {
    NOT_STARTED: '未着手',
    IN_PROGRESS: '進行中',
    COMPLETED: '完了',
    FAILED: '要再提出',
  };
  const variants: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
    NOT_STARTED: 'default',
    IN_PROGRESS: 'warning',
    COMPLETED: 'success',
    FAILED: 'danger',
  };
  return (
    <Badge variant={variants[status] ?? 'default'} className="shrink-0">
      {labels[status] ?? status}
    </Badge>
  );
}
