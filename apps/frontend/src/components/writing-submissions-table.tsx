'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WritingSubmissionSidePanel } from '@/components/writing-submission-side-panel';
import { getLanguageLabel, getDifficultyLabel, getDifficultyColor } from '@/lib/utils';
import { PenTool, ArrowRight, CheckCircle2, XCircle, MessageSquare, Eye, Clock, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

type SortColumn = 'title' | 'language' | 'result' | 'feedback' | 'createdAt';
type SortDirection = 'asc' | 'desc';

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

// ソート可能なヘッダーコンポーネント
function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortColumn;
  currentSort: { column: SortColumn; direction: SortDirection };
  onSort: (column: SortColumn) => void;
  align?: 'left' | 'center' | 'right';
}) {
  const isActive = currentSort.column === sortKey;
  const alignClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <th
      className={`py-3 px-4 text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none ${
        align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
      }`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${alignClass}`}>
        {label}
        {isActive ? (
          currentSort.direction === 'asc' ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-30" />
        )}
      </div>
    </th>
  );
}

export function WritingSubmissionsTable({ submissions }: WritingSubmissionsTableProps) {
  const [selectedSubmission, setSelectedSubmission] = useState<WritingSubmissionSummary | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ソートハンドラー
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // 結果を数値に変換（成功=2, 失敗=1, 実行中=0）
  const resultToNumber = (passed: boolean | null): number => {
    if (passed === true) return 2;
    if (passed === false) return 1;
    return 0;
  };

  // フィードバック状態を数値に変換
  const feedbackToNumber = (status: string): number => {
    return status === 'COMPLETED' ? 1 : 0;
  };

  // ソート済みデータ
  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortColumn) {
        case 'title':
          aValue = a.challenge.title.toLowerCase();
          bValue = b.challenge.title.toLowerCase();
          break;
        case 'language':
          aValue = a.language;
          bValue = b.language;
          break;
        case 'result':
          aValue = resultToNumber(a.passed);
          bValue = resultToNumber(b.passed);
          break;
        case 'feedback':
          aValue = feedbackToNumber(a.llmFeedbackStatus);
          bValue = feedbackToNumber(b.llmFeedbackStatus);
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.createdAt).getTime();
          bValue = new Date(b.createdAt).getTime();
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [submissions, sortColumn, sortDirection]);

  if (submissions.length === 0) {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <PenTool className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              まだ提出履歴がありません
            </h3>
            <p className="text-slate-400 mb-6">
              お題に挑戦して、コードを提出しましょう
            </p>
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
    <div className="flex gap-6">
      {/* Main Table */}
      <Card className={`flex-1 transition-all duration-300 ${selectedSubmission ? 'w-1/2' : 'w-full'}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="w-5 h-5 text-violet-400" />
            提出履歴
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <SortableHeader
                    label="お題"
                    sortKey="title"
                    currentSort={{ column: sortColumn, direction: sortDirection }}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="言語"
                    sortKey="language"
                    currentSort={{ column: sortColumn, direction: sortDirection }}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="結果"
                    sortKey="result"
                    currentSort={{ column: sortColumn, direction: sortDirection }}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="FB"
                    sortKey="feedback"
                    currentSort={{ column: sortColumn, direction: sortDirection }}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="提出日時"
                    sortKey="createdAt"
                    currentSort={{ column: sortColumn, direction: sortDirection }}
                    onSort={handleSort}
                  />
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedSubmissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer ${
                      selectedSubmission?.id === submission.id ? 'bg-slate-800/70' : ''
                    }`}
                    onClick={() => setSelectedSubmission(submission)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium truncate max-w-[200px]">
                          {submission.challenge.title}
                        </span>
                        <Badge className={`${getDifficultyColor(submission.challenge.difficulty)} w-fit mt-1`}>
                          {getDifficultyLabel(submission.challenge.difficulty)}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">
                        {getLanguageLabel(submission.language)}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {submission.passed === true ? (
                        <div className="flex items-center gap-1 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="text-sm">成功</span>
                        </div>
                      ) : submission.passed === false ? (
                        <div className="flex items-center gap-1 text-red-400">
                          <XCircle className="w-4 h-4" />
                          <span className="text-sm">失敗</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-4 h-4" />
                          <span className="text-sm">実行中</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {submission.llmFeedbackStatus === 'COMPLETED' ? (
                        <MessageSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-400">
                      {isMounted ? formatDate(submission.createdAt) : '読み込み中...'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubmission(submission);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Side Panel */}
      {selectedSubmission && (
        <WritingSubmissionSidePanel
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </div>
  );
}
