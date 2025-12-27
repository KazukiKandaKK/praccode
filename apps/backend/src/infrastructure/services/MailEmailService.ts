import { IEmailService } from '../../domain/ports/IEmailService';
import {
  sendEmailVerification,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendEmailChangeConfirmation,
} from '../../lib/mail';

export class MailEmailService implements IEmailService {
  async sendVerificationEmail(to: string, name: string | null, confirmUrl: string): Promise<void> {
    await sendEmailVerification(to, name ?? undefined, confirmUrl);
  }

  async sendWelcomeEmail(to: string, name: string | null): Promise<void> {
    await sendWelcomeEmail(to, name ?? undefined);
  }

  async sendPasswordResetEmail(to: string, name: string | null, resetUrl: string): Promise<void> {
    await sendPasswordResetEmail(to, name ?? undefined, resetUrl);
  }

  async sendEmailChangeConfirmation(
    currentEmail: string,
    newEmail: string,
    confirmUrl: string
  ): Promise<void> {
    await sendEmailChangeConfirmation(currentEmail, newEmail, confirmUrl);
  }
}
