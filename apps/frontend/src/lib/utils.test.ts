import { describe, it, expect } from 'vitest';
import {
  getDifficultyLabel,
  getDifficultyColor,
  getScoreLevelColor,
  getScoreLevelBgColor,
  getLanguageLabel,
  getLearningGoalLabel,
  getGenreLabel,
} from './utils';

// ============================================
// getDifficultyLabel テスト
// ============================================
describe('getDifficultyLabel', () => {
  describe('正常系', () => {
    it('難易度1の場合、「入門」を返す', () => {
      expect(getDifficultyLabel(1)).toBe('入門');
    });

    it('難易度2の場合、「初級」を返す', () => {
      expect(getDifficultyLabel(2)).toBe('初級');
    });

    it('難易度3の場合、「中級」を返す', () => {
      expect(getDifficultyLabel(3)).toBe('中級');
    });

    it('難易度4の場合、「上級」を返す', () => {
      expect(getDifficultyLabel(4)).toBe('上級');
    });

    it('難易度5の場合、「エキスパート」を返す', () => {
      expect(getDifficultyLabel(5)).toBe('エキスパート');
    });
  });

  describe('境界値テスト', () => {
    it('難易度1（最小値）', () => {
      expect(getDifficultyLabel(1)).toBe('入門');
    });

    it('難易度5（最大値）', () => {
      expect(getDifficultyLabel(5)).toBe('エキスパート');
    });
  });

  describe('外れ値テスト', () => {
    it('難易度0の場合、「不明」を返す', () => {
      expect(getDifficultyLabel(0)).toBe('不明');
    });

    it('難易度6の場合、「不明」を返す', () => {
      expect(getDifficultyLabel(6)).toBe('不明');
    });

    it('負の難易度の場合、「不明」を返す', () => {
      expect(getDifficultyLabel(-1)).toBe('不明');
    });

    it('小数の難易度の場合、「不明」を返す', () => {
      expect(getDifficultyLabel(2.5)).toBe('不明');
    });
  });
});

// ============================================
// getDifficultyColor テスト
// ============================================
describe('getDifficultyColor', () => {
  describe('正常系', () => {
    it('難易度1の場合、emeraldカラーを返す', () => {
      expect(getDifficultyColor(1)).toBe('text-emerald-400');
    });

    it('難易度2の場合、cyanカラーを返す', () => {
      expect(getDifficultyColor(2)).toBe('text-cyan-400');
    });

    it('難易度3の場合、amberカラーを返す', () => {
      expect(getDifficultyColor(3)).toBe('text-amber-400');
    });

    it('難易度4の場合、orangeカラーを返す', () => {
      expect(getDifficultyColor(4)).toBe('text-orange-400');
    });

    it('難易度5の場合、redカラーを返す', () => {
      expect(getDifficultyColor(5)).toBe('text-red-400');
    });
  });

  describe('外れ値テスト', () => {
    it('無効な難易度の場合、slateカラーを返す', () => {
      expect(getDifficultyColor(0)).toBe('text-slate-400');
      expect(getDifficultyColor(6)).toBe('text-slate-400');
      expect(getDifficultyColor(-1)).toBe('text-slate-400');
    });
  });
});

// ============================================
// getScoreLevelColor テスト
// ============================================
describe('getScoreLevelColor', () => {
  describe('正常系', () => {
    it('レベルAの場合、emeraldカラーを返す', () => {
      expect(getScoreLevelColor('A')).toBe('text-emerald-400');
    });

    it('レベルBの場合、cyanカラーを返す', () => {
      expect(getScoreLevelColor('B')).toBe('text-cyan-400');
    });

    it('レベルCの場合、amberカラーを返す', () => {
      expect(getScoreLevelColor('C')).toBe('text-amber-400');
    });

    it('レベルDの場合、redカラーを返す', () => {
      expect(getScoreLevelColor('D')).toBe('text-red-400');
    });
  });

  describe('外れ値テスト', () => {
    it('無効なレベルの場合、slateカラーを返す', () => {
      expect(getScoreLevelColor('E')).toBe('text-slate-400');
      expect(getScoreLevelColor('')).toBe('text-slate-400');
      expect(getScoreLevelColor('a')).toBe('text-slate-400'); // 小文字
    });
  });
});

// ============================================
// getScoreLevelBgColor テスト
// ============================================
describe('getScoreLevelBgColor', () => {
  describe('正常系', () => {
    it('レベルAの場合、emerald背景を返す', () => {
      expect(getScoreLevelBgColor('A')).toBe('bg-emerald-500/20 border-emerald-500/30');
    });

    it('レベルBの場合、cyan背景を返す', () => {
      expect(getScoreLevelBgColor('B')).toBe('bg-cyan-500/20 border-cyan-500/30');
    });

    it('レベルCの場合、amber背景を返す', () => {
      expect(getScoreLevelBgColor('C')).toBe('bg-amber-500/20 border-amber-500/30');
    });

    it('レベルDの場合、red背景を返す', () => {
      expect(getScoreLevelBgColor('D')).toBe('bg-red-500/20 border-red-500/30');
    });
  });

  describe('外れ値テスト', () => {
    it('無効なレベルの場合、slate背景を返す', () => {
      expect(getScoreLevelBgColor('X')).toBe('bg-slate-500/20 border-slate-500/30');
      expect(getScoreLevelBgColor('')).toBe('bg-slate-500/20 border-slate-500/30');
    });
  });
});

// ============================================
// getLanguageLabel テスト
// ============================================
describe('getLanguageLabel', () => {
  describe('正常系', () => {
    it('typescriptの場合、「TypeScript」を返す', () => {
      expect(getLanguageLabel('typescript')).toBe('TypeScript');
    });

    it('javascriptの場合、「JavaScript」を返す', () => {
      expect(getLanguageLabel('javascript')).toBe('JavaScript');
    });

    it('goの場合、「Go」を返す', () => {
      expect(getLanguageLabel('go')).toBe('Go');
    });

    it('rubyの場合、「Ruby」を返す', () => {
      expect(getLanguageLabel('ruby')).toBe('Ruby');
    });

    it('pythonの場合、「Python」を返す', () => {
      expect(getLanguageLabel('python')).toBe('Python');
    });

    it('rustの場合、「Rust」を返す', () => {
      expect(getLanguageLabel('rust')).toBe('Rust');
    });
  });

  describe('外れ値テスト', () => {
    it('未知の言語の場合、そのまま返す', () => {
      expect(getLanguageLabel('unknown')).toBe('unknown');
      expect(getLanguageLabel('java')).toBe('java');
    });

    it('空文字の場合、空文字を返す', () => {
      expect(getLanguageLabel('')).toBe('');
    });

    it('大文字混じりの場合、そのまま返す', () => {
      expect(getLanguageLabel('TypeScript')).toBe('TypeScript'); // マッチしない
    });
  });
});

// ============================================
// getLearningGoalLabel テスト
// ============================================
describe('getLearningGoalLabel', () => {
  describe('正常系', () => {
    it('responsibilityの場合、「責務理解」を返す', () => {
      expect(getLearningGoalLabel('responsibility')).toBe('責務理解');
    });

    it('data_flowの場合、「データフロー」を返す', () => {
      expect(getLearningGoalLabel('data_flow')).toBe('データフロー');
    });

    it('error_handlingの場合、「エラーハンドリング」を返す', () => {
      expect(getLearningGoalLabel('error_handling')).toBe('エラーハンドリング');
    });

    it('testingの場合、「テスト」を返す', () => {
      expect(getLearningGoalLabel('testing')).toBe('テスト');
    });

    it('performanceの場合、「パフォーマンス」を返す', () => {
      expect(getLearningGoalLabel('performance')).toBe('パフォーマンス');
    });

    it('securityの場合、「セキュリティ」を返す', () => {
      expect(getLearningGoalLabel('security')).toBe('セキュリティ');
    });
  });

  describe('外れ値テスト', () => {
    it('未知のゴールの場合、そのまま返す', () => {
      expect(getLearningGoalLabel('unknown_goal')).toBe('unknown_goal');
    });

    it('空文字の場合、空文字を返す', () => {
      expect(getLearningGoalLabel('')).toBe('');
    });
  });
});

// ============================================
// getGenreLabel テスト
// ============================================
describe('getGenreLabel', () => {
  describe('正常系', () => {
    it('authの場合、「認証/認可」を返す', () => {
      expect(getGenreLabel('auth')).toBe('認証/認可');
    });

    it('databaseの場合、「データベース」を返す', () => {
      expect(getGenreLabel('database')).toBe('データベース');
    });

    it('error_handlingの場合、「エラーハンドリング」を返す', () => {
      expect(getGenreLabel('error_handling')).toBe('エラーハンドリング');
    });

    it('api_clientの場合、「APIクライアント」を返す', () => {
      expect(getGenreLabel('api_client')).toBe('APIクライアント');
    });

    it('async_concurrencyの場合、「非同期/並行」を返す', () => {
      expect(getGenreLabel('async_concurrency')).toBe('非同期/並行');
    });

    it('performanceの場合、「パフォーマンス」を返す', () => {
      expect(getGenreLabel('performance')).toBe('パフォーマンス');
    });

    it('testingの場合、「テスト」を返す', () => {
      expect(getGenreLabel('testing')).toBe('テスト');
    });

    it('refactoringの場合、「リファクタリング」を返す', () => {
      expect(getGenreLabel('refactoring')).toBe('リファクタリング');
    });
  });

  describe('外れ値テスト', () => {
    it('未知のジャンルの場合、そのまま返す', () => {
      expect(getGenreLabel('unknown_genre')).toBe('unknown_genre');
    });

    it('空文字の場合、空文字を返す', () => {
      expect(getGenreLabel('')).toBe('');
    });
  });
});

