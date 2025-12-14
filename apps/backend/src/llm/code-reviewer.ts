/**
 * LLMによるコードレビュー
 */

import { generateWithOllama } from './llm-client.js';
import { loadPrompt, renderPrompt } from './prompt-loader.js';
import { PromptSanitizer } from './prompt-sanitizer.js';

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
  
  // ユーザー入力をサニタイズ
  // USER_CODEはコード部分なので、base64検出を緩和
  const sanitizedUserCode = PromptSanitizer.sanitize(input.userCode, 'USER_CODE', {
    allowBase64: true, // コード内にbase64が含まれる可能性があるため
  });
  const sanitizedChallengeTitle = PromptSanitizer.sanitize(
    input.challengeTitle,
    'CHALLENGE_TITLE'
  );
  const sanitizedChallengeDescription = PromptSanitizer.sanitize(
    input.challengeDescription,
    'CHALLENGE_DESCRIPTION'
  );
  const sanitizedTestOutput = PromptSanitizer.sanitize(trimmedOutput, 'TEST_OUTPUT');
  
  return renderPrompt(template, {
    CHALLENGE_TITLE: sanitizedChallengeTitle,
    CHALLENGE_DESCRIPTION: sanitizedChallengeDescription,
    LANGUAGE: input.language,
    USER_CODE: sanitizedUserCode,
    TEST_RESULT: passedText,
    TEST_OUTPUT: sanitizedTestOutput,
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
