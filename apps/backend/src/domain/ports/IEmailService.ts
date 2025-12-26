export interface IEmailService {
  sendVerificationEmail(to: string, name: string | null, confirmUrl: string): Promise<void>;
  sendWelcomeEmail(to: string, name: string | null): Promise<void>;
  sendPasswordResetEmail(to: string, name: string | null, resetUrl: string): Promise<void>;
}
