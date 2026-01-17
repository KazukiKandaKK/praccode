'use client';

import { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2, Sparkles, FileCheck, PenTool } from 'lucide-react';

interface EvaluationJob {
  submissionId: string;
  exerciseTitle: string;
}

interface GenerationJob {
  exerciseId: string;
}

interface WritingJob {
  submissionId: string;
  challengeTitle: string;
}

interface WritingChallengeGenJob {
  challengeId: string;
}

interface EvaluationContextValue {
  startEvaluationWatch: (submissionId: string, exerciseTitle: string) => void;
  startGenerationWatch: (exerciseId: string) => void;
  startWritingWatch: (submissionId: string, challengeTitle: string) => void;
  startWritingChallengeWatch: (challengeId: string) => void;
  pendingEvaluations: EvaluationJob[];
  pendingGenerations: GenerationJob[];
  pendingWritings: WritingJob[];
  pendingWritingChallenges: WritingChallengeGenJob[];
}

const EvaluationContext = createContext<EvaluationContextValue | null>(null);

export function useEvaluationToast() {
  const ctx = useContext(EvaluationContext);
  if (!ctx) {
    throw new Error('useEvaluationToast must be used within EvaluationToastProvider');
  }
  return ctx;
}

export function EvaluationToastProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [pendingEvaluations, setPendingEvaluations] = useState<EvaluationJob[]>([]);
  const [pendingGenerations, setPendingGenerations] = useState<GenerationJob[]>([]);
  const [pendingWritings, setPendingWritings] = useState<WritingJob[]>([]);
  const [pendingWritingChallenges, setPendingWritingChallenges] = useState<
    WritingChallengeGenJob[]
  >([]);
  const evaluationPollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const generationEventSourceRef = useRef<Map<string, EventSource>>(new Map());
  const writingPollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const writingChallengePollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // ========== 評価監視 ==========
  const pollSubmission = useCallback(
    async (job: EvaluationJob) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      try {
        const res = await fetch(`${apiUrl}/submissions/${job.submissionId}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          const timer = evaluationPollingRef.current.get(job.submissionId);
          if (timer) {
            clearInterval(timer);
            evaluationPollingRef.current.delete(job.submissionId);
          }
          setPendingEvaluations((prev) => prev.filter((e) => e.submissionId !== job.submissionId));
          toast.error('評価の取得に失敗しました');
          return;
        }

        const data = await res.json();

        if (data.status === 'EVALUATED') {
          const timer = evaluationPollingRef.current.get(job.submissionId);
          if (timer) {
            clearInterval(timer);
            evaluationPollingRef.current.delete(job.submissionId);
          }

          setPendingEvaluations((prev) => prev.filter((e) => e.submissionId !== job.submissionId));

          toast.success(`「${job.exerciseTitle}」の評価が完了しました`, {
            duration: 10000,
            action: {
              label: '結果を見る',
              onClick: () => {
                router.push(`/submissions/${job.submissionId}`);
              },
            },
          });
        }
      } catch (err) {
        console.error('Evaluation polling error:', err);
      }
    },
    [router]
  );

  const startEvaluationWatch = useCallback(
    (submissionId: string, exerciseTitle: string) => {
      if (evaluationPollingRef.current.has(submissionId)) {
        return;
      }

      const job: EvaluationJob = { submissionId, exerciseTitle };
      setPendingEvaluations((prev) => [...prev, job]);

      pollSubmission(job);

      const timer = setInterval(() => {
        pollSubmission(job);
      }, 2000);

      evaluationPollingRef.current.set(submissionId, timer);

      toast.info(`「${exerciseTitle}」を評価中です...`, {
        duration: 3000,
      });
    },
    [pollSubmission]
  );

  const startGenerationWatch = useCallback(
    (exerciseId: string) => {
      if (generationEventSourceRef.current.has(exerciseId)) {
        return;
      }

      const userId = session?.user?.id;
      if (!userId) {
        toast.error('セッションが無効です');
        return;
      }

      const job: GenerationJob = { exerciseId };
      setPendingGenerations((prev) => [...prev, job]);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const eventSource = new EventSource(
        `${apiUrl}/exercises/${exerciseId}/events?userId=${userId}`
      );
      generationEventSourceRef.current.set(exerciseId, eventSource);

      const cleanup = () => {
        eventSource.close();
        generationEventSourceRef.current.delete(exerciseId);
        setPendingGenerations((prev) => prev.filter((g) => g.exerciseId !== exerciseId));
      };

      eventSource.addEventListener('ready', (event) => {
        const data = JSON.parse((event as MessageEvent).data) as {
          exerciseId: string;
          status: 'READY';
          title?: string;
        };
        cleanup();
        toast.success(`問題「${data.title ?? '新しい問題'}」が作成されました`, {
          duration: 10000,
          action: {
            label: '問題を解く',
            onClick: () => {
              router.push(`/exercises/${exerciseId}`);
            },
          },
        });
        router.refresh();
      });

      eventSource.addEventListener('failed', () => {
        cleanup();
        toast.error('問題の生成に失敗しました');
      });

      eventSource.addEventListener('timeout', () => {
        cleanup();
        toast.error('問題の生成がタイムアウトしました');
      });

      eventSource.onerror = () => {
        cleanup();
        toast.error('問題の生成通知に失敗しました');
      };

      toast.info('問題を生成中です...', {
        duration: 3000,
      });
    },
    [router, session]
  );

  // ========== ライティング提出監視 ==========
  const pollWritingSubmission = useCallback(async (job: WritingJob) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    try {
      const res = await fetch(`${apiUrl}/writing/submissions/${job.submissionId}`, {
        cache: 'no-store',
      });

      if (!res.ok) {
        const timer = writingPollingRef.current.get(job.submissionId);
        if (timer) {
          clearInterval(timer);
          writingPollingRef.current.delete(job.submissionId);
        }
        setPendingWritings((prev) => prev.filter((w) => w.submissionId !== job.submissionId));
        toast.error('コード実行結果の取得に失敗しました');
        return;
      }

      const data = await res.json();

      if (data.status === 'COMPLETED' || data.status === 'ERROR') {
        const timer = writingPollingRef.current.get(job.submissionId);
        if (timer) {
          clearInterval(timer);
          writingPollingRef.current.delete(job.submissionId);
        }

        setPendingWritings((prev) => prev.filter((w) => w.submissionId !== job.submissionId));

        if (data.passed) {
          toast.success(`「${job.challengeTitle}」のテストに合格しました！`, {
            duration: 10000,
          });
        } else {
          toast.error(`「${job.challengeTitle}」のテストに失敗しました`, {
            duration: 10000,
          });
        }
      }
    } catch (err) {
      console.error('Writing polling error:', err);
    }
  }, []);

  const startWritingWatch = useCallback(
    (submissionId: string, challengeTitle: string) => {
      if (writingPollingRef.current.has(submissionId)) {
        return;
      }

      const job: WritingJob = { submissionId, challengeTitle };
      setPendingWritings((prev) => [...prev, job]);

      const timer = setInterval(() => {
        pollWritingSubmission(job);
      }, 1000);

      writingPollingRef.current.set(submissionId, timer);

      toast.info('コードを実行中...', {
        duration: 3000,
      });
    },
    [pollWritingSubmission]
  );

  // ========== ライティングお題生成監視 ==========
  const pollWritingChallenge = useCallback(
    async (job: WritingChallengeGenJob) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const userId = session?.user?.id;

      if (!userId) {
        toast.error('セッションが無効です');
        return;
      }

      try {
        const res = await fetch(
          `${apiUrl}/writing/challenges/${job.challengeId}?userId=${userId}`,
          {
            cache: 'no-store',
          }
        );

        if (!res.ok) {
          const timer = writingChallengePollingRef.current.get(job.challengeId);
          if (timer) {
            clearInterval(timer);
            writingChallengePollingRef.current.delete(job.challengeId);
          }
          setPendingWritingChallenges((prev) =>
            prev.filter((c) => c.challengeId !== job.challengeId)
          );
          toast.error('お題の生成に失敗しました');
          return;
        }

        const data = await res.json();

        if (data.status === 'READY') {
          const timer = writingChallengePollingRef.current.get(job.challengeId);
          if (timer) {
            clearInterval(timer);
            writingChallengePollingRef.current.delete(job.challengeId);
          }

          setPendingWritingChallenges((prev) =>
            prev.filter((c) => c.challengeId !== job.challengeId)
          );

          toast.success(`お題「${data.title}」が作成されました`, {
            duration: 10000,
            action: {
              label: '挑戦する',
              onClick: () => {
                router.push(`/writing/${job.challengeId}`);
              },
            },
          });
          router.refresh(); // リスト更新
        } else if (data.status === 'FAILED') {
          const timer = writingChallengePollingRef.current.get(job.challengeId);
          if (timer) {
            clearInterval(timer);
            writingChallengePollingRef.current.delete(job.challengeId);
          }

          setPendingWritingChallenges((prev) =>
            prev.filter((c) => c.challengeId !== job.challengeId)
          );

          toast.error('お題の生成に失敗しました');
        }
      } catch (err) {
        console.error('Writing challenge polling error:', err);
      }
    },
    [router, session]
  );

  const startWritingChallengeWatch = useCallback(
    (challengeId: string) => {
      if (writingChallengePollingRef.current.has(challengeId)) {
        return;
      }

      const job: WritingChallengeGenJob = { challengeId };
      setPendingWritingChallenges((prev) => [...prev, job]);

      const timer = setInterval(() => {
        pollWritingChallenge(job);
      }, 2000);

      writingChallengePollingRef.current.set(challengeId, timer);

      toast.info('ライティングお題を生成中...', {
        duration: 3000,
      });
    },
    [pollWritingChallenge]
  );

  // クリーンアップ
  useEffect(() => {
    // refの値を変数にコピー（クリーンアップ関数で使用するため）
    const evaluationTimers = evaluationPollingRef.current;
    const generationSources = generationEventSourceRef.current;
    const writingTimers = writingPollingRef.current;
    const writingChallengeTimers = writingChallengePollingRef.current;

    return () => {
      evaluationTimers.forEach((timer) => clearInterval(timer));
      evaluationTimers.clear();
      generationSources.forEach((source) => source.close());
      generationSources.clear();
      writingTimers.forEach((timer) => clearInterval(timer));
      writingTimers.clear();
      writingChallengeTimers.forEach((timer) => clearInterval(timer));
      writingChallengeTimers.clear();
    };
  }, []);

  const totalPending =
    pendingEvaluations.length +
    pendingGenerations.length +
    pendingWritings.length +
    pendingWritingChallenges.length;

  return (
    <EvaluationContext.Provider
      value={{
        startEvaluationWatch,
        startGenerationWatch,
        startWritingWatch,
        startWritingChallengeWatch,
        pendingEvaluations,
        pendingGenerations,
        pendingWritings,
        pendingWritingChallenges,
      }}
    >
      {children}

      {/* 処理中インジケーター（右上固定） */}
      {totalPending > 0 && (
        <div className="fixed top-4 right-4 z-40 space-y-2">
          {pendingGenerations.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/95 backdrop-blur border border-cyan-500/30 rounded-xl shadow-lg shadow-cyan-500/10">
              <div className="relative">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">リーディング問題を生成中</p>
                <p className="text-xs text-slate-400">
                  {pendingGenerations.length}件のAI生成が進行中
                </p>
              </div>
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin ml-2" />
            </div>
          )}

          {pendingWritingChallenges.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/95 backdrop-blur border border-violet-500/30 rounded-xl shadow-lg shadow-violet-500/10">
              <div className="relative">
                <PenTool className="w-5 h-5 text-violet-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-violet-400 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">ライティングお題を生成中</p>
                <p className="text-xs text-slate-400">
                  {pendingWritingChallenges.length}件のAI生成が進行中
                </p>
              </div>
              <Loader2 className="w-4 h-4 text-violet-400 animate-spin ml-2" />
            </div>
          )}

          {pendingEvaluations.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/95 backdrop-blur border border-cyan-500/30 rounded-xl shadow-lg shadow-cyan-500/10">
              <div className="relative">
                <FileCheck className="w-5 h-5 text-cyan-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">回答を評価中</p>
                <p className="text-xs text-slate-400">
                  {pendingEvaluations.length}件のAI評価が進行中
                </p>
              </div>
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin ml-2" />
            </div>
          )}

          {pendingWritings.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/95 backdrop-blur border border-emerald-500/30 rounded-xl shadow-lg shadow-emerald-500/10">
              <div className="relative">
                <PenTool className="w-5 h-5 text-emerald-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">コード実行中</p>
                <p className="text-xs text-slate-400">{pendingWritings.length}件のテスト実行中</p>
              </div>
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin ml-2" />
            </div>
          )}
        </div>
      )}
    </EvaluationContext.Provider>
  );
}
