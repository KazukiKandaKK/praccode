import { ApplicationError } from '@/application/errors/ApplicationError';
import type { IExerciseRepository } from '@/domain/ports/IExerciseRepository';
import type { ISubmissionRepository } from '@/domain/ports/ISubmissionRepository';
import type { IMentorThreadRepository, MentorThreadRecord } from '@/domain/ports/IMentorThreadRepository';

type Params = {
  userId: string;
  exerciseId?: string;
  submissionId?: string;
};

export class CreateMentorThreadUseCase {
  constructor(
    private readonly threadRepository: IMentorThreadRepository,
    private readonly exerciseRepository: IExerciseRepository,
    private readonly submissionRepository: ISubmissionRepository
  ) {}

  async execute(params: Params): Promise<MentorThreadRecord> {
    if (params.submissionId) {
      const existing = await this.threadRepository.findByUserAndSubmissionId(
        params.userId,
        params.submissionId
      );
      if (existing) {
        return existing;
      }
      const submission = await this.submissionRepository.findById(params.submissionId);
      if (!submission) {
        throw new ApplicationError('Submission not found', 404);
      }
      if (submission.userId !== params.userId) {
        throw new ApplicationError('Thread not found', 404);
      }
      if (params.exerciseId && submission.exercise.id !== params.exerciseId) {
        throw new ApplicationError('Exercise mismatch for submission', 400);
      }
    }

    if (params.exerciseId) {
      const existing = await this.threadRepository.findByUserAndExerciseId(
        params.userId,
        params.exerciseId
      );
      if (existing) {
        return existing;
      }
      const exercise = await this.exerciseRepository.findById(params.exerciseId);
      if (!exercise) {
        throw new ApplicationError('Exercise not found', 404);
      }
    }

    return this.threadRepository.createThread({
      userId: params.userId,
      exerciseId: params.exerciseId ?? null,
      submissionId: params.submissionId ?? null,
    });
  }
}
