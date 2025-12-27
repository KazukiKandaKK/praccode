import { ApplicationError } from '../../errors/ApplicationError';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';
import { IEmailChangeTokenRepository } from '../../../domain/ports/IEmailChangeTokenRepository';

export interface ConfirmEmailChangeInput {
  userId: string;
  tokenHash: string;
}

export class ConfirmEmailChangeUseCase {
  constructor(
    private readonly users: IUserAccountRepository,
    private readonly tokens: IEmailChangeTokenRepository
  ) {}

  async execute(input: ConfirmEmailChangeInput) {
    const record = await this.tokens.findByTokenHash(input.tokenHash);

    if (!record || record.userId !== input.userId) {
      throw new ApplicationError('Invalid token', 400);
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await this.tokens.deleteById(record.id);
      throw new ApplicationError('Token expired', 400);
    }

    const existing = await this.users.findByEmail(record.newEmail);
    if (existing) {
      await this.tokens.deleteById(record.id);
      throw new ApplicationError('Email already in use', 409);
    }

    const updated = await this.users.updateEmail(record.userId, record.newEmail);
    await this.tokens.deleteById(record.id);

    return { status: 'ok' as const, user: updated };
  }
}
