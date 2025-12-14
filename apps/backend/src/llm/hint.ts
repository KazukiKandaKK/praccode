import { z } from 'zod';
import { loadPrompt, renderPrompt } from './prompt-loader.js';
import { PromptSanitizer } from './prompt-sanitizer.js';

export interface GenerateHintInput {
  code: string;
  question: string;
  learningGoals: string[];
}

const outputSchema = z.object({
  hint: z.string(),
});

function buildPrompt(input: GenerateHintInput): string {
  const template = loadPrompt('hint-prompt.md');
  const learningGoalsText = input.learningGoals.map((g) => `- ${g}`).join('\n');
  
  // ユーザー入力をサニタイズ
  // CODEはコード部分なので、base64検出を緩和
  const sanitizedCode = PromptSanitizer.sanitize(input.code, 'CODE', {
    allowBase64: true, // コード内にbase64が含まれる可能性があるため
  });
  const sanitizedQuestion = PromptSanitizer.sanitize(input.question, 'QUESTION');
  const sanitizedLearningGoals = PromptSanitizer.sanitize(
    learningGoalsText,
    'LEARNING_GOALS'
  );
  
  return renderPrompt(template, {
    CODE: sanitizedCode,
    QUESTION: sanitizedQuestion,
    LEARNING_GOALS: sanitizedLearningGoals,
  });
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
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('No response from OpenAI');
  }

  const parsed = JSON.parse(content);
  const result = outputSchema.parse(parsed);
  return result.hint;
}
