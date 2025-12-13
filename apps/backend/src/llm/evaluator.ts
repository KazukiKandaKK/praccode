import { z } from 'zod';
import { generateWithOllama } from './ollama.js';

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
  return `あなたは熟練したソフトウェアエンジニアです。
以下のコードを前提に、ユーザーの回答を評価してください。

# コード
\`\`\`
${input.code}
\`\`\`

# 問い
${input.question}

# 模範回答の要点
${input.idealPoints.map((p, i) => `- (${i + 1}) ${p}`).join('\n')}

# ユーザーの回答
${input.userAnswer}

以下の JSON 形式で出力してください。マークダウンのコードブロックなしで、純粋なJSONのみを返してください。
{
  "score": 0〜100 の整数（達成度を示す）,
  "level": "A" | "B" | "C" | "D"（A:優秀 B:良好 C:改善の余地あり D:不十分）,
  "feedback": "具体的なフィードバック（日本語で、良かった点と改善点を含む）",
  "aspects": {
    "responsibility": 責務理解度(0-100),
    "data_flow": データフロー理解度(0-100),
    "error_handling": エラーハンドリング理解度(0-100)
  }
}

評価基準:
- A (90-100): 模範回答の要点をほぼ全て網羅し、適切な表現で説明できている
- B (70-89): 主要な要点を理解しているが、一部の観点が不足している
- C (50-69): 基本的な理解はあるが、重要な観点が複数欠けている
- D (0-49): 理解が不十分で、主要な要点を捉えられていない`;
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

