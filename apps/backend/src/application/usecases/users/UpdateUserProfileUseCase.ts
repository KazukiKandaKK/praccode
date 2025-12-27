import { ApplicationError } from '../../errors/ApplicationError';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';

export interface UpdateUserProfileInput {
  userId: string;
  name: string;
}

export class UpdateUserProfileUseCase {
  constructor(private readonly users: IUserAccountRepository) {}

  async execute(input: UpdateUserProfileInput) {
    const profile = await this.users.getProfile(input.userId);
    if (!profile) {
      throw new ApplicationError('User not found', 404);
    }

    return this.users.updateName(input.userId, input.name);
  }
}
