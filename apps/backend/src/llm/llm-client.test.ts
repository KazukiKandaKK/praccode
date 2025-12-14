import { describe, it, expect } from 'vitest';
import { getLLMProvider } from './llm-client';
import { OllamaProvider } from './ollama-provider';

describe('LLM Client', () => {
  it('should return a provider instance', () => {
    const provider = getLLMProvider();
    expect(provider).toBeDefined();
    expect(provider.generate).toBeDefined();
    expect(provider.checkHealth).toBeDefined();
  });

  it('should return OllamaProvider by default', () => {
    const provider = getLLMProvider();
    expect(provider).toBeInstanceOf(OllamaProvider);
  });

  it('should have generate method that returns Promise<string>', () => {
    const provider = getLLMProvider();
    expect(typeof provider.generate).toBe('function');
    // 実際の呼び出しはしない（Ollama/Geminiへの接続が必要なため）
  });

  it('should have checkHealth method that returns Promise<boolean>', () => {
    const provider = getLLMProvider();
    expect(typeof provider.checkHealth).toBe('function');
    // 実際の呼び出しはしない（Ollama/Geminiへの接続が必要なため）
  });
});
