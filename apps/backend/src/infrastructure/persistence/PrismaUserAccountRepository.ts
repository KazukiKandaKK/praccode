import { prisma } from '../../lib/prisma';
import {
  IUserAccountRepository,
  UserProfile,
} from '../../domain/ports/IUserAccountRepository';

export class PrismaUserAccountRepository implements IUserAccountRepository {
  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        password: true,
        accounts: {
          select: { provider: true },
          take: 1,
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? '',
      image: user.image,
      role: user.role as UserProfile['role'],
      hasPassword: Boolean(user.password),
      oauthProviders: user.accounts.map((a) => a.provider),
    };
  }

  async updateName(userId: string, name: string) {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true, image: true },
    });
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name ?? '',
      image: updated.image,
    };
  }

  async findByEmail(email: string): Promise<{ id: string } | null> {
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return existing;
  }

  async findByIdWithPassword(userId: string): Promise<{ id: string; password: string | null } | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    return user;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }

  async updateEmail(userId: string, email: string): Promise<{ id: string; email: string; name: string }> {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email },
      select: { id: true, email: true, name: true },
    });
    return { id: updated.id, email: updated.email, name: updated.name ?? '' };
  }
}
