import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, isRateLimitError } from './retry-handler';

describe('retry-handler', () => {

    describe('isRateLimitError', () => {
        it('should return true for "429" error messages', () => {
            expect(isRateLimitError(new Error('Request failed with status code 429'))).toBe(true);
        });
        it('should return true for "rate limit" error messages', () => {
            expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
        });
        it('should return false for other errors', () => {
            expect(isRateLimitError(new Error('Something else went wrong'))).toBe(false);
        });
    });

    describe('retryWithBackoff', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });
        afterEach(() => {
            vi.useRealTimers();
        });

        it('アクションが初回で成功した場合、リトライしない', async () => {
            const action = vi.fn().mockResolvedValue('success');
            const result = await retryWithBackoff(action, { maxRetries: 3 });
            expect(result).toBe('success');
            expect(action).toHaveBeenCalledTimes(1);
        });

        it('アクションが一度失敗し、2回目で成功した場合', async () => {
            const action = vi.fn()
                .mockRejectedValueOnce(new Error('fail once'))
                .mockResolvedValue('success');
            
            const promise = retryWithBackoff(action, { maxRetries: 3, baseDelay: 100 });
            
            await vi.advanceTimersByTimeAsync(100);

            const result = await promise;

            expect(result).toBe('success');
            expect(action).toHaveBeenCalledTimes(2);
        });

        it('最大リトライ回数を超えて失敗した場合、エラーを投げる', async () => {
            const action = vi.fn().mockRejectedValue(new Error('persistent failure'));
            
            const promise = retryWithBackoff(action, { maxRetries: 2, baseDelay: 100 });

            await vi.advanceTimersByTimeAsync(100); // 1st retry delay
            await vi.advanceTimersByTimeAsync(200); // 2nd retry delay

            await expect(promise).rejects.toThrow('persistent failure');
            expect(action).toHaveBeenCalledTimes(3);
        });

        it('onRetryコールバックが呼ばれる', async () => {
            const action = vi.fn()
                .mockRejectedValueOnce(new Error('fail once'))
                .mockResolvedValue('success');
            const onRetry = vi.fn();

            const promise = retryWithBackoff(action, { onRetry, baseDelay: 100 });
            await vi.advanceTimersByTimeAsync(100);
            await promise;

            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 100);
        });
    });
});
