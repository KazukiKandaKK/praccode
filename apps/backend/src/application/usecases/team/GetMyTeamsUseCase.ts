import { ITeamRepository } from '../../../domain/ports/ITeamRepository';

export class GetMyTeamsUseCase {
  constructor(private readonly teamRepo: ITeamRepository) {}

  async execute(userId: string) {
    return this.teamRepo.getTeamsForUser(userId);
  }
}
