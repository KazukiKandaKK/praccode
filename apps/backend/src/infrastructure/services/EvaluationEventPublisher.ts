import { IEvaluationEventPublisher, EvaluationEvent } from '../../domain/ports/IEvaluationEventPublisher';
import {
  emitEvaluationComplete,
  emitEvaluationFailed,
  onEvaluationEvent,
} from '../../lib/evaluation-events';

export class EvaluationEventPublisher implements IEvaluationEventPublisher {
  emitEvaluationComplete(submissionId: string): void {
    emitEvaluationComplete(submissionId);
  }

  emitEvaluationFailed(submissionId: string): void {
    emitEvaluationFailed(submissionId);
  }

  onEvaluationEvent(submissionId: string, listener: (event: EvaluationEvent) => void): () => void {
    return onEvaluationEvent(submissionId, listener);
  }
}
