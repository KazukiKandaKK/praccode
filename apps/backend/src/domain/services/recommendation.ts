import { LearningAnalysisResult } from '../ports/ILearningAnalyzer';

export interface RecommendationContext {
  focusAreas: string[];
  difficulty: number;
  suggestedLanguage?: string;
}

/**
 * 学習分析結果から、次に生成すべき問題の文脈を決定する。
 * これはドメインルールであり、LLMやインフラの詳細に依存しない。
 */
export function getRecommendedProblemContext(
  analysis: LearningAnalysisResult
): RecommendationContext {
  const focusAreas = analysis.weaknesses.length > 0 ? analysis.weaknesses : ['基礎力強化'];
  const difficulty = analysis.weaknesses.length > 1 ? 2 : 3; // 弱みが多い場合は易しめに

  return {
    focusAreas,
    difficulty,
  };
}
