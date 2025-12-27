import { IPasswordResetTokenRepository } from '../../domain/ports/IPasswordResetTokenRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { ITokenService } from '../../domain/ports/ITokenService';
import { ApplicationError } from '../errors/ApplicationError';

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export class ResetPasswordUseCase {
  constructor(
    private readonly tokenRepository: IPasswordResetTokenRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly userRepository: IUserRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(input: ResetPasswordInput): Promise<void> {
    const tokenHash = this.tokenService.hash(input.token);

    const record = await this.tokenRepository.findWithUserByHash(tokenHash);
    if (!record) {
      throw new ApplicationError('Invalid or expired token', 404);
    }

    const now = new Date();
    if (record.token.expiresAt < now) {
      await this.tokenRepository.deleteById(record.token.id);
      throw new ApplicationError('Token expired', 410);
    }

    const hashed = await this.passwordHasher.hash(input.newPassword);
    await this.userRepository.updatePassword(record.user.id, hashed);

    await this.tokenRepository.deleteById(record.token.id);
  }
}
