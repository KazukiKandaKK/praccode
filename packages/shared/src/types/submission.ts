export type SubmissionStatus = 'draft' | 'submitted' | 'evaluated';
export type ScoreLevel = 'A' | 'B' | 'C' | 'D';

export interface SubmissionAnswer {
  id: string;
  submissionId: string;
  questionIndex: number;
  answerText: string;
  score: number | null;
  level: ScoreLevel | null;
  llmFeedback: string | null;
  aspects: Record<string, number> | null;
  createdAt: Date;
}

export interface Submission {
  id: string;
  exerciseId: string;
  userId: string;
  status: SubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubmissionWithAnswers extends Submission {
  answers: SubmissionAnswer[];
}

export interface AnswerInput {
  questionIndex: number;
  answerText: string;
}

export interface EvaluationResult {
  questionIndex: number;
  score: number;
  level: ScoreLevel;
  feedback: string;
  aspects: Record<string, number>;
}

export interface EvaluationResponse {
  submissionId: string;
  scores: EvaluationResult[];
}

export interface HintRequest {
  exerciseId: string;
  questionIndex: number;
}

export interface HintResponse {
  hint: string;
}


