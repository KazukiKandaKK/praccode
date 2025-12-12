'use client';

import { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Sparkles, FileCheck } from 'lucide-react';

interface EvaluationJob {
  submissionId: string;
  exerciseTitle: string;
}

interface GenerationJob {
  exerciseId: string;
}

interface EvaluationContextValue {
  startEvaluationWatch: (submissionId: string, exerciseTitle: string) => void;
  startGenerationWatch: (exerciseId: string) => void;
  pendingEvaluations: EvaluationJob[];
  pendingGenerations: GenerationJob[];
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
  const [pendingEvaluations, setPendingEvaluations] = useState<EvaluationJob[]>([]);
  const [pendingGenerations, setPendingGenerations] = useState<GenerationJob[]>([]);
  const evaluationPollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const generationPollingRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

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

  // ========== 問題生成監視 ==========
  const pollExercise = useCallback(
    async (job: GenerationJob) => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      try {
        const res = await fetch(`${apiUrl}/exercises/${job.exerciseId}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          const timer = generationPollingRef.current.get(job.exerciseId);
          if (timer) {
            clearInterval(timer);
            generationPollingRef.current.delete(job.exerciseId);
          }
          setPendingGenerations((prev) => prev.filter((g) => g.exerciseId !== job.exerciseId));
          toast.error('問題の生成に失敗しました');
          return;
        }

        const data = await res.json();

        if (data.status === 'READY') {
          const timer = generationPollingRef.current.get(job.exerciseId);
          if (timer) {
            clearInterval(timer);
            generationPollingRef.current.delete(job.exerciseId);
          }

          setPendingGenerations((prev) => prev.filter((g) => g.exerciseId !== job.exerciseId));

          toast.success(`問題「${data.title}」が作成されました`, {
            duration: 10000,
            action: {
              label: '問題を解く',
              onClick: () => {
                router.push(`/exercises/${job.exerciseId}`);
              },
            },
          });
        } else if (data.status === 'FAILED') {
          const timer = generationPollingRef.current.get(job.exerciseId);
          if (timer) {
            clearInterval(timer);
            generationPollingRef.current.delete(job.exerciseId);
          }

          setPendingGenerations((prev) => prev.filter((g) => g.exerciseId !== job.exerciseId));

          toast.error('問題の生成に失敗しました');
        }
      } catch (err) {
        console.error('Generation polling error:', err);
      }
    },
    [router]
  );

  const startGenerationWatch = useCallback(
    (exerciseId: string) => {
      if (generationPollingRef.current.has(exerciseId)) {
        return;
      }

      const job: GenerationJob = { exerciseId };
      setPendingGenerations((prev) => [...prev, job]);

      // 即時チェックはせず、少し待ってからポーリング開始
      const timer = setInterval(() => {
        pollExercise(job);
      }, 2000);

      generationPollingRef.current.set(exerciseId, timer);

      toast.info('問題を生成中です...', {
        duration: 3000,
      });
    },
    [pollExercise]
  );

  // クリーンアップ
  useEffect(() => {
    return () => {
      evaluationPollingRef.current.forEach((timer) => clearInterval(timer));
      evaluationPollingRef.current.clear();
      generationPollingRef.current.forEach((timer) => clearInterval(timer));
      generationPollingRef.current.clear();
    };
  }, []);

  const totalPending = pendingEvaluations.length + pendingGenerations.length;

  return (
    <EvaluationContext.Provider
      value={{
        startEvaluationWatch,
        startGenerationWatch,
        pendingEvaluations,
        pendingGenerations,
      }}
    >
      {children}

      {/* 処理中インジケーター（右上固定） */}
      {totalPending > 0 && (
        <div className="fixed top-4 right-4 z-40 space-y-2">
          {pendingGenerations.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/95 backdrop-blur border border-violet-500/30 rounded-xl shadow-lg shadow-violet-500/10">
              <div className="relative">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-violet-400 rounded-full animate-ping" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">問題を生成中</p>
                <p className="text-xs text-slate-400">
                  {pendingGenerations.length}件のAI生成が進行中
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
        </div>
      )}
    </EvaluationContext.Provider>
  );
}

