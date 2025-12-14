/**
 * Google Gemini API プロバイダー実装
 */

import type { LLMProvider, LLMGenerateOptions } from './llm-provider.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  process.env.GEMINI_API_URL || 'https://aiplatform.googleapis.com/v1';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

interface GeminiGenerateRequest {
  contents: Array<{
    parts: Array<{
      text: string;
    }>;
  }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
  error?: {
    message: string;
    code: number;
  };
}

export class GeminiProvider implements LLMProvider {
  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const requestBody: GeminiGenerateRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt,
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
      const url = `${GEMINI_API_URL}/publishers/google/models/${GEMINI_MODEL}:streamGenerateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
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
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      // streamGenerateContentはストリーミングレスポンスを返す可能性がある
      // レスポンステキストを取得して処理
      const responseText = await response.text();
      
      // ストリーミングレスポンスの場合、複数のJSONオブジェクトが改行区切りで返される
      // 最後の有効なレスポンスを使用
      const lines = responseText.trim().split('\n').filter((line) => line.trim());
      let lastValidData: GeminiGenerateResponse | null = null;

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line) as GeminiGenerateResponse;
          if (parsed.candidates && parsed.candidates.length > 0) {
            lastValidData = parsed;
          }
        } catch {
          // JSONパースに失敗した行は無視
          continue;
        }
      }

      // ストリーミングレスポンスが空の場合、通常のJSONレスポンスとして試す
      if (!lastValidData) {
        try {
          lastValidData = JSON.parse(responseText) as GeminiGenerateResponse;
        } catch {
          throw new Error(`Failed to parse Gemini API response: ${responseText.substring(0, 200)}`);
        }
      }

      const data = lastValidData;

      if (data.error) {
        throw new Error(`Gemini API error: ${data.error.code} - ${data.error.message}`);
      }

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('Gemini API returned no candidates');
      }

      // ストリーミングレスポンスの場合、すべての候補からテキストを結合
      const texts = data.candidates
        .map((candidate) => candidate.content?.parts?.[0]?.text)
        .filter((text): text is string => Boolean(text));

      if (texts.length === 0) {
        throw new Error('Gemini API returned empty response');
      }

      // すべてのテキストを結合して返す
      return texts.join('');
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Gemini request timed out after ${timeoutMs / 1000} seconds`);
      }
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!GEMINI_API_KEY) {
      return false;
    }

    try {
      // 簡単なリクエストでヘルスチェック（新しいAI Platform APIエンドポイント）
      const url = `${GEMINI_API_URL}/publishers/google/models/${GEMINI_MODEL}?key=${encodeURIComponent(GEMINI_API_KEY)}`;
      const response = await fetch(url, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

