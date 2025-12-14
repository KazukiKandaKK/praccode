/**
 * Ollama API プロバイダー実装
 */

import type { LLMProvider, LLMGenerateOptions } from './llm-provider.js';
import { parseRetryAfter } from './retry-handler.js';
import { PromptSanitizer } from './prompt-sanitizer.js';

// Docker内からホストのOllamaに接続
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://host.docker.internal:11434';
// 1.5bは軽量で高速、7bはより高品質だが重い
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:1.5b';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  format?: 'json';
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

export class OllamaProvider implements LLMProvider {
  async generate(prompt: string, options?: LLMGenerateOptions): Promise<string> {
    // プロンプト全体をサニタイズ（既に構造化されている前提）
    const sanitizedPrompt = this.sanitizeStructuredPrompt(prompt);

    const requestBody: OllamaGenerateRequest = {
      model: OLLAMA_MODEL,
      prompt: sanitizedPrompt,
      stream: false,
      ...(options?.jsonMode && { format: 'json' }),
      options: {
        temperature: options?.temperature ?? 0.7,
        num_predict: options?.maxTokens ?? 4096,
      },
    };

    // タイムアウト設定（デフォルト60秒）
    const timeoutMs = options?.timeoutMs ?? 60000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
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
          throw new Error(`Ollama API rate limit (429)${retryInfo}: ${errorText}`);
        }

        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as OllamaGenerateResponse;
      return data.response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${timeoutMs / 1000} seconds`);
      }
      throw error;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
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
