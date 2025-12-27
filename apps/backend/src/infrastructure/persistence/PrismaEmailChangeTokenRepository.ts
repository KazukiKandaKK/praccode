import { prisma } from '../../lib/prisma';
import {
  EmailChangeToken,
  IEmailChangeTokenRepository,
} from '../../domain/ports/IEmailChangeTokenRepository';

export class PrismaEmailChangeTokenRepository implements IEmailChangeTokenRepository {
  async deleteByUserId(userId: string): Promise<void> {
    await prisma.emailChangeToken.deleteMany({
      where: { userId },
    });
  }

  async createToken(data: {
    userId: string;
    newEmail: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await prisma.emailChangeToken.create({
      data: {
        userId: data.userId,
        newEmail: data.newEmail,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<EmailChangeToken | null> {
    const record = await prisma.emailChangeToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, newEmail: true, expiresAt: true },
    });
    return record;
  }

  async deleteById(id: string): Promise<void> {
    await prisma.emailChangeToken.delete({
      where: { id },
    });
  }
}
