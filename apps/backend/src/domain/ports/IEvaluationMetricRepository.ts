export type EvaluationMetricSource = 'READING' | 'WRITING';

export type EvaluationMetric = {
  aspect: string;
  score: number;
};

export type EvaluationMetricRecord = {
  id: string;
  userId: string;
  sourceType: EvaluationMetricSource;
  aspect: string;
  score: number;
  createdAt: Date;
};

export interface IEvaluationMetricRepository {
  saveMetrics(params: {
    userId: string;
    sourceType: EvaluationMetricSource;
    submissionId?: string;
    writingSubmissionId?: string;
    metrics: EvaluationMetric[];
  }): Promise<void>;

  listByUser(userId: string, limit?: number): Promise<EvaluationMetricRecord[]>;
}
