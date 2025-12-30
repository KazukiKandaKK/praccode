import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import { join } from 'path';
import { authRoutes } from '@/infrastructure/web/authRoutes';
import { RegisterUserUseCase } from '@/application/usecases/RegisterUserUseCase';
import { VerifyEmailUseCase } from '@/application/usecases/VerifyEmailUseCase';
import { PrismaUserRepository } from '@/infrastructure/persistence/PrismaUserRepository';
import { PrismaEmailVerificationTokenRepository } from '@/infrastructure/persistence/PrismaEmailVerificationTokenRepository';
import { BcryptPasswordHasher } from '@/infrastructure/security/BcryptPasswordHasher';
import { CryptoTokenService } from '@/infrastructure/security/CryptoTokenService';
import { MailEmailService } from '@/infrastructure/services/MailEmailService';
import { InitialAssignmentService } from '@/infrastructure/services/InitialAssignmentService';
import { prisma } from '@/lib/prisma';

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const describeDb = hasDatabaseUrl ? describe : describe.skip;

describeDb('auth registration e2e', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const userRepository = new PrismaUserRepository();
    const tokenRepository = new PrismaEmailVerificationTokenRepository();
    const passwordHasher = new BcryptPasswordHasher();
    const tokenService = new CryptoTokenService();
    const emailService = new MailEmailService();
    const initialAssignmentService = new InitialAssignmentService();

    const registerUserUseCase = new RegisterUserUseCase(
      userRepository,
      passwordHasher,
      tokenRepository,
      emailService,
      tokenService,
      initialAssignmentService
    );
    const verifyEmailUseCase = new VerifyEmailUseCase(
      tokenRepository,
      userRepository,
      emailService,
      tokenService
    );

    app = Fastify();
    await app.register(
      (instance) =>
        authRoutes(instance, {
          loginUseCase: {
            execute: async () => ({
              user: {
                id: 'dummy',
                email: 'dummy@example.com',
                name: 'dummy',
                image: null,
                role: 'LEARNER',
              },
            }),
          },
          registerUserUseCase,
          verifyEmailUseCase,
          requestPasswordResetUseCase: {
            execute: async () => ({ emailSent: true }),
          },
          resetPasswordUseCase: {
            execute: async () => undefined,
          },
        }),
      { prefix: '/auth' }
    );
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('registers a user and verifies email', async () => {
    const timestamp = Date.now();
    const email = `e2e_user_${timestamp}@example.com`;
    const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    const mailDir = join(process.cwd(), 'tmp', 'mail');

    await fs.mkdir(mailDir, { recursive: true });
    await removeMailFiles(mailDir, sanitizedEmail);

    let userId: string | null = null;

    try {
      const registerResponse = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          email,
          password: 'password123',
          name: 'E2E User',
        },
      });

      expect(registerResponse.statusCode).toBe(201);
      const registerBody = JSON.parse(registerResponse.payload) as { id: string };
      userId = registerBody.id;

      const mailPath = await findLatestMailPath(mailDir, sanitizedEmail);
      expect(mailPath).toBeTruthy();
      const mailContent = await fs.readFile(mailPath as string, 'utf-8');
      const token = extractToken(mailContent);

      const verifyResponse = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token },
      });

      expect(verifyResponse.statusCode).toBe(200);
      const verifyBody = JSON.parse(verifyResponse.payload) as { message?: string };
      expect(verifyBody.message).toContain('Email verified successfully');

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.emailVerified).toBeTruthy();
    } finally {
      if (userId) {
        await prisma.exercise.deleteMany({ where: { assignedToId: userId } });
        await prisma.writingChallenge.deleteMany({ where: { assignedToId: userId } });
        await prisma.emailVerificationToken.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
      await removeMailFiles(mailDir, sanitizedEmail);
    }
  });
});

async function findLatestMailPath(mailDir: string, sanitizedEmail: string) {
  const entries = await fs.readdir(mailDir).catch(() => []);
  const matches = entries.filter((entry) => entry.includes(sanitizedEmail));
  if (matches.length === 0) return null;

  const withStats = await Promise.all(
    matches.map(async (entry) => ({
      entry,
      stat: await fs.stat(join(mailDir, entry)),
    }))
  );
  withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return join(mailDir, withStats[0].entry);
}

function extractToken(content: string): string {
  const codeMatch = content.match(/<code>([^<]+)<\/code>/);
  if (codeMatch) {
    const url = new URL(codeMatch[1].trim());
    const token = url.searchParams.get('token');
    if (token) {
      return token;
    }
  }

  const linkMatch = content.match(/verify-email\?token=([^"\\s<]+)/);
  if (linkMatch) {
    return decodeURIComponent(linkMatch[1]);
  }

  throw new Error('Verification token not found in email content');
}

async function removeMailFiles(mailDir: string, sanitizedEmail: string) {
  const entries = await fs.readdir(mailDir).catch(() => []);
  const targets = entries.filter((entry) => entry.includes(sanitizedEmail));
  await Promise.all(targets.map((entry) => fs.unlink(join(mailDir, entry))));
}
