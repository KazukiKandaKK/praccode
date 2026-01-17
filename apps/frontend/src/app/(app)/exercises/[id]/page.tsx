'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { CodeViewer } from '@/components/code-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getDifficultyLabel,
  getDifficultyColor,
  getLanguageLabel,
  getLearningGoalLabel,
} from '@/lib/utils';
import { Lightbulb, Send, Loader2, ChevronLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useEvaluationToast } from '@/components/evaluation-toast-provider';
import { API_BASE_URL } from '@/lib/api';
import { findLlmInputViolation } from '@/lib/llm-input-guard';
import { useLearningTimeTracker } from '@/hooks/use-learning-time-tracker';
import { useMentorWorkflowTracker } from '@/hooks/use-mentor-workflow-tracker';
import { MentorChat } from '@/components/mentor-chat';

interface Exercise {
  id: string;
  title: string;
  language: string;
  difficulty: number;
  code: string;
  learningGoals: string[];
  questions: Array<{
    id: string;
    questionIndex: number;
    questionText: string;
  }>;
}

export default function ExerciseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const exerciseId = params.id as string;
  const { data: session, status: sessionStatus } = useSession();
  const { startEvaluationWatch } = useEvaluationToast();
  const apiUrl = API_BASE_URL;

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [hints, setHints] = useState<Record<number, string>>({});
  const [loadingHint, setLoadingHint] = useState<number | null>(null);
  const [hintErrors, setHintErrors] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const fromMentor = searchParams.get('from') === 'mentor';
  const listHref = fromMentor ? '/exercises?from=mentor' : '/exercises';

  useLearningTimeTracker({
    userId: session?.user?.id,
    source: 'reading_exercise',
  });
  useMentorWorkflowTracker({ userId: session?.user?.id, step: 'DO' });

  useEffect(() => {
    async function fetchExercise() {
      try {
        setIsLoading(true);
        setFetchError(null);

        if (!session?.user?.id) {
          setFetchError('ログインが必要です');
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${apiUrl}/exercises/${exerciseId}?userId=${session.user.id}`);

        if (!response.ok) {
          if (response.status === 404) {
            setFetchError('問題が見つかりません');
          } else if (response.status === 403) {
            setFetchError('この問題にアクセスする権限がありません');
          } else {
            setFetchError('問題の読み込みに失敗しました');
          }
          setExercise(null);
          return;
        }

        const data = (await response.json()) as Exercise;
        setExercise(data);

        // Initialize empty answers
        const initialAnswers: Record<number, string> = {};
        data.questions.forEach((q) => {
          initialAnswers[q.questionIndex] = '';
        });
        setAnswers(initialAnswers);
      } catch (err) {
        console.error('Error fetching exercise:', err);
        setExercise(null);
        setFetchError('問題の読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    }

    if (exerciseId && session?.user?.id) {
      fetchExercise();
    }
  }, [apiUrl, exerciseId, session?.user?.id, sessionStatus]);

  const handleAnswerChange = (questionIndex: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: value }));
  };

  const handleGetHint = async (questionIndex: number) => {
    if (!session?.user?.id) {
      router.push('/login');
      return;
    }

    setLoadingHint(questionIndex);
    setHintErrors((prev) => ({ ...prev, [questionIndex]: '' }));

    try {
      // backendは /hints prefix で controller path が /hints のため /hints/hints となる
      const res = await fetch(`${apiUrl}/hints/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseId,
          questionIndex,
          userId: session.user.id,
        }),
      });

      if (!res.ok) {
        const message =
          res.status === 404
            ? 'ヒントが見つかりませんでした'
            : 'ヒントの取得に失敗しました';
        setHintErrors((prev) => ({ ...prev, [questionIndex]: message }));
        return;
      }

      const data = (await res.json()) as { hint: string };
      setHints((prev) => ({ ...prev, [questionIndex]: data.hint }));
    } catch (error) {
      console.error('Hint fetch error:', error);
      setHintErrors((prev) => ({
        ...prev,
        [questionIndex]: 'ヒントの取得に失敗しました',
      }));
    } finally {
      setLoadingHint(null);
    }
  };

  const handleSubmit = async () => {
    if (!session?.user?.id) {
      router.push('/login');
      return;
    }

    const inputViolation = findLlmInputViolation(
      Object.entries(answers).map(([questionIndex, answerText]) => ({
        field: `回答${Number(questionIndex) + 1}`,
        value: answerText,
      }))
    );

    if (inputViolation) {
      setSubmitError(`入力に禁止表現が含まれています: ${inputViolation.field}`);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1) submission 作成
      const createRes = await fetch(`${apiUrl}/exercises/${exerciseId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id }),
      });

      if (!createRes.ok) {
        const t = await createRes.text();
        throw new Error(`サブミッション作成に失敗しました: ${createRes.status} ${t}`);
      }

      const created = (await createRes.json()) as { id: string };
      const submissionId = created.id;

      // 2) 回答保存
      const payloadAnswers = Object.entries(answers).map(([questionIndex, answerText]) => ({
        questionIndex: Number(questionIndex),
        answerText,
      }));

      const saveRes = await fetch(`${apiUrl}/submissions/${submissionId}/answers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payloadAnswers }),
      });

      if (!saveRes.ok) {
        const t = await saveRes.text();
        throw new Error(`回答保存に失敗しました: ${saveRes.status} ${t}`);
      }

      // 3) 評価キック（非同期）
      const evalRes = await fetch(`${apiUrl}/submissions/${submissionId}/evaluate`, {
        method: 'POST',
      });

      if (!evalRes.ok && evalRes.status !== 202) {
        const t = await evalRes.text();
        throw new Error(`評価開始に失敗しました: ${evalRes.status} ${t}`);
      }

      // 4) バックグラウンドで評価完了を監視（トースト通知付き）
      startEvaluationWatch(submissionId, exercise?.title || '問題');
      setIsSubmitted(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : '送信に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (fetchError || !exercise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{fetchError || '問題が見つかりません'}</p>
          <Link
            href={listHref}
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
          >
            <ChevronLeft className="w-4 h-4" />
            学習一覧に戻る
          </Link>
          {fromMentor && (
            <Link
              href="/mentor"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white mt-3 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              AIメンターに戻る
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href={listHref}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          学習一覧に戻る
        </Link>
        {fromMentor && (
          <Link
            href="/mentor"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            AIメンターに戻る
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="primary">{getLanguageLabel(exercise.language)}</Badge>
          <Badge className={getDifficultyColor(exercise.difficulty)}>
            {getDifficultyLabel(exercise.difficulty)}
          </Badge>
          {exercise.learningGoals.map((goal) => (
            <Badge key={goal} variant="default">
              {getLearningGoalLabel(goal)}
            </Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-white">{exercise.title}</h1>
      </div>

      {/* Main Content - Split View */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Code Viewer */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CodeViewer code={exercise.code} language={exercise.language} />
        </div>

        {/* Right: Questions */}
        <div className="space-y-6">
          {exercise.questions.map((question, index) => (
            <Card key={question.id || String(question.questionIndex)}>
              <CardHeader>
                <CardTitle className="text-lg">問題 {index + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300">{question.questionText}</p>

                {/* Hint */}
                {hints[question.questionIndex] && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-400 mb-2">
                      <Lightbulb className="w-4 h-4" />
                      <span className="text-sm font-medium">ヒント</span>
                    </div>
                    <p className="text-sm text-amber-200 whitespace-pre-wrap">
                      {hints[question.questionIndex]}
                    </p>
                  </div>
                )}
                {hintErrors[question.questionIndex] && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                    {hintErrors[question.questionIndex]}
                  </div>
                )}

                {/* Answer Input */}
                <textarea
                  value={answers[question.questionIndex] || ''}
                  onChange={(e) => handleAnswerChange(question.questionIndex, e.target.value)}
                  placeholder="回答を入力してください..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />

                {/* Hint Button */}
                {!hints[question.questionIndex] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleGetHint(question.questionIndex)}
                    disabled={loadingHint === question.questionIndex}
                  >
                    {loadingHint === question.questionIndex ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ヒントを生成中...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4 mr-2" />
                        ヒントをもらう
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Submit Button */}
          {submitError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{submitError}</p>
            </div>
          )}

          {isSubmitted ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                  <div>
                    <p className="text-emerald-400 font-medium">回答を送信しました！</p>
                    <p className="text-sm text-slate-400 mt-1">
                      AIが評価中です。完了したら右上に通知が届きます。
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => router.push('/exercises')}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  他の問題を解く
                </Button>
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    setIsSubmitted(false);
                    setAnswers({});
                    exercise?.questions.forEach((q) => {
                      setAnswers((prev) => ({ ...prev, [q.questionIndex]: '' }));
                    });
                  }}
                >
                  もう一度解く
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full"
              onClick={handleSubmit}
              disabled={isSubmitting || Object.values(answers).every((a) => !a.trim())}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  送信中...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  回答を送信して評価を受ける
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {session?.user?.id && (
        <div className="mt-10">
          <MentorChat userId={session.user.id} exerciseId={exercise.id} />
        </div>
      )}
    </div>
  );
}
