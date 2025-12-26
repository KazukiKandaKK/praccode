import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordResetTokenRepository } from '../../domain/ports/IPasswordResetTokenRepository';
import { ITokenService } from '../../domain/ports/ITokenService';
import { IEmailService } from '../../domain/ports/IEmailService';

export interface RequestPasswordResetInput {
  name: string;
  email: string;
  origin?: string;
}

export interface RequestPasswordResetResult {
  emailSent: boolean;
}

export class RequestPasswordResetUseCase {
  private static RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly tokenRepository: IPasswordResetTokenRepository,
    private readonly tokenService: ITokenService,
    private readonly emailService: IEmailService
  ) {}

  async execute(input: RequestPasswordResetInput): Promise<RequestPasswordResetResult> {
    const user = await this.userRepository.findVerifiedByEmailAndName(input.email, input.name);

    // セキュリティのため、存在しなくても成功レスポンスを返す
    if (!user) {
      return { emailSent: false };
    }

    await this.tokenRepository.deleteAllForUser(user.id);

    const { token, tokenHash } = this.tokenService.generate();
    const expiresAt = new Date(Date.now() + RequestPasswordResetUseCase.RESET_TOKEN_TTL_MS);

    await this.tokenRepository.create(user.id, tokenHash, expiresAt);

    const origin =
      input.origin || process.env.APP_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

    await this.emailService.sendPasswordResetEmail(user.email, user.name, resetUrl);

    return { emailSent: true };
  }
}
