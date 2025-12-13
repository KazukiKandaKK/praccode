import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Target,
  TrendingUp,
  Clock,
  ArrowRight,
  PenTool,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { getLearningGoalLabel } from '@/lib/utils';
import { GenerateRecommendationButton } from '@/components/generate-recommendation-button';
import { DashboardActivityHeatmap } from '@/components/dashboard-activity-heatmap';

interface DashboardStats {
  totalReadingSubmissions: number;
  totalWritingSubmissions: number;
  avgReadingScore: number;
  writingPassRate: number;
  aspectAverages: Record<string, number>;
  recentActivity: Array<{
    type: 'reading' | 'writing';
    id: string;
    title: string;
    language: string;
    score: number | null;
    passed: boolean | null;
    date: string;
  }>;
  thisWeekCount: number;
}

interface LearningAnalysis {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string;
  analyzedAt: string;
  cached: boolean;
}

async function getDashboardStats(userId: string): Promise<DashboardStats | null> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/dashboard/stats?userId=${userId}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return null;
  }
}

async function getLearningAnalysis(userId: string): Promise<LearningAnalysis | null> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/dashboard/analysis?userId=${userId}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching learning analysis:', error);
    return null;
  }
}

interface ActivityResponse {
  activity: Array<{
    date: string;
    count: number;
  }>;
}

async function getDashboardActivity(userId: string): Promise<ActivityResponse | null> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/dashboard/activity?userId=${userId}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('Error fetching dashboard activity:', error);
    return null;
  }
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const [stats, analysis, activity] = await Promise.all([
    getDashboardStats(session.user.id),
    getLearningAnalysis(session.user.id),
    getDashboardActivity(session.user.id),
  ]);

  const totalSubmissions =
    (stats?.totalReadingSubmissions || 0) + (stats?.totalWritingSubmissions || 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          おかえりなさい、{session.user.name || 'ユーザー'}さん
        </h1>
        <p className="text-slate-400 mt-2">
          今日もコードリーディング・ライティングを頑張りましょう！
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          label="リーディング提出"
          value={`${stats?.totalReadingSubmissions || 0}回`}
          color="cyan"
        />
        <StatCard
          icon={<PenTool className="w-5 h-5" />}
          label="ライティング提出"
          value={`${stats?.totalWritingSubmissions || 0}回`}
          color="violet"
        />
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="平均スコア"
          value={stats?.avgReadingScore ? `${stats.avgReadingScore}点` : '-'}
          color="emerald"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="今週の提出"
          value={`${stats?.thisWeekCount || 0}回`}
          color="amber"
        />
      </div>

      {/* Activity Heatmap */}
      {activity && activity.activity.length > 0 && (
        <div className="mb-6">
          <DashboardActivityHeatmap activity={activity.activity} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Aspect Scores */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>あなたのスコアマップ</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.aspectAverages && Object.keys(stats.aspectAverages).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(stats.aspectAverages).map(([aspect, score]) => (
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
            ) : (
              <p className="text-slate-400 text-sm">
                問題に挑戦すると、観点別のスコアが表示されます。
              </p>
            )}

            {/* ライティング成功率 */}
            {stats && stats.totalWritingSubmissions > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">ライティング成功率</span>
                  <span className="text-lg font-bold text-emerald-400">
                    {stats.writingPassRate}%
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${stats.writingPassRate}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>最近の挑戦</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div
                    key={`${activity.type}-${activity.id}`}
                    className="p-3 bg-slate-700/30 rounded-lg"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {activity.type === 'reading' ? (
                        <BookOpen className="w-3 h-3 text-cyan-400" />
                      ) : (
                        <PenTool className="w-3 h-3 text-violet-400" />
                      )}
                      <span className="text-xs text-slate-500">
                        {activity.type === 'reading' ? 'リーディング' : 'ライティング'}
                      </span>
                    </div>
                    <p className="text-white font-medium text-sm line-clamp-2">{activity.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-400">
                        {new Date(activity.date).toLocaleDateString('ja-JP')}
                      </span>
                      {activity.type === 'reading' && activity.score !== null && (
                        <Badge variant={activity.score >= 70 ? 'success' : 'warning'}>
                          {activity.score}点
                        </Badge>
                      )}
                      {activity.type === 'writing' &&
                        activity.passed !== null &&
                        (activity.passed ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            成功
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400">
                            <XCircle className="w-3 h-3 mr-1" />
                            失敗
                          </Badge>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">まだ完了した問題がありません</p>
            )}

            <div className="flex gap-2 mt-4">
              <Link href="/exercises" className="flex-1">
                <Button variant="secondary" className="w-full" size="sm">
                  <BookOpen className="w-4 h-4 mr-1" />
                  リーディング
                </Button>
              </Link>
              <Link href="/writing" className="flex-1">
                <Button variant="secondary" className="w-full" size="sm">
                  <PenTool className="w-4 h-4 mr-1" />
                  ライティング
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Analysis Section */}
      {analysis && (
        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          {/* Strengths */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                あなたの強み
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.strengths.length > 0 ? (
                <ul className="space-y-2">
                  {analysis.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm">まだ分析データがありません</p>
              )}
            </CardContent>
          </Card>

          {/* Weaknesses */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                改善ポイント
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.weaknesses.length > 0 ? (
                <ul className="space-y-2">
                  {analysis.weaknesses.map((weakness, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                      <Target className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      {weakness}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm">現時点では特に改善点は見つかりません</p>
              )}
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lightbulb className="w-5 h-5 text-cyan-400" />
                おすすめ
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.recommendations.length > 0 ? (
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                      <ArrowRight className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-400 text-sm">問題に挑戦するとおすすめが表示されます</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Summary & Generate Recommendation */}
      {analysis && analysis.summary && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-violet-400" />
              AI分析サマリ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300 mb-4">{analysis.summary}</p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-700">
              <span className="text-xs text-slate-500">
                最終分析: {new Date(analysis.analyzedAt).toLocaleString('ja-JP')}
              </span>
              <GenerateRecommendationButton userId={session.user.id} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {totalSubmissions === 0 && (
        <Card className="mt-6">
          <CardContent className="py-12">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-cyan-500/10 to-violet-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">さあ、学習を始めましょう！</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">
                問題に挑戦すると、あなたの強みや改善点をAIが分析し、 最適な学習プランを提案します。
              </p>
              <div className="flex gap-3 justify-center">
                <Link href="/exercises">
                  <Button>
                    <BookOpen className="w-4 h-4 mr-2" />
                    リーディングに挑戦
                  </Button>
                </Link>
                <Link href="/writing">
                  <Button variant="secondary">
                    <PenTool className="w-4 h-4 mr-2" />
                    ライティングに挑戦
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
