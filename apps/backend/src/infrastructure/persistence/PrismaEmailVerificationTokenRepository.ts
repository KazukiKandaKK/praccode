import { prisma } from '../../lib/prisma';
import { IEmailVerificationTokenRepository, VerificationTokenWithUser } from '../../domain/ports/IEmailVerificationTokenRepository';
import { User } from '../../domain/entities/User';

export class PrismaEmailVerificationTokenRepository
  implements IEmailVerificationTokenRepository
{
  async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }

  async findWithUserByHash(tokenHash: string): Promise<VerificationTokenWithUser | null> {
    const record = await prisma.emailVerificationToken.findUnique({
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
    await prisma.emailVerificationToken.delete({
      where: { id },
    });
  }
}
