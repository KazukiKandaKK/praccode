import { IUserRepository } from '../../domain/ports/IUserRepository';
import { IPasswordHasher } from '../../domain/ports/IPasswordHasher';
import { IEmailVerificationTokenRepository } from '../../domain/ports/IEmailVerificationTokenRepository';
import { IEmailService } from '../../domain/ports/IEmailService';
import { ITokenService } from '../../domain/ports/ITokenService';
import { IInitialAssignmentService } from '../../domain/ports/IInitialAssignmentService';
import { ApplicationError } from '../errors/ApplicationError';
import { User } from '../../domain/entities/User';

export interface RegisterUserInput {
  email: string;
  password: string;
  name: string;
  origin?: string;
}

export interface RegisterUserResult {
  user: User;
  confirmUrl: string;
}

export class RegisterUserUseCase {
  private static EMAIL_VERIFICATION_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenRepository: IEmailVerificationTokenRepository,
    private readonly emailService: IEmailService,
    private readonly tokenService: ITokenService,
    private readonly initialAssignmentService: IInitialAssignmentService
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserResult> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw new ApplicationError('Email already registered', 409);
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = await this.userRepository.createUser({
      email: input.email,
      name: input.name,
      passwordHash,
      role: 'LEARNER',
    });

    const { token, tokenHash } = this.tokenService.generate();
    const expiresAt = new Date(Date.now() + RegisterUserUseCase.EMAIL_VERIFICATION_TTL_MS);
    await this.tokenRepository.create(user.id, tokenHash, expiresAt);

    const origin =
      input.origin || process.env.APP_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';
    const confirmUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;

    await this.emailService.sendVerificationEmail(user.email, user.name, confirmUrl);

    // 初期データの割り当てはユーザー作成後に実行
    await this.initialAssignmentService.assignPresetsToUser(user.id);

    return { user, confirmUrl };
  }
}
