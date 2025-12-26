import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeminiProvider } from '@/llm/gemini-provider';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GeminiProvider', () => {
  let provider: GeminiProvider;

  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    provider = new GeminiProvider();
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('generate', () => {
    const prompt = 'test prompt';

    it('正常系: 正常なレスポンスを返す', async () => {
      const mockApiResponse = {
        candidates: [{ content: { parts: [{ text: 'test response' }] } }],
      };
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(mockApiResponse),
      });

      const result = await provider.generate(prompt);

      expect(result).toBe('test response');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/models/gemini-2.5-flash-lite:streamGenerateContent'),
        expect.any(Object)
      );
    });

    it('正常系: ストリーミングされたレスポンスを正しくパースする', async () => {
      const streamResponse = `{"candidates": [{"content": {"parts": [{"text": "Hello "}]}}]}
{"candidates": [{"content": {"parts": [{"text": "World"}]}}]}`;
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => streamResponse,
      });

      const result = await provider.generate(prompt);
      expect(result).toBe('Hello World');
    });

    it('異常系: APIキーがない場合エラーを投げる', async () => {
      vi.stubEnv('GEMINI_API_KEY', '');
      // Re-instantiate provider to pick up new env var
      const providerWithoutKey = new GeminiProvider();
      await expect(providerWithoutKey.generate(prompt)).rejects.toThrow(
        'GEMINI_API_KEY environment variable is not set'
      );
    });

    it('異常系: APIがエラーを返した場合', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });
      await expect(provider.generate(prompt)).rejects.toThrow('Gemini API error: 500');
    });

    it('異常系: レスポンスに候補がない場合エラーを投げる', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify({ candidates: [] }),
      });
      await expect(provider.generate(prompt)).rejects.toThrow('Gemini API returned no candidates');
    });
  });

  describe('checkHealth', () => {
    it('正常系: 接続に成功した場合trueを返す', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const result = await provider.checkHealth();
      expect(result).toBe(true);
    });

    it('異常系: APIキーがない場合falseを返す', async () => {
      vi.stubEnv('GEMINI_API_KEY', '');
      const providerWithoutKey = new GeminiProvider();
      const result = await providerWithoutKey.checkHealth();
      expect(result).toBe(false);
    });
  });
});
