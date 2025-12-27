export interface User {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  image?: string | null;
  role: 'ADMIN' | 'LEARNER';
  emailVerified: Date | null;
}

export interface EmailVerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}
