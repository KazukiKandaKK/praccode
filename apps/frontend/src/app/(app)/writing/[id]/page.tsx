'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDifficultyLabel, getDifficultyColor, getLanguageLabel } from '@/lib/utils';
import { toast } from 'sonner';
import {
  PenTool,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Terminal,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api';
import { findLlmInputViolation } from '@/lib/llm-input-guard';
import { useLearningTimeTracker } from '@/hooks/use-learning-time-tracker';
import { useMentorWorkflowTracker } from '@/hooks/use-mentor-workflow-tracker';

interface WritingChallenge {
  id: string;
  title: string;
  description: string;
  language: string;
  difficulty: number;
  testCode: string;
  starterCode?: string;
  createdAt: string;
}

interface WritingSubmission {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  passed: boolean | null;
  executedAt: string | null;
  llmFeedback: string | null;
  llmFeedbackStatus: 'NOT_STARTED' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  llmFeedbackAt: string | null;
}

/**
 * テストコードから関数名を抽出してスターターコードを生成
 */
function generateStarterCode(language: string, testCode: string): string {
  let functionName = 'solution';

  // 言語ごとにテストコードから関数名を抽出
  if (language === 'python') {
    // from solution import func_name
    const match = testCode.match(/from solution import (\w+)/);
    if (match) functionName = match[1];
    return `# お題の説明を読んで、関数を実装してください
def ${functionName}(*args):
    # ここに実装を書いてください
    # TODO: 適切な戻り値を返す
    pass
`;
  }

  if (language === 'javascript') {
    // const { funcName } = require('./solution') or require('./solution').funcName
    const match = testCode.match(/(?:const|let|var)\s*\{\s*(\w+)\s*\}\s*=\s*require/);
    if (match) functionName = match[1];
    return `// お題の説明を読んで、関数を実装してください
function ${functionName}() {
  // ここに実装を書いてください
  // TODO: 適切な戻り値を返す
  return null;
}

module.exports = { ${functionName} };
`;
  }

  if (language === 'typescript') {
    // import { funcName } from './solution'
    const match = testCode.match(/import\s*\{\s*(\w+)\s*\}\s*from/);
    if (match) functionName = match[1];
    return `// お題の説明を読んで、関数を実装してください
export function ${functionName}(...args: unknown[]): unknown {
  // ここに実装を書いてください
  // TODO: 適切な戻り値を返す
  return null;
}
`;
  }

  if (language === 'go') {
    // func TestFuncName or FuncName(
    const match = testCode.match(/\b([A-Z][a-zA-Z0-9]*)\s*\(/);
    if (match && match[1] !== 'Test') functionName = match[1];
    // テスト関数名からプロダクション関数名を推測
    const testMatch = testCode.match(/func\s+Test([A-Z][a-zA-Z0-9]*)/);
    if (testMatch) functionName = testMatch[1];
    return `package solution

// お題の説明を読んで、関数を実装してください
func ${functionName}(args ...interface{}) interface{} {
	// ここに実装を書いてください
	// TODO: 適切な戻り値を返す
	return nil
}
`;
  }

  // フォールバック
  return `// お題の説明を読んで、関数を実装してください
`;
}

export default function WritingChallengePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const challengeId = params.id as string;
  const fromMentor = searchParams.get('from') === 'mentor';
  const listHref = fromMentor ? '/writing?from=mentor' : '/writing';

  const [challenge, setChallenge] = useState<WritingChallenge | null>(null);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState<WritingSubmission | null>(null);

  const apiUrl = API_BASE_URL;

  useLearningTimeTracker({
    userId: session?.user?.id,
    source: 'writing_challenge',
  });
  useMentorWorkflowTracker({ userId: session?.user?.id, step: 'DO' });

  // お題取得
  useEffect(() => {
    const fetchChallenge = async () => {
      if (!session?.user?.id) return;

      try {
        const res = await fetch(
          `${apiUrl}/writing/challenges/${challengeId}?userId=${encodeURIComponent(session.user.id)}`
        );
        if (!res.ok) {
          if (res.status === 403) {
            toast.error('このお題にアクセスする権限がありません');
            router.push(listHref);
          } else {
            toast.error('お題が見つかりません');
            router.push(listHref);
          }
          return;
        }
        const data = await res.json();
        setChallenge(data);
        // starterCode があればそれを使い、なければテストコードから関数名を抽出して生成
        if (data.starterCode) {
          setCode(data.starterCode);
        } else {
          setCode(generateStarterCode(data.language, data.testCode || ''));
        }
      } catch {
        toast.error('お題の取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };

    fetchChallenge();
  }, [challengeId, apiUrl, router, session?.user?.id, listHref]);

  // 提出ポーリング
  const pollSubmission = useCallback(
    async (submissionId: string) => {
      try {
        const res = await fetch(`${apiUrl}/writing/submissions/${submissionId}`);
        if (!res.ok) return;

        const data: WritingSubmission = await res.json();
        setSubmission(data);

        if (data.status === 'PENDING' || data.status === 'RUNNING') {
          setTimeout(() => pollSubmission(submissionId), 1000);
        } else {
          if (data.passed) {
            toast.success('テストに合格しました！');
          } else {
            toast.error('テストに失敗しました');
          }
        }

        // LLMフィードバックのポーリング（生成中の場合）
        if (data.llmFeedbackStatus === 'GENERATING') {
          setTimeout(() => pollSubmission(submissionId), 2000);
        } else if (data.llmFeedbackStatus === 'COMPLETED' && !submission?.llmFeedback) {
          toast.success('AIフィードバックが完成しました！');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    },
    [apiUrl, submission]
  );

  // LLMフィードバックをリクエスト
  const handleRequestFeedback = async () => {
    if (!submission) return;

    const inputViolation = findLlmInputViolation([{ field: 'コード', value: code }]);
    if (inputViolation) {
      toast.error('入力に禁止表現が含まれています');
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/writing/submissions/${submission.id}/feedback`, {
        method: 'POST',
      });

      if (res.ok || res.status === 202) {
        // ステータスを更新してポーリング開始
        setSubmission({
          ...submission,
          llmFeedbackStatus: 'GENERATING',
        });
        toast.info('AIフィードバックを生成中です...');
        pollSubmission(submission.id);
      } else {
        const error = await res.json();
        toast.error(error.error || 'フィードバックのリクエストに失敗しました');
      }
    } catch (err) {
      toast.error('フィードバックのリクエストに失敗しました');
      console.error('Feedback request error:', err);
    }
  };

  // コード提出
  const handleSubmit = async () => {
    if (!session?.user?.id || !challenge) return;

    setIsSubmitting(true);
    setSubmission(null);

    const inputViolation = findLlmInputViolation([{ field: 'コード', value: code }]);
    if (inputViolation) {
      toast.error('入力に禁止表現が含まれています');
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/writing/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          challengeId: challenge.id,
          language: challenge.language,
          code,
        }),
      });

      if (!res.ok) {
        throw new Error('提出に失敗しました');
      }

      const data = await res.json();
      toast.info('コードを実行中...');
      pollSubmission(data.submissionId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '提出に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    );
  }

  if (!challenge) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Link */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          href={listHref}
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          お題一覧に戻る
        </Link>
        {fromMentor && (
          <Link
            href="/mentor"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            AIメンターに戻る
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="p-2 bg-violet-500/10 rounded-xl">
            <PenTool className="w-6 h-6 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">{challenge.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="primary">{getLanguageLabel(challenge.language)}</Badge>
          <Badge className={getDifficultyColor(challenge.difficulty)}>
            {getDifficultyLabel(challenge.difficulty)}
          </Badge>
        </div>

        {/* Description with function signature highlight */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-violet-400 mb-2">お題</h3>
          <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
            {challenge.description}
          </p>
          <p className="text-xs text-amber-400 mt-3">
            💡 説明文の関数名と引数を正確に実装してください
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Code Editor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>コードエディタ</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">言語:</span>
                <Badge variant="primary" className="text-sm">
                  {getLanguageLabel(challenge.language)}
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full h-96 font-mono text-sm bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="コードを入力..."
              spellCheck={false}
            />
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !code.trim()}
              className="w-full mt-4 bg-violet-600 hover:bg-violet-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  提出中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  実行して提出
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Test Code & Results */}
        <div className="space-y-6">
          {/* Test Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-slate-400" />
                テストコード
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="w-full h-48 overflow-auto font-mono text-xs bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-300">
                {challenge.testCode}
              </pre>
            </CardContent>
          </Card>

          {/* Results */}
          {submission && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {submission.status === 'PENDING' || submission.status === 'RUNNING' ? (
                    <>
                      <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                      実行中...
                    </>
                  ) : submission.passed ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      テスト成功
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-400" />
                      テスト失敗
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {submission.executedAt && (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock className="w-4 h-4" />
                    {new Date(submission.executedAt).toLocaleString('ja-JP')}
                  </div>
                )}

                {submission.stdout && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-300 mb-2">標準出力</h4>
                    <pre className="font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-300 overflow-auto max-h-40">
                      {submission.stdout}
                    </pre>
                  </div>
                )}

                {submission.stderr && (
                  <div>
                    <h4 className="text-sm font-medium text-red-300 mb-2">エラー出力</h4>
                    <pre className="font-mono text-xs bg-red-950/30 border border-red-800/50 rounded-lg p-3 text-red-300 overflow-auto max-h-40">
                      {submission.stderr}
                    </pre>
                  </div>
                )}

                {submission.exitCode !== null && (
                  <div className="text-sm text-slate-400">
                    終了コード:{' '}
                    <code className="bg-slate-800 px-2 py-0.5 rounded">{submission.exitCode}</code>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Feedback */}
          {submission && submission.executedAt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="text-violet-400">✨</span>
                    AIフィードバック
                  </span>
                  {submission.llmFeedbackStatus === 'NOT_STARTED' && (
                    <Button
                      onClick={handleRequestFeedback}
                      className="bg-violet-600 hover:bg-violet-500"
                      size="sm"
                    >
                      フィードバックを受ける
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {submission.llmFeedbackStatus === 'GENERATING' && (
                  <div className="flex items-center justify-center gap-3 py-8 text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>AIがコードをレビューしています...</span>
                  </div>
                )}

                {submission.llmFeedbackStatus === 'COMPLETED' && submission.llmFeedback && (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div
                      className="text-slate-300 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: submission.llmFeedback
                          .replace(/\n/g, '<br/>')
                          .replace(
                            /###\s*(.+?)(<br\/>|$)/g,
                            '<h3 class="text-lg font-semibold text-white mt-4 mb-2">$1</h3>'
                          )
                          .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
                          .replace(/-\s+(.+?)(<br\/>|$)/g, '<li class="ml-4">$1</li>'),
                      }}
                    />
                  </div>
                )}

                {submission.llmFeedbackStatus === 'FAILED' && (
                  <div className="text-center py-8">
                    <p className="text-red-400 mb-2">フィードバックの生成に失敗しました</p>
                    <p className="text-xs text-slate-400 mb-4">
                      Ollamaが起動しているか確認してください（ollama serve）
                    </p>
                    <Button onClick={handleRequestFeedback} variant="outline" size="sm">
                      再試行
                    </Button>
                  </div>
                )}

                {submission.llmFeedbackStatus === 'NOT_STARTED' && (
                  <div className="text-center py-8 text-slate-400">
                    <p className="mb-2">AIによるコードレビューを受けることができます</p>
                    <p className="text-xs text-slate-500">
                      良い点や改善点について具体的なフィードバックを提供します
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
