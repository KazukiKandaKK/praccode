import { describe, it, expect } from 'vitest';
import {
  calculateStats,
  generateFallbackAnalysis,
  getRecommendedProblemContext,
  Stats,
} from './learning-analyzer';

// ============================================
// calculateStats テスト
// ============================================
describe('calculateStats', () => {
  describe('正常系', () => {
    it('空配列の場合、デフォルト値を返す', () => {
      const result = calculateStats([], []);

      expect(result.totalReadingSubmissions).toBe(0);
      expect(result.totalWritingSubmissions).toBe(0);
      expect(result.avgReadingScore).toBe(0);
      expect(result.writingPassRate).toBe(0);
      expect(Object.keys(result.aspectScores)).toHaveLength(0);
      expect(Object.keys(result.languageStats)).toHaveLength(0);
      expect(Object.keys(result.genreStats)).toHaveLength(0);
    });

    it('リーディング提出1件の場合、正しく集計する', () => {
      const readingSubmissions = [
        {
          exerciseTitle: 'Test Exercise',
          language: 'typescript',
          genre: 'auth',
          score: 80,
          level: 'B',
          aspects: { responsibility: 85, data_flow: 75 },
          feedback: null,
        },
      ];

      const result = calculateStats(readingSubmissions, []);

      expect(result.totalReadingSubmissions).toBe(1);
      expect(result.avgReadingScore).toBe(80);
      expect(result.languageStats['typescript']).toEqual({ count: 1, avgScore: 80 });
      expect(result.genreStats['auth']).toEqual({ count: 1, avgScore: 80 });
      expect(result.aspectScores['responsibility']).toEqual({ total: 85, count: 1 });
      expect(result.aspectScores['data_flow']).toEqual({ total: 75, count: 1 });
    });

    it('複数のリーディング提出で平均を正しく計算する', () => {
      const readingSubmissions = [
        {
          exerciseTitle: 'Exercise 1',
          language: 'typescript',
          genre: 'auth',
          score: 60,
          level: 'C',
          aspects: { responsibility: 70 },
          feedback: null,
        },
        {
          exerciseTitle: 'Exercise 2',
          language: 'typescript',
          genre: 'database',
          score: 80,
          level: 'B',
          aspects: { responsibility: 90 },
          feedback: null,
        },
      ];

      const result = calculateStats(readingSubmissions, []);

      expect(result.totalReadingSubmissions).toBe(2);
      expect(result.avgReadingScore).toBe(70); // (60 + 80) / 2 = 70
      expect(result.languageStats['typescript'].avgScore).toBe(70);
      expect(result.aspectScores['responsibility']).toEqual({ total: 160, count: 2 });
    });

    it('ライティング提出の成功率を正しく計算する', () => {
      const writingSubmissions = [
        { challengeTitle: 'Challenge 1', language: 'javascript', passed: true, feedback: null },
        { challengeTitle: 'Challenge 2', language: 'javascript', passed: false, feedback: null },
        { challengeTitle: 'Challenge 3', language: 'javascript', passed: true, feedback: null },
        { challengeTitle: 'Challenge 4', language: 'javascript', passed: true, feedback: null },
      ];

      const result = calculateStats([], writingSubmissions);

      expect(result.totalWritingSubmissions).toBe(4);
      expect(result.writingPassRate).toBe(75); // 3/4 = 75%
    });
  });

  describe('境界値テスト', () => {
    it('スコア0の場合', () => {
      const readingSubmissions = [
        {
          exerciseTitle: 'Test',
          language: 'typescript',
          genre: null,
          score: 0,
          level: 'D',
          aspects: null,
          feedback: null,
        },
      ];

      const result = calculateStats(readingSubmissions, []);

      expect(result.avgReadingScore).toBe(0);
    });

    it('スコア100の場合', () => {
      const readingSubmissions = [
        {
          exerciseTitle: 'Test',
          language: 'typescript',
          genre: null,
          score: 100,
          level: 'A',
          aspects: null,
          feedback: null,
        },
      ];

      const result = calculateStats(readingSubmissions, []);

      expect(result.avgReadingScore).toBe(100);
    });

    it('ライティング全て成功の場合（100%）', () => {
      const writingSubmissions = [
        { challengeTitle: 'C1', language: 'javascript', passed: true, feedback: null },
        { challengeTitle: 'C2', language: 'javascript', passed: true, feedback: null },
      ];

      const result = calculateStats([], writingSubmissions);

      expect(result.writingPassRate).toBe(100);
    });

    it('ライティング全て失敗の場合（0%）', () => {
      const writingSubmissions = [
        { challengeTitle: 'C1', language: 'javascript', passed: false, feedback: null },
        { challengeTitle: 'C2', language: 'javascript', passed: false, feedback: null },
      ];

      const result = calculateStats([], writingSubmissions);

      expect(result.writingPassRate).toBe(0);
    });
  });

  describe('外れ値テスト', () => {
    it('genreがnullの場合、genreStatsに含まれない', () => {
      const readingSubmissions = [
        {
          exerciseTitle: 'Test',
          language: 'typescript',
          genre: null,
          score: 70,
          level: 'B',
          aspects: null,
          feedback: null,
        },
      ];

      const result = calculateStats(readingSubmissions, []);

      expect(Object.keys(result.genreStats)).toHaveLength(0);
    });

    it('aspectsがnullの場合、aspectScoresに含まれない', () => {
      const readingSubmissions = [
        {
          exerciseTitle: 'Test',
          language: 'typescript',
          genre: 'auth',
          score: 70,
          level: 'B',
          aspects: null,
          feedback: null,
        },
      ];

      const result = calculateStats(readingSubmissions, []);

      expect(Object.keys(result.aspectScores)).toHaveLength(0);
    });
  });
});

// ============================================
// generateFallbackAnalysis テスト
// ============================================
describe('generateFallbackAnalysis', () => {
  describe('正常系', () => {
    it('データなしの場合、デフォルトのおすすめを返す', () => {
      const stats: Stats = {
        totalReadingSubmissions: 0,
        totalWritingSubmissions: 0,
        avgReadingScore: 0,
        writingPassRate: 0,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.recommendations).toContain('継続して問題に取り組みましょう');
      expect(result.summary).toBe('まだ提出データがありません。');
    });

    it('高スコア（80以上）の場合、強みとして認識する', () => {
      const stats: Stats = {
        totalReadingSubmissions: 5,
        totalWritingSubmissions: 0,
        avgReadingScore: 85,
        writingPassRate: 0,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.strengths).toContain('コードリーディング力が高い');
    });

    it('ライティング成功率が高い（80以上）場合、強みとして認識する', () => {
      const stats: Stats = {
        totalReadingSubmissions: 0,
        totalWritingSubmissions: 5,
        avgReadingScore: 0,
        writingPassRate: 85,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.strengths).toContain('コードライティングの正確性が高い');
    });
  });

  describe('境界値テスト', () => {
    it('リーディングスコア境界値：79点（強みに含まれない）', () => {
      const stats: Stats = {
        totalReadingSubmissions: 5,
        totalWritingSubmissions: 0,
        avgReadingScore: 79,
        writingPassRate: 0,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.strengths).not.toContain('コードリーディング力が高い');
    });

    it('リーディングスコア境界値：80点（強みに含まれる）', () => {
      const stats: Stats = {
        totalReadingSubmissions: 5,
        totalWritingSubmissions: 0,
        avgReadingScore: 80,
        writingPassRate: 0,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.strengths).toContain('コードリーディング力が高い');
    });

    it('リーディングスコア境界値：59点（弱みに含まれる）', () => {
      const stats: Stats = {
        totalReadingSubmissions: 5,
        totalWritingSubmissions: 0,
        avgReadingScore: 59,
        writingPassRate: 0,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.weaknesses).toContain('コードリーディングの精度向上が必要');
    });

    it('リーディングスコア境界値：60点（弱みに含まれない）', () => {
      const stats: Stats = {
        totalReadingSubmissions: 5,
        totalWritingSubmissions: 0,
        avgReadingScore: 60,
        writingPassRate: 0,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.weaknesses).not.toContain('コードリーディングの精度向上が必要');
    });

    it('ライティング成功率境界値：49%（弱みに含まれる）', () => {
      const stats: Stats = {
        totalReadingSubmissions: 0,
        totalWritingSubmissions: 5,
        avgReadingScore: 0,
        writingPassRate: 49,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.weaknesses).toContain('コードライティングのテスト通過率を上げましょう');
    });

    it('ライティング成功率境界値：50%（弱みに含まれない）', () => {
      const stats: Stats = {
        totalReadingSubmissions: 0,
        totalWritingSubmissions: 5,
        avgReadingScore: 0,
        writingPassRate: 50,
        aspectScores: {},
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.weaknesses).not.toContain('コードライティングのテスト通過率を上げましょう');
    });
  });

  describe('アスペクト分析', () => {
    it('アスペクトスコアが80以上の場合、強みとして認識する', () => {
      const stats: Stats = {
        totalReadingSubmissions: 5,
        totalWritingSubmissions: 0,
        avgReadingScore: 70,
        writingPassRate: 0,
        aspectScores: {
          responsibility: { total: 160, count: 2 }, // avg = 80
        },
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.strengths).toContain('responsibilityの理解が優れている');
    });

    it('アスペクトスコアが60未満の場合、弱みとして認識する', () => {
      const stats: Stats = {
        totalReadingSubmissions: 5,
        totalWritingSubmissions: 0,
        avgReadingScore: 70,
        writingPassRate: 0,
        aspectScores: {
          data_flow: { total: 118, count: 2 }, // avg = 59
        },
        languageStats: {},
        genreStats: {},
      };

      const result = generateFallbackAnalysis(stats);

      expect(result.weaknesses).toContain('data_flowの理解を深める必要あり');
      expect(result.recommendations).toContain('data_flowに関連する問題に挑戦しましょう');
    });
  });
});

// ============================================
// getRecommendedProblemContext テスト
// ============================================
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

