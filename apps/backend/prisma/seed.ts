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

