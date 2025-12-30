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
      name: 'user',
    },
    create: {
      email: 'user@example.com',
      name: 'user',
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
            questionText:
              'useCallback と useEffect の依存配列について、なぜこの構成になっているか説明してください。',
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

  // ========== コードライティングお題 ==========

  // ライティングお題1: FizzBuzz (JavaScript)
  const writingChallenge1 = await prisma.writingChallenge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000001',
      title: 'FizzBuzz を実装しよう',
      description: `関数 fizzBuzz(n) を実装してください。

1からnまでの数値について、以下のルールで文字列の配列を返します:
- 3の倍数のとき "Fizz"
- 5の倍数のとき "Buzz"  
- 3と5両方の倍数のとき "FizzBuzz"
- それ以外は数値を文字列に変換

例: fizzBuzz(5) => ["1", "2", "Fizz", "4", "Buzz"]`,
      language: 'javascript',
      difficulty: 1,
      status: 'READY',
      testCode: `const { fizzBuzz } = require('./solution');

// テストヘルパー
let passed = 0, failed = 0;
function test(name, actual, expected) {
  const eq = JSON.stringify(actual) === JSON.stringify(expected);
  if (eq) {
    console.log('✓ ' + name + ': PASSED');
    passed++;
  } else {
    console.log('✗ ' + name + ': FAILED');
    console.log('  期待値:', JSON.stringify(expected));
    console.log('  実際値:', JSON.stringify(actual));
    failed++;
  }
}

// テストケース
test('fizzBuzz(1)', fizzBuzz(1), ["1"]);
test('fizzBuzz(3)', fizzBuzz(3), ["1", "2", "Fizz"]);
test('fizzBuzz(5)', fizzBuzz(5), ["1", "2", "Fizz", "4", "Buzz"]);
test('fizzBuzz(15)', fizzBuzz(15), ["1", "2", "Fizz", "4", "Buzz", "Fizz", "7", "8", "Fizz", "Buzz", "11", "Fizz", "13", "14", "FizzBuzz"]);

// 結果サマリ
console.log('');
console.log(passed + '/' + (passed + failed) + ' tests passed');
if (failed > 0) process.exit(1);`,
      starterCode: `// 1からnまでの数値についてFizzBuzzのルールで変換した配列を返す関数
function fizzBuzz(n) {
  // ここに実装を書いてください
  const result = [];
  // TODO: 1からnまでループして、ルールに従って配列に追加
  return result;
}

module.exports = { fizzBuzz };`,
      sampleCode: `function fizzBuzz(n) {
  const result = [];
  for (let i = 1; i <= n; i++) {
    if (i % 15 === 0) result.push("FizzBuzz");
    else if (i % 3 === 0) result.push("Fizz");
    else if (i % 5 === 0) result.push("Buzz");
    else result.push(String(i));
  }
  return result;
}
module.exports = { fizzBuzz };`,
    },
  });

  console.log('Created writing challenge 1:', writingChallenge1.id);

  // ライティングお題2: 配列の合計 (Python)
  const writingChallenge2 = await prisma.writingChallenge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000002',
      title: '配列の合計と平均を計算',
      description: `関数 calculate_stats(numbers) を実装してください。

整数のリストを受け取り、合計と平均を含む辞書を返します:
- 空リストの場合は {"sum": 0, "average": 0} を返す
- 平均は小数点以下2桁まで（四捨五入）

例: calculate_stats([1, 2, 3, 4, 5]) => {"sum": 15, "average": 3.0}`,
      language: 'python',
      difficulty: 1,
      status: 'READY',
      testCode: `from solution import calculate_stats

# テストヘルパー
passed, failed = 0, 0
def test(name, actual, expected):
    global passed, failed
    if actual == expected:
        print(f"✓ {name}: PASSED")
        passed += 1
    else:
        print(f"✗ {name}: FAILED")
        print(f"  期待値: {repr(expected)}")
        print(f"  実際値: {repr(actual)}")
        failed += 1

# テストケース
test("calculate_stats([])", calculate_stats([]), {"sum": 0, "average": 0})
test("calculate_stats([5])", calculate_stats([5]), {"sum": 5, "average": 5.0})
test("calculate_stats([1, 2, 3, 4, 5])", calculate_stats([1, 2, 3, 4, 5]), {"sum": 15, "average": 3.0})
test("calculate_stats([10, 20, 30])", calculate_stats([10, 20, 30]), {"sum": 60, "average": 20.0})

# 結果サマリ
print()
print(f"{passed}/{passed + failed} tests passed")
if failed > 0:
    exit(1)`,
      starterCode: `# 整数のリストを受け取り、合計と平均を含む辞書を返す関数
def calculate_stats(numbers):
    # ここに実装を書いてください
    # TODO: 合計と平均を計算して辞書で返す
    return {"sum": 0, "average": 0}`,
      sampleCode: `def calculate_stats(numbers):
    if not numbers:
        return {"sum": 0, "average": 0}
    total = sum(numbers)
    avg = round(total / len(numbers), 2)
    return {"sum": total, "average": avg}`,
    },
  });

  console.log('Created writing challenge 2:', writingChallenge2.id);

  // ライティングお題3: 文字列反転 (TypeScript)
  const writingChallenge3 = await prisma.writingChallenge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000003',
      title: '単語ごとに文字列を反転',
      description: `関数 reverseWords(str: string): string を実装してください。

文字列を受け取り、単語の順序は保ったまま各単語の文字を反転させます:
- 単語はスペースで区切られる
- 連続するスペースは1つのスペースとして扱う

例: reverseWords("hello world") => "olleh dlrow"
例: reverseWords("The quick brown fox") => "ehT kciuq nworb xof"`,
      language: 'typescript',
      difficulty: 2,
      status: 'READY',
      testCode: `import { reverseWords } from './solution';

// テストヘルパー
let passed = 0, failed = 0;
function test(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log('✓ ' + name + ': PASSED');
    passed++;
  } else {
    console.log('✗ ' + name + ': FAILED');
    console.log('  期待値:', JSON.stringify(expected));
    console.log('  実際値:', JSON.stringify(actual));
    failed++;
  }
}

// テストケース
test('reverseWords("hello")', reverseWords("hello"), "olleh");
test('reverseWords("hello world")', reverseWords("hello world"), "olleh dlrow");
test('reverseWords("The quick brown fox")', reverseWords("The quick brown fox"), "ehT kciuq nworb xof");
test('reverseWords("a b c")', reverseWords("a b c"), "a b c");
test('reverseWords("")', reverseWords(""), "");

// 結果サマリ
console.log('');
console.log(passed + '/' + (passed + failed) + ' tests passed');
if (failed > 0) process.exit(1);`,
      starterCode: `// 文字列を受け取り、各単語の文字を反転させる関数
export function reverseWords(str: string): string {
  // ここに実装を書いてください
  // TODO: 各単語を反転して返す
  return "";
}`,
      sampleCode: `export function reverseWords(str: string): string {
  return str
    .split(' ')
    .map(word => word.split('').reverse().join(''))
    .join(' ');
}`,
    },
  });

  console.log('Created writing challenge 3:', writingChallenge3.id);

  // ライティングお題4: 素数判定 (Go)
  const writingChallenge4 = await prisma.writingChallenge.upsert({
    where: { id: '10000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '10000000-0000-0000-0000-000000000004',
      title: '素数判定関数を実装',
      description: `関数 IsPrime(n int) bool を実装してください。

整数を受け取り、素数かどうかを判定します:
- 2未満の数は素数ではない
- 2は素数
- 効率的なアルゴリズムを心がける

例: IsPrime(2) => true
例: IsPrime(4) => false
例: IsPrime(17) => true`,
      language: 'go',
      difficulty: 2,
      status: 'READY',
      testCode: `package solution

import (
	"fmt"
	"testing"
)

func TestIsPrime(t *testing.T) {
	tests := []struct {
		name string
		n    int
		want bool
	}{
		{"IsPrime(0)", 0, false},
		{"IsPrime(1)", 1, false},
		{"IsPrime(2)", 2, true},
		{"IsPrime(3)", 3, true},
		{"IsPrime(4)", 4, false},
		{"IsPrime(17)", 17, true},
		{"IsPrime(18)", 18, false},
		{"IsPrime(97)", 97, true},
		{"IsPrime(100)", 100, false},
	}

	passed := 0
	for _, tt := range tests {
		got := IsPrime(tt.n)
		if got == tt.want {
			fmt.Printf("✓ %s: PASSED\\n", tt.name)
			passed++
		} else {
			fmt.Printf("✗ %s: FAILED\\n", tt.name)
			fmt.Printf("  期待値: %v\\n", tt.want)
			fmt.Printf("  実際値: %v\\n", got)
			t.Fail()
		}
	}
	fmt.Printf("\\n%d/%d tests passed\\n", passed, len(tests))
}`,
      starterCode: `package solution

// 整数を受け取り、素数かどうかを判定する関数
func IsPrime(n int) bool {
	// ここに実装を書いてください
	// TODO: 素数判定のロジックを実装
	return false
}`,
      sampleCode: `package solution

func IsPrime(n int) bool {
	if n < 2 {
		return false
	}
	if n == 2 {
		return true
	}
	if n%2 == 0 {
		return false
	}
	for i := 3; i*i <= n; i += 2 {
		if n%i == 0 {
			return false
		}
	}
	return true
}`,
    },
  });

  console.log('Created writing challenge 4:', writingChallenge4.id);

  // ========== メタデータ（成長サマリ） ==========
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const dayMs = 24 * 60 * 60 * 1000;
  const weeks = 52;
  const makeId = (prefix: string, index: number) =>
    `${prefix}-0000-0000-0000-${index.toString().padStart(12, '0')}`;
  const readingSubmissions: Array<{ id: string; createdAt: Date }> = [];
  const writingSubmissions: Array<{ id: string; createdAt: Date; passed: boolean }> = [];
  const exercises = [exercise1, exercise2, exercise3];
  const challenges = [writingChallenge1, writingChallenge2, writingChallenge3, writingChallenge4];
  const firstWeek = new Date(now.getTime() - (weeks - 1) * 7 * dayMs);

  for (let i = 0; i < weeks; i += 1) {
    const createdAt = new Date(firstWeek.getTime() + i * 7 * dayMs);
    const readingId = makeId('20000000', i + 1);
    const exercise = exercises[i % exercises.length];

    await prisma.submission.upsert({
      where: { id: readingId },
      update: { status: 'EVALUATED' },
      create: {
        id: readingId,
        exerciseId: exercise.id,
        userId: sampleUser.id,
        status: 'EVALUATED',
        createdAt,
      },
    });

    readingSubmissions.push({ id: readingId, createdAt });

    const writingId = makeId('30000000', i + 1);
    const challenge = challenges[i % challenges.length];
    const writingScore = i < 10 ? 0 : i < 26 ? 50 : 100;
    const passed = writingScore >= 100;

    await prisma.writingSubmission.upsert({
      where: { id: writingId },
      update: {
        status: 'COMPLETED',
        passed,
      },
      create: {
        id: writingId,
        challengeId: challenge.id,
        userId: sampleUser.id,
        language: challenge.language,
        code: challenge.sampleCode || challenge.starterCode || '',
        status: 'COMPLETED',
        stdout: passed ? 'tests passed' : 'tests failed',
        stderr: '',
        exitCode: passed ? 0 : 1,
        passed,
        executedAt: createdAt,
        llmFeedback: passed
          ? '要件通りに実装できています。可読性の向上を意識しましょう。'
          : '境界ケースの洗い出しと条件分岐の整理を意識しましょう。',
        llmFeedbackStatus: 'COMPLETED',
        llmFeedbackAt: createdAt,
        createdAt,
      },
    });

    writingSubmissions.push({ id: writingId, createdAt, passed });
  }

  const samplePlan = {
    summary: '1週間で責務理解とデータフローの説明力を高める',
    focusAreas: ['responsibility', 'data_flow', 'error_handling'],
    weeklyPlan: [
      {
        title: '責務理解の強化と構造整理',
        goals: ['クラス/関数の役割を整理して説明できる'],
        activities: ['毎日1問のリーディング', '提出前に責務分解メモを作成'],
        deliverables: ['責務分解の要約メモ', 'レビュー付き提出'],
      },
    ],
    quickTests: [
      {
        name: '責務説明テスト',
        task: '対象コードの責務を3点で説明する',
        expectedAnswer: '役割/入出力/副作用を網羅する',
        evaluationCriteria: ['責務が具体的', '入出力が明確', '副作用に言及'],
      },
    ],
    checkpoints: [
      {
        metric: '責務理解スコア',
        target: '70点以上',
        when: 'スプリント終了時',
      },
    ],
    reminders: ['1日1問を継続する'],
  };

  const learningPlan = await prisma.learningPlan.upsert({
    where: { id: '70000000-0000-0000-0000-000000000001' },
    update: {
      plan: samplePlan,
    },
    create: {
      id: '70000000-0000-0000-0000-000000000001',
      userId: sampleUser.id,
      plan: samplePlan,
      presetAnswers: [
        { question: 'いまの課題や伸ばしたい領域は？', answer: '責務理解とデータフロー' },
        { question: '好きな/得意な言語・フレームワークは？', answer: 'TypeScript' },
        { question: '週あたりの学習時間は？', answer: '6時間' },
      ],
      targetLanguage: 'TypeScript',
      modelId: 'seed',
      temperature: 0.2,
      createdAt: daysAgo(9),
      updatedAt: daysAgo(9),
    },
  });

  await prisma.mentorSprint.upsert({
    where: { id: '80000000-0000-0000-0000-000000000001' },
    update: {
      goal: samplePlan.summary,
      focusAreas: samplePlan.focusAreas,
      startDate: daysAgo(2),
      endDate: daysAgo(-5),
      status: 'ACTIVE',
    },
    create: {
      id: '80000000-0000-0000-0000-000000000001',
      userId: sampleUser.id,
      learningPlanId: learningPlan.id,
      sequence: 1,
      goal: samplePlan.summary,
      focusAreas: samplePlan.focusAreas,
      startDate: daysAgo(2),
      endDate: daysAgo(-5),
      status: 'ACTIVE',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  });

  const feedbackTemplates = [
    {
      overall: '基礎理解が安定してきました。改善点を整理しながら積み上げられています。',
      strengths: ['責務の切り分けが明確', '説明が端的で読みやすい'],
      improvements: [
        { area: 'エラーハンドリング', advice: '例外の種類と復旧パターンを整理しましょう。' },
        { area: 'データフロー', advice: '入力→処理→出力の図解を添えるとより明確です。' },
      ],
      nextFocus: ['error_handling', 'data_flow'],
    },
    {
      overall: '応用的な観点が増えてきました。次は品質と速度の両立を意識しましょう。',
      strengths: ['データフローの追跡が安定', '改善案の粒度が適切'],
      improvements: [
        { area: 'パフォーマンス', advice: 'ボトルネックになりやすい処理を先に洗い出しましょう。' },
        { area: '設計選択', advice: 'トレードオフと採用理由を明記しましょう。' },
      ],
      nextFocus: ['performance', 'responsibility'],
    },
    {
      overall: '品質面の安定感が出ています。次は再現性の高い改善提案を目指しましょう。',
      strengths: ['パフォーマンス観点の指摘が増えた', '根拠のある提案ができている'],
      improvements: [
        { area: 'テスト観点', advice: '境界ケースの網羅性を上げましょう。' },
        { area: '運用面', advice: 'ログ/監視の観点を追加しましょう。' },
      ],
      nextFocus: ['error_handling', 'performance'],
    },
  ];

  const feedbackInsights: Array<{
    id: string;
    userId: string;
    mentorFeedbackId: string;
    type: 'STRENGTH' | 'IMPROVEMENT';
    label: string;
    detail: string | null;
    example: string | null;
    createdAt: Date;
  }> = [];
  let insightIndex = 1;

  const feedbackCount = 12;
  for (let i = 0; i < feedbackCount; i += 1) {
    const feedbackId = makeId('40000000', i + 1);
    const monthIndex = i + 1;
    const submissionIndex = Math.min(i * 4 + 3, readingSubmissions.length - 1);
    const submission = readingSubmissions[submissionIndex];
    const template = feedbackTemplates[Math.min(Math.floor(i / 4), feedbackTemplates.length - 1)];
    const feedback = {
      overall: `${template.overall} ${monthIndex}ヶ月目の振り返りです。`,
      strengths: template.strengths,
      improvements: template.improvements,
      nextFocus: template.nextFocus,
    };

    await prisma.mentorFeedbackLog.upsert({
      where: { id: feedbackId },
      update: {
        feedback,
        submissionId: submission.id,
        modelId: 'seed',
        temperature: 0.1,
      },
      create: {
        id: feedbackId,
        userId: sampleUser.id,
        submissionId: submission.id,
        feedback,
        modelId: 'seed',
        temperature: 0.1,
        createdAt: submission.createdAt,
      },
    });

    template.strengths.forEach((label) => {
      feedbackInsights.push({
        id: makeId('60000000', insightIndex),
        userId: sampleUser.id,
        mentorFeedbackId: feedbackId,
        type: 'STRENGTH',
        label,
        detail: null,
        example: null,
        createdAt: submission.createdAt,
      });
      insightIndex += 1;
    });

    template.improvements.forEach((improvement) => {
      feedbackInsights.push({
        id: makeId('60000000', insightIndex),
        userId: sampleUser.id,
        mentorFeedbackId: feedbackId,
        type: 'IMPROVEMENT',
        label: improvement.area,
        detail: improvement.advice,
        example: null,
        createdAt: submission.createdAt,
      });
      insightIndex += 1;
    });
  }

  await prisma.mentorFeedbackInsight.createMany({
    data: feedbackInsights,
    skipDuplicates: true,
  });

  const clampScore = (score: number) => Math.max(35, Math.min(95, score));
  const evaluationMetrics: Array<{
    id: string;
    userId: string;
    sourceType: 'READING' | 'WRITING';
    aspect: string;
    score: number;
    submissionId?: string | null;
    writingSubmissionId?: string | null;
    createdAt: Date;
  }> = [];
  let metricIndex = 1;

  for (let i = 0; i < readingSubmissions.length; i += 1) {
    const progress = i / Math.max(1, readingSubmissions.length - 1);
    const base = 55 + progress * 25;
    const wobble = (i % 4) - 1.5;
    const submission = readingSubmissions[i];

    evaluationMetrics.push({
      id: makeId('50000000', metricIndex),
      userId: sampleUser.id,
      sourceType: 'READING',
      aspect: 'responsibility',
      score: clampScore(Math.round(base + 6 + wobble)),
      submissionId: submission.id,
      createdAt: submission.createdAt,
    });
    metricIndex += 1;

    evaluationMetrics.push({
      id: makeId('50000000', metricIndex),
      userId: sampleUser.id,
      sourceType: 'READING',
      aspect: 'data_flow',
      score: clampScore(Math.round(base + 3 + wobble)),
      submissionId: submission.id,
      createdAt: submission.createdAt,
    });
    metricIndex += 1;

    evaluationMetrics.push({
      id: makeId('50000000', metricIndex),
      userId: sampleUser.id,
      sourceType: 'READING',
      aspect: 'error_handling',
      score: clampScore(Math.round(base - 1 + wobble)),
      submissionId: submission.id,
      createdAt: submission.createdAt,
    });
    metricIndex += 1;

    evaluationMetrics.push({
      id: makeId('50000000', metricIndex),
      userId: sampleUser.id,
      sourceType: 'READING',
      aspect: 'performance',
      score: clampScore(Math.round(base - 6 + wobble)),
      submissionId: submission.id,
      createdAt: submission.createdAt,
    });
    metricIndex += 1;

    const writingSubmission = writingSubmissions[i];
    const writingScore = i < 10 ? 0 : i < 26 ? 50 : 100;

    evaluationMetrics.push({
      id: makeId('50000000', metricIndex),
      userId: sampleUser.id,
      sourceType: 'WRITING',
      aspect: 'tests_passed',
      score: writingScore,
      writingSubmissionId: writingSubmission.id,
      createdAt: writingSubmission.createdAt,
    });
    metricIndex += 1;
  }

  await prisma.evaluationMetric.createMany({
    data: evaluationMetrics,
    skipDuplicates: true,
  });

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
