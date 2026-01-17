import { EventEmitter } from 'events';

const exerciseGenerationEmitter = new EventEmitter();
exerciseGenerationEmitter.setMaxListeners(100);

export type ExerciseGenerationEventType = 'ready' | 'failed';

export interface ExerciseGenerationEvent {
  exerciseId: string;
  type: ExerciseGenerationEventType;
  timestamp: number;
  title?: string;
}

export function emitExerciseReady(exerciseId: string, title?: string): void {
  const event: ExerciseGenerationEvent = {
    exerciseId,
    type: 'ready',
    timestamp: Date.now(),
    title,
  };
  exerciseGenerationEmitter.emit(`exercise:${exerciseId}`, event);
}

export function emitExerciseFailed(exerciseId: string): void {
  const event: ExerciseGenerationEvent = {
    exerciseId,
    type: 'failed',
    timestamp: Date.now(),
  };
  exerciseGenerationEmitter.emit(`exercise:${exerciseId}`, event);
}

export function onExerciseGenerationEvent(
  exerciseId: string,
  callback: (event: ExerciseGenerationEvent) => void
): () => void {
  const eventName = `exercise:${exerciseId}`;
  exerciseGenerationEmitter.on(eventName, callback);

  return () => {
    exerciseGenerationEmitter.off(eventName, callback);
  };
}

export { exerciseGenerationEmitter };
