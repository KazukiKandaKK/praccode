'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CodeViewer } from '@/components/code-viewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDifficultyLabel, getDifficultyColor, getLanguageLabel, getLearningGoalLabel } from '@/lib/utils';
import { Lightbulb, Send, Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

// Mock data - in real app, fetch from API
const mockExercises: Record<string, {
  id: string;
  title: string;
  language: string;
  difficulty: number;
  code: string;
  learningGoals: string[];
  questions: Array<{
    id: string;
    questionIndex: number;
    questionText: string;
  }>;
}> = {
  '00000000-0000-0000-0000-000000000001': {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'TypeScript サービスクラスの責務を理解する',
    language: 'typescript',
    difficulty: 2,
    learningGoals: ['responsibility', 'data_flow', 'error_handling'],
    code: `import { prisma } from '../lib/prisma';

export class UserService {
  async createUser(email: string, name: string) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    const user = await prisma.user.create({
      data: { email, name },
    });

    await this.sendWelcomeEmail(user.email);
    return user;
  }

  private async sendWelcomeEmail(email: string) {
    // メール送信ロジック（省略）
    console.log(\`Sending welcome email to \${email}\`);
  }

  async getUserById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }
}`,
    questions: [
      {
        id: 'q1',
        questionIndex: 0,
        questionText: 'このクラスの責務を1〜2文で説明してください。',
      },
      {
        id: 'q2',
        questionIndex: 1,
        questionText: 'createUser メソッドのデータフロー（入力→処理→出力）を説明してください。',
      },
      {
        id: 'q3',
        questionIndex: 2,
        questionText: 'このコードで気になる点や改善すべき点があれば挙げてください。',
      },
    ],
  },
  '00000000-0000-0000-0000-000000000002': {
    id: '00000000-0000-0000-0000-000000000002',
    title: 'React カスタムフックのデータフェッチパターン',
    language: 'typescript',
    difficulty: 3,
    learningGoals: ['data_flow', 'error_handling', 'performance'],
    code: `import { useState, useEffect, useCallback } from 'react';

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useFetch<T>(url: string): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(\`HTTP error! status: \${response.status}\`);
      }
      
      const data = await response.json();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ 
        data: null, 
        loading: false, 
        error: error instanceof Error ? error : new Error('Unknown error') 
      });
    }
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...state, refetch: fetchData };
}`,
    questions: [
      {
        id: 'q1',
        questionIndex: 0,
        questionText: 'このカスタムフックが提供する機能を説明してください。',
      },
      {
        id: 'q2',
        questionIndex: 1,
        questionText: 'useCallback と useEffect の依存配列について、なぜこの構成になっているか説明してください。',
      },
      {
        id: 'q3',
        questionIndex: 2,
        questionText: 'このフックの改善点やエッジケースへの対応について考えてください。',
      },
    ],
  },
  '00000000-0000-0000-0000-000000000003': {
    id: '00000000-0000-0000-0000-000000000003',
    title: 'API エラーハンドリングパターン',
    language: 'typescript',
    difficulty: 3,
    learningGoals: ['error_handling', 'responsibility'],
    code: `export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function handleApiResponse<T>(
  response: Response
): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    
    throw new ApiError(
      errorBody.message || 'An error occurred',
      response.status,
      errorBody.code || 'UNKNOWN_ERROR'
    );
  }

  return response.json();
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return 'ログインが必要です';
      case 'FORBIDDEN':
        return 'アクセス権限がありません';
      case 'NOT_FOUND':
        return 'リソースが見つかりません';
      case 'VALIDATION_ERROR':
        return '入力内容に誤りがあります';
      default:
        return error.message;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return '予期しないエラーが発生しました';
}`,
    questions: [
      {
        id: 'q1',
        questionIndex: 0,
        questionText: 'ApiError クラスの設計意図を説明してください。',
      },
      {
        id: 'q2',
        questionIndex: 1,
        questionText: 'handleApiResponse 関数でのエラー処理の流れを説明してください。',
      },
      {
        id: 'q3',
        questionIndex: 2,
        questionText: 'このエラーハンドリング設計の良い点と改善点を挙げてください。',
      },
    ],
  },
};

export default function ExerciseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const exerciseId = params.id as string;

  const [exercise, setExercise] = useState<typeof mockExercises[string] | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [hints, setHints] = useState<Record<number, string>>({});
  const [loadingHint, setLoadingHint] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // In real app, fetch from API
    const ex = mockExercises[exerciseId];
    if (ex) {
      setExercise(ex);
      // Initialize empty answers
      const initialAnswers: Record<number, string> = {};
      ex.questions.forEach((q) => {
        initialAnswers[q.questionIndex] = '';
      });
      setAnswers(initialAnswers);
    }
  }, [exerciseId]);

  const handleAnswerChange = (questionIndex: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: value }));
  };

  const handleGetHint = async (questionIndex: number) => {
    setLoadingHint(questionIndex);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setHints((prev) => ({
      ...prev,
      [questionIndex]: 'コードの構造に注目してみましょう。このクラスがどのようなメソッドを持っているか、それぞれのメソッドが何を行っているかを整理してみてください。',
    }));
    setLoadingHint(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // In real app, create submission, save answers, then evaluate
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // Redirect to results page
    router.push(`/submissions/mock-submission-id`);
  };

  if (!exercise) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Link
        href="/exercises"
        className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        学習一覧に戻る
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="primary">{getLanguageLabel(exercise.language)}</Badge>
          <Badge className={getDifficultyColor(exercise.difficulty)}>
            {getDifficultyLabel(exercise.difficulty)}
          </Badge>
          {exercise.learningGoals.map((goal) => (
            <Badge key={goal} variant="default">
              {getLearningGoalLabel(goal)}
            </Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold text-white">{exercise.title}</h1>
      </div>

      {/* Main Content - Split View */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Code Viewer */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <CodeViewer code={exercise.code} language={exercise.language} />
        </div>

        {/* Right: Questions */}
        <div className="space-y-6">
          {exercise.questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  問題 {index + 1}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-300">{question.questionText}</p>

                {/* Hint */}
                {hints[question.questionIndex] && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-400 mb-2">
                      <Lightbulb className="w-4 h-4" />
                      <span className="text-sm font-medium">ヒント</span>
                    </div>
                    <p className="text-sm text-amber-200">{hints[question.questionIndex]}</p>
                  </div>
                )}

                {/* Answer Input */}
                <textarea
                  value={answers[question.questionIndex] || ''}
                  onChange={(e) => handleAnswerChange(question.questionIndex, e.target.value)}
                  placeholder="回答を入力してください..."
                  rows={4}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                />

                {/* Hint Button */}
                {!hints[question.questionIndex] && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleGetHint(question.questionIndex)}
                    disabled={loadingHint === question.questionIndex}
                  >
                    {loadingHint === question.questionIndex ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ヒントを生成中...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="w-4 h-4 mr-2" />
                        ヒントをもらう
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || Object.values(answers).every((a) => !a.trim())}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                評価中...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                回答を送信して評価を受ける
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

