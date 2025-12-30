import { describe, it, expect, vi } from 'vitest';
import { scoreToLevel, normalizeScore, evaluateAnswer } from '@/infrastructure/llm/evaluator';
import * as llmClient from '@/infrastructure/llm/llm-client';

vi.mock('@/infrastructure/llm/llm-client');
const mockLlmClient = llmClient as any;

// ============================================
// evaluateAnswer test
// ============================================
describe('evaluateAnswer', () => {
  const validInput = {
    code: 'const a = 1;',
    question: 'What is a?',
    idealPoints: ['`a` is a variable'],
    userAnswer: 'a is a var',
  };

  it('正常系: LLMが有効なJSONを返した場合、パースして返す', async () => {
    const mockResponse = {
      score: 85,
      feedback: 'Good job',
      aspects: { Clarity: 90 },
    };
    mockLlmClient.generateWithOllama.mockResolvedValue(JSON.stringify(mockResponse));

    const result = await evaluateAnswer(validInput);

    expect(result.score).toBe(85);
    expect(result.level).toBe('B');
    expect(result.feedback).toBe('Good job');
    expect(result.aspects).toEqual({ Clarity: 90 });
  });

  it('異常系: LLMが不正なJSONを返した場合、エラーを投げる', async () => {
    mockLlmClient.generateWithOllama.mockResolvedValue('this is not json');
    await expect(evaluateAnswer(validInput)).rejects.toThrow();
  });

  it('異常系: LLMのレスポンスに必要なフィールドが欠けている場合、エラーを投げる', async () => {
    const mockResponse = {
      // 'score' field is missing
      feedback: 'Good job',
    };
    mockLlmClient.generateWithOllama.mockResolvedValue(JSON.stringify(mockResponse));
    await expect(evaluateAnswer(validInput)).rejects.toThrow();
  });
});

// ============================================
// scoreToLevel テスト
// ============================================
describe('scoreToLevel', () => {
  describe('正常系', () => {
    it('スコア100の場合、Aを返す', () => {
      expect(scoreToLevel(100)).toBe('A');
    });

    it('スコア75の場合、Bを返す', () => {
      expect(scoreToLevel(75)).toBe('B');
    });

    it('スコア60の場合、Cを返す', () => {
      expect(scoreToLevel(60)).toBe('C');
    });

    it('スコア30の場合、Dを返す', () => {
      expect(scoreToLevel(30)).toBe('D');
    });
  });

  describe('境界値テスト（A/Bの境界：89/90）', () => {
    it('スコア89の場合、Bを返す', () => {
      expect(scoreToLevel(89)).toBe('B');
    });

    it('スコア90の場合、Aを返す', () => {
      expect(scoreToLevel(90)).toBe('A');
    });
  });

  describe('境界値テスト（B/Cの境界：69/70）', () => {
    it('スコア69の場合、Cを返す', () => {
      expect(scoreToLevel(69)).toBe('C');
    });

    it('スコア70の場合、Bを返す', () => {
      expect(scoreToLevel(70)).toBe('B');
    });
  });

  describe('境界値テスト（C/Dの境界：49/50）', () => {
    it('スコア49の場合、Dを返す', () => {
      expect(scoreToLevel(49)).toBe('D');
    });

    it('スコア50の場合、Cを返す', () => {
      expect(scoreToLevel(50)).toBe('C');
    });
  });

  describe('境界値テスト（最小/最大）', () => {
    it('スコア0の場合、Dを返す', () => {
      expect(scoreToLevel(0)).toBe('D');
    });

    it('スコア100の場合、Aを返す', () => {
      expect(scoreToLevel(100)).toBe('A');
    });
  });

  describe('外れ値テスト', () => {
    it('スコア-10の場合、Dを返す', () => {
      expect(scoreToLevel(-10)).toBe('D');
    });

    it('スコア150の場合、Aを返す', () => {
      expect(scoreToLevel(150)).toBe('A');
    });

    it('小数点スコア89.9の場合、Bを返す', () => {
      expect(scoreToLevel(89.9)).toBe('B');
    });

    it('小数点スコア90.0の場合、Aを返す', () => {
      expect(scoreToLevel(90.0)).toBe('A');
    });
  });
});

// ============================================
// normalizeScore テスト
// ============================================
describe('normalizeScore', () => {
  describe('正常系', () => {
    it('範囲内のスコアはそのまま返す', () => {
      expect(normalizeScore(50)).toBe(50);
    });

    it('小数点スコアは四捨五入される', () => {
      expect(normalizeScore(75.4)).toBe(75);
      expect(normalizeScore(75.5)).toBe(76);
      expect(normalizeScore(75.6)).toBe(76);
    });
  });

  describe('境界値テスト', () => {
    it('スコア0はそのまま返す', () => {
      expect(normalizeScore(0)).toBe(0);
    });

    it('スコア100はそのまま返す', () => {
      expect(normalizeScore(100)).toBe(100);
    });
  });

  describe('外れ値テスト', () => {
    it('負のスコアは0に正規化される', () => {
      expect(normalizeScore(-1)).toBe(0);
      expect(normalizeScore(-50)).toBe(0);
      expect(normalizeScore(-100)).toBe(0);
    });

    it('100超のスコアは100に正規化される', () => {
      expect(normalizeScore(101)).toBe(100);
      expect(normalizeScore(150)).toBe(100);
      expect(normalizeScore(1000)).toBe(100);
    });
  });
});
