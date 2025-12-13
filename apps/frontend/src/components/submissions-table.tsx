'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SubmissionSidePanel } from '@/components/submission-side-panel';
import {
  getLanguageLabel,
  getScoreLevelColor,
  getScoreLevelBgColor,
  getGenreLabel,
} from '@/lib/utils';
import { FileText, ArrowRight, Clock, Eye, ChevronDown, ChevronRight, Trophy } from 'lucide-react';

interface SubmissionSummary {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'EVALUATED';
  createdAt: string;
  updatedAt: string;
  exercise: {
    id: string;
    title: string;
    language: string;
    difficulty: number;
    genre: string | null;
  };
  avgScore: number | null;
  overallLevel: 'A' | 'B' | 'C' | 'D' | null;
  answerCount: number;
}

interface ExerciseGroup {
  exerciseId: string;
  title: string;
  language: string;
  genre: string | null;
  submissions: SubmissionSummary[];
  bestLevel: 'A' | 'B' | 'C' | 'D' | null;
  bestScore: number | null;
  lastSubmittedAt: string;
}

interface SubmissionsTableProps {
  submissions: SubmissionSummary[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  });
}

// 評価レベルを数値に変換
const levelToNumber = (level: 'A' | 'B' | 'C' | 'D' | null): number => {
  if (level === 'A') return 4;
  if (level === 'B') return 3;
  if (level === 'C') return 2;
  if (level === 'D') return 1;
  return 0;
};

export function SubmissionsTable({ submissions }: SubmissionsTableProps) {
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // お題ごとにグループ化
  const exerciseGroups = useMemo(() => {
    const groupMap = new Map<string, ExerciseGroup>();

    submissions.forEach((submission) => {
      const exerciseId = submission.exercise.id;
      const existing = groupMap.get(exerciseId);

      if (existing) {
        existing.submissions.push(submission);
        // 最高評価を更新
        if (levelToNumber(submission.overallLevel) > levelToNumber(existing.bestLevel)) {
          existing.bestLevel = submission.overallLevel;
          existing.bestScore = submission.avgScore;
        }
        // 最終提出日時を更新
        if (new Date(submission.updatedAt) > new Date(existing.lastSubmittedAt)) {
          existing.lastSubmittedAt = submission.updatedAt;
        }
      } else {
        groupMap.set(exerciseId, {
          exerciseId,
          title: submission.exercise.title,
          language: submission.exercise.language,
          genre: submission.exercise.genre,
          submissions: [submission],
          bestLevel: submission.overallLevel,
          bestScore: submission.avgScore,
          lastSubmittedAt: submission.updatedAt,
        });
      }
    });

    // 最終提出日時でソート（新しい順）
    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime()
    );
  }, [submissions]);

  const toggleExercise = (exerciseId: string) => {
    setExpandedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  };

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">まだ学習結果がありません</h3>
            <p className="text-slate-400 mb-6">問題に挑戦して、最初の評価を獲得しましょう</p>
            <Link href="/exercises">
              <Button>
                問題一覧へ
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>評価結果一覧</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-700">
            {exerciseGroups.map((group) => {
              const isExpanded = expandedExercises.has(group.exerciseId);

              return (
                <div key={group.exerciseId}>
                  {/* アコーディオンヘッダー */}
                  <div
                    className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => toggleExercise(group.exerciseId)}
                  >
                    {/* 展開アイコン */}
                    <div className="text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>

                    {/* 評価インジケーター */}
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        group.bestLevel === 'A'
                          ? 'bg-emerald-400'
                          : group.bestLevel === 'B'
                            ? 'bg-cyan-400'
                            : group.bestLevel === 'C'
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                      }`}
                    />

                    {/* 問題タイトル */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{group.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="primary" className="text-xs">
                          {getLanguageLabel(group.language)}
                        </Badge>
                        {group.genre && (
                          <span className="text-xs text-slate-500">
                            {getGenreLabel(group.genre)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 最高評価 */}
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      {group.bestLevel ? (
                        <Badge
                          className={`${getScoreLevelBgColor(group.bestLevel)} ${getScoreLevelColor(group.bestLevel)}`}
                        >
                          {group.bestLevel}
                          {group.bestScore !== null && ` (${group.bestScore}点)`}
                        </Badge>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </div>

                    {/* 提出回数 */}
                    <div className="text-sm text-slate-400 w-20 text-right">
                      {group.submissions.length}回提出
                    </div>

                    {/* 最終提出日時 */}
                    <div className="hidden md:flex items-center gap-1 text-sm text-slate-500 w-40">
                      <Clock className="w-3 h-3" />
                      {isMounted ? formatDate(group.lastSubmittedAt) : '...'}
                    </div>
                  </div>

                  {/* 展開コンテンツ */}
                  {isExpanded && (
                    <div className="bg-slate-800/30 border-t border-slate-700/50">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700/50">
                            <th className="py-3 px-6 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-12">
                              #
                            </th>
                            <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                              評価
                            </th>
                            <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                              スコア
                            </th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              提出日時
                            </th>
                            <th className="py-3 px-6 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.submissions
                            .sort(
                              (a, b) =>
                                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                            )
                            .map((submission, index) => (
                              <tr
                                key={submission.id}
                                className="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors cursor-pointer"
                                onClick={() => setSelectedSubmissionId(submission.id)}
                              >
                                <td className="py-3 px-6 text-sm text-slate-500">
                                  {group.submissions.length - index}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {submission.overallLevel ? (
                                    <Badge
                                      className={`${getScoreLevelBgColor(submission.overallLevel)} ${getScoreLevelColor(submission.overallLevel)}`}
                                    >
                                      {submission.overallLevel}
                                    </Badge>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`font-medium ${
                                      submission.avgScore !== null
                                        ? getScoreLevelColor(submission.overallLevel || 'D')
                                        : 'text-slate-600'
                                    }`}
                                  >
                                    {submission.avgScore !== null
                                      ? `${submission.avgScore}点`
                                      : '-'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <Clock className="w-4 h-4" />
                                    {isMounted ? formatDate(submission.updatedAt) : '読み込み中...'}
                                  </div>
                                </td>
                                <td className="py-3 px-6 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSubmissionId(submission.id);
                                    }}
                                  >
                                    <Eye className="w-4 h-4 mr-1" />
                                    詳細
                                  </Button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>

                      {/* お題への再挑戦リンク */}
                      <div className="px-6 py-3 bg-slate-800/20 border-t border-slate-700/30">
                        <Link href={`/exercises/${group.exerciseId}`}>
                          <Button variant="secondary" size="sm">
                            このお題にもう一度挑戦
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Side Panel */}
      <SubmissionSidePanel
        submissionId={selectedSubmissionId}
        onClose={() => setSelectedSubmissionId(null)}
      />
    </>
  );
}
