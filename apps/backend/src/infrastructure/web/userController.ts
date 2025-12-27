import crypto from 'node:crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ApplicationError } from '../../application/errors/ApplicationError.js';
import { GetUserProfileUseCase } from '../../application/usecases/users/GetUserProfileUseCase.js';
import { UpdateUserProfileUseCase } from '../../application/usecases/users/UpdateUserProfileUseCase.js';
import { RequestEmailChangeUseCase } from '../../application/usecases/users/RequestEmailChangeUseCase.js';
import { ConfirmEmailChangeUseCase } from '../../application/usecases/users/ConfirmEmailChangeUseCase.js';
import { ChangePasswordUseCase } from '../../application/usecases/users/ChangePasswordUseCase.js';

const getMeQuerySchema = z.object({
  userId: z.string().uuid(),
});

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

const requestEmailChangeSchema = z.object({
  userId: z.string().uuid(),
  newEmail: z.string().email(),
});

const confirmEmailChangeSchema = z.object({
  userId: z.string().uuid(),
  token: z.string().min(10),
});

const changePasswordSchema = z.object({
  userId: z.string().uuid(),
  currentPassword: z.string().min(4),
  newPassword: z.string().min(6),
});

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export interface UserControllerDeps {
  getProfile: GetUserProfileUseCase;
  updateProfile: UpdateUserProfileUseCase;
  requestEmailChange: RequestEmailChangeUseCase;
  confirmEmailChange: ConfirmEmailChangeUseCase;
  changePassword: ChangePasswordUseCase;
}

export function userController(fastify: FastifyInstance, deps: UserControllerDeps) {
  // GET /users/me?userId=... - プロフィール取得
  fastify.get('/me', async (request, reply) => {
    const query = getMeQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid query parameters', details: query.error.format() });
    }
    const { userId } = query.data;

    try {
      const profile = await deps.getProfile.execute(userId);
      return reply.send(profile);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // PATCH /users/me - 名前変更
  fastify.patch('/me', async (request, reply) => {
    const body = updateProfileSchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid request body', details: body.error.format() });
    }
    const { userId, name } = body.data;

    try {
      const updated = await deps.updateProfile.execute({ userId, name });
      return reply.send(updated);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // POST /users/me/email-change/request - メール変更リクエスト
  fastify.post('/me/email-change/request', async (request, reply) => {
    const body = requestEmailChangeSchema.parse(request.body);
    const origin = process.env.APP_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';

    try {
      const result = await deps.requestEmailChange.execute({
        userId: body.userId,
        newEmail: body.newEmail,
        origin,
      });

      return reply.status(202).send(result);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // POST /users/me/email-change/confirm - メール変更確定
  fastify.post('/me/email-change/confirm', async (request, reply) => {
    const body = confirmEmailChangeSchema.parse(request.body);
    const tokenHash = sha256Hex(body.token);

    try {
      const result = await deps.confirmEmailChange.execute({
        userId: body.userId,
        tokenHash,
      });

      return reply.send(result);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });

  // POST /users/me/password - パスワード変更（現パス必須）
  fastify.post('/me/password', async (request, reply) => {
    const body = changePasswordSchema.parse(request.body);

    try {
      const result = await deps.changePassword.execute({
        userId: body.userId,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
      });

      return reply.send(result);
    } catch (error) {
      if (error instanceof ApplicationError) {
        return reply.status(error.statusCode).send({ error: error.message });
      }
      throw error;
    }
  });
}
