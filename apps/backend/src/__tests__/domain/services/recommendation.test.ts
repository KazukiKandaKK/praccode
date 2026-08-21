import { describe, it, expect } from 'vitest';
import { getRecommendedProblemContext } from '@/domain/services/recommendation';

describe('getRecommendedProblemContext', () => {
  describe('正常系', () => {
    it('弱みがある場合、弱みをfocusAreasとして返す', () => {
      const analysis = {
        strengths: ['強み1'],
        weaknesses: ['弱み1', '弱み2'],
        recommendations: ['おすすめ1'],
        summary: 'サマリ',
      };

      const result = getRecommendedProblemContext(analysis);

      expect(result.focusAreas).toEqual(['弱み1', '弱み2']);
    });

    it('弱みがない場合、デフォルトのfocusAreasを返す', () => {
      const analysis = {
        strengths: ['強み1'],
        weaknesses: [],
        recommendations: ['おすすめ1'],
        summary: 'サマリ',
      };

      const result = getRecommendedProblemContext(analysis);

      expect(result.focusAreas).toEqual(['基礎力強化']);
    });
  });

  describe('難易度設定', () => {
    it('弱みが2つ以上の場合、難易度2を返す', () => {
      const analysis = {
        strengths: [],
        weaknesses: ['弱み1', '弱み2'],
        recommendations: [],
        summary: '',
      };

      const result = getRecommendedProblemContext(analysis);

      expect(result.difficulty).toBe(2);
    });

    it('弱みが1つの場合、難易度3を返す', () => {
      const analysis = {
        strengths: [],
        weaknesses: ['弱み1'],
        recommendations: [],
        summary: '',
      };

      const result = getRecommendedProblemContext(analysis);

      expect(result.difficulty).toBe(3);
    });

    it('弱みがない場合、難易度3を返す', () => {
      const analysis = {
        strengths: [],
        weaknesses: [],
        recommendations: [],
        summary: '',
      };

      const result = getRecommendedProblemContext(analysis);

      expect(result.difficulty).toBe(3);
    });
  });
});
