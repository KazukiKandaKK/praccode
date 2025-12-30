/**
 * レート制限ミドルウェア - スライディングウィンドウ方式
 */

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.LLM_RATE_LIMIT_WINDOW_MS || '60000', 10); // デフォルト: 60秒
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.LLM_RATE_LIMIT_MAX_REQUESTS || '10', 10); // デフォルト: 10リクエスト
const RATE_LIMIT_MAX_TOKENS = parseInt(
  process.env.LLM_RATE_LIMIT_MAX_TOKENS || '60000',
  10
); // 0は無制限
const RATE_LIMIT_PREEMPT_MS = parseInt(process.env.LLM_RATE_LIMIT_PREEMPT_MS || '10000', 10); // デフォルト: 10秒
const RATE_LIMIT_QUEUE_MAX = parseInt(process.env.LLM_RATE_LIMIT_QUEUE_MAX || '100', 10);
const RATE_LIMIT_QUEUE_TIMEOUT_MS = parseInt(
  process.env.LLM_RATE_LIMIT_QUEUE_TIMEOUT_MS || '30000',
  10
);

const MIN_DEGRADE_FACTOR = 0.5;
const DEGRADE_MULTIPLIER = 0.7;
const RECOVER_STEP = 0.05;

/**
 * スライディングウィンドウ方式のレート制限
 * 一定時間内のリクエスト数を制限し、超過時は待機する
 */
export class RateLimiter {
  private requests: Array<{ timestamp: number; tokens: number }> = [];
  private queue: Promise<void> = Promise.resolve();
  private queueDepth = 0;
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxTokens: number;
  private readonly preemptMs: number;
  private readonly queueMax: number;
  private readonly queueTimeoutMs: number;
  private degradeFactor = 1;
  private degradeUntil = 0;

  constructor(
    windowMs: number = RATE_LIMIT_WINDOW_MS,
    maxRequests: number = RATE_LIMIT_MAX_REQUESTS,
    maxTokens: number = RATE_LIMIT_MAX_TOKENS,
    preemptMs: number = RATE_LIMIT_PREEMPT_MS,
    queueMax: number = RATE_LIMIT_QUEUE_MAX,
    queueTimeoutMs: number = RATE_LIMIT_QUEUE_TIMEOUT_MS
  ) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.maxTokens = maxTokens;
    this.preemptMs = preemptMs;
    this.queueMax = queueMax;
    this.queueTimeoutMs = queueTimeoutMs;
  }

  /**
   * レート制限をチェックし、必要に応じて待機
   */
  async acquire(tokens: number = 0): Promise<void> {
    if (this.queueMax > 0 && this.queueDepth >= this.queueMax) {
      throw new Error('LLM rate limit queue overflow (429)');
    }

    this.queueDepth += 1;
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutError = new Error('LLM rate limit queue timeout (429)');
    let timeoutPromise: Promise<void> | null = null;
    if (this.queueTimeoutMs > 0) {
      timeoutPromise = new Promise<void>((_, reject) => {
        timeoutId = setTimeout(() => {
          timedOut = true;
          reject(timeoutError);
        }, this.queueTimeoutMs);
      });
    }

    const run = this.queue.then(() => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (timedOut) {
        throw timeoutError;
      }
      return this.acquireInternal(tokens);
    });
    this.queue = run.catch(() => undefined);

    const pending = timeoutPromise ? Promise.race([run, timeoutPromise]) : run;

    try {
      await pending;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.queueDepth = Math.max(0, this.queueDepth - 1);
    }
  }

  private async acquireInternal(tokens: number = 0): Promise<void> {
    // リクエスト数/トークン数が0以下なら何もせず終了
    if (this.maxRequests <= 0 && this.maxTokens <= 0) {
      return;
    }

    if (this.windowMs <= 0) {
      return;
    }

    const safeTokens = Math.max(0, Math.floor(tokens));

    let now = Date.now();
    this.cleanup(now);

    while (true) {
      const { usedRequests, usedTokens } = this.getUsage();
      this.applyPreemptiveDegrade(now, usedRequests, usedTokens);

      const effectiveMaxRequests =
        this.maxRequests > 0
          ? Math.max(1, Math.floor(this.maxRequests * this.degradeFactor))
          : Number.POSITIVE_INFINITY;
      const effectiveMaxTokens =
        this.maxTokens > 0
          ? Math.max(1, Math.floor(this.maxTokens * this.degradeFactor))
          : Number.POSITIVE_INFINITY;

      const nextRequests = usedRequests + 1;
      const nextTokens = usedTokens + safeTokens;

      if (nextRequests <= effectiveMaxRequests && nextTokens <= effectiveMaxTokens) {
        break;
      }

      const waitTime = this.calculateWaitMs(
        now,
        nextRequests,
        nextTokens,
        effectiveMaxRequests,
        effectiveMaxTokens
      );

      if (waitTime <= 0) {
        break;
      }

      console.info(
        `[RateLimiter] レート制限: ${Math.round(effectiveMaxRequests)} req / ${Math.round(effectiveMaxTokens)} tokens (factor ${this.degradeFactor.toFixed(
          2
        )}). ${waitTime}ms 待機します...`
      );

      await this.sleep(waitTime);
      now = Date.now();
      this.cleanup(now);
    }

    this.requests.push({ timestamp: now, tokens: safeTokens });
  }

  /**
   * ウィンドウ外の古いリクエストを削除
   */
  private cleanup(now: number = Date.now()): void {
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((entry) => entry.timestamp > cutoff);
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 現在の状態を取得（デバッグ用）
   */
  getStatus(): {
    currentRequests: number;
    maxRequests: number;
    windowMs: number;
    queueDepth: number;
  } {
    this.cleanup();
    return {
      currentRequests: this.requests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      queueDepth: this.queueDepth,
    };
  }

  private getUsage(): { usedRequests: number; usedTokens: number } {
    const usedRequests = this.requests.length;
    const usedTokens = this.requests.reduce((sum, entry) => sum + entry.tokens, 0);
    return { usedRequests, usedTokens };
  }

  private calculateWaitMs(
    now: number,
    nextRequests: number,
    nextTokens: number,
    maxRequests: number,
    maxTokens: number
  ): number {
    let waitForRequests = 0;
    const requestOverflow = nextRequests - maxRequests;
    if (requestOverflow > 0 && this.requests.length > 0) {
      const overflowIndex = Math.min(requestOverflow - 1, this.requests.length - 1);
      const ts = this.requests[overflowIndex]?.timestamp;
      if (typeof ts === 'number') {
        waitForRequests = Math.max(0, ts + this.windowMs - now);
      }
    }

    let waitForTokens = 0;
    const tokenOverflow = nextTokens - maxTokens;
    if (tokenOverflow > 0 && this.requests.length > 0) {
      let remaining = tokenOverflow;
      for (const entry of this.requests) {
        remaining -= entry.tokens;
        if (remaining <= 0) {
          waitForTokens = Math.max(0, entry.timestamp + this.windowMs - now);
          break;
        }
      }
    }

    return Math.max(waitForRequests, waitForTokens);
  }

  private applyPreemptiveDegrade(
    now: number,
    usedRequests: number,
    usedTokens: number
  ): void {
    if (this.preemptMs <= 0) {
      return;
    }

    const shouldPreemptRequests = this.shouldPreempt(usedRequests, this.maxRequests);
    const shouldPreemptTokens = this.shouldPreempt(usedTokens, this.maxTokens);

    if (shouldPreemptRequests || shouldPreemptTokens) {
      this.degradeFactor = Math.max(MIN_DEGRADE_FACTOR, this.degradeFactor * DEGRADE_MULTIPLIER);
      this.degradeUntil = now + this.preemptMs;
      return;
    }

    if (now > this.degradeUntil && this.degradeFactor < 1) {
      this.degradeFactor = Math.min(1, this.degradeFactor + RECOVER_STEP);
    }
  }

  private shouldPreempt(used: number, limit: number): boolean {
    if (limit <= 0 || used <= 0) {
      return false;
    }

    const ratePerMs = used / this.windowMs;
    if (ratePerMs <= 0) {
      return false;
    }

    const remaining = limit - used;
    if (remaining <= 0) {
      return true;
    }

    const etaMs = remaining / ratePerMs;
    return etaMs <= this.preemptMs;
  }
}

// シングルトンインスタンス
let globalRateLimiter: RateLimiter | null = null;

/**
 * グローバルレート制限インスタンスを取得
 */
export function getGlobalRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new RateLimiter();
  }
  return globalRateLimiter;
}
