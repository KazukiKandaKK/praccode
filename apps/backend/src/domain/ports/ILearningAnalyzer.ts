export interface ReadingAnalysisItem {
  exerciseTitle: string;
  language: string;
  genre: string | null;
  score: number;
  level: string;
  aspects: Record<string, number> | null;
  feedback?: string | null;
}

export interface WritingAnalysisItem {
  challengeTitle: string;
  language: string;
  passed: boolean;
  feedback?: string | null;
}

export interface LearningAnalysisResult {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string;
}

export interface ILearningAnalyzer {
  analyze(reading: ReadingAnalysisItem[], writing: WritingAnalysisItem[]): Promise<LearningAnalysisResult>;
}
