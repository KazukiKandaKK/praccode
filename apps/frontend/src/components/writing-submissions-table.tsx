'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WritingSubmissionSidePanel } from '@/components/writing-submission-side-panel';
import { getLanguageLabel, getDifficultyLabel, getDifficultyColor } from '@/lib/utils';
import {
  PenTool,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Eye,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface WritingSubmissionSummary {
  id: string;
  challengeId: string;
  language: string;
  code: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  passed: boolean | null;
  executedAt: string | null;
  llmFeedback: string | null;
  llmFeedbackStatus: string;
  llmFeedbackAt: string | null;
  createdAt: string;
  challenge: {
    id: string;
    title: string;
    language: string;
    difficulty: number;
  };
}

interface ChallengeGroup {
  challengeId: string;
  title: string;
  language: string;
  difficulty: number;
  submissions: WritingSubmissionSummary[];
  passedCount: number;
  failedCount: number;
  hasFeedback: boolean;
  lastSubmittedAt: string;
}

interface WritingSubmissionsTableProps {
  submissions: WritingSubmissionSummary[];
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

export function WritingSubmissionsTable({ submissions }: WritingSubmissionsTableProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<WritingSubmissionSummary | null>(
    null
  );
  const [isMounted, setIsMounted] = useState(false);
  const [expandedChallenges, setExpandedChallenges] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // お題ごとにグループ化
  const challengeGroups = useMemo(() => {
    const groupMap = new Map<string, ChallengeGroup>();

    submissions.forEach((submission) => {
      const challengeId = submission.challengeId;
      const existing = groupMap.get(challengeId);

      if (existing) {
        existing.submissions.push(submission);
        if (submission.passed === true) existing.passedCount++;
        if (submission.passed === false) existing.failedCount++;
        if (submission.llmFeedbackStatus === 'COMPLETED') existing.hasFeedback = true;
        if (new Date(submission.createdAt) > new Date(existing.lastSubmittedAt)) {
          existing.lastSubmittedAt = submission.createdAt;
        }
      } else {
        groupMap.set(challengeId, {
          challengeId,
          title: submission.challenge.title,
          language: submission.challenge.language,
          difficulty: submission.challenge.difficulty,
          submissions: [submission],
          passedCount: submission.passed === true ? 1 : 0,
          failedCount: submission.passed === false ? 1 : 0,
          hasFeedback: submission.llmFeedbackStatus === 'COMPLETED',
          lastSubmittedAt: submission.createdAt,
        });
      }
    });

    // 最終提出日時でソート（新しい順）
    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.lastSubmittedAt).getTime() - new Date(a.lastSubmittedAt).getTime()
    );
  }, [submissions]);

  const toggleChallenge = (challengeId: string) => {
    setExpandedChallenges((prev) => {
      const next = new Set(prev);
      if (next.has(challengeId)) {
        next.delete(challengeId);
      } else {
        next.add(challengeId);
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
              <PenTool className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">まだ提出履歴がありません</h3>
            <p className="text-slate-400 mb-6">お題に挑戦して、コードを提出しましょう</p>
            <Link href="/writing">
              <Button>
                お題一覧へ
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
          <CardTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-violet-400" />
            提出履歴
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-700">
            {challengeGroups.map((group) => {
              const isExpanded = expandedChallenges.has(group.challengeId);
              const hasSuccess = group.passedCount > 0;

              return (
                <div key={group.challengeId}>
                  {/* アコーディオンヘッダー */}
                  <div
                    className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => toggleChallenge(group.challengeId)}
                  >
                    {/* 展開アイコン */}
                    <div className="text-slate-400">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>

                    {/* 成功インジケーター */}
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        hasSuccess ? 'bg-emerald-400' : 'bg-red-400'
                      }`}
                    />

                    {/* 問題タイトル */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{group.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {getLanguageLabel(group.language)}
                        </Badge>
                        <Badge className={`${getDifficultyColor(group.difficulty)} text-xs`}>
                          {getDifficultyLabel(group.difficulty)}
                        </Badge>
                      </div>
                    </div>

                    {/* 成功/失敗数 */}
                    <div className="flex items-center gap-3">
                      {group.passedCount > 0 && (
                        <div className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm">{group.passedCount}</span>
                        </div>
                      )}
                      {group.failedCount > 0 && (
                        <div className="flex items-center gap-1 text-red-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm">{group.failedCount}</span>
                        </div>
                      )}
                      {group.hasFeedback && <MessageSquare className="w-4 h-4 text-cyan-400" />}
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
                            <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                              言語
                            </th>
                            <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                              結果
                            </th>
                            <th className="py-3 px-4 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                              FB
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
                                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                            )
                            .map((submission, index) => (
                              <tr
                                key={submission.id}
                                className="border-b border-slate-700/30 hover:bg-slate-800/50 transition-colors cursor-pointer"
                                onClick={() => setSelectedSubmission(submission)}
                              >
                                <td className="py-3 px-6 text-sm text-slate-500">
                                  {group.submissions.length - index}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant="outline" className="text-xs">
                                    {getLanguageLabel(submission.language)}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {submission.passed === true ? (
                                    <div className="inline-flex items-center gap-1 text-emerald-400">
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span className="text-sm">成功</span>
                                    </div>
                                  ) : submission.passed === false ? (
                                    <div className="inline-flex items-center gap-1 text-red-400">
                                      <XCircle className="w-4 h-4" />
                                      <span className="text-sm">失敗</span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 text-slate-400">
                                      <Clock className="w-4 h-4" />
                                      <span className="text-sm">実行中</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {submission.llmFeedbackStatus === 'COMPLETED' ? (
                                    <MessageSquare className="w-4 h-4 text-cyan-400 mx-auto" />
                                  ) : (
                                    <span className="text-slate-500">-</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <Clock className="w-4 h-4" />
                                    {isMounted ? formatDate(submission.createdAt) : '読み込み中...'}
                                  </div>
                                </td>
                                <td className="py-3 px-6 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSubmission(submission);
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
                        <Link href={`/writing/${group.challengeId}`}>
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
      <WritingSubmissionSidePanel
        submission={selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
      />
    </>
  );
}
