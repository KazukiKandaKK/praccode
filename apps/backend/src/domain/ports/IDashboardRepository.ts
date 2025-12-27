import { GeneratedExercise } from './IExerciseGenerator';
import { WritingChallengeGenerated } from './IWritingChallengeGenerator';

export interface ReadingSubmissionRecord {
  id: string;
  userId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'EVALUATED';
  createdAt: Date;
  updatedAt: Date;
  exercise: {
    id: string;
    title: string;
    language: string;
    genre: string | null;
  };
  answers: Array<{
    score: number | null;
    level: string | null;
    aspects: Record<string, number> | null;
    llmFeedback: string | null;
  }>;
}

export interface WritingSubmissionRecord {
  id: string;
  userId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  createdAt: Date;
  executedAt: Date | null;
  passed: boolean | null;
  challenge: {
    id: string;
    title: string;
    language: string;
  };
  llmFeedback: string | null;
  llmFeedbackStatus: 'NOT_STARTED' | 'GENERATING' | 'COMPLETED' | 'FAILED';
}

export interface LearningAnalysisRecord {
  userId: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string;
  analyzedAt: Date;
}

export interface IDashboardRepository {
  getReadingSubmissions(userId: string): Promise<ReadingSubmissionRecord[]>;
  getWritingSubmissions(userId: string): Promise<WritingSubmissionRecord[]>;
  getReadingActivityDates(userId: string, startDate: Date, endDate: Date): Promise<Date[]>;
  getWritingActivityDates(userId: string, startDate: Date, endDate: Date): Promise<Date[]>;
  getLearningAnalysis(userId: string): Promise<LearningAnalysisRecord | null>;
  saveLearningAnalysis(userId: string, record: Omit<LearningAnalysisRecord, 'userId'>): Promise<void>;
  createReadingExercisePlaceholder(data: {
    userId: string;
    language: string;
    difficulty: number;
    genre: string;
  }): Promise<string>;
  saveGeneratedExercise(exerciseId: string, generated: GeneratedExercise): Promise<void>;
  markExerciseFailed(exerciseId: string): Promise<void>;
  createWritingChallengePlaceholder(data: {
    userId: string;
    language: string;
    difficulty: number;
  }): Promise<string>;
  saveGeneratedWritingChallenge(
    challengeId: string,
    generated: WritingChallengeGenerated
  ): Promise<void>;
  markWritingChallengeFailed(challengeId: string): Promise<void>;
}
