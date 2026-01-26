/**
 * LLMクライアント - 環境変数に基づいてプロバイダーを選択
 */

import type { LLMProvider } from './llm-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import { getGlobalRateLimiter } from './rate-limiter.js';
import { retryWithBackoff, isRateLimitError } from './retry-handler.js';
import { estimateTokens } from './token-estimator.js';

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';
const DEFAULT_MAX_TOKENS = 4096;

type ProviderName = 'ollama' | 'gemini' | 'openai';
const PROVIDER_ORDER: ProviderName[] = ['ollama', 'gemini', 'openai'];
const providerCache = new Map<ProviderName, LLMProvider>();

/**
 * LLMプロバイダーを取得（シングルトン）
 */
export function getLLMProvider(): LLMProvider {
  const [primary] = getProviderOrder();
  return getProviderInstance(primary);
}

function getProviderOrder(): ProviderName[] {
  const preferred = LLM_PROVIDER.toLowerCase() as ProviderName;
  if (PROVIDER_ORDER.includes(preferred)) {
    return [preferred, ...PROVIDER_ORDER.filter((name) => name !== preferred)];
  }
  return [...PROVIDER_ORDER];
}

function getProviderInstance(name: ProviderName): LLMProvider {
  const existing = providerCache.get(name);
  if (existing) {
    return existing;
  }

  const provider =
    name === 'gemini'
      ? new GeminiProvider()
      : name === 'openai'
        ? new OpenAIProvider()
        : new OllamaProvider();

  providerCache.set(name, provider);
  return provider;
}

function isServiceUnavailableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('503') ||
    message.includes('service unavailable') ||
    message.includes('fetch failed') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('connection reset') ||
    message.includes('socket hang up') ||
    message.includes('timed out')
  );
}

function shouldSkipProvider(name: ProviderName): boolean {
  if (name === 'gemini') {
    const authMode = (process.env.GEMINI_AUTH_MODE || 'auto').toLowerCase();
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY);
    const hasVertexCreds = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS_FILE
    );
    const hasVertexProject = Boolean(
      process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || process.env.VERTEX_PROJECT
    );
    const hasVertex = hasVertexCreds && hasVertexProject;

    if (authMode === 'api_key') {
      return !hasApiKey;
    }
    if (authMode === 'vertex') {
      return !hasVertex;
    }
    return !(hasApiKey || hasVertex);
  }
  if (name === 'openai') {
    return !process.env.OPENAI_API_KEY;
  }
  return false;
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
  const providerOrder = getProviderOrder();
  let lastError: Error | null = null;

  for (const name of providerOrder) {
    if (shouldSkipProvider(name)) {
      continue;
    }

    const rateLimiter = getGlobalRateLimiter();
    const promptTokens = estimateTokens(prompt);
    const outputTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    await rateLimiter.acquire(promptTokens + outputTokens);

    const provider = getProviderInstance(name);

    try {
      return await retryWithBackoff(
        async () => {
          try {
            return await provider.generate(prompt, options);
          } catch (error) {
            if (error instanceof Error && isRateLimitError(error)) {
              throw error;
            }
            throw error;
          }
        },
        {
          onRetry: (error, retryCount, delayMs) => {
            console.info(
              `[LLMClient] ${name} 呼び出し失敗 (試行 ${retryCount}): ${error.message}. ${delayMs}ms 後に再試行...`
            );
          },
        }
      );
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if (isServiceUnavailableError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('No available LLM provider');
}

/**
 * テキスト生成ストリーム（プロバイダー非対応時は1回生成で代用）
 */
export async function* generateStream(
  prompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
    timeoutMs?: number;
  }
): AsyncIterable<string> {
  const providerOrder = getProviderOrder();
  let lastError: Error | null = null;

  for (const name of providerOrder) {
    if (shouldSkipProvider(name)) {
      continue;
    }

    const rateLimiter = getGlobalRateLimiter();
    const promptTokens = estimateTokens(prompt);
    const outputTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
    await rateLimiter.acquire(promptTokens + outputTokens);

    const provider = getProviderInstance(name);

    try {
      if (provider.generateStream) {
        const stream = await retryWithBackoff(
          () => Promise.resolve(provider.generateStream?.(prompt, options)),
          {
            onRetry: (error, retryCount, delayMs) => {
              console.info(
                `[LLMClient] ${name} ストリーム呼び出し失敗 (試行 ${retryCount}): ${error.message}. ${delayMs}ms 後に再試行...`
              );
            },
          }
        );

        if (!stream) {
          throw new Error('LLM provider returned empty stream');
        }

        for await (const chunk of stream) {
          yield chunk;
        }
        return;
      }

      const response = await retryWithBackoff(
        async () => provider.generate(prompt, options),
        {
          onRetry: (error, retryCount, delayMs) => {
            console.info(
              `[LLMClient] ${name} 呼び出し失敗 (試行 ${retryCount}): ${error.message}. ${delayMs}ms 後に再試行...`
            );
          },
        }
      );
      yield response;
      return;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if (isServiceUnavailableError(err)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error('No available LLM provider');
}

/**
 * ヘルスチェック（後方互換性のため）
 */
export async function checkLLMHealth(): Promise<boolean> {
  for (const name of getProviderOrder()) {
    if (shouldSkipProvider(name)) {
      continue;
    }
    const provider = getProviderInstance(name);
    if (await provider.checkHealth()) {
      return true;
    }
  }
  return false;
}

export async function checkOllamaHealth(): Promise<boolean> {
  return checkLLMHealth();
}
