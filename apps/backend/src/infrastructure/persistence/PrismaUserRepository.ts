import { Prisma } from '../../lib/prisma';
import { prisma } from '../../lib/prisma';
import { CreateUserInput, IUserRepository } from '../../domain/ports/IUserRepository';
import { User } from '../../domain/entities/User';

export class PrismaUserRepository implements IUserRepository {
  async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({ where: { email } });
    return user ? this.mapToDomain(user) : null;
  }

  async findVerifiedByEmailAndName(email: string, name: string): Promise<User | null> {
    const user = await prisma.user.findFirst({
      where: {
        email,
        name,
        emailVerified: { not: null },
      },
    });
    return user ? this.mapToDomain(user) : null;
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        password: input.passwordHash,
        role: input.role ?? 'LEARNER',
        emailVerified: null,
      },
    });
    return this.mapToDomain(user);
  }

  async setEmailVerified(userId: string, verifiedAt: Date): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerified: verifiedAt },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }

  private mapToDomain(user: Prisma.UserGetPayload<Record<string, never>>): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.password,
      image: user.image,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }
}
