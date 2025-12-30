'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreateExerciseDialog } from '@/components/create-exercise-dialog';
import { ChevronLeft, Plus } from 'lucide-react';
import { useMentorWorkflowTracker } from '@/hooks/use-mentor-workflow-tracker';

interface ExercisesHeaderProps {
  userId: string;
}

export function ExercisesHeader({ userId }: ExercisesHeaderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const searchParams = useSearchParams();
  const fromMentor = searchParams.get('from') === 'mentor';

  useMentorWorkflowTracker({ userId, step: 'DO' });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          {fromMentor && (
            <Link
              href="/mentor"
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ChevronLeft className="w-4 h-4" />
              AIメンターに戻る
            </Link>
          )}
          <h1 className="text-3xl font-bold text-white">コードリーディング</h1>
          <p className="text-slate-400 mt-1">コードを読んで理解力を鍛えましょう</p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          問題を作成
        </Button>
      </div>

      <CreateExerciseDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        userId={userId}
      />
    </>
  );
}
