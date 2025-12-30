import { describe, it, expect } from 'vitest';
import { GetMentorAssessmentStatusUseCase } from '@/application/usecases/mentor/GetMentorAssessmentStatusUseCase';
import type {
  IMentorAssessmentRepository,
  MentorAssessmentTask,
} from '@/domain/ports/IMentorAssessmentRepository';

describe('GetMentorAssessmentStatusUseCase', () => {
  it('summarizes reading and writing completion', async () => {
    const tasks: MentorAssessmentTask[] = [
      {
        id: 'reading-1',
        type: 'reading',
        title: 'Reading One',
        language: 'typescript',
        difficulty: 2,
        status: 'COMPLETED',
      },
      {
        id: 'reading-2',
        type: 'reading',
        title: 'Reading Two',
        language: 'typescript',
        difficulty: 3,
        status: 'IN_PROGRESS',
      },
      {
        id: 'writing-1',
        type: 'writing',
        title: 'Writing One',
        language: 'typescript',
        difficulty: 2,
        status: 'COMPLETED',
      },
    ];

    const repo: IMentorAssessmentRepository = {
      listTasks: async () => tasks,
    };

    const useCase = new GetMentorAssessmentStatusUseCase(repo);
    const result = await useCase.execute('user-1');

    expect(result.summary.total).toBe(3);
    expect(result.summary.completed).toBe(2);
    expect(result.summary.reading.total).toBe(2);
    expect(result.summary.reading.completed).toBe(1);
    expect(result.summary.writing.total).toBe(1);
    expect(result.summary.writing.completed).toBe(1);
  });
});
