'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ArrowRight,
  Clock
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
  submission: WritingSubmissionSummary;
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

export function WritingSubmissionSidePanel({ submission, onClose }: WritingSubmissionSidePanelProps) {
  return (
    <Card className="w-1/2 min-w-[400px] max-h-[calc(100vh-200px)] overflow-y-auto sticky top-4">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex-1">
          <CardTitle className="text-lg text-white mb-2">
            {submission.challenge.title}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {getLanguageLabel(submission.language)}
            </Badge>
            <Badge className={getDifficultyColor(submission.challenge.difficulty)}>
              {getDifficultyLabel(submission.challenge.difficulty)}
            </Badge>
            {submission.passed === true ? (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                成功
              </Badge>
            ) : submission.passed === false ? (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                <XCircle className="w-3 h-3 mr-1" />
                失敗
              </Badge>
            ) : (
              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                <Clock className="w-3 h-3 mr-1" />
                実行中
              </Badge>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 提出日時 */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="w-4 h-4" />
          提出: {formatDate(submission.createdAt)}
        </div>

        {/* 提出コード */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Code2 className="w-4 h-4 text-violet-400" />
            <h4 className="text-sm font-medium text-slate-300">提出コード</h4>
          </div>
          <pre className="font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 overflow-x-auto max-h-48">
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
                <pre className="font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 overflow-x-auto max-h-32">
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
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
              <div 
                className="text-sm text-slate-300 leading-relaxed prose prose-invert prose-sm max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: submission.llmFeedback
                    .replace(/\n/g, '<br/>')
                    .replace(/###\s*(.+?)(<br\/>|$)/g, '<h4 class="text-sm font-semibold text-white mt-3 mb-1">$1</h4>')
                    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
                    .replace(/-\s+(.+?)(<br\/>|$)/g, '<li class="ml-2 text-slate-300">$1</li>')
                }}
              />
            </div>
          </div>
        )}

        {/* 詳細ページへのリンク */}
        <div className="pt-4 border-t border-slate-700">
          <Link href={`/writing/${submission.challengeId}`}>
            <Button className="w-full">
              このお題に挑戦する
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

