import crypto from 'node:crypto';
import { ApplicationError } from '../../errors/ApplicationError';
import { IUserAccountRepository } from '../../../domain/ports/IUserAccountRepository';
import { IEmailChangeTokenRepository } from '../../../domain/ports/IEmailChangeTokenRepository';
import { IEmailService } from '../../../domain/ports/IEmailService';

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export interface RequestEmailChangeInput {
  userId: string;
  newEmail: string;
  origin: string;
}

export class RequestEmailChangeUseCase {
  constructor(
    private readonly users: IUserAccountRepository,
    private readonly tokens: IEmailChangeTokenRepository,
    private readonly emailService: IEmailService
  ) {}

  async execute(input: RequestEmailChangeInput) {
    const user = await this.users.getProfile(input.userId);
    if (!user) {
      throw new ApplicationError('User not found', 404);
    }

    if (user.email.toLowerCase() === input.newEmail.toLowerCase()) {
      throw new ApplicationError('New email is the same as current email', 400);
    }

    const existing = await this.users.findByEmail(input.newEmail);
    if (existing) {
      throw new ApplicationError('Email already in use', 409);
    }

    // 既存トークンは無効化（最新のみ有効にする）
    await this.tokens.deleteByUserId(input.userId);

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.tokens.createToken({
      userId: input.userId,
      newEmail: input.newEmail,
      tokenHash,
      expiresAt,
    });

    const confirmUrl = `${input.origin}/settings/email-change?token=${encodeURIComponent(token)}`;

    await this.emailService.sendEmailChangeConfirmation(user.email, input.newEmail, confirmUrl);

    return {
      status: 'queued' as const,
      message: 'Confirmation email sent. Check backend/tmp/mail directory.',
    };
  }
}
