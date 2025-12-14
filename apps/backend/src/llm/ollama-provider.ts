/**
 * Ollama API プロバイダー実装
 */

import type { LLMProvider, LLMGenerateOptions } from './llm-provider.js';
import { parseRetryAfter } from './retry-handler.js';

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
    const requestBody: OllamaGenerateRequest = {
      model: OLLAMA_MODEL,
      prompt,
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
}

