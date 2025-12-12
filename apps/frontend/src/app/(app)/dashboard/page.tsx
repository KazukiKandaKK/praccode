import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, Target, TrendingUp, Clock, ArrowRight } from 'lucide-react';
import { getLearningGoalLabel } from '@/lib/utils';

// In a real app, this would fetch from the API
async function getProgress(userId: string) {
  // Mock data for MVP
  return {
    userId,
    totalExercises: 10,
    completedExercises: 3,
    averageScore: 72,
    aspectScores: {
      responsibility: 78,
      data_flow: 65,
      error_handling: 70,
    },
    recentSubmissions: [
      {
        exerciseId: '00000000-0000-0000-0000-000000000001',
        exerciseTitle: 'TypeScript サービスクラスの責務を理解する',
        submittedAt: new Date().toISOString(),
        averageScore: 75,
      },
    ],
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const progress = await getProgress(session.user.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          おかえりなさい、{session.user.name || 'ユーザー'}さん
        </h1>
        <p className="text-slate-400 mt-2">今日もコードリーディングを頑張りましょう！</p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          label="完了した学習の数"
          value={`${progress.completedExercises}/${progress.totalExercises}`}
          color="cyan"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="平均スコア"
          value={`${progress.averageScore}点`}
          color="emerald"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="進捗率"
          value={`${Math.round((progress.completedExercises / progress.totalExercises) * 100)}%`}
          color="violet"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="今週完了した学習の数"
          value="3問"
          color="amber"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Aspect Scores */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>あなたのスコアマップ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(progress.aspectScores).map(([aspect, score]) => (
                <div key={aspect}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{getLearningGoalLabel(aspect)}</span>
                    <span className="text-white font-medium">{score}点</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-700">
              <h4 className="text-sm font-medium text-slate-400 mb-2">改善のヒント</h4>
              <p className="text-slate-300 text-sm">
                データフローの理解が他の観点に比べて低めです。
                コードの入力・処理・出力の流れを意識して読み解く練習をしましょう。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>最近の学習</CardTitle>
          </CardHeader>
          <CardContent>
            {progress.recentSubmissions.length > 0 ? (
              <div className="space-y-4">
                {progress.recentSubmissions.map((submission) => (
                  <div
                    key={submission.exerciseId}
                    className="p-3 bg-slate-700/30 rounded-lg"
                  >
                    <p className="text-white font-medium text-sm line-clamp-2">
                      {submission.exerciseTitle}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">
                        {new Date(submission.submittedAt).toLocaleDateString('ja-JP')}
                      </span>
                      <Badge variant={submission.averageScore >= 70 ? 'success' : 'warning'}>
                        {submission.averageScore}点
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">まだ完了した学習がありません</p>
            )}

            <Link href="/exercises" className="block mt-4">
              <Button variant="secondary" className="w-full">
                学習テーマを探す
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Recommended Exercises */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>おすすめの学習テーマ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <RecommendedExercise
              title="React カスタムフックのデータフェッチパターン"
              language="TypeScript"
              difficulty={3}
              reason="データフロー理解を強化"
            />
            <RecommendedExercise
              title="API エラーハンドリングパターン"
              language="TypeScript"
              difficulty={3}
              reason="エラーハンドリングを学ぶ"
            />
            <RecommendedExercise
              title="TypeScript サービスクラスの責務を理解する"
              language="TypeScript"
              difficulty={2}
              reason="責務理解の基礎"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'cyan' | 'emerald' | 'violet' | 'amber';
}) {
  const colorClasses = {
    cyan: 'bg-cyan-500/10 text-cyan-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    violet: 'bg-violet-500/10 text-violet-400',
    amber: 'bg-amber-500/10 text-amber-400',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecommendedExercise({
  title,
  language,
  difficulty,
  reason,
}: {
  title: string;
  language: string;
  difficulty: number;
  reason: string;
}) {
  return (
    <Link
      href="/exercises"
      className="block p-4 bg-slate-700/30 rounded-xl hover:bg-slate-700/50 transition-colors group"
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge>{language}</Badge>
        <Badge variant="primary">Lv.{difficulty}</Badge>
      </div>
      <h4 className="text-white font-medium group-hover:text-cyan-400 transition-colors line-clamp-2">
        {title}
      </h4>
      <p className="text-xs text-slate-400 mt-2">{reason}</p>
    </Link>
  );
}

