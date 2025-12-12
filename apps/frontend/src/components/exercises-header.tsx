'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreateExerciseDialog } from '@/components/create-exercise-dialog';
import { Plus } from 'lucide-react';

interface ExercisesHeaderProps {
  userId: string;
}

export function ExercisesHeader({ userId }: ExercisesHeaderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">学習</h1>
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

