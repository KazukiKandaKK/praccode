/**
 * 学習分析ロジック
 * ユーザーの提出履歴からLLMで強み・弱み・おすすめを分析
 */

import { generateWithOllama } from './ollama';

interface SubmissionData {
  exerciseTitle: string;
  language: string;
  genre: string | null;
  score: number;
  level: string;
  aspects: Record<string, number> | null;
  feedback: string | null;
}

interface WritingSubmissionData {
  challengeTitle: string;
  language: string;
  passed: boolean;
  feedback: string | null;
}

interface AnalysisResult {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string;
}

/**
 * 提出データから学習分析を生成
 */
export async function analyzeLearningProgress(
  readingSubmissions: SubmissionData[],
  writingSubmissions: WritingSubmissionData[]
): Promise<AnalysisResult> {
  // 統計データを計算
  const stats = calculateStats(readingSubmissions, writingSubmissions);

  // 十分なデータがない場合はデフォルト結果を返す
  if (readingSubmissions.length === 0 && writingSubmissions.length === 0) {
    return {
      strengths: [],
      weaknesses: [],
      recommendations: ['まずは問題に挑戦してみましょう！'],
      summary: 'まだ提出データがありません。問題に挑戦すると、あなたの強みや改善点を分析できるようになります。',
    };
  }

  const prompt = buildAnalysisPrompt(stats, readingSubmissions, writingSubmissions);

  try {
    const response = await generateWithOllama(prompt, {
      temperature: 0.3,
      maxTokens: 1024,
      jsonMode: true,
      timeoutMs: 30000,
    });

    const parsed = JSON.parse(response);
    return {
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      recommendations: parsed.recommendations || [],
      summary: parsed.summary || '',
    };
  } catch (error) {
    console.error('Learning analysis failed:', error);
    // フォールバック: 統計ベースの分析
    return generateFallbackAnalysis(stats);
  }
}

interface Stats {
  totalReadingSubmissions: number;
  totalWritingSubmissions: number;
  avgReadingScore: number;
  writingPassRate: number;
  aspectScores: Record<string, { total: number; count: number }>;
  languageStats: Record<string, { count: number; avgScore: number }>;
  genreStats: Record<string, { count: number; avgScore: number }>;
}

function calculateStats(
  readingSubmissions: SubmissionData[],
  writingSubmissions: WritingSubmissionData[]
): Stats {
  const stats: Stats = {
    totalReadingSubmissions: readingSubmissions.length,
    totalWritingSubmissions: writingSubmissions.length,
    avgReadingScore: 0,
    writingPassRate: 0,
    aspectScores: {},
    languageStats: {},
    genreStats: {},
  };

  // リーディング統計
  if (readingSubmissions.length > 0) {
    const totalScore = readingSubmissions.reduce((sum, s) => sum + s.score, 0);
    stats.avgReadingScore = Math.round(totalScore / readingSubmissions.length);

    for (const sub of readingSubmissions) {
      // 言語別
      if (!stats.languageStats[sub.language]) {
        stats.languageStats[sub.language] = { count: 0, avgScore: 0 };
      }
      stats.languageStats[sub.language].count++;
      stats.languageStats[sub.language].avgScore += sub.score;

      // ジャンル別
      if (sub.genre) {
        if (!stats.genreStats[sub.genre]) {
          stats.genreStats[sub.genre] = { count: 0, avgScore: 0 };
        }
        stats.genreStats[sub.genre].count++;
        stats.genreStats[sub.genre].avgScore += sub.score;
      }

      // アスペクト別
      if (sub.aspects) {
        for (const [aspect, score] of Object.entries(sub.aspects)) {
          if (!stats.aspectScores[aspect]) {
            stats.aspectScores[aspect] = { total: 0, count: 0 };
          }
          stats.aspectScores[aspect].total += score;
          stats.aspectScores[aspect].count++;
        }
      }
    }

    // 平均を計算
    for (const lang of Object.keys(stats.languageStats)) {
      stats.languageStats[lang].avgScore = Math.round(
        stats.languageStats[lang].avgScore / stats.languageStats[lang].count
      );
    }
    for (const genre of Object.keys(stats.genreStats)) {
      stats.genreStats[genre].avgScore = Math.round(
        stats.genreStats[genre].avgScore / stats.genreStats[genre].count
      );
    }
  }

  // ライティング統計
  if (writingSubmissions.length > 0) {
    const passedCount = writingSubmissions.filter((s) => s.passed).length;
    stats.writingPassRate = Math.round((passedCount / writingSubmissions.length) * 100);
  }

  return stats;
}

function buildAnalysisPrompt(
  stats: Stats,
  readingSubmissions: SubmissionData[],
  writingSubmissions: WritingSubmissionData[]
): string {
  const aspectSummary = Object.entries(stats.aspectScores)
    .map(([aspect, data]) => `${aspect}: ${Math.round(data.total / data.count)}点`)
    .join(', ');

  const languageSummary = Object.entries(stats.languageStats)
    .map(([lang, data]) => `${lang}: ${data.count}回 (平均${data.avgScore}点)`)
    .join(', ');

  return `あなたはプログラミング学習のアドバイザーです。
以下のユーザーの学習データを分析し、強み・弱み・おすすめを日本語で簡潔に出力してください。

## 学習データ
- コードリーディング提出: ${stats.totalReadingSubmissions}回
- 平均スコア: ${stats.avgReadingScore}点
- ライティング提出: ${stats.totalWritingSubmissions}回
- ライティング成功率: ${stats.writingPassRate}%
- 言語別: ${languageSummary || 'なし'}
- 観点別スコア: ${aspectSummary || 'なし'}

## 出力形式 (JSON)
{
  "strengths": ["強み1", "強み2"],
  "weaknesses": ["弱み1"],
  "recommendations": ["おすすめ1", "おすすめ2"],
  "summary": "総評（2-3文）"
}

各項目は1-3個程度、簡潔に。データが少ない場合は控えめに分析。`;
}

function generateFallbackAnalysis(stats: Stats): AnalysisResult {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const recommendations: string[] = [];

  // スコアベースの分析
  if (stats.avgReadingScore >= 80) {
    strengths.push('コードリーディング力が高い');
  } else if (stats.avgReadingScore < 60 && stats.totalReadingSubmissions > 0) {
    weaknesses.push('コードリーディングの精度向上が必要');
    recommendations.push('基礎的な問題から復習しましょう');
  }

  if (stats.writingPassRate >= 80) {
    strengths.push('コードライティングの正確性が高い');
  } else if (stats.writingPassRate < 50 && stats.totalWritingSubmissions > 0) {
    weaknesses.push('コードライティングのテスト通過率を上げましょう');
    recommendations.push('シンプルな問題から練習を始めましょう');
  }

  // アスペクト分析
  const aspectAvgs = Object.entries(stats.aspectScores).map(([aspect, data]) => ({
    aspect,
    avg: Math.round(data.total / data.count),
  }));

  const strongAspects = aspectAvgs.filter((a) => a.avg >= 80);
  const weakAspects = aspectAvgs.filter((a) => a.avg < 60);

  if (strongAspects.length > 0) {
    strengths.push(`${strongAspects[0].aspect}の理解が優れている`);
  }
  if (weakAspects.length > 0) {
    weaknesses.push(`${weakAspects[0].aspect}の理解を深める必要あり`);
    recommendations.push(`${weakAspects[0].aspect}に関連する問題に挑戦しましょう`);
  }

  // デフォルトのおすすめ
  if (recommendations.length === 0) {
    recommendations.push('継続して問題に取り組みましょう');
  }

  const summary =
    stats.totalReadingSubmissions + stats.totalWritingSubmissions > 0
      ? `${stats.totalReadingSubmissions + stats.totalWritingSubmissions}回の提出データを分析しました。`
      : 'まだ提出データがありません。';

  return { strengths, weaknesses, recommendations, summary };
}

/**
 * 弱みに基づいた問題生成のためのプロンプト情報を生成
 */
export function getRecommendedProblemContext(analysis: AnalysisResult): {
  focusAreas: string[];
  difficulty: number;
  suggestedLanguage?: string;
} {
  const focusAreas = analysis.weaknesses.length > 0 ? analysis.weaknesses : ['基礎力強化'];
  const difficulty = analysis.weaknesses.length > 1 ? 2 : 3; // 弱みが多い場合は易しめに

  return {
    focusAreas,
    difficulty,
  };
}

