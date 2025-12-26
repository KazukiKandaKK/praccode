import { generateWithOllama } from './llm-client.js';
import { loadPrompt, renderPrompt } from './prompt-loader.js';
import { PromptSanitizer } from './prompt-sanitizer.js';

export interface GenerateHintInput {
  code: string;
  question: string;
  learningGoals: string[];
}

/**
 * 学習用のヒントをLLMで生成する
 */
export async function generateHint(input: GenerateHintInput): Promise<string> {
  const template = loadPrompt('hint-prompt.md');

  const prompt = renderPrompt(template, {
    CODE: PromptSanitizer.sanitize(input.code, 'CODE', { allowBase64: true }),
    QUESTION: PromptSanitizer.sanitize(input.question, 'QUESTION'),
    LEARNING_GOALS: PromptSanitizer.sanitize(input.learningGoals.join('\n'), 'LEARNING_GOALS'),
  });

  const response = await generateWithOllama(prompt, {
    temperature: 0.7,
    maxTokens: 512,
  });

  return response.trim();
}
