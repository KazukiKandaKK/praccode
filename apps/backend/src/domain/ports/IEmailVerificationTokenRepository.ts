import { EmailVerificationToken, User } from '../entities/User';

export interface VerificationTokenWithUser {
  token: EmailVerificationToken;
  user: User;
}

export interface IEmailVerificationTokenRepository {
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findWithUserByHash(tokenHash: string): Promise<VerificationTokenWithUser | null>;
  deleteById(id: string): Promise<void>;
}
