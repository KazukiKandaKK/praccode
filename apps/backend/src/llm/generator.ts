/**
 * LLMを使った問題生成ロジック
 */

import { z } from 'zod';
import { generateWithOllama } from './llm-client.js';
import { loadPrompt, renderPrompt } from './prompt-loader.js';
import { PromptSanitizer } from './prompt-sanitizer.js';

// 生成されるExerciseの型定義
export const generatedExerciseSchema = z.object({
  title: z.string().min(1),
  code: z.string().min(1),
  learningGoals: z.array(z.string()),
  questions: z.array(
    z.object({
      questionText: z.string().min(1),
      idealAnswerPoints: z.array(z.string()),
    })
  ),
});

export type GeneratedExercise = z.infer<typeof generatedExerciseSchema>;

export interface GenerateExerciseInput {
  language: string;
  difficulty: number;
  genre: string;
}

// 言語ごとのコード例のヒント
const languageHints: Record<string, string> = {
  typescript: 'TypeScript/JavaScript のクラス、関数、React Hooks、API クライアントなど',
  javascript: 'JavaScript の関数、クラス、非同期処理、DOM操作など',
  go: 'Go の構造体、インターフェース、goroutine、エラーハンドリングなど',
  ruby: 'Ruby のクラス、モジュール、メタプログラミング、Rails パターンなど',
  python: 'Python のクラス、デコレータ、ジェネレータ、Django/Flask パターンなど',
};

// 難易度の説明
const difficultyDescriptions: Record<number, string> = {
  1: '入門レベル: シンプルな関数や基本的なパターン。初学者向け。',
  2: '初級レベル: 基本的なクラスやモジュール構造。いくつかの設計パターンを含む。',
  3: '中級レベル: 複数のコンポーネントが連携する実践的なコード。エラーハンドリングや状態管理を含む。',
  4: '上級レベル: 複雑なアーキテクチャパターン。抽象化や依存性注入を含む。',
  5: 'エキスパートレベル: 高度な設計パターン、パフォーマンス最適化、メタプログラミングなど。',
};

// ジャンル（プリセット）の説明
const genreDescriptions: Record<string, string> = {
  auth: '認証/認可、セッション、トークン、権限チェックなど',
  database: 'DBアクセス、トランザクション、N+1、スキーマ設計など',
  error_handling: '例外設計、エラー型、リトライ、失敗時のふるまいなど',
  api_client: 'HTTPクライアント、リクエスト/レスポンス変換、タイムアウト、リトライなど',
  async_concurrency: '非同期処理、並行処理、キュー、レースコンディションなど',
  performance: 'パフォーマンス最適化、キャッシュ、メモ化、ボトルネック分析など',
  testing: 'テスト設計、モック、テスト容易性、依存の切り方など',
  refactoring: 'リファクタリング、責務分離、抽象化、命名、構造改善など',
};

/**
 * 問題生成用のプロンプトを構築
 */
function buildGenerationPrompt(input: GenerateExerciseInput): string {
  const languageHint = languageHints[input.language] || input.language;
  const difficultyDesc = difficultyDescriptions[input.difficulty] || '中級レベル';
  const genreDesc = genreDescriptions[input.genre] || input.genre;

  const template = loadPrompt('generator-prompt.md');
  
  // ユーザー入力の可能性があるフィールドをサニタイズ
  const sanitizedGenre = PromptSanitizer.sanitize(input.genre, 'GENRE');
  const sanitizedLanguage = PromptSanitizer.sanitize(input.language, 'LANGUAGE');
  
  return renderPrompt(template, {
    LANGUAGE: sanitizedLanguage,
    DIFFICULTY: input.difficulty.toString(),
    DIFFICULTY_DESC: difficultyDesc,
    GENRE: sanitizedGenre,
    GENRE_DESC: genreDesc,
    LANGUAGE_HINT: languageHint,
  });
}

/**
 * LLMを使って問題を生成
 */
export async function generateExercise(input: GenerateExerciseInput): Promise<GeneratedExercise> {
  const prompt = buildGenerationPrompt(input);

  // Ollamaで生成（JSONモードを使用）
  const response = await generateWithOllama(prompt, {
    temperature: 0.7,
    maxTokens: 4096,
    jsonMode: true,
  });

  // JSONをパース
  let parsed: unknown;
  try {
    parsed = JSON.parse(response);
  } catch {
    // JSONパースに失敗した場合、コードブロックを除去して再試行
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error(`Failed to parse LLM response as JSON: ${response.substring(0, 200)}`);
    }
  }

  // スキーマでバリデーション
  const validated = generatedExerciseSchema.parse(parsed);

  return validated;
}
