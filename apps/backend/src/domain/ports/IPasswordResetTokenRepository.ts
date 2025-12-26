import { PasswordResetToken, User } from '../entities/User';

export interface PasswordResetTokenWithUser {
  token: PasswordResetToken;
  user: User;
}

export interface IPasswordResetTokenRepository {
  deleteAllForUser(userId: string): Promise<void>;
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findWithUserByHash(tokenHash: string): Promise<PasswordResetTokenWithUser | null>;
  deleteById(id: string): Promise<void>;
}
