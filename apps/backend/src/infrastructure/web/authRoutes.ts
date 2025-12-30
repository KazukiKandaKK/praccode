import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { LoginInput, LoginResult } from '../../application/usecases/LoginUseCase.js';
import type {
  RegisterUserInput,
  RegisterUserResult,
} from '../../application/usecases/RegisterUserUseCase.js';
import type { VerifyEmailInput } from '../../application/usecases/VerifyEmailUseCase.js';
import type { RequestPasswordResetInput } from '../../application/usecases/RequestPasswordResetUseCase.js';
import type { ResetPasswordInput } from '../../application/usecases/ResetPasswordUseCase.js';
import { ApplicationError } from '../../application/errors/ApplicationError.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
});

const verifyEmailSchema = z.object({
  token: z.string(),
});

const forgotPasswordSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

type UseCaseExecutor<I, O> = {
  execute: (input: I) => Promise<O>;
};

export interface AuthControllerDeps {
  loginUseCase: UseCaseExecutor<LoginInput, LoginResult>;
  registerUserUseCase: UseCaseExecutor<RegisterUserInput, RegisterUserResult>;
  verifyEmailUseCase: UseCaseExecutor<
    VerifyEmailInput,
    { alreadyVerified?: boolean; message?: string }
  >;
  requestPasswordResetUseCase: UseCaseExecutor<RequestPasswordResetInput, { emailSent?: boolean }>;
  resetPasswordUseCase: UseCaseExecutor<ResetPasswordInput, void>;
}

export async function authRoutes(fastify: FastifyInstance, deps: AuthControllerDeps) {
  // POST /auth/login - ログイン
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    try {
      const result = await deps.loginUseCase.execute(body.data);
      return reply.send(result.user);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error, 'Login failed');
      return reply.status(500).send({ error: 'Login failed' });
    }
  });

  // POST /auth/register - 新規登録
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    try {
      const result = await deps.registerUserUseCase.execute({
        ...body.data,
        origin: process.env.APP_ORIGIN || process.env.CORS_ORIGIN,
      });

      fastify.log.info(
        { userId: result.user.id, email: result.user.email, confirmUrl: result.confirmUrl },
        'User registered, verification email sent, preset data assigned'
      );

      return reply.status(201).send({
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        message: 'Registration successful. Please check your email to verify your account.',
      });
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error, 'Registration failed');
      return reply.status(500).send({ error: 'Registration failed' });
    }
  });

  // POST /auth/verify-email - メール認証
  fastify.post('/verify-email', async (request, reply) => {
    const body = verifyEmailSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    try {
      const result = await deps.verifyEmailUseCase.execute({ token: body.data.token });
      if (result?.alreadyVerified) {
        return reply.status(200).send(result);
      }
      return reply.send(result);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error, 'Email verification failed');
      return reply.status(500).send({ error: 'Email verification failed' });
    }
  });

  // POST /auth/forgot-password - パスワードリセットリクエスト
  fastify.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    try {
      await deps.requestPasswordResetUseCase.execute({
        ...body.data,
        origin: process.env.APP_ORIGIN || process.env.CORS_ORIGIN,
      });

      return reply.send({
        message:
          'If the name and email match a verified account, a password reset link has been sent.',
      });
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error, 'Password reset request failed');
      return reply.status(500).send({ error: 'Password reset request failed' });
    }
  });

  // POST /auth/reset-password - パスワードリセット実行
  fastify.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    try {
      await deps.resetPasswordUseCase.execute({
        token: body.data.token,
        newPassword: body.data.password,
      });

      return reply.send({
        message: 'Password has been reset successfully. You can now log in.',
      });
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      fastify.log.error(error, 'Password reset failed');
      return reply.status(500).send({ error: 'Password reset failed' });
    }
  });
}
