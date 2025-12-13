'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  getScoreLevelColor,
  getScoreLevelBgColor,
  getLanguageLabel,
  getGenreLabel,
  getLearningGoalLabel,
} from '@/lib/utils';
import { X, ExternalLink, Loader2, Trophy, Target } from 'lucide-react';

interface SubmissionDetail {
  id: string;
  status: string;
  exerciseId: string;
  exercise: {
    title: string;
    language: string;
    genre: string | null;
    questions: Array<{
      questionIndex: number;
      questionText: string;
    }>;
  };
  answers: Array<{
    questionIndex: number;
    answerText: string;
    score: number | null;
    level: string | null;
    llmFeedback: string | null;
    aspects: Record<string, number> | null;
  }>;
}

interface SubmissionSidePanelProps {
  submissionId: string | null;
  onClose: () => void;
}

export function SubmissionSidePanel({ submissionId, onClose }: SubmissionSidePanelProps) {
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) {
      setSubmission(null);
      return;
    }

    const fetchSubmission = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        const res = await fetch(`${apiUrl}/submissions/${submissionId}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error('取得に失敗しました');
        }

        const data = await res.json();
        setSubmission(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : '取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [submissionId]);

  if (!submissionId) return null;

  // 統計計算
  const evaluatedAnswers =
    submission?.answers.filter((a) => a.score !== null && a.level !== null) || [];
  const avgScore =
    evaluatedAnswers.length > 0
      ? Math.round(
          evaluatedAnswers.reduce((sum, a) => sum + (a.score || 0), 0) / evaluatedAnswers.length
        )
      : 0;
  const overallLevel = avgScore >= 90 ? 'A' : avgScore >= 70 ? 'B' : avgScore >= 50 ? 'C' : 'D';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={onClose} />

      {/* Side Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">結果サマリ</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-16">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {submission && !loading && (
            <div className="space-y-6">
              {/* Exercise Info */}
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{submission.exercise.title}</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="primary">{getLanguageLabel(submission.exercise.language)}</Badge>
                  {submission.exercise.genre && (
                    <Badge variant="secondary">{getGenreLabel(submission.exercise.genre)}</Badge>
                  )}
                </div>
              </div>

              {/* Overall Score */}
              <div className="bg-gradient-to-r from-cyan-500/10 to-violet-500/10 rounded-xl p-6 border border-slate-700">
                <div className="flex items-center gap-6">
                  <div
                    className={`w-20 h-20 rounded-xl flex items-center justify-center border ${getScoreLevelBgColor(
                      overallLevel
                    )}`}
                  >
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getScoreLevelColor(overallLevel)}`}>
                        {overallLevel}
                      </div>
                      <div className="text-xs text-slate-400">{avgScore}点</div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-bold text-white mb-1">
                      {overallLevel === 'A'
                        ? '素晴らしい！'
                        : overallLevel === 'B'
                          ? 'よくできました'
                          : overallLevel === 'C'
                            ? '改善の余地あり'
                            : 'もう一度挑戦'}
                    </h4>
                    <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-1 text-slate-400">
                        <Trophy className="w-4 h-4" />
                        最高: {Math.max(...evaluatedAnswers.map((a) => a.score || 0))}点
                      </div>
                      <div className="flex items-center gap-1 text-slate-400">
                        <Target className="w-4 h-4" />
                        平均: {avgScore}点
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Question Results */}
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-3">設問別結果</h4>
                <div className="space-y-3">
                  {submission.answers.map((answer) => {
                    const question = submission.exercise.questions.find(
                      (q) => q.questionIndex === answer.questionIndex
                    );
                    const level = answer.level || 'D';
                    const score = answer.score || 0;

                    return (
                      <div
                        key={answer.questionIndex}
                        className="bg-slate-800/50 rounded-lg p-4 border border-slate-700"
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <p className="text-sm text-white font-medium line-clamp-2">
                            Q{answer.questionIndex + 1}: {question?.questionText}
                          </p>
                          <Badge
                            className={`shrink-0 ${getScoreLevelBgColor(level)} ${getScoreLevelColor(level)}`}
                          >
                            {level} ({score}点)
                          </Badge>
                        </div>
                        {answer.llmFeedback && (
                          <p className="text-xs text-slate-400 line-clamp-2">
                            {answer.llmFeedback}
                          </p>
                        )}
                        {answer.aspects && Object.keys(answer.aspects).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Object.entries(answer.aspects).map(([aspect, score]) => (
                              <span
                                key={aspect}
                                className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded"
                              >
                                {getLearningGoalLabel(aspect)}: {score}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-700">
                <Link href={`/submissions/${submissionId}`} className="flex-1">
                  <Button className="w-full">
                    詳細ページへ
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href={`/exercises/${submission.exerciseId}`} className="flex-1">
                  <Button variant="secondary" className="w-full">
                    もう一度挑戦
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
