import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { authRoutes } from './auth';
import { prisma } from '../lib/prisma';
import * as mail from '../lib/mail';
import * as crypto from 'node:crypto';

// Mock dependencies
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    exercise: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    writingChallenge: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn(prisma)),
  },
}));

vi.mock('../lib/mail', () => ({
  sendEmailVerification: vi.fn().mockResolvedValue(undefined),
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock('node:crypto', () => {
  const mockHash = {
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(),
  };
  const cryptoMock = {
    createHash: vi.fn(() => mockHash),
    randomBytes: vi.fn(),
  };
  // Handle both `import crypto from 'crypto'` and `import * as crypto from 'crypto'`
  return {
    ...cryptoMock,
    default: cryptoMock,
  };
});

const mockPrisma = prisma as any;
const mockMail = mail as any;
const mockBcrypt = bcrypt as any;
const mockCrypto = crypto as any;

describe('authRoutes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
    // Add a mock error handler to better simulate the production environment
    // This catches ZodErrors and returns a 400 response
    app.setErrorHandler((error, request, reply) => {
      if (error.validation) {
        reply.status(400).send({ error: 'Invalid input', details: error.validation });
      } else {
        // Log the full error for debugging in tests
        console.error(error);
        reply.status(500).send({ error: 'Internal Server Error' });
      }
    });
    app.register(authRoutes, { prefix: '/auth' });
    vi.clearAllMocks();
  });

  //--- Login Tests ---
  describe('POST /auth/login', () => {
    const loginPayload = {
      email: 'test@example.com',
      password: 'password123',
    };

    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      password: 'hashedpassword',
      name: 'Test User',
      image: null,
      role: 'LEARNER',
      emailVerified: new Date(),
    };

    it('正常系: 認証成功でユーザ情報を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: loginPayload,
      });

      expect(response.statusCode).toBe(200);
      const { id, email, name, image, role } = mockUser;
      expect(JSON.parse(response.payload)).toEqual({ id, email, name, image, role });
    });

    it('異常系: ユーザーが見つからない場合401を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: loginPayload,
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Invalid credentials' });
    });

    it('異常系: パスワードが一致しない場合401を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: loginPayload,
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Invalid credentials' });
    });

    it('異常系: メールが未認証の場合403を返す', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: null };
      mockPrisma.user.findUnique.mockResolvedValue(unverifiedUser);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: loginPayload,
      });

      expect(response.statusCode).toBe(403);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Email not verified' });
    });

    it('異常系: 入力形式が不正な場合400を返す', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'invalid-email', password: '123' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  //--- Registration Tests ---
  describe('POST /auth/register', () => {
    const registerPayload = {
      email: 'newuser@example.com',
      password: 'new-password-123',
      name: 'New User',
    };

    const mockNewUser = {
      id: 'user-2',
      email: registerPayload.email,
      name: registerPayload.name,
    };

    const mockPresetExercise = { id: 'preset-ex-1', questions: [] };
    const mockPresetChallenge = { id: 'preset-ch-1' };

    it('正常系: 登録に成功し、確認メールを送信する', async () => {
      // Setup mocks for the happy path
      mockPrisma.user.findUnique.mockResolvedValue(null); // No existing user
      mockPrisma.user.create.mockResolvedValue(mockNewUser);
      mockBcrypt.hash.mockResolvedValue('hashed-new-password');
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('test-token'));
      mockCrypto.createHash().update().digest.mockReturnValue('hashed-token');
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});
      mockPrisma.exercise.findUnique.mockResolvedValue(mockPresetExercise);
      mockPrisma.writingChallenge.findUnique.mockResolvedValue(mockPresetChallenge);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerPayload,
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).message).toContain('Registration successful');

      // Verify mocks
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerPayload.email },
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith(registerPayload.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalled();
      expect(mockMail.sendEmailVerification).toHaveBeenCalled();

      // Verify preset assignment logic was called
      expect(mockPrisma.exercise.findUnique).toHaveBeenCalled();
      expect(mockPrisma.exercise.create).toHaveBeenCalled();
      expect(mockPrisma.writingChallenge.findUnique).toHaveBeenCalled();
      expect(mockPrisma.writingChallenge.create).toHaveBeenCalled();
    });

    it('異常系: 登録済みのメールアドレスの場合409を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockNewUser); // User already exists

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerPayload,
      });

      expect(response.statusCode).toBe(409);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Email already registered' });
    });

    it('異常系: 入力形式が不正な場合400を返す', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'invalid', password: 'short', name: 'a' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  //--- Email Verification Tests ---
  describe('POST /auth/verify-email', () => {
    const validToken = 'valid-token';
    const hashedValidToken = 'hashed-valid-token';

    const mockVerificationToken = {
      id: 'token-1',
      tokenHash: hashedValidToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // Expires in 1 hour
      userId: 'user-1',
      user: {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        emailVerified: null,
      },
    };

    beforeEach(() => {
      mockCrypto.createHash().update().digest.mockReturnValue(hashedValidToken);
    });

    it('正常系: 有効なトークンでメール認証に成功する', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(mockVerificationToken);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (client: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)
      );
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.emailVerificationToken.delete.mockResolvedValue({});

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: validToken },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).message).toContain('Email verified successfully');

      // Verify mocks
      expect(mockPrisma.emailVerificationToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hashedValidToken },
        include: { user: true },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockVerificationToken.userId },
        data: { emailVerified: expect.any(Date) },
      });
      expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
        where: { id: mockVerificationToken.id },
      });
      expect(mockMail.sendWelcomeEmail).toHaveBeenCalledWith(
        mockVerificationToken.user.email,
        mockVerificationToken.user.name
      );
    });

    it('異常系: 不正なトークンの場合404を返す', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: 'invalid-token' },
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Invalid or expired token' });
    });

    it('異常系: 期限切れのトークンの場合410を返す', async () => {
      const expiredToken = { ...mockVerificationToken, expiresAt: new Date(Date.now() - 1000) };
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(expiredToken);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: validToken },
      });

      expect(response.statusCode).toBe(410);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Token expired' });
      expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
        where: { id: expiredToken.id },
      });
    });

    it('準正常系: 既に認証済みの場合メッセージを返す', async () => {
      const alreadyVerifiedToken = {
        ...mockVerificationToken,
        user: { ...mockVerificationToken.user, emailVerified: new Date() },
      };
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(alreadyVerifiedToken);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: validToken },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        message: 'Email already verified. You can now log in.',
        alreadyVerified: true,
      });
      expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
        where: { id: alreadyVerifiedToken.id },
      });
    });
  });

  //--- Forgot Password Tests ---
  describe('POST /auth/forgot-password', () => {
    const forgotPasswordPayload = {
      name: 'Test User',
      email: 'test@example.com',
    };

    const mockUser = {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      emailVerified: new Date(),
    };

    it('正常系: ユーザーが見つかり、リセットメールが送信される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('reset-token'));
      mockCrypto.createHash().update().digest.mockReturnValue('hashed-reset-token');

      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: forgotPasswordPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
      expect(mockMail.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('準正常系: ユーザーが見つからなくても成功メッセージを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: forgotPasswordPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mockMail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('異常系: 入力形式が不正な場合400を返す', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { email: 'invalid-email' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  //--- Reset Password Tests ---
  describe('POST /auth/reset-password', () => {
    const validToken = 'valid-reset-token';
    const hashedValidToken = 'hashed-valid-reset-token';
    const resetPasswordPayload = {
      token: validToken,
      password: 'new-secure-password',
    };

    const mockResetToken = {
      id: 'reset-token-1',
      tokenHash: hashedValidToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // Expires in 1 hour
      userId: 'user-1',
    };

    beforeEach(() => {
      mockCrypto.createHash().update().digest.mockReturnValue(hashedValidToken);
    });

    it('正常系: 有効なトークンでパスワードリセットに成功する', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(mockResetToken);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      mockPrisma.$transaction.mockImplementation(
        async (fn: (client: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)
      );

      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: resetPasswordPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).message).toContain(
        'Password has been reset successfully'
      );

      // Verify mocks
      expect(mockBcrypt.hash).toHaveBeenCalledWith(resetPasswordPayload.password, 10);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockResetToken.userId },
        data: { password: 'new-hashed-password' },
      });
      expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({
        where: { id: mockResetToken.id },
      });
    });

    it('異常系: 不正なトークンの場合404を返す', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: resetPasswordPayload,
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Invalid or expired token' });
    });

    it('異常系: 期限切れのトークンの場合410を返す', async () => {
      const expiredToken = { ...mockResetToken, expiresAt: new Date(Date.now() - 1) };
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue(expiredToken);

      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: resetPasswordPayload,
      });

      expect(response.statusCode).toBe(410);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Token expired' });
      expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({
        where: { id: expiredToken.id },
      });
    });

    it('異常系: 入力形式が不正な場合400を返す', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token: 'a-token', password: 'short' },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
