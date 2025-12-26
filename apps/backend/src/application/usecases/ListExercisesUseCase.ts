import {
  IExerciseRepository,
  ExerciseFilter,
  Pagination,
} from '../../domain/ports/IExerciseRepository';
import { Exercise } from '../../domain/entities/Exercise';

export interface ListExercisesInput extends ExerciseFilter, Pagination {}

export interface ListExercisesOutput {
  exercises: Exercise[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ListExercisesUseCase {
  constructor(private readonly exerciseRepository: IExerciseRepository) {}

  async execute(input: ListExercisesInput): Promise<ListExercisesOutput> {
    const { page, limit, ...filter } = input;

    const [exercises, total] = await Promise.all([
      this.exerciseRepository.find(filter, { page, limit }),
      this.exerciseRepository.count(filter),
    ]);

    return {
      exercises,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
