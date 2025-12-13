'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getLanguageLabel, getDifficultyLabel, getDifficultyColor } from '@/lib/utils';
import {
  X,
  CheckCircle2,
  XCircle,
  Code2,
  Terminal,
  MessageSquare,
  ExternalLink,
  Clock,
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

interface WritingSubmissionSidePanelProps {
  submission: WritingSubmissionSummary | null;
  onClose: () => void;
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

export function WritingSubmissionSidePanel({
  submission,
  onClose,
}: WritingSubmissionSidePanelProps) {
  if (!submission) return null;

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
          <div className="space-y-6">
            {/* Exercise Info */}
            <div>
              <h3 className="text-xl font-bold text-white mb-2">{submission.challenge.title}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge variant="primary">{getLanguageLabel(submission.language)}</Badge>
                <Badge className={getDifficultyColor(submission.challenge.difficulty)}>
                  {getDifficultyLabel(submission.challenge.difficulty)}
                </Badge>
              </div>
            </div>

            {/* Overall Status */}
            <div
              className={`rounded-xl p-6 border ${
                submission.passed === true
                  ? 'bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border-emerald-500/30'
                  : submission.passed === false
                    ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10 border-red-500/30'
                    : 'bg-gradient-to-r from-slate-500/10 to-slate-400/10 border-slate-500/30'
              }`}
            >
              <div className="flex items-center gap-6">
                <div
                  className={`w-20 h-20 rounded-xl flex items-center justify-center border ${
                    submission.passed === true
                      ? 'bg-emerald-500/20 border-emerald-500/50'
                      : submission.passed === false
                        ? 'bg-red-500/20 border-red-500/50'
                        : 'bg-slate-500/20 border-slate-500/50'
                  }`}
                >
                  {submission.passed === true ? (
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  ) : submission.passed === false ? (
                    <XCircle className="w-10 h-10 text-red-400" />
                  ) : (
                    <Clock className="w-10 h-10 text-slate-400 animate-pulse" />
                  )}
                </div>
                <div className="flex-1">
                  <h4
                    className={`text-lg font-bold mb-1 ${
                      submission.passed === true
                        ? 'text-emerald-400'
                        : submission.passed === false
                          ? 'text-red-400'
                          : 'text-slate-400'
                    }`}
                  >
                    {submission.passed === true
                      ? 'テスト成功！'
                      : submission.passed === false
                        ? 'テスト失敗'
                        : '実行中...'}
                  </h4>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Clock className="w-4 h-4" />
                      提出: {formatDate(submission.createdAt)}
                    </div>
                    {submission.llmFeedbackStatus === 'COMPLETED' && (
                      <div className="flex items-center gap-1 text-cyan-400">
                        <MessageSquare className="w-4 h-4" />
                        AIフィードバックあり
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 提出コード */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Code2 className="w-4 h-4 text-violet-400" />
                <h4 className="text-sm font-medium text-slate-300">提出コード</h4>
              </div>
              <pre className="font-mono text-xs bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-slate-300 overflow-x-auto max-h-48">
                {submission.code}
              </pre>
            </div>

            {/* テスト結果 */}
            {(submission.stdout || submission.stderr) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-sm font-medium text-slate-300">テスト結果</h4>
                </div>

                {submission.stdout && (
                  <div className="mb-2">
                    <p className="text-xs text-slate-400 mb-1">標準出力:</p>
                    <pre className="font-mono text-xs bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-slate-300 overflow-x-auto max-h-32">
                      {submission.stdout}
                    </pre>
                  </div>
                )}

                {submission.stderr && (
                  <div>
                    <p className="text-xs text-red-400 mb-1">エラー出力:</p>
                    <pre className="font-mono text-xs bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-red-300 overflow-x-auto max-h-32">
                      {submission.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* AIフィードバック */}
            {submission.llmFeedbackStatus === 'COMPLETED' && submission.llmFeedback && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-medium text-slate-300">AIフィードバック</h4>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                  <div
                    className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: submission.llmFeedback
                        .replace(/\n/g, '<br/>')
                        .replace(
                          /###\s*(.+?)(<br\/>|$)/g,
                          '<h4 class="text-sm font-semibold text-white mt-3 mb-1">$1</h4>'
                        )
                        .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
                        .replace(/-\s+(.+?)(<br\/>|$)/g, '<li class="ml-2 text-slate-300">$1</li>'),
                    }}
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-slate-700">
              <Link href={`/writing/${submission.challengeId}`} className="flex-1">
                <Button className="w-full">
                  このお題に挑戦する
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
