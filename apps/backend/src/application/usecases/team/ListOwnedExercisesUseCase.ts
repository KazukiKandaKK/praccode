import {
  IExerciseAssignmentRepository,
  OwnedExerciseSummary,
} from '../../../domain/ports/IExerciseAssignmentRepository';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';
import { ApplicationError } from '../../errors/ApplicationError';

export class ListOwnedExercisesUseCase {
  constructor(
    private readonly exerciseAssignmentRepo: IExerciseAssignmentRepository,
    private readonly userAccountRepo: IUserAccountRepository
  ) {}

  async execute(requesterId: string): Promise<OwnedExerciseSummary[]> {
    const requesterProfile = await this.userAccountRepo.getProfile(requesterId);
    if (!requesterProfile) {
      throw new ApplicationError('Unauthorized', 401);
    }
    if (requesterProfile.role !== 'ADMIN') {
      throw new ApplicationError('Forbidden', 403);
    }

    return this.exerciseAssignmentRepo.findOwnedReadyExercises(requesterId);
  }
}
