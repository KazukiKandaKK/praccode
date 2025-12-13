'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, BookOpen, PenTool, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';

interface GenerateRecommendationButtonProps {
  userId: string;
}

type ProblemType = 'reading' | 'writing';

export function GenerateRecommendationButton({ userId }: GenerateRecommendationButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<ProblemType | null>(null);
  const router = useRouter();

  const handleGenerate = async (type: ProblemType) => {
    setIsGenerating(true);
    setGeneratingType(type);
    setIsOpen(false);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/dashboard/generate-recommendation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          language: 'javascript',
          type, // 'reading' or 'writing'
        }),
      });

      if (!response.ok) {
        throw new Error('生成に失敗しました');
      }

      const data = await response.json();
      
      const typeLabel = type === 'reading' ? 'リーディング問題' : 'ライティング問題';
      toast.success(`${typeLabel}を生成中です`, {
        description: 'しばらくお待ちください...',
      });

      // 生成完了を待って遷移
      setTimeout(() => {
        if (type === 'reading') {
          router.push(`/exercises/${data.exerciseId}`);
        } else {
          router.push(`/writing/${data.challengeId}`);
        }
      }, 3000);
    } catch (error) {
      console.error('Generate recommendation error:', error);
      toast.error('問題の生成に失敗しました');
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  return (
    <div className="relative">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isGenerating}
        size="sm"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {generatingType === 'reading' ? 'リーディング生成中...' : 'ライティング生成中...'}
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            あなた専用の問題を生成
            <ChevronDown className="w-4 h-4 ml-1" />
          </>
        )}
      </Button>

      {/* Dropdown Menu */}
      {isOpen && !isGenerating && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className="absolute right-0 bottom-full mb-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">問題タイプを選択</span>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="p-2">
              <button
                onClick={() => handleGenerate('reading')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left hover:bg-slate-800 transition-colors"
              >
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">コードリーディング</p>
                  <p className="text-xs text-slate-400">コードを読んで設問に答える</p>
                </div>
              </button>
              
              <button
                onClick={() => handleGenerate('writing')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left hover:bg-slate-800 transition-colors mt-1"
              >
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <PenTool className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">コードライティング</p>
                  <p className="text-xs text-slate-400">お題に沿ってコードを書く</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
