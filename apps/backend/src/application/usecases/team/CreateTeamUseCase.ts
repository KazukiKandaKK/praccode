import { ITeamRepository, TeamRecord } from '../../../domain/ports/ITeamRepository';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';
import { ApplicationError } from '../../errors/ApplicationError';

export class CreateTeamUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly userAccountRepo: IUserAccountRepository
  ) {}

  async execute(input: { requesterId: string; name: string }): Promise<TeamRecord> {
    const requesterProfile = await this.userAccountRepo.getProfile(input.requesterId);
    if (!requesterProfile) {
      throw new ApplicationError('Unauthorized', 401);
    }
    if (requesterProfile.role !== 'ADMIN') {
      throw new ApplicationError('Forbidden', 403);
    }

    const trimmedName = input.name.trim();
    if (trimmedName.length === 0) {
      throw new ApplicationError('Team name is required', 400);
    }

    return this.teamRepo.createTeam(trimmedName, input.requesterId);
  }
}
