import { ApplicationError } from '../../errors/ApplicationError';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';

export class GetUserProfileUseCase {
  constructor(private readonly users: IUserAccountRepository) {}

  async execute(userId: string) {
    const profile = await this.users.getProfile(userId);
    if (!profile) {
      throw new ApplicationError('User not found', 404);
    }
    return profile;
  }
}
