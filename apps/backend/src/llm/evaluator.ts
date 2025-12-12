import { Mastra } from '@mastra/core';
import { z } from 'zod';

const mastra = new Mastra({});

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

  const agent = mastra.getAgent('code-answer-evaluator');

  // Mastra経由でOpenAI APIを呼び出し
  // 注: 実際のMastra設定に応じて調整が必要
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'あなたはコードリーディングの回答を評価する専門家です。JSON形式で回答してください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(content);
  return outputSchema.parse(parsed);
}

