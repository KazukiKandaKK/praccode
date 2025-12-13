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
import { FileText, ArrowRight, Clock, Eye, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

type SortColumn = 'title' | 'language' | 'level' | 'score' | 'createdAt';
type SortDirection = 'asc' | 'desc';

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

interface SubmissionsTableProps {
  submissions: SubmissionSummary[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  // UTC固定でフォーマットしてサーバー/クライアントの不一致を防ぐ
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo', // JST固定
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
      className={`py-4 px-4 text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none ${
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

export function SubmissionsTable({ submissions }: SubmissionsTableProps) {
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ソートハンドラー
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // 同じカラムをクリックしたら方向を反転
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // 新しいカラムをクリックしたらそのカラムで降順ソート
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // 評価レベルを数値に変換
  const levelToNumber = (level: 'A' | 'B' | 'C' | 'D' | null): number => {
    if (level === 'A') return 4;
    if (level === 'B') return 3;
    if (level === 'C') return 2;
    if (level === 'D') return 1;
    return 0;
  };

  // ソート済みデータ
  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortColumn) {
        case 'title':
          aValue = a.exercise.title.toLowerCase();
          bValue = b.exercise.title.toLowerCase();
          break;
        case 'language':
          aValue = a.exercise.language;
          bValue = b.exercise.language;
          break;
        case 'level':
          aValue = levelToNumber(a.overallLevel);
          bValue = levelToNumber(b.overallLevel);
          break;
        case 'score':
          aValue = a.avgScore ?? -1;
          bValue = b.avgScore ?? -1;
          break;
        case 'createdAt':
        default:
          aValue = new Date(a.updatedAt).getTime();
          bValue = new Date(b.updatedAt).getTime();
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
              <FileText className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              まだ学習結果がありません
            </h3>
            <p className="text-slate-400 mb-6">
              問題に挑戦して、最初の評価を獲得しましょう
            </p>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <SortableHeader
                    label="問題名"
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
                  <th className="text-left py-4 px-4 text-sm font-medium text-slate-400">
                    ジャンル
                  </th>
                  <SortableHeader
                    label="評価"
                    sortKey="level"
                    currentSort={{ column: sortColumn, direction: sortDirection }}
                    onSort={handleSort}
                    align="center"
                  />
                  <SortableHeader
                    label="スコア"
                    sortKey="score"
                    currentSort={{ column: sortColumn, direction: sortDirection }}
                    onSort={handleSort}
                    align="center"
                  />
                  <SortableHeader
                    label="提出日時"
                    sortKey="createdAt"
                    currentSort={{ column: sortColumn, direction: sortDirection }}
                    onSort={handleSort}
                  />
                  <th className="text-right py-4 px-6 text-sm font-medium text-slate-400">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSubmissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="border-b border-slate-700/50 hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedSubmissionId(submission.id)}
                  >
                    {/* 問題名 */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            submission.overallLevel === 'A'
                              ? 'bg-emerald-400'
                              : submission.overallLevel === 'B'
                              ? 'bg-cyan-400'
                              : submission.overallLevel === 'C'
                              ? 'bg-amber-400'
                              : 'bg-red-400'
                          }`}
                        />
                        <span className="text-white font-medium truncate max-w-[250px]">
                          {submission.exercise.title}
                        </span>
                      </div>
                    </td>

                    {/* 言語 */}
                    <td className="py-4 px-4">
                      <Badge variant="primary" className="text-xs">
                        {getLanguageLabel(submission.exercise.language)}
                      </Badge>
                    </td>

                    {/* ジャンル */}
                    <td className="py-4 px-4">
                      {submission.exercise.genre ? (
                        <span className="text-sm text-slate-400">
                          {getGenreLabel(submission.exercise.genre)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-600">-</span>
                      )}
                    </td>

                    {/* 評価 */}
                    <td className="py-4 px-4 text-center">
                      {submission.overallLevel ? (
                        <Badge
                          className={`${getScoreLevelBgColor(
                            submission.overallLevel
                          )} ${getScoreLevelColor(submission.overallLevel)}`}
                        >
                          {submission.overallLevel}
                        </Badge>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* スコア */}
                    <td className="py-4 px-4 text-center">
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

                    {/* 提出日時 */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Clock className="w-4 h-4" />
                        {isMounted ? formatDate(submission.updatedAt) : '読み込み中...'}
                      </div>
                    </td>

                    {/* 操作 */}
                    <td className="py-4 px-6 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubmissionId(submission.id);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        結果を見る
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
      <SubmissionSidePanel
        submissionId={selectedSubmissionId}
        onClose={() => setSelectedSubmissionId(null)}
      />
    </>
  );
}
