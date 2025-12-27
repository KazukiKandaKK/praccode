import { ApplicationError } from '../../errors/ApplicationError';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';
import { IPasswordHasher } from '../../../domain/ports/IPasswordHasher';

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export class ChangePasswordUseCase {
  constructor(
    private readonly users: IUserAccountRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(input: ChangePasswordInput) {
    const user = await this.users.findByIdWithPassword(input.userId);
    if (!user) {
      throw new ApplicationError('User not found', 404);
    }

    if (!user.password) {
      throw new ApplicationError('Password is not set for this user', 400);
    }

    const ok = await this.passwordHasher.compare(input.currentPassword, user.password);
    if (!ok) {
      throw new ApplicationError('Current password is incorrect', 401);
    }

    const hashed = await this.passwordHasher.hash(input.newPassword);
    await this.users.updatePassword(input.userId, hashed);

    return { status: 'ok' as const };
  }
}
