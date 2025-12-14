/**
 * レート制限ミドルウェア - スライディングウィンドウ方式
 */

const RATE_LIMIT_WINDOW_MS = parseInt(
  process.env.LLM_RATE_LIMIT_WINDOW_MS || '60000',
  10
); // デフォルト: 60秒
const RATE_LIMIT_MAX_REQUESTS = parseInt(
  process.env.LLM_RATE_LIMIT_MAX_REQUESTS || '10',
  10
); // デフォルト: 10リクエスト

/**
 * スライディングウィンドウ方式のレート制限
 * 一定時間内のリクエスト数を制限し、超過時は待機する
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = RATE_LIMIT_WINDOW_MS, maxRequests: number = RATE_LIMIT_MAX_REQUESTS) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * レート制限をチェックし、必要に応じて待機
   */
  async acquire(): Promise<void> {
    this.cleanup();

    const now = Date.now();

    // ウィンドウ内のリクエスト数が上限に達している場合
    if (this.requests.length >= this.maxRequests) {
      // 最古のリクエストがウィンドウから出るまでの待機時間を計算
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + this.windowMs - now;

      if (waitTime > 0) {
        console.info(
          `[RateLimiter] レート制限: ${this.maxRequests}リクエスト/${this.windowMs}ms に達しました。${waitTime}ms 待機します...`
        );
        await this.sleep(waitTime);
        // 待機後に再度クリーンアップ
        this.cleanup();
      }
    }

    // 新しいリクエストを記録
    this.requests.push(now);
  }

  /**
   * ウィンドウ外の古いリクエストを削除
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    this.requests = this.requests.filter((timestamp) => timestamp > cutoff);
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
  getStatus(): { currentRequests: number; maxRequests: number; windowMs: number } {
    this.cleanup();
    return {
      currentRequests: this.requests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
    };
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

