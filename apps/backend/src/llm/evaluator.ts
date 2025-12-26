import { z } from 'zod';
import { generateWithOllama } from './llm-client.js';
import { loadPrompt, renderPrompt } from './prompt-loader.js';
import { PromptSanitizer } from './prompt-sanitizer.js';

export interface EvaluateAnswerInput {
  code: string;
  question: string;
  idealPoints: string[];
  userAnswer: string;
}

export interface EvaluateAnswerOutput {
  score: number;
  level: 'A' | 'B' | 'C' | 'D';
  feedback: string;
  aspects?: Record<string, number>;
}

const outputSchema = z.object({
  score: z.number().min(0).max(100),
  level: z.enum(['A', 'B', 'C', 'D']),
  feedback: z.string(),
  aspects: z.record(z.string(), z.number()).optional(),
});

/**
 * スコアからレベルを判定
 * A: 90-100, B: 70-89, C: 50-69, D: 0-49
 */
export function scoreToLevel(score: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

/**
 * スコアを0-100の範囲に正規化
 */
export function normalizeScore(score: number): number {
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

function buildPrompt(input: EvaluateAnswerInput): string {
  const template = loadPrompt('evaluator-prompt.md');
  const idealPointsText = input.idealPoints.map((p, i) => `- (${i + 1}) ${p}`).join('\n');

  // ユーザー入力をサニタイズ
  // CODEはコード部分なので、base64検出を緩和
  const sanitizedCode = PromptSanitizer.sanitize(input.code, 'CODE', {
    allowBase64: true, // コード内にbase64が含まれる可能性があるため
  });
  const sanitizedQuestion = PromptSanitizer.sanitize(input.question, 'QUESTION');
  const sanitizedUserAnswer = PromptSanitizer.sanitize(input.userAnswer, 'USER_ANSWER');
  const sanitizedIdealPoints = PromptSanitizer.sanitize(idealPointsText, 'IDEAL_POINTS');

  return renderPrompt(template, {
    CODE: sanitizedCode,
    QUESTION: sanitizedQuestion,
    IDEAL_POINTS: sanitizedIdealPoints,
    USER_ANSWER: sanitizedUserAnswer,
  });
}

const llmResponseSchema = z.object({
  score: z.number(),
  feedback: z.string(),
  aspects: z.record(z.string(), z.number()).optional(),
});

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerOutput> {
  const prompt = buildPrompt(input);

  const response = await generateWithOllama(prompt, {
    temperature: 0.3,
    maxTokens: 1024,
    jsonMode: true,
  });

  const parsed = JSON.parse(response);

  // First, validate the raw LLM output
  const llmResult = llmResponseSchema.parse(parsed);

  const normalizedScore = normalizeScore(llmResult.score);

  return {
    score: normalizedScore,
    level: scoreToLevel(normalizedScore),
    feedback: llmResult.feedback,
    aspects: llmResult.aspects,
  };
}
