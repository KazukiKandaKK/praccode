import { IEmailVerificationTokenRepository } from '../../domain/ports/IEmailVerificationTokenRepository';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IEmailService } from '../../domain/ports/IEmailService';
import { ITokenService } from '../../domain/ports/ITokenService';
import { ApplicationError } from '../errors/ApplicationError';

export interface VerifyEmailInput {
  token: string;
}

export class VerifyEmailUseCase {
  constructor(
    private readonly tokenRepository: IEmailVerificationTokenRepository,
    private readonly userRepository: IUserRepository,
    private readonly emailService: IEmailService,
    private readonly tokenService: ITokenService
  ) {}

  async execute(input: VerifyEmailInput) {
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

    if (record.user.emailVerified) {
      await this.tokenRepository.deleteById(record.token.id).catch(() => {
        // cleanup best-effort
      });
      return { alreadyVerified: true, message: 'Email already verified. You can now log in.' };
    }

    await this.userRepository.setEmailVerified(record.user.id, now);
    await this.tokenRepository.deleteById(record.token.id);

    await this.emailService.sendWelcomeEmail(record.user.email, record.user.name);

    return { message: 'Email verified successfully. You can now log in.' };
  }
}
