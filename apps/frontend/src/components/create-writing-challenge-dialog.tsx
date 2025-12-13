'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { useEvaluationToast } from '@/components/evaluation-toast-provider';

interface CreateWritingChallengeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'go', label: 'Go' },
];

const DIFFICULTIES = [
  { value: 1, label: '入門', description: 'シンプルな1関数、基本的なロジック' },
  { value: 2, label: '初級', description: '複数の条件分岐、配列・文字列操作' },
  { value: 3, label: '中級', description: 'アルゴリズム的思考が必要' },
  { value: 4, label: '上級', description: '複雑なデータ構造、最適化' },
  { value: 5, label: 'エキスパート', description: '高度なアルゴリズム' },
];

export function CreateWritingChallengeDialog({ isOpen, onClose, userId }: CreateWritingChallengeDialogProps) {
  const { startWritingChallengeWatch } = useEvaluationToast();
  const [language, setLanguage] = useState<'javascript' | 'typescript' | 'python' | 'go'>('javascript');
  const [difficulty, setDifficulty] = useState(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/writing/challenges/auto`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          language,
          difficulty,
        }),
      });

      if (!response.ok && response.status !== 202) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate challenge');
      }

      const data = await response.json();

      // 非同期生成開始: ダイアログを閉じてバックグラウンド監視開始
      startWritingChallengeWatch(data.challengeId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'お題の生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <Card className="relative z-10 w-full max-w-lg mx-4 bg-slate-900 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-violet-400" />
            お題を生成
          </CardTitle>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            disabled={isGenerating}
          >
            <X className="w-5 h-5" />
          </button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* 言語選択 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              プログラミング言語
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => setLanguage(lang.value as typeof language)}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    language === lang.value
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* 難易度選択 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              難易度
            </label>
            <div className="space-y-2">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff.value}
                  onClick={() => setDifficulty(diff.value)}
                  disabled={isGenerating}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                    difficulty === diff.value
                      ? 'bg-violet-500/20 border-2 border-violet-500'
                      : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${
                      difficulty === diff.value ? 'text-violet-400' : 'text-white'
                    }`}>
                      Lv.{diff.value} {diff.label}
                    </span>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < diff.value ? 'bg-violet-500' : 'bg-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{diff.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* 生成ボタン */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 text-white font-semibold py-3"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                お題を生成する
              </>
            )}
          </Button>

          <p className="text-xs text-center text-slate-400">
            生成完了後、右上に通知が届きます
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

