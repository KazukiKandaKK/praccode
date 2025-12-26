import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, getGlobalRateLimiter } from '@/llm/rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    // フェイクタイマーを使用してDate.nowとsetTimeoutを制御
    vi.useFakeTimers();
  });

  afterEach(() => {
    // 実際のタイマーに戻す
    vi.useRealTimers();
  });

  it('インスタンス化: カスタム設定が正しく適用される', () => {
    const limiter = new RateLimiter(10000, 5);
    const status = limiter.getStatus();
    expect(status.windowMs).toBe(10000);
    expect(status.maxRequests).toBe(5);
  });

  it('acquire: 制限に達していない場合、待機しない', async () => {
    const limiter = new RateLimiter(1000, 3);
    const sleepSpy = vi.spyOn(limiter as any, 'sleep');

    await limiter.acquire();
    await limiter.acquire();

    expect(limiter.getStatus().currentRequests).toBe(2);
    expect(sleepSpy).not.toHaveBeenCalled();
  });

  it('acquire: 制限に達した場合、適切な時間待機する', async () => {
    const windowMs = 1000;
    const maxRequests = 2;
    const limiter = new RateLimiter(windowMs, maxRequests);
    const sleepSpy = vi.spyOn(limiter as any, 'sleep');

    // 2回のリクエストを記録
    await limiter.acquire(); // time: 0
    vi.advanceTimersByTime(100);
    await limiter.acquire(); // time: 100

    expect(limiter.getStatus().currentRequests).toBe(2);

    // 3回目のリクエスト（制限超過）
    const acquirePromise = limiter.acquire();

    // 待機時間が正しく計算されているか確認
    // 最初のreqから1000ms後まで待つので、残り900ms
    expect(sleepSpy).toHaveBeenCalledWith(900);

    // 時間を進めて待機を完了させる
    vi.advanceTimersByTime(900);
    await acquirePromise;

    // 待機後にリクエストが記録され、古いものが削除されているか確認
    // time: 1000
    const status = limiter.getStatus();
    expect(status.currentRequests).toBe(2); // time: 100 と time: 1000 のリクエスト
  });

  it('acquire: 複数のリクエストが同時に発生しても正しく処理する', async () => {
    const limiter = new RateLimiter(1000, 2);
    const sleepSpy = vi.spyOn(limiter as any, 'sleep');

    await limiter.acquire(); // time: 0
    vi.advanceTimersByTime(10);
    await limiter.acquire(); // time: 10
    expect(limiter.getStatus().currentRequests).toBe(2);
    expect(sleepSpy).not.toHaveBeenCalled();

    // 3rd request should wait
    const p3 = limiter.acquire();
    expect(sleepSpy).toHaveBeenCalledWith(990); // Waits until time 1000

    vi.advanceTimersByTime(990); // time: 1000
    await p3;

    // After waiting, request at time 0 is cleaned, and request at 1000 is added.
    expect(limiter.getStatus().currentRequests).toBe(2); // requests at 10, 1000
  });

  it('cleanup: ウィンドウ外の古いリクエストを正しく削除する', async () => {
    const limiter = new RateLimiter(1000, 5);

    await limiter.acquire(); // time: 0
    vi.advanceTimersByTime(500);
    await limiter.acquire(); // time: 500
    expect(limiter.getStatus().currentRequests).toBe(2);

    // Advance time to the exact edge of the window
    vi.advanceTimersByTime(500); // total time: 1000
    // The request at time 0 is now exactly on the edge, but should be removed
    // because the window is (now - windowMs, now].
    expect(limiter.getStatus().currentRequests).toBe(1); // request at 500 remains

    // Advance time further
    vi.advanceTimersByTime(1); // total time: 1001
    expect(limiter.getStatus().currentRequests).toBe(1); // request at 500 still remains
  });

  describe('境界値分析', () => {
    it('maxRequestsが1の場合、リクエストごとに待機する', async () => {
      const limiter = new RateLimiter(1000, 1);
      const sleepSpy = vi.spyOn(limiter as any, 'sleep');

      await limiter.acquire(); // time: 0
      expect(limiter.getStatus().currentRequests).toBe(1);

      const secondAcquire = limiter.acquire();
      expect(sleepSpy).toHaveBeenCalledWith(1000);
      vi.advanceTimersByTime(1000);
      await secondAcquire;

      expect(limiter.getStatus().currentRequests).toBe(1);
    });

    it('windowMsが0の場合、レート制限がかからない', async () => {
      const limiter = new RateLimiter(0, 5);
      const sleepSpy = vi.spyOn(limiter as any, 'sleep');

      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      // With windowMs=0, the main goal is to ensure no waiting occurs.
      // The number of requests in the queue is an implementation detail.
      expect(sleepSpy).not.toHaveBeenCalled();
    });
  });

  describe('異常系', () => {
    it('コンストラクタに負の数が渡されてもエラーを投げない', () => {
      const limiter = new RateLimiter(-1000, -5);
      const status = limiter.getStatus();
      expect(status.windowMs).toBe(-1000);
      expect(status.maxRequests).toBe(-5);
    });

    it('maxRequestsが0の場合、何もしない', async () => {
      const limiter = new RateLimiter(1000, 0);
      const sleepSpy = vi.spyOn(limiter as any, 'sleep');

      await limiter.acquire();
      await limiter.acquire();

      expect(limiter.getStatus().currentRequests).toBe(0);
      expect(sleepSpy).not.toHaveBeenCalled();
    });
  });
});

describe('getGlobalRateLimiter', () => {
  // グローバルインスタンスのテストはモジュールレベルでの状態に依存するため注意
  // ここでは単純なシングルトンの確認のみ
  it('常に同じインスタンスを返す', () => {
    const instance1 = getGlobalRateLimiter();
    const instance2 = getGlobalRateLimiter();
    expect(instance1).toBe(instance2);
  });
});
