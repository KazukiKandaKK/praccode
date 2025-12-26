import { Exercise } from '../entities/Exercise';

export interface IExerciseRepository {
  findById(id: string): Promise<Exercise | null>;
}
