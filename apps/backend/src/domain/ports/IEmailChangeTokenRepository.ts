export interface EmailChangeToken {
  id: string;
  userId: string;
  newEmail: string;
  expiresAt: Date;
}

export interface IEmailChangeTokenRepository {
  deleteByUserId(userId: string): Promise<void>;
  createToken(data: { userId: string; newEmail: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<EmailChangeToken | null>;
  deleteById(id: string): Promise<void>;
}
