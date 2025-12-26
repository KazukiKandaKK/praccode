import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListExercisesUseCase } from './ListExercisesUseCase';
import { IExerciseRepository } from '../../domain/ports/IExerciseRepository';
import { ExerciseEntity } from '../../domain/entities/Exercise';

const mockExerciseRepository = {
  findById: vi.fn(),
  find: vi.fn(),
  count: vi.fn(),
} as IExerciseRepository;

describe('ListExercisesUseCase', () => {
  let useCase: ListExercisesUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new ListExercisesUseCase(mockExerciseRepository);
  });

  it('should return exercises and pagination', async () => {
    const mockExercises = [new ExerciseEntity('1', 'code', [], [])];
    mockExerciseRepository.find.mockResolvedValue(mockExercises);
    mockExerciseRepository.count.mockResolvedValue(1);

    const input = { userId: 'user-1', page: 1, limit: 10 };
    const result = await useCase.execute(input);

    expect(result.exercises).toEqual(mockExercises);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
    expect(mockExerciseRepository.find).toHaveBeenCalledWith(
      { userId: 'user-1' },
      { page: 1, limit: 10 }
    );
    expect(mockExerciseRepository.count).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
