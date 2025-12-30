'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, ApiError, MentorWorkflowState, MentorWorkflowStep } from '@/lib/api';
import { useMentorWorkflowTracker } from '@/hooks/use-mentor-workflow-tracker';

const steps = [
  {
    key: '1',
    label: '計画',
    title: '学習計画',
    step: 'PLAN',
    href: '/mentor/plan',
    match: ['/mentor', '/mentor/plan'],
  },
  {
    key: '2',
    label: '実行',
    title: '学習',
    step: 'DO',
    href: '/exercises?from=mentor',
    match: ['/exercises', '/writing'],
  },
  {
    key: '3',
    label: '振り返り',
    title: 'フィードバック',
    step: 'CHECK',
    href: '/mentor/feedback',
    match: ['/mentor/feedback'],
  },
  {
    key: '4',
    label: '次の学習計画',
    title: '計画履歴',
    step: 'NEXT_PLAN',
    href: '/mentor/plan/history',
    match: ['/mentor/plan/history'],
  },
];

function getActiveIndex(pathname: string) {
  const found = steps.find((step) => step.match.some((path) => pathname.startsWith(path)));
  return found ? steps.indexOf(found) : 0;
}

type Props = {
  userId: string;
};

const stepLabels: Record<MentorWorkflowStep, string> = {
  PLAN: '計画',
  DO: '実行',
  CHECK: '振り返り',
  NEXT_PLAN: '次の学習計画',
};

const stepTones: Record<
  MentorWorkflowStep,
  {
    bar: string;
    badge: string;
    badgeActive: string;
    dot: string;
    ring: string;
    surface: string;
  }
> = {
  PLAN: {
    bar: 'bg-sky-400/70',
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
    badgeActive: 'border-sky-400/70 bg-sky-500/20 text-sky-100',
    dot: 'bg-sky-400',
    ring: 'ring-sky-400/30',
    surface: 'bg-sky-500/5',
  },
  DO: {
    bar: 'bg-emerald-400/70',
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    badgeActive: 'border-emerald-400/70 bg-emerald-500/20 text-emerald-100',
    dot: 'bg-emerald-400',
    ring: 'ring-emerald-400/30',
    surface: 'bg-emerald-500/5',
  },
  CHECK: {
    bar: 'bg-amber-400/70',
    badge: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    badgeActive: 'border-amber-400/70 bg-amber-500/20 text-amber-100',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/30',
    surface: 'bg-amber-500/5',
  },
  NEXT_PLAN: {
    bar: 'bg-teal-400/70',
    badge: 'border-teal-500/40 bg-teal-500/10 text-teal-200',
    badgeActive: 'border-teal-400/70 bg-teal-500/20 text-teal-100',
    dot: 'bg-teal-400',
    ring: 'ring-teal-400/30',
    surface: 'bg-teal-500/5',
  },
};

export function MentorWorkflowNav({ userId }: Props) {
  const pathname = usePathname();
  const activeIndex = getActiveIndex(pathname);
  const activeStep = steps[activeIndex]?.step as MentorWorkflowStep;
  const [workflowState, setWorkflowState] = useState<MentorWorkflowState | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);

  useMentorWorkflowTracker({ userId, step: activeStep });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) return;
      try {
        const state = await api.getMentorWorkflowState(userId);
        if (!cancelled) {
          setWorkflowState(state);
          setWorkflowError(null);
        }
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) {
          if (!cancelled) {
            setWorkflowState(null);
            setWorkflowError(null);
          }
          return;
        }
        console.error('Failed to load mentor workflow state:', error);
        if (!cancelled) {
          setWorkflowError('ワークフローの取得に失敗しました');
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const resumeStep = workflowState?.step ?? activeStep;
  const resumeTarget = useMemo(
    () => steps.find((step) => step.step === resumeStep),
    [resumeStep]
  );
  const showResume =
    resumeTarget && !resumeTarget.match.some((path) => pathname.startsWith(path));

  return (
    <Card className="border-slate-600/70">
      <CardHeader className="pb-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base text-slate-100">学習サイクル</CardTitle>
            <p className="text-sm text-slate-400">
              計画・実行・振り返り・次の学習計画を循環させて学習を前進させます
            </p>
          </div>
          {showResume && resumeTarget && (
            <Link href={resumeTarget.href}>
              <Button size="sm" variant="secondary">
                今の学習ステップへ
              </Button>
            </Link>
          )}
        </div>
        {workflowState && (
          <p className="text-xs text-slate-500">
            前回: {stepLabels[workflowState.step]} ({formatDate(workflowState.updatedAt)})
          </p>
        )}
        {workflowError && <p className="text-xs text-rose-300">{workflowError}</p>}
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const isActive = index === activeIndex;
            const tone = stepTones[step.step];
            return (
              <Link
                key={step.key}
                href={step.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-4 rounded-xl border border-slate-700/60 bg-slate-900/40 p-3 transition-colors',
                  tone.surface,
                  isActive
                    ? cn('border-slate-500/80 bg-slate-800/70 ring-1', tone.ring)
                    : 'hover:border-slate-600/70 hover:bg-slate-900/60'
                )}
              >
                <span className={cn('self-stretch w-1 rounded-full', tone.bar)} aria-hidden />
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold',
                      isActive ? tone.badgeActive : tone.badge
                    )}
                  >
                    {step.key}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs tracking-wide">
                      <span className={cn('h-2 w-2 rounded-full', tone.dot)} aria-hidden />
                      <span className={isActive ? 'text-slate-200' : 'text-slate-500'}>
                        {step.label}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'text-sm font-semibold',
                        isActive ? 'text-white' : 'text-slate-200'
                      )}
                    >
                      {step.title}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function formatDate(date: string | number | Date) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
