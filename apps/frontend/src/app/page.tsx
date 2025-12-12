import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Code2, BookOpen, BarChart3, Lightbulb } from 'lucide-react';

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Code2 className="w-8 h-8 text-cyan-400" />
              <span className="text-xl font-bold text-white">PracCode</span>
            </div>
            <div className="flex items-center gap-4">
              {session ? (
                <Link
                  href="/dashboard"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold rounded-lg transition-colors"
                >
                  ダッシュボード
                </Link>
              ) : (
                <>
                  <Link href="/login" className="text-slate-300 hover:text-white transition-colors">
                    ログイン
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold rounded-lg transition-colors"
                  >
                    無料で始める
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-violet-400">
              コード読解力を鍛える
            </span>
            
          </h1>
          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            実務レベルのコードを題材に、他人のコードを読み解く力を段階的に鍛える学習サービスです。
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={session ? '/exercises' : '/register'}
              className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold text-lg rounded-xl transition-all hover:scale-105 shadow-lg shadow-cyan-500/25"
            >
              学習を始める
            </Link>
            <Link
              href="/exercises"
              className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-lg rounded-xl transition-colors border border-slate-700"
            >
              学習を再開する
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">特徴</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<BookOpen className="w-8 h-8" />}
              title="実務レベルのコード"
              description="TypeScript, Go, Ruby など実際の開発で使われるコードパターンを題材にした学習"
            />
            <FeatureCard
              icon={<Lightbulb className="w-8 h-8" />}
              title="AI フィードバック"
              description="回答に対してAIが詳細なフィードバックを提供。良い点・改善点が明確に分かります"
            />
            <FeatureCard
              icon={<BarChart3 className="w-8 h-8" />}
              title="スキル可視化"
              description="責務理解・データフロー・エラーハンドリングなど観点別にスキルを可視化"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500">
          <p>&copy; 2024 PracCode. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 hover:border-cyan-500/30 transition-colors">
      <div className="w-14 h-14 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400 mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}

