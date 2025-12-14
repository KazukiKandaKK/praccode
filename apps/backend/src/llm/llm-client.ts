/**
 * LLMクライアント - 環境変数に基づいてプロバイダーを選択
 */

import type { LLMProvider } from './llm-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { GeminiProvider } from './gemini-provider.js';

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
  const provider = getLLMProvider();
  return provider.generate(prompt, options);
}

/**
 * ヘルスチェック（後方互換性のため）
 */
export async function checkOllamaHealth(): Promise<boolean> {
  const provider = getLLMProvider();
  return provider.checkHealth();
}

