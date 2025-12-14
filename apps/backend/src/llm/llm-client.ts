/**
 * LLMクライアント - 環境変数に基づいてプロバイダーを選択
 */

import type { LLMProvider } from './llm-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { getGlobalRateLimiter } from './rate-limiter.js';
import { retryWithBackoff, isRateLimitError } from './retry-handler.js';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';

let cachedProvider: LLMProvider | null = null;

/**
 * LLMプロバイダーを取得（シングルトン）
 */
export function getLLMProvider(): LLMProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  switch (LLM_PROVIDER.toLowerCase()) {
    case 'gemini':
      cachedProvider = new GeminiProvider();
      break;
    case 'ollama':
    default:
      cachedProvider = new OllamaProvider();
      break;
  }

  return cachedProvider;
}

/**
 * テキスト生成（後方互換性のため）
 * レート制限とリトライ機能を含む
 */
export async function generateWithOllama(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    timeoutMs?: number;
  }
): Promise<string> {
  const rateLimiter = getGlobalRateLimiter();
  const provider = getLLMProvider();

  // レート制限を適用
  await rateLimiter.acquire();

  // 429エラー時のリトライを適用
  return retryWithBackoff(
    async () => {
      try {
        return await provider.generate(prompt, options);
      } catch (error) {
        // 429エラーの場合は再スローしてリトライさせる
        if (error instanceof Error && isRateLimitError(error)) {
          throw error;
        }
        // その他のエラーはそのままスロー（リトライしない）
        throw error;
      }
    },
    {
      onRetry: (error, retryCount, delayMs) => {
        console.info(
          `[LLMClient] API呼び出し失敗 (試行 ${retryCount}): ${error.message}. ${delayMs}ms 後に再試行...`
        );
      },
    }
  );
}

/**
 * ヘルスチェック（後方互換性のため）
 */
export async function checkOllamaHealth(): Promise<boolean> {
  const provider = getLLMProvider();
  return provider.checkHealth();
}
