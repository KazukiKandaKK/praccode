export interface EvaluateAnswerInput {
  code: string;
  question: string;
  idealPoints: string[];
  userAnswer: string;
}

export interface EvaluateAnswerResult {
  score: number;
  level: string;
  feedback: string;
  aspects?: Record<string, number>;
}

export interface IAnswerEvaluationService {
  evaluate(input: EvaluateAnswerInput): Promise<EvaluateAnswerResult>;
}
