export type ExerciseGenerationEvent = {
  exerciseId: string;
  type: 'ready' | 'failed';
  timestamp: number;
  title?: string;
};

export interface IExerciseGenerationEventPublisher {
  emitExerciseReady(exerciseId: string, title?: string): void;
  emitExerciseFailed(exerciseId: string): void;
  onExerciseEvent(
    exerciseId: string,
    listener: (event: ExerciseGenerationEvent) => void
  ): () => void;
}
