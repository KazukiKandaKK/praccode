export type EvaluationEvent = {
  submissionId: string;
  type: 'evaluated' | 'failed';
  timestamp: number;
};

export interface IEvaluationEventPublisher {
  emitEvaluationComplete(submissionId: string): void;
  emitEvaluationFailed(submissionId: string): void;
  onEvaluationEvent(submissionId: string, listener: (event: EvaluationEvent) => void): () => void;
}
