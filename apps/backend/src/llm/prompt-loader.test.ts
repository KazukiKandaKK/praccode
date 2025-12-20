import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { loadPrompt, renderPrompt } from './prompt-loader';

// Mock fs.readFileSync
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

const mockedReadFile = readFileSync as vi.Mock;

describe('prompt-loader', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadPrompt', () => {
    it('should read and return the content of a prompt file', () => {
      const mockContent = 'This is a mock prompt.';
      mockedReadFile.mockReturnValue(mockContent);

      const content = loadPrompt('test-prompt.md');

      expect(mockedReadFile).toHaveBeenCalledWith(
        expect.stringContaining('prompts/test-prompt.md'),
        'utf-8'
      );
      expect(content).toBe(mockContent);
    });
  });

  describe('renderPrompt', () => {
    const template = 'Question: {{QUESTION}}\nAnswer: {{USER_ANSWER}}\nInfo: {{OTHER_INFO}}';

    it('should wrap user input fields with separators', () => {
      const variables = {
        QUESTION: 'What is it?',
        USER_ANSWER: 'It is a thing.',
      };
      const result = renderPrompt(template, variables);
      
      expect(result).toContain('---USER_INPUT_START---\nWhat is it?\n---USER_INPUT_END---');
      expect(result).toContain('---USER_INPUT_START---\nIt is a thing.\n---USER_INPUT_END---');
    });

    it('should replace non-user input fields directly', () => {
        const variables = {
          OTHER_INFO: 'This is other info.',
        };
        const result = renderPrompt(template, variables);
        expect(result).toContain('Info: This is other info.');
        expect(result).not.toContain('---USER_INPUT_START---');
      });

    it('should handle multiple placeholders correctly', () => {
      const variables = {
        QUESTION: 'A question.',
        USER_ANSWER: 'An answer.',
        OTHER_INFO: 'More info.',
      };
      const result = renderPrompt(template, variables);
      expect(result).toContain('---USER_INPUT_START---\nA question.\n---USER_INPUT_END---');
      expect(result).toContain('---USER_INPUT_START---\nAn answer.\n---USER_INPUT_END---');
      expect(result).toContain('Info: More info.');
    });

    it('should not replace placeholders that are not in the variables object', () => {
        const variables = {
            QUESTION: 'A question.',
          };
          const result = renderPrompt(template, variables);
          expect(result).toContain('---USER_INPUT_START---\nA question.\n---USER_INPUT_END---');
          expect(result).toContain('{{USER_ANSWER}}');
          expect(result).toContain('{{OTHER_INFO}}');
    });
  });
});
