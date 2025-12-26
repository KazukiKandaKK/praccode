/**
 * Google Gemini API プロバイダー実装
 */

import type { LLMProvider, LLMGenerateOptions } from './llm-provider.js';
import { parseRetryAfter } from './retry-handler.js';
import { PromptSanitizer } from './prompt-sanitizer.js';

export class GeminiProvider implements LLMProvider {
  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const apiUrl = process.env.GEMINI_API_URL || 'https://aiplatform.googleapis.com/v1';
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

    // プロンプト全体をサニタイズ（既に構造化されている前提）
    // ただし、セパレータ部分は除外してサニタイズ
    const sanitizedPrompt = this.sanitizeStructuredPrompt(prompt);

    const requestBody: GeminiGenerateRequest = {
      contents: [
        {
          parts: [
            {
              text: sanitizedPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens ?? 4096,
        ...(options?.jsonMode && { responseMimeType: 'application/json' }),
      },
    };

    // タイムアウト設定（デフォルト60秒）
    const timeoutMs = options?.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // 新しいAI Platform APIエンドポイントを使用
      const url = `${apiUrl}/publishers/google/models/${model}:streamGenerateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        // 429エラーの場合、Retry-Afterヘッダーを含めてエラーをスロー
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterMs = parseRetryAfter(retryAfter);
          const retryInfo = retryAfterMs ? ` (Retry after ${retryAfterMs}ms)` : '';
          throw new Error(`Gemini API rate limit (429)${retryInfo}: ${errorText}`);
        }

        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      // streamGenerateContentはストリーミングレスポンスを返す可能性がある
      // レスポンステキストを取得して処理
      const responseText = await response.text();

      const allTexts: string[] = [];
      let hasCandidates = false;

      // Handle both streaming and non-streaming responses
      try {
        const lines = responseText
          .trim()
          .split('\n')
          .filter((line) => line.startsWith('[') || line.startsWith('{'));

        for (const line of lines) {
          // Sometimes the stream response is wrapped in an array, sometimes not.
          const items = JSON.parse(line);
          const responses = Array.isArray(items) ? items : [items];

          for (const data of responses) {
            if (data.error) {
              throw new Error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
            }
            if (data.candidates && data.candidates.length > 0) {
              hasCandidates = true;
              const texts = data.candidates
                .map((candidate: any) => candidate.content?.parts?.[0]?.text)
                .filter((text: any): text is string => Boolean(text));
              allTexts.push(...texts);
            }
          }
        }
      } catch (e) {
        // If parsing lines fails, try to parse the whole thing as one JSON object
        try {
          const data = JSON.parse(responseText);
          if (data.error) {
            throw new Error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
          }
          if (data.candidates && data.candidates.length > 0) {
            hasCandidates = true;
            const texts = data.candidates
              .map((candidate: any) => candidate.content?.parts?.[0]?.text)
              .filter((text: any): text is string => Boolean(text));
            allTexts.push(...texts);
          }
        } catch (finalError) {
          throw new Error(`Failed to parse Gemini API response: ${responseText.substring(0, 200)}`);
        }
      }

      if (!hasCandidates) {
        throw new Error('Gemini API returned no candidates');
      }

      if (allTexts.length === 0) {
        throw new Error('Gemini API returned empty response');
      }

      return allTexts.join('');
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Gemini request timed out after ${timeoutMs / 1000} seconds`);
      }
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return false;
    }

    const apiUrl = process.env.GEMINI_API_URL || 'https://aiplatform.googleapis.com/v1';
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

    try {
      // 簡単なリクエストでヘルスチェック（新しいAI Platform APIエンドポイント）
      const url = `${apiUrl}/publishers/google/models/${model}?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 構造化されたプロンプトをサニタイズ
   * セパレータで囲まれたユーザー入力部分のみをサニタイズ
   */
  private sanitizeStructuredPrompt(prompt: string): string {
    const separatorStart = '---USER_INPUT_START---';
    const separatorEnd = '---USER_INPUT_END---';

    // セパレータがない場合は全体をサニタイズ
    if (!prompt.includes(separatorStart)) {
      return PromptSanitizer.sanitize(prompt, 'prompt');
    }

    // セパレータで分割して、ユーザー入力部分のみサニタイズ
    const parts: string[] = [];
    const remaining = prompt;
    let startIndex = 0;

    while (true) {
      const startPos = remaining.indexOf(separatorStart, startIndex);
      if (startPos === -1) {
        // 残りの部分を追加
        if (startIndex < remaining.length) {
          parts.push(remaining.substring(startIndex));
        }
        break;
      }

      // セパレータ前の部分を追加
      parts.push(remaining.substring(startIndex, startPos + separatorStart.length));

      const endPos = remaining.indexOf(separatorEnd, startPos + separatorStart.length);
      if (endPos === -1) {
        // 終了セパレータが見つからない場合は残りをそのまま追加
        parts.push(remaining.substring(startPos + separatorStart.length));
        break;
      }

      // ユーザー入力部分をサニタイズ
      const userInput = remaining.substring(startPos + separatorStart.length, endPos);
      const sanitizedInput = PromptSanitizer.sanitize(userInput.trim(), 'user_input');
      parts.push(`\n${sanitizedInput}\n`);

      // 終了セパレータを追加
      parts.push(separatorEnd);

      startIndex = endPos + separatorEnd.length;
    }

    return parts.join('');
  }
}
