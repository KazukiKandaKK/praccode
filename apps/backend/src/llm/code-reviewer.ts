/**
 * LLMによるコードレビュー
 */

import { generateWithOllama } from './ollama.js';

export interface CodeReviewInput {
  language: string;
  challengeTitle: string;
  challengeDescription: string;
  userCode: string;
  testCode: string;
  testOutput: string;
  passed: boolean;
}

/**
 * コードレビュー用のプロンプトを構築
 */
function buildCodeReviewPrompt(input: CodeReviewInput): string {
  const passedText = input.passed ? 'テスト結果: 全て通過' : 'テスト結果: 一部失敗';

  // テスト出力が長すぎる場合は切り詰める
  const trimmedOutput =
    input.testOutput.length > 500
      ? input.testOutput.slice(0, 500) + '\n... (省略)'
      : input.testOutput;

  return `You are a programming instructor. Review this code and give feedback in Japanese.

Task: ${input.challengeTitle}
Description: ${input.challengeDescription}

Code (${input.language}):
${input.userCode}

${passedText}
${trimmedOutput}

Give feedback in this format:

### 良い点
- (1-2 specific good points)

### 改善点
- (2-3 specific suggestions for improvement)

### 学習ポイント
- (1-2 key concepts to learn)

Rules:
- Write in Japanese
- Be concise and specific
- ${input.passed ? 'Code works but suggest improvements' : 'Explain why tests failed and how to fix'}`;
}

/**
 * LLMを使ってコードレビューを生成
 */
export async function generateCodeReview(input: CodeReviewInput): Promise<string> {
  const prompt = buildCodeReviewPrompt(input);

  const feedback = await generateWithOllama(prompt, {
    temperature: 0.7,
    maxTokens: 2048,
  });

  return feedback.trim();
}
