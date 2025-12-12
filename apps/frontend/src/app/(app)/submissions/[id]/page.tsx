'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CodeViewer } from '@/components/code-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  getScoreLevelColor,
  getScoreLevelBgColor,
  getLearningGoalLabel,
} from '@/lib/utils';
import { ChevronLeft, Trophy, Target, TrendingUp, ArrowRight, Loader2 } from 'lucide-react';

// Mock data for MVP
const mockSubmissionResult = {
  id: 'mock-submission-id',
  exerciseId: '00000000-0000-0000-0000-000000000001',
  status: 'evaluated',
  exercise: {
    title: 'TypeScript サービスクラスの責務を理解する',
    code: `import { prisma } from '../lib/prisma';

export class UserService {
  async createUser(email: string, name: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = await prisma.user.create({
      data: { email, name },
    });

    await this.sendWelcomeEmail(user.email);
    return user;
  }

  private async sendWelcomeEmail(email: string) {
    console.log(\`Sending welcome email to \${email}\`);
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}`,
    questions: [
      { questionIndex: 0, questionText: 'このクラスの責務を1〜2文で説明してください。' },
      { questionIndex: 1, questionText: 'createUser メソッドのデータフロー（入力→処理→出力）を説明してください。' },
      { questionIndex: 2, questionText: 'このコードで気になる点や改善すべき点があれば挙げてください。' },
    ],
  },
  answers: [
    {
      questionIndex: 0,
      answerText: 'UserServiceクラスは、ユーザーの作成と取得を担当するサービスクラスです。データベースとの通信をカプセル化しています。',
      score: 78,
      level: 'B',
      llmFeedback: '責務の説明は概ね正しいです。ただし、ウェルカムメール送信という副作用についても触れると、より完全な説明になります。このクラスは単純なCRUD操作だけでなく、ユーザー作成時の通知処理も含んでいる点が特徴です。',
      aspects: {
        responsibility: 80,
        data_flow: 75,
        error_handling: 70,
      },
    },
    {
      questionIndex: 1,
      answerText: 'emailとnameを受け取り、既存ユーザーの存在をチェックし、存在しなければ新規ユーザーを作成してウェルカムメールを送信し、作成したユーザーオブジェクトを返します。',
      score: 85,
      level: 'A',
      llmFeedback: 'データフローの説明が明確で、入力から出力までの流れを正確に捉えています。特にエラーケース（既存ユーザーが存在する場合）についても言及できるとより完璧です。',
      aspects: {
        responsibility: 85,
        data_flow: 90,
        error_handling: 75,
      },
    },
    {
      questionIndex: 2,
      answerText: 'sendWelcomeEmailが失敗した場合、ユーザー作成がロールバックされない可能性があります。また、エラーメッセージが具体的でないため、デバッグが困難かもしれません。',
      score: 72,
      level: 'B',
      llmFeedback: '良い観点です！sendWelcomeEmailの失敗時の問題は重要なポイントです。追加で、トランザクション処理が明示的でない点、メール送信を非同期キューで処理すべきという点も検討できます。エラーコードの導入についても触れると良いでしょう。',
      aspects: {
        responsibility: 70,
        data_flow: 65,
        error_handling: 80,
      },
    },
  ],
};

export default function SubmissionResultPage() {
  const params = useParams();
  const [submission, setSubmission] = useState<typeof mockSubmissionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => {
      setSubmission(mockSubmissionResult);
      setLoading(false);
    }, 500);
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-slate-400">結果が見つかりません</p>
      </div>
    );
  }

  // Calculate overall stats
  const overallScore = Math.round(
    submission.answers.reduce((sum, a) => sum + a.score, 0) / submission.answers.length
  );
  const overallLevel =
    overallScore >= 90 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 50 ? 'C' : 'D';

  // Aggregate aspect scores
  const aspectTotals: Record<string, { total: number; count: number }> = {};
  submission.answers.forEach((a) => {
    if (a.aspects) {
      Object.entries(a.aspects).forEach(([key, value]) => {
        if (!aspectTotals[key]) {
          aspectTotals[key] = { total: 0, count: 0 };
        }
        aspectTotals[key].total += value;
        aspectTotals[key].count += 1;
      });
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Link
        href="/exercises"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        学習一覧に戻る
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">{submission.exercise.title}</h1>
        <p className="text-slate-400">評価結果</p>
      </div>

      {/* Overall Score Card */}
      <Card className="mb-8 overflow-hidden">
        <div className="bg-gradient-to-r from-cyan-500/20 to-violet-500/20 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Score */}
            <div className="flex items-center gap-6">
              <div
                className={`w-24 h-24 rounded-2xl flex items-center justify-center border ${getScoreLevelBgColor(
                  overallLevel
                )}`}
              >
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getScoreLevelColor(overallLevel)}`}>
                    {overallLevel}
                  </div>
                  <div className="text-sm text-slate-400">{overallScore}点</div>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">
                  {overallLevel === 'A'
                    ? '素晴らしい！'
                    : overallLevel === 'B'
                    ? 'よくできました！'
                    : overallLevel === 'C'
                    ? '改善の余地があります'
                    : 'もう一度挑戦しましょう'}
                </h2>
                <p className="text-slate-400">
                  {submission.answers.length}問中{submission.answers.filter((a) => a.score >= 70).length}
                  問で良好な評価を獲得
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4">
              <QuickStat icon={<Trophy />} label="最高スコア" value={`${Math.max(...submission.answers.map((a) => a.score))}点`} />
              <QuickStat icon={<Target />} label="平均スコア" value={`${overallScore}点`} />
            </div>
          </div>
        </div>
      </Card>

      {/* Aspect Scores */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>あなたのスコアマップ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {Object.entries(aspectTotals).map(([aspect, data]) => {
              const avgScore = Math.round(data.total / data.count);
              return (
                <div key={aspect} className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{avgScore}</div>
                  <div className="text-sm text-slate-400 mb-2">{getLearningGoalLabel(aspect)}</div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full"
                      style={{ width: `${avgScore}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Code Reference */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>コード</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CodeViewer code={submission.exercise.code} language="typescript" />
            </CardContent>
          </Card>
        </div>

        {/* Question Results */}
        <div className="space-y-6">
          {submission.answers.map((answer, index) => {
            const question = submission.exercise.questions[index];
            return (
              <Card key={answer.questionIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">問題 {index + 1}</CardTitle>
                    <Badge
                      className={`${getScoreLevelBgColor(answer.level)} ${getScoreLevelColor(
                        answer.level
                      )}`}
                    >
                      {answer.level} ({answer.score}点)
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Question */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-1">問題</h4>
                    <p className="text-white">{question.questionText}</p>
                  </div>

                  {/* Your Answer */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-1">あなたの回答</h4>
                    <p className="text-slate-300 bg-slate-700/30 p-3 rounded-lg">
                      {answer.answerText}
                    </p>
                  </div>

                  {/* Feedback */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-400 mb-1">フィードバック</h4>
                    <p className="text-cyan-200 bg-cyan-500/10 border border-cyan-500/30 p-3 rounded-lg">
                      {answer.llmFeedback}
                    </p>
                  </div>

                  {/* Aspect breakdown */}
                  {answer.aspects && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-2">観点別評価</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(answer.aspects).map(([aspect, score]) => (
                          <span
                            key={aspect}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/50 rounded text-xs"
                          >
                            <span className="text-slate-400">{getLearningGoalLabel(aspect)}:</span>
                            <span className="text-white font-medium">{score}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Actions */}
          <div className="flex gap-4">
            <Link href={`/exercises/${submission.exerciseId}`} className="flex-1">
              <Button variant="secondary" className="w-full">
                <TrendingUp className="w-4 h-4 mr-2" />
                もう一度挑戦
              </Button>
            </Link>
            <Link href="/exercises" className="flex-1">
              <Button className="w-full">
                次の学習へ
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-slate-700/50 rounded-lg flex items-center justify-center mx-auto mb-2 text-slate-400">
        {icon}
      </div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  );
}

