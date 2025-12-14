import { z } from 'zod';
import { generateWithOllama } from './llm-client.js';
import { loadPrompt, renderPrompt } from './prompt-loader.js';

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
  
  return renderPrompt(template, {
    CODE: input.code,
    QUESTION: input.question,
    IDEAL_POINTS: idealPointsText,
    USER_ANSWER: input.userAnswer,
  });
}

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerOutput> {
  const prompt = buildPrompt(input);

  const response = await generateWithOllama(prompt, {
    temperature: 0.3,
    maxTokens: 1024,
    jsonMode: true,
  });

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

  return outputSchema.parse(parsed);
}
