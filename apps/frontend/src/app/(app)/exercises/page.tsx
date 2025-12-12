import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExercisesHeader } from '@/components/exercises-header';
import { getDifficultyLabel, getDifficultyColor, getLanguageLabel, getLearningGoalLabel } from '@/lib/utils';
import { Search, Filter, ArrowRight } from 'lucide-react';

interface Exercise {
  id: string;
  title: string;
  language: string;
  difficulty: number;
  genre?: string | null;
  learningGoals: string[];
}

// APIから問題一覧を取得
async function getExercises(): Promise<{ exercises: Exercise[] }> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/exercises`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch exercises:', response.status);
      return { exercises: [] };
    }

    const data = await response.json();
    return {
      exercises: data.exercises.map((e: Exercise & { learningGoals: unknown }) => ({
        ...e,
        learningGoals: Array.isArray(e.learningGoals) ? e.learningGoals : [],
      })),
    };
  } catch (error) {
    console.error('Error fetching exercises:', error);
    return { exercises: [] };
  }
}

export default async function ExercisesPage() {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { exercises } = await getExercises();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Create Button */}
      <ExercisesHeader userId={session.user.id} />

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
          <p className="text-slate-400">「問題を作成」ボタンから新しい問題を生成してみましょう</p>
        </div>
      )}
    </div>
  );
}

function ExerciseCard({
  exercise,
}: {
  exercise: Exercise;
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
