import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { OllamaProvider } from './ollama-provider';
import { GeminiProvider } from './gemini-provider';
import { getGlobalRateLimiter } from './rate-limiter';
import { retryWithBackoff } from './retry-handler';

vi.mock('./ollama-provider');
vi.mock('./gemini-provider');
vi.mock('./rate-limiter');
vi.mock('./retry-handler');

describe('LLM Client', () => {

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    describe('getLLMProvider', () => {
        it('should return OllamaProvider by default', async () => {
            const { getLLMProvider } = await import('./llm-client');
            const provider = getLLMProvider();
            expect(provider).toBeInstanceOf(OllamaProvider);
        });

        it('should return GeminiProvider when env var is set', async () => {
            vi.stubEnv('LLM_PROVIDER', 'gemini');
            const { getLLMProvider } = await import('./llm-client');
            const provider = getLLMProvider();
            expect(provider).toBeInstanceOf(GeminiProvider);
        });
    });

    describe('generateWithOllama', () => {
        const mockRateLimiter = { acquire: vi.fn().mockResolvedValue(undefined) };
        const mockProvider = { generate: vi.fn().mockResolvedValue('response') };

        beforeEach(() => {
            vi.mocked(getGlobalRateLimiter).mockReturnValue(mockRateLimiter);
            vi.mocked(OllamaProvider).mockImplementation(() => mockProvider as any);
            vi.mocked(retryWithBackoff).mockImplementation(async (fn: any) => fn());
        });

        it('should call its dependencies', async () => {
            const { generateWithOllama } = await import('./llm-client');
            await generateWithOllama('prompt');
            expect(mockRateLimiter.acquire).toHaveBeenCalled();
            expect(retryWithBackoff).toHaveBeenCalled();
            expect(mockProvider.generate).toHaveBeenCalled();
        });

        it('should re-throw a rate limit error to be handled by retry', async () => {
            const rateLimitError = new Error('429 rate limit');
            mockProvider.generate.mockRejectedValue(rateLimitError);
            
            const { generateWithOllama } = await import('./llm-client');

            // The retry handler will catch and re-throw, so we expect it to be thrown here
            await expect(generateWithOllama('prompt')).rejects.toThrow(rateLimitError);

            expect(mockRateLimiter.acquire).toHaveBeenCalled();
            expect(retryWithBackoff).toHaveBeenCalled();
            expect(mockProvider.generate).toHaveBeenCalled();
        });
    });
});
