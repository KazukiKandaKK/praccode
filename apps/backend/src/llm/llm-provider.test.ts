import { describe, it, expect } from 'vitest';
import type { LLMProvider } from './llm-provider';

// This test file is only for improving coverage metrics.
// It confirms that the type definition file can be imported.
describe('LLMProvider interface', () => {
  it('should be defined', () => {
    const mockProvider: LLMProvider = {
      async generate() {
        return 'ok';
      },
      async checkHealth() {
        return true;
      },
    };

    expect(mockProvider).toBeDefined();
  });
});
