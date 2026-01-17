import {
  IExerciseGenerationEventPublisher,
  ExerciseGenerationEvent,
} from '../../domain/ports/IExerciseGenerationEventPublisher';
import {
  emitExerciseReady,
  emitExerciseFailed,
  onExerciseGenerationEvent,
} from '../../lib/exercise-generation-events';

export class ExerciseGenerationEventPublisher implements IExerciseGenerationEventPublisher {
  emitExerciseReady(exerciseId: string, title?: string): void {
    emitExerciseReady(exerciseId, title);
  }

  emitExerciseFailed(exerciseId: string): void {
    emitExerciseFailed(exerciseId);
  }

  onExerciseEvent(
    exerciseId: string,
    listener: (event: ExerciseGenerationEvent) => void
  ): () => void {
    return onExerciseGenerationEvent(exerciseId, listener);
  }
}
