import { describe, it, expect, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { authRoutes, AuthControllerDeps } from '@/routes/auth';
import { ApplicationError } from '@/application/errors/ApplicationError';
import type { LoginInput, LoginResult } from '@/application/usecases/LoginUseCase';
import type {
  RegisterUserInput,
  RegisterUserResult,
} from '@/application/usecases/RegisterUserUseCase';
import type { VerifyEmailInput } from '@/application/usecases/VerifyEmailUseCase';
import type { RequestPasswordResetInput } from '@/application/usecases/RequestPasswordResetUseCase';
import type { ResetPasswordInput } from '@/application/usecases/ResetPasswordUseCase';

type UseCaseMock<TInput = unknown, TResult = unknown> = {
  execute: (input: TInput) => Promise<TResult>;
};

const baseUser = {
  id: 'user-id',
  email: 'user@example.com',
  name: 'User',
  passwordHash: 'hashed',
  role: 'LEARNER' as const,
  emailVerified: null,
};

function createDeps(overrides?: Partial<AuthControllerDeps>): AuthControllerDeps {
  return {
    loginUseCase: {
      execute: async () => ({
        user: { id: baseUser.id, email: baseUser.email, name: baseUser.name, image: null, role: baseUser.role },
      }),
    } as UseCaseMock<LoginInput, LoginResult>,
    registerUserUseCase: {
      execute: async () => ({
        user: baseUser,
        confirmUrl: 'https://example.com',
      }),
    } as UseCaseMock<RegisterUserInput, RegisterUserResult>,
    verifyEmailUseCase: { execute: async () => ({ message: 'ok' }) } as UseCaseMock<
      VerifyEmailInput,
      { message: string }
    >,
    requestPasswordResetUseCase: { execute: async () => ({ emailSent: true }) } as UseCaseMock<
      RequestPasswordResetInput,
      { emailSent: boolean }
    >,
    resetPasswordUseCase: { execute: async () => undefined } as UseCaseMock<
      ResetPasswordInput,
      void
    >,
    ...overrides,
  };
}

function buildApp(deps: AuthControllerDeps): FastifyInstance {
  const app = Fastify();
  app.register((instance) => authRoutes(instance, deps), { prefix: '/auth' });
  return app;
}

describe('authRoutes', () => {
  let app: FastifyInstance;
  let deps: AuthControllerDeps;

  beforeEach(() => {
    deps = createDeps();
    app = buildApp(deps);
  });

  //--- Login Tests ---
  describe('POST /auth/login', () => {
    const loginPayload = {
      email: 'test@example.com',
      password: 'password123',
    };

    it('正常系: 認証成功でユーザ情報を返す', async () => {
      deps.loginUseCase.execute = async () => ({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          image: null,
          role: 'LEARNER',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: loginPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toMatchObject({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'LEARNER',
      });
    });

    it('異常系: 認証失敗で401を返す', async () => {
      deps.loginUseCase.execute = async () => {
        throw new ApplicationError('Invalid credentials', 401);
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: loginPayload,
      });

      expect(response.statusCode).toBe(401);
    });

    it('異常系: メールが未認証の場合403を返す', async () => {
      deps.loginUseCase.execute = async () => {
        throw new ApplicationError('Email not verified', 403);
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: loginPayload,
      });

      expect(response.statusCode).toBe(403);
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

    it('正常系: 登録に成功し、確認メールの案内を返す', async () => {
      deps.registerUserUseCase.execute = async () => ({
        user: {
          id: 'user-2',
          email: registerPayload.email,
          name: registerPayload.name,
          passwordHash: 'hashed',
          role: 'LEARNER',
          emailVerified: null,
        },
        confirmUrl: 'https://example.com',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerPayload,
      });

      expect(response.statusCode).toBe(201);
      expect(JSON.parse(response.payload).message).toContain('Registration successful');
    });

    it('異常系: 登録済みのメールアドレスの場合409を返す', async () => {
      deps.registerUserUseCase.execute = async () => {
        throw new ApplicationError('Email already registered', 409);
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: registerPayload,
      });

      expect(response.statusCode).toBe(409);
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

    it('正常系: 有効なトークンでメール認証に成功する', async () => {
      deps.verifyEmailUseCase.execute = async () => ({
        message: 'Email verified successfully. You can now log in.',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: validToken },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).message).toContain('Email verified successfully');
    });

    it('異常系: 不正なトークンの場合404を返す', async () => {
      deps.verifyEmailUseCase.execute = async () => {
        throw new ApplicationError('Invalid or expired token', 404);
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: 'invalid-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('異常系: 期限切れのトークンの場合410を返す', async () => {
      deps.verifyEmailUseCase.execute = async () => {
        throw new ApplicationError('Token expired', 410);
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/verify-email',
        payload: { token: validToken },
      });

      expect(response.statusCode).toBe(410);
    });

    it('準正常系: 既に認証済みの場合メッセージを返す', async () => {
      deps.verifyEmailUseCase.execute = async () => ({
        alreadyVerified: true,
        message: 'Email already verified. You can now log in.',
      });

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
    });
  });

  //--- Password Reset Request Tests ---
  describe('POST /auth/forgot-password', () => {
    it('正常系: トークン生成を受け付けて202を返す', async () => {
      deps.requestPasswordResetUseCase.execute = async () => ({ emailSent: true });

      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { name: 'User', email: 'user@example.com' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).message).toContain('password reset link has been sent');
    });

    it('異常系: 入力形式が不正な場合400を返す', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/forgot-password',
        payload: { name: '', email: 'invalid-email' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  //--- Password Reset Execution Tests ---
  describe('POST /auth/reset-password', () => {
    it('正常系: パスワードリセット成功で200を返す', async () => {
      deps.resetPasswordUseCase.execute = async () => undefined;

      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token: 'valid-token', password: 'new-password' },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload).message).toContain('Password has been reset');
    });

    it('異常系: 不正なトークンで404を返す', async () => {
      deps.resetPasswordUseCase.execute = async () => {
        throw new ApplicationError('Invalid or expired token', 404);
      };

      const response = await app.inject({
        method: 'POST',
        url: '/auth/reset-password',
        payload: { token: 'invalid', password: 'new-password' },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
