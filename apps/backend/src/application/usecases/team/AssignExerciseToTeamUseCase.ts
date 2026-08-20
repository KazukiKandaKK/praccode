import { ITeamRepository } from '../../../domain/ports/ITeamRepository';
import { IExerciseAssignmentRepository } from '../../../domain/ports/IExerciseAssignmentRepository';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';
import { ApplicationError } from '../../errors/ApplicationError';

export interface AssignExerciseToTeamInput {
  requesterId: string;
  teamId: string;
  exerciseId: string;
}

export interface AssignExerciseToTeamResult {
  assignedCount: number;
  assignments: { userId: string; exerciseId: string }[];
}

export class AssignExerciseToTeamUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly exerciseAssignmentRepo: IExerciseAssignmentRepository,
    private readonly userAccountRepo: IUserAccountRepository
  ) {}

  async execute(input: AssignExerciseToTeamInput): Promise<AssignExerciseToTeamResult> {
    const requesterProfile = await this.userAccountRepo.getProfile(input.requesterId);
    if (!requesterProfile) {
      throw new ApplicationError('Unauthorized', 401);
    }
    if (requesterProfile.role !== 'ADMIN') {
      throw new ApplicationError('Forbidden', 403);
    }

    const isRequesterMember = await this.teamRepo.isMemberOfTeam(input.requesterId, input.teamId);
    if (!isRequesterMember) {
      throw new ApplicationError('Team not found', 404);
    }

    const isOwned = await this.exerciseAssignmentRepo.isOwnedExercise(
      input.exerciseId,
      input.requesterId
    );
    if (!isOwned) {
      throw new ApplicationError('Exercise not found', 404);
    }

    const members = await this.teamRepo.getMembersByTeamIds([input.teamId]);
    const learnerIds = members.filter((m) => m.role === 'LEARNER').map((m) => m.id);

    if (learnerIds.length === 0) {
      return { assignedCount: 0, assignments: [] };
    }

    const created = await this.exerciseAssignmentRepo.copyExerciseToUsers(
      input.exerciseId,
      learnerIds
    );

    const assignments = Object.entries(created).map(([userId, exerciseId]) => ({
      userId,
      exerciseId,
    }));

    return { assignedCount: assignments.length, assignments };
  }
}
