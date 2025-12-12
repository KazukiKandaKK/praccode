import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // サンプルユーザー作成（開発用）
  const hashedPassword = await bcrypt.hash('user', 10);
  const sampleUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {
      password: hashedPassword,
    },
    create: {
      email: 'user@example.com',
      name: 'Sample User',
      password: hashedPassword,
      role: 'LEARNER',
    },
  });

  console.log('Created sample user:', sampleUser.email);

  // 管理者ユーザー作成
  const adminPassword = await bcrypt.hash('admin', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      password: adminPassword,
    },
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'ADMIN',
    },
  });

  console.log('Created admin user:', adminUser.id);

  // サンプル学習1: TypeScript サービスクラス
  const exercise1 = await prisma.exercise.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'TypeScript サービスクラスの責務を理解する',
      language: 'typescript',
      difficulty: 2,
      sourceType: 'embedded',
      learningGoals: ['responsibility', 'data_flow', 'error_handling'],
      createdById: adminUser.id,
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
      questions: {
        create: [
          {
            questionIndex: 0,
            questionText: 'このクラスの責務を1〜2文で説明してください。',
            idealAnswerPoints: [
              'ユーザーの作成と取得を担当するサービスクラスである',
              'データベースとのやり取りをカプセル化している',
              '新規ユーザー作成時にウェルカムメールを送信する副作用がある',
            ],
          },
          {
            questionIndex: 1,
            questionText: 'createUser メソッドのデータフロー（入力→処理→出力）を説明してください。',
            idealAnswerPoints: [
              '入力: email と name の2つのパラメータを受け取る',
              '処理1: 既存ユーザーの重複チェックを行う',
              '処理2: 重複がなければDBにユーザーを作成する',
              '処理3: ウェルカムメールを送信する',
              '出力: 作成されたユーザーオブジェクトを返す',
            ],
          },
          {
            questionIndex: 2,
            questionText: 'このコードで気になる点や改善すべき点があれば挙げてください。',
            idealAnswerPoints: [
              'sendWelcomeEmail の失敗時にユーザー作成もロールバックされてしまう可能性がある',
              'メール送信は非同期キューに入れるべきかもしれない',
              'トランザクション処理が明示的でない',
              'エラーメッセージがシンプルすぎる（識別可能なエラーコードがあると良い）',
            ],
          },
        ],
      },
    },
  });

  console.log('Created exercise 1:', exercise1.id);

  // サンプル学習2: React Hook
  const exercise2 = await prisma.exercise.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      title: 'React カスタムフックのデータフェッチパターン',
      language: 'typescript',
      difficulty: 3,
      sourceType: 'embedded',
      learningGoals: ['data_flow', 'error_handling', 'performance'],
      createdById: adminUser.id,
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
      questions: {
        create: [
          {
            questionIndex: 0,
            questionText: 'このカスタムフックが提供する機能を説明してください。',
            idealAnswerPoints: [
              'URLを受け取ってデータをフェッチする汎用的なフック',
              'loading, data, error の3つの状態を管理する',
              'refetch 関数で手動で再取得が可能',
              'TypeScript のジェネリクスで型安全性を提供',
            ],
          },
          {
            questionIndex: 1,
            questionText: 'useCallback と useEffect の依存配列について、なぜこの構成になっているか説明してください。',
            idealAnswerPoints: [
              'useCallback は url が変わった時のみ関数を再生成する',
              'useEffect は fetchData が変わった時に実行される',
              'url 変更時に自動的に再フェッチされる仕組み',
              '無限ループを防ぐためにこの構成が必要',
            ],
          },
          {
            questionIndex: 2,
            questionText: 'このフックの改善点やエッジケースへの対応について考えてください。',
            idealAnswerPoints: [
              'コンポーネントのアンマウント時にフェッチをキャンセルする機能がない',
              'AbortController を使うべき',
              'キャッシュ機構がない',
              'リトライ機能がない',
              'レースコンディションの考慮が不十分',
            ],
          },
        ],
      },
    },
  });

  console.log('Created exercise 2:', exercise2.id);

  // サンプル学習3: エラーハンドリング
  const exercise3 = await prisma.exercise.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      title: 'API エラーハンドリングパターン',
      language: 'typescript',
      difficulty: 3,
      sourceType: 'embedded',
      learningGoals: ['error_handling', 'responsibility'],
      createdById: adminUser.id,
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
      questions: {
        create: [
          {
            questionIndex: 0,
            questionText: 'ApiError クラスの設計意図を説明してください。',
            idealAnswerPoints: [
              '標準の Error を拡張してAPI固有の情報を持たせている',
              'statusCode でHTTPステータスを保持',
              'code でアプリケーション固有のエラーコードを保持',
              '型安全なエラーハンドリングを可能にする',
            ],
          },
          {
            questionIndex: 1,
            questionText: 'handleApiResponse 関数でのエラー処理の流れを説明してください。',
            idealAnswerPoints: [
              'response.ok でHTTPステータスが成功かどうかをチェック',
              'エラー時はレスポンスボディからエラー情報を取得を試みる',
              'JSON パースに失敗した場合は空オブジェクトにフォールバック',
              'ApiError をスローして呼び出し元でハンドリング可能にする',
            ],
          },
          {
            questionIndex: 2,
            questionText: 'このエラーハンドリング設計の良い点と改善点を挙げてください。',
            idealAnswerPoints: [
              '良い点: 型ガード isApiError で型安全に判定できる',
              '良い点: エラーコードを日本語メッセージに変換する関数がある',
              '改善点: エラーコードがハードコードされている（定数化すべき）',
              '改善点: ログ記録の仕組みがない',
              '改善点: リトライ可能なエラーかどうかの判定がない',
            ],
          },
        ],
      },
    },
  });

  console.log('Created exercise 3:', exercise3.id);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

