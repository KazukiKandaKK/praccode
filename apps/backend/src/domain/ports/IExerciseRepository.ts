import { Exercise } from '../entities/Exercise';

export interface Pagination {
  page: number;
  limit: number;
}

export interface ExerciseFilter {
  userId: string;
  language?: string;
  difficulty?: number;
  genre?: string;
}

export interface IExerciseRepository {
  findById(id: string): Promise<Exercise | null>;
  find(filter: ExerciseFilter, pagination: Pagination): Promise<Exercise[]>;
  count(filter: ExerciseFilter): Promise<number>;
  countAll(): Promise<number>;
}
