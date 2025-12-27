import { prisma } from '../../lib/prisma';
import {
  IPasswordResetTokenRepository,
  PasswordResetTokenWithUser,
} from '../../domain/ports/IPasswordResetTokenRepository';
import { User } from '../../domain/entities/User';

export class PrismaPasswordResetTokenRepository implements IPasswordResetTokenRepository {
  async deleteAllForUser(userId: string): Promise<void> {
    await prisma.passwordResetToken.deleteMany({
      where: { userId },
    });
  }

  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findWithUserByHash(tokenHash: string): Promise<PasswordResetTokenWithUser | null> {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record) {
      return null;
    }

    const user: User = {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name,
      passwordHash: record.user.password,
      image: record.user.image,
      role: record.user.role,
      emailVerified: record.user.emailVerified,
    };

    return {
      token: {
        id: record.id,
        userId: record.userId,
        tokenHash: record.tokenHash,
        expiresAt: record.expiresAt,
        createdAt: record.createdAt,
      },
      user,
    };
  }

  async deleteById(id: string): Promise<void> {
    await prisma.passwordResetToken.delete({
      where: { id },
    });
  }
}
