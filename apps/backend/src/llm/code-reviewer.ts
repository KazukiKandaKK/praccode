/**
 * LLMによるコードレビュー
 */

import { generateWithOllama } from './llm-client.js';
import { loadPrompt, renderPrompt } from './prompt-loader.js';

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

  const feedbackGuide = input.passed
    ? 'Code works but suggest improvements'
    : 'Explain why tests failed and how to fix';

  const template = loadPrompt('code-reviewer-prompt.md');
  
  return renderPrompt(template, {
    CHALLENGE_TITLE: input.challengeTitle,
    CHALLENGE_DESCRIPTION: input.challengeDescription,
    LANGUAGE: input.language,
    USER_CODE: input.userCode,
    TEST_RESULT: passedText,
    TEST_OUTPUT: trimmedOutput,
    FEEDBACK_GUIDE: feedbackGuide,
  });
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
