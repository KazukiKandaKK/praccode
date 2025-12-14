/**
 * リトライハンドラー - エクスポネンシャルバックオフ
 */

const MAX_RETRIES = parseInt(process.env.LLM_RATE_LIMIT_MAX_RETRIES || '3', 10);
const BASE_DELAY_MS = 1000; // 初回リトライの待機時間: 1秒

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  onRetry?: (error: Error, retryCount: number, delayMs: number) => void;
}

/**
 * 429エラー時のエクスポネンシャルバックオフ付きリトライ
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const baseDelay = options.baseDelay ?? BASE_DELAY_MS;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最後の試行の場合はエラーをスロー
      if (attempt >= maxRetries) {
        throw lastError;
      }

      // エクスポネンシャルバックオフで待機時間を計算
      // 1秒 → 2秒 → 4秒 → ...
      const delayMs = baseDelay * Math.pow(2, attempt);

      if (options.onRetry) {
        options.onRetry(lastError, attempt + 1, delayMs);
      }

      console.info(
        `[RetryHandler] リトライ ${attempt + 1}/${maxRetries}: ${delayMs}ms 待機後に再試行します...`
      );

      await sleep(delayMs);
    }
  }

  // 到達不可能だが、型安全性のため
  throw lastError || new Error('Retry failed');
}

/**
 * 429エラーかどうかを判定
 */
export function isRateLimitError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes('429') || message.includes('rate limit');
}

/**
 * Retry-Afterヘッダーから待機時間を取得
 */
export function parseRetryAfter(retryAfterHeader: string | null): number | null {
  if (!retryAfterHeader) {
    return null;
  }

  // 秒数で指定されている場合
  const seconds = parseInt(retryAfterHeader, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000; // ミリ秒に変換
  }

  // HTTP日時で指定されている場合
  const date = new Date(retryAfterHeader);
  if (!isNaN(date.getTime())) {
    const now = Date.now();
    const waitTime = date.getTime() - now;
    return waitTime > 0 ? waitTime : 0;
  }

  return null;
}

/**
 * 指定時間待機
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry-Afterを考慮したリトライ
 */
export async function retryWithRetryAfter<T>(
  fn: (retryAfter?: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? MAX_RETRIES;
  const baseDelay = options.baseDelay ?? BASE_DELAY_MS;

  let lastError: Error | null = null;
  let retryAfterMs: number | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(retryAfterMs ?? undefined);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 最後の試行の場合はエラーをスロー
      if (attempt >= maxRetries) {
        throw lastError;
      }

      // エクスポネンシャルバックオフで待機時間を計算
      let delayMs = baseDelay * Math.pow(2, attempt);

      // Retry-Afterがある場合はそれを優先
      if (retryAfterMs !== null && retryAfterMs > 0) {
        delayMs = retryAfterMs;
      }

      if (options.onRetry) {
        options.onRetry(lastError, attempt + 1, delayMs);
      }

      console.info(
        `[RetryHandler] リトライ ${attempt + 1}/${maxRetries}: ${delayMs}ms 待機後に再試行します...`
      );

      await sleep(delayMs);

      // Retry-Afterをリセット（次の試行で新しい値を取得するため）
      retryAfterMs = null;
    }
  }

  // 到達不可能だが、型安全性のため
  throw lastError || new Error('Retry failed');
}

