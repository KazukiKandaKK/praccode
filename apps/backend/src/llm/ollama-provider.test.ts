import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from './ollama-provider';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaProvider', () => {

    let provider: OllamaProvider;

    beforeEach(() => {
        provider = new OllamaProvider();
        mockFetch.mockClear();
    });

    describe('generate', () => {
        const prompt = 'test prompt';

        it('正常系: 正常なレスポンスを返す', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({ response: 'test response' }),
            });

            const result = await provider.generate(prompt);

            expect(result).toBe('test response');
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/generate'), expect.any(Object));
            const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(requestBody.prompt).toContain(prompt);
        });

        it('異常系: 429レート制限エラーを投げる', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 429,
                text: async () => 'rate limit exceeded',
                headers: new Headers(),
            });

            await expect(provider.generate(prompt)).rejects.toThrow('Ollama API rate limit (429)');
        });

        it('異常系: タイムアウトエラーを投げる', async () => {
            mockFetch.mockImplementation((url, options) => {
                return new Promise((_resolve, reject) => {
                    // Simulate a timeout by rejecting when the signal is aborted
                    options.signal.addEventListener('abort', () => {
                        // The AbortError class is not easily available in all test envs,
                        // so we simulate it with a named error.
                        const abortError = new Error('The user aborted a request.');
                        abortError.name = 'AbortError';
                        reject(abortError);
                    });
                });
            });

            await expect(provider.generate(prompt, { timeoutMs: 100 })).rejects.toThrow('Ollama request timed out');
        });
    });

    describe('checkHealth', () => {
        it('正常系: 接続に成功した場合trueを返す', async () => {
            mockFetch.mockResolvedValue({ ok: true });
            const result = await provider.checkHealth();
            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/tags'), expect.any(Object));
        });

        it('異常系: 接続に失敗した場合falseを返す', async () => {
            mockFetch.mockRejectedValue(new Error('connection failed'));
            const result = await provider.checkHealth();
            expect(result).toBe(false);
        });
    });
});
