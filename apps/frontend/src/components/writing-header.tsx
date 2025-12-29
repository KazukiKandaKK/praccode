'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreateWritingChallengeDialog } from '@/components/create-writing-challenge-dialog';
import { Plus, PenTool } from 'lucide-react';

interface WritingHeaderProps {
  userId: string;
}

export function WritingHeader({ userId }: WritingHeaderProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-violet-500/10 rounded-xl">
              <PenTool className="w-6 h-6 text-violet-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">コードライティング</h1>
          </div>
          <p className="text-slate-400">お題に沿ってコードを書き、テストを通過させましょう。</p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          お題を生成
        </Button>
      </div>

      <CreateWritingChallengeDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        userId={userId}
      />
    </>
  );
}

