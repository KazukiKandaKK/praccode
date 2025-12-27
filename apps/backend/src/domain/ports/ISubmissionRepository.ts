import { Submission } from '../entities/Submission';

export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'EVALUATED';

export interface SubmissionListItem {
  id: string;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
  exercise: {
    id: string;
    title: string;
    language: string;
    difficulty: number;
    genre: string | null;
  };
  avgScore: number | null;
  overallLevel: 'A' | 'B' | 'C' | 'D' | null;
  answerCount: number;
}

export interface SubmissionDetailAnswer {
  id: string;
  questionIndex: number;
  answerText: string | null;
  score: number | null;
  level: string | null;
  llmFeedback: string | null;
  aspects: Record<string, number> | null;
}

export interface SubmissionDetail {
  id: string;
  userId: string;
  status: SubmissionStatus;
  answers: SubmissionDetailAnswer[];
  exercise: {
    id: string;
    title: string;
    code: string;
    questions: Array<{
      questionIndex: number;
      questionText: string;
      idealAnswerPoints: string[];
    }>;
  };
}

export interface EvaluationTarget {
  id: string;
  userId: string;
  status: SubmissionStatus;
  answers: Array<{
    id: string;
    questionIndex: number;
    answerText: string | null;
  }>;
  exercise: {
    code: string;
    questions: Array<{
      questionIndex: number;
      questionText: string;
      idealAnswerPoints: string[];
    }>;
  };
}

export interface ISubmissionRepository {
  findCompletedByUserId(userId: string): Promise<Submission[]>;
  listByUser(
    userId: string,
    status: SubmissionStatus | undefined,
    pagination: { page: number; limit: number }
  ): Promise<{ submissions: SubmissionListItem[]; total: number }>;
  findById(id: string): Promise<SubmissionDetail | null>;
  updateAnswers(
    submissionId: string,
    answers: Array<{ questionIndex: number; answerText: string }>
  ): Promise<void>;
  getEvaluationTarget(id: string): Promise<EvaluationTarget | null>;
  markStatus(id: string, status: SubmissionStatus): Promise<void>;
  updateAnswerEvaluation(
    answerId: string,
    data: {
      score: number | null;
      level: string | null;
      llmFeedback: string | null;
      aspects: Record<string, number> | null;
    }
  ): Promise<void>;
}
