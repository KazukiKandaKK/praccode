import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { GetUserProgressUseCase } from '@/application/usecases/GetUserProgressUseCase';
import { ISubmissionRepository } from '@/domain/ports/ISubmissionRepository';
import { IExerciseRepository } from '@/domain/ports/IExerciseRepository';

const mockSubmissionRepository: Mocked<ISubmissionRepository> = {
  findCompletedByUserId: vi.fn(),
};

const mockExerciseRepository: Mocked<IExerciseRepository> = {
  countAll: vi.fn(),
  findById: vi.fn(),
  find: vi.fn(),
  count: vi.fn(),
};

describe('GetUserProgressUseCase', () => {
  let useCase: GetUserProgressUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new GetUserProgressUseCase(mockSubmissionRepository, mockExerciseRepository);
  });

  it('should calculate and return user progress', async () => {
    mockExerciseRepository.countAll.mockResolvedValue(10);
    mockSubmissionRepository.findCompletedByUserId.mockResolvedValue([
      {
        exerciseId: 'ex-1',
        updatedAt: new Date(),
        exercise: { title: 'Ex 1' },
        answers: [{ score: 80, aspects: { Logic: 8 } }],
      },
    ]);

    const result = await useCase.execute('user-1');

    expect(result.totalExercises).toBe(10);
    expect(result.completedExercises).toBe(1);
    expect(result.averageScore).toBe(80);
    expect(result.aspectScores).toEqual({ Logic: 8 });
  });
});
