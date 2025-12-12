import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDifficultyLabel, getDifficultyColor, getLanguageLabel, getLearningGoalLabel } from '@/lib/utils';
import { Search, Filter, ArrowRight } from 'lucide-react';

// In a real app, this would fetch from the API
async function getExercises() {
  // Mock data for MVP
  return {
    exercises: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        title: 'TypeScript サービスクラスの責務を理解する',
        language: 'typescript',
        difficulty: 2,
        learningGoals: ['responsibility', 'data_flow', 'error_handling'],
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        title: 'React カスタムフックのデータフェッチパターン',
        language: 'typescript',
        difficulty: 3,
        learningGoals: ['data_flow', 'error_handling', 'performance'],
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        title: 'API エラーハンドリングパターン',
        language: 'typescript',
        difficulty: 3,
        learningGoals: ['error_handling', 'responsibility'],
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 3,
      totalPages: 1,
    },
  };
}

export default async function ExercisesPage() {
  const { exercises } = await getExercises();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">学習</h1>
          <p className="text-slate-400 mt-1">コードを読んで理解力を鍛えましょう</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="学習を検索..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
        <select className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
          <option value="">言語を選択</option>
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="go">Go</option>
          <option value="ruby">Ruby</option>
          <option value="python">Python</option>
        </select>
        <select className="px-4 py-2.5 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500">
          <option value="">難易度を選択</option>
          <option value="1">入門</option>
          <option value="2">初級</option>
          <option value="3">中級</option>
          <option value="4">上級</option>
          <option value="5">エキスパート</option>
        </select>
      </div>

      {/* Exercise Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {exercises.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} />
        ))}
      </div>

      {/* Empty State */}
      {exercises.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Filter className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">学習が見つかりません</h3>
          <p className="text-slate-400">フィルターを変更してみてください</p>
        </div>
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
}: {
  exercise: {
    id: string;
    title: string;
    language: string;
    difficulty: number;
    learningGoals: string[];
  };
}) {
  return (
    <Card className="group hover:border-cyan-500/30 transition-colors">
      <CardContent className="p-6">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="primary">{getLanguageLabel(exercise.language)}</Badge>
          <Badge className={getDifficultyColor(exercise.difficulty)}>
            {getDifficultyLabel(exercise.difficulty)}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-cyan-400 transition-colors line-clamp-2">
          {exercise.title}
        </h3>

        {/* Learning Goals */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {exercise.learningGoals.slice(0, 3).map((goal) => (
            <span
              key={goal}
              className="text-xs px-2 py-1 bg-slate-700/50 text-slate-300 rounded"
            >
              {getLearningGoalLabel(goal)}
            </span>
          ))}
        </div>

        {/* Action */}
        <Link href={`/exercises/${exercise.id}`}>
          <Button variant="secondary" className="w-full group-hover:bg-cyan-500 group-hover:text-slate-900 transition-colors">
            挑戦する
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

