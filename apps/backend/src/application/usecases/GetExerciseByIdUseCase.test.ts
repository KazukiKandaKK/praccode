import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetExerciseByIdUseCase } from './GetExerciseByIdUseCase';
import { IExerciseRepository } from '../../domain/ports/IExerciseRepository';
import { ExerciseEntity } from '../../domain/entities/Exercise';
import { ApplicationError } from '../errors/ApplicationError';

const mockExerciseRepository = {
  findById: vi.fn(),
  find: vi.fn(),
  count: vi.fn(),
} as IExerciseRepository;

describe('GetExerciseByIdUseCase', () => {
  let useCase: GetExerciseByIdUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetExerciseByIdUseCase(mockExerciseRepository);
  });

  it('should return an exercise if found', async () => {
    const mockExercise = new ExerciseEntity('1', 'code', [], []);
    mockExerciseRepository.findById.mockResolvedValue(mockExercise);

    const result = await useCase.execute({ exerciseId: '1', userId: 'user-1' });

    expect(result).toEqual(mockExercise);
    expect(mockExerciseRepository.findById).toHaveBeenCalledWith('1');
  });

  it('should throw ApplicationError if exercise not found', async () => {
    mockExerciseRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute({ exerciseId: '1', userId: 'user-1' })).rejects.toThrow(
      ApplicationError
    );
  });
});
