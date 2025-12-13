'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { useEvaluationToast } from '@/components/evaluation-toast-provider';

interface CreateExerciseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const LANGUAGES = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'go', label: 'Go' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'python', label: 'Python' },
];

const DIFFICULTIES = [
  { value: 1, label: '入門', description: 'シンプルな関数や基本的なパターン' },
  { value: 2, label: '初級', description: '基本的なクラスやモジュール構造' },
  { value: 3, label: '中級', description: '複数のコンポーネントが連携する実践的なコード' },
  { value: 4, label: '上級', description: '複雑なアーキテクチャパターン' },
  { value: 5, label: 'エキスパート', description: '高度な設計パターン' },
];

const GENRES = [
  { value: 'auth', label: '認証/認可' },
  { value: 'database', label: 'DB' },
  { value: 'error_handling', label: 'エラーハンドリング' },
  { value: 'api_client', label: 'APIクライアント' },
  { value: 'async_concurrency', label: '非同期/並行' },
  { value: 'performance', label: 'パフォーマンス' },
  { value: 'testing', label: 'テスト' },
  { value: 'refactoring', label: 'リファクタリング' },
];

export function CreateExerciseDialog({ isOpen, onClose, userId }: CreateExerciseDialogProps) {
  const { startGenerationWatch } = useEvaluationToast();
  const [language, setLanguage] = useState('typescript');
  const [difficulty, setDifficulty] = useState(2);
  const [genre, setGenre] = useState('error_handling');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/exercises/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          language,
          difficulty,
          genre,
          userId,
        }),
      });

      if (!response.ok && response.status !== 202) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate exercise');
      }

      const data = await response.json();

      // 非同期生成開始: ダイアログを閉じてバックグラウンド監視開始
      startGenerationWatch(data.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '問題の生成に失敗しました');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <Card className="relative z-10 w-full max-w-lg mx-4 bg-slate-900 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            問題を作成
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
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => setLanguage(lang.value)}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    language === lang.value
                      ? 'bg-cyan-500 text-slate-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* ジャンル選択 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">ジャンル</label>
            <div className="grid grid-cols-2 gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGenre(g.value)}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    genre === g.value
                      ? 'bg-cyan-500 text-slate-900'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* 難易度選択 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">難易度</label>
            <div className="space-y-2">
              {DIFFICULTIES.map((diff) => (
                <button
                  key={diff.value}
                  onClick={() => setDifficulty(diff.value)}
                  disabled={isGenerating}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                    difficulty === diff.value
                      ? 'bg-cyan-500/20 border-2 border-cyan-500'
                      : 'bg-slate-800 border-2 border-transparent hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-medium ${
                        difficulty === diff.value ? 'text-cyan-400' : 'text-white'
                      }`}
                    >
                      Lv.{diff.value} {diff.label}
                    </span>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-full ${
                            i < diff.value ? 'bg-cyan-500' : 'bg-slate-600'
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
            className="w-full bg-gradient-to-r from-cyan-500 to-violet-500 hover:from-cyan-400 hover:to-violet-400 text-white font-semibold py-3"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                問題を生成する
              </>
            )}
          </Button>

          <p className="text-xs text-center text-slate-400">生成完了後、右上に通知が届きます</p>
        </CardContent>
      </Card>
    </div>
  );
}
