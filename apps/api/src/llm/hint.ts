import { z } from 'zod';

export interface GenerateHintInput {
  code: string;
  question: string;
  learningGoals: string[];
}

const outputSchema = z.object({
  hint: z.string(),
});

function buildPrompt(input: GenerateHintInput): string {
  return `あなたはソフトウェアエンジニアの教育者です。
学習者がコードリーディングの問題に取り組んでいます。
答えを直接教えずに、考える方向性を示すヒントを提供してください。

# コード
\`\`\`
${input.code}
\`\`\`

# 問い
${input.question}

# 学習ポイント
${input.learningGoals.map((g) => `- ${g}`).join('\n')}

# ヒント生成のルール
1. 答えそのものを言わない
2. 特定のコード行を直接指摘しない
3. 「何を見ればよいか」「どんな観点で読めばよいか」という方向性を示す
4. 2〜3文程度で簡潔に
5. 日本語で回答

以下の JSON 形式で出力してください:
{
  "hint": "ヒントの内容"
}`;
}

export async function generateHint(input: GenerateHintInput): Promise<string> {
  const prompt = buildPrompt(input);

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
            'あなたはコードリーディングのヒントを提供する教育者です。JSON形式で回答してください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array< { message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(content);
  const result = outputSchema.parse(parsed);
  return result.hint;
}

