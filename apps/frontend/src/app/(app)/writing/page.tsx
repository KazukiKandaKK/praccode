import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WritingHeader } from '@/components/writing-header';
import { getDifficultyLabel, getDifficultyColor, getLanguageLabel } from '@/lib/utils';
import { ArrowRight, Code2 } from 'lucide-react';

interface WritingChallenge {
  id: string;
  title: string;
  description: string;
  language: string;
  difficulty: number;
  createdAt: string;
}

async function getChallenges(): Promise<{ challenges: WritingChallenge[] }> {
  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/writing/challenges`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch challenges:', response.status);
      return { challenges: [] };
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching challenges:', error);
    return { challenges: [] };
  }
}

export default async function WritingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { challenges } = await getChallenges();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Create Button */}
      <WritingHeader userId={session.user.id} />

      {/* Challenge Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {challenges.map((challenge) => (
          <ChallengeCard key={challenge.id} challenge={challenge} />
        ))}
      </div>

      {/* Empty State */}
      {challenges.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Code2 className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">お題がありません</h3>
          <p className="text-slate-400">「お題を生成」ボタンから新しいお題を作成してみましょう</p>
        </div>
      )}
    </div>
  );
}

function ChallengeCard({ challenge }: { challenge: WritingChallenge }) {
  return (
    <Card className="group hover:border-violet-500/30 transition-colors">
      <CardContent className="p-6">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="primary">{getLanguageLabel(challenge.language)}</Badge>
          <Badge className={getDifficultyColor(challenge.difficulty)}>
            {getDifficultyLabel(challenge.difficulty)}
          </Badge>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-violet-400 transition-colors line-clamp-2">
          {challenge.title}
        </h3>

        {/* Description */}
        <p className="text-sm text-slate-400 mb-4 line-clamp-3">
          {challenge.description}
        </p>

        {/* Action */}
        <Link href={`/writing/${challenge.id}`}>
          <Button variant="secondary" className="w-full group-hover:bg-violet-500 group-hover:text-white transition-colors">
            挑戦する
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

