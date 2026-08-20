import { ITeamRepository } from '../../../domain/ports/ITeamRepository';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';
import { ApplicationError } from '../../errors/ApplicationError';

export class RemoveTeamMemberUseCase {
  constructor(
    private readonly teamRepo: ITeamRepository,
    private readonly userAccountRepo: IUserAccountRepository
  ) {}

  async execute(input: { requesterId: string; teamId: string; memberUserId: string }): Promise<void> {
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

    await this.teamRepo.removeMember(input.teamId, input.memberUserId);
  }
}
