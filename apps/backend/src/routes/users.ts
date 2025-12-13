import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

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

export async function userRoutes(fastify: FastifyInstance) {
  // GET /users/me?userId=... - プロフィール取得
  fastify.get('/me', async (request, reply) => {
    const query = getMeQuerySchema.parse(request.query);
    const { userId } = query;

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

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const hasPassword = Boolean(user.password);
    const oauthProviders = user.accounts.map((a) => a.provider);

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      hasPassword,
      oauthProviders,
    });
  });

  // PATCH /users/me - 名前変更
  fastify.patch('/me', async (request, reply) => {
    const body = updateProfileSchema.parse(request.body);
    const { userId, name } = body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true, image: true },
    });

    return reply.send(updated);
  });

  // POST /users/me/email-change/request - メール変更リクエスト（開発環境はURLをログに出す）
  fastify.post('/me/email-change/request', async (request, reply) => {
    const body = requestEmailChangeSchema.parse(request.body);
    const { userId, newEmail } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (user.email.toLowerCase() === newEmail.toLowerCase()) {
      return reply.status(400).send({ error: 'New email is the same as current email' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: newEmail },
      select: { id: true },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Email already in use' });
    }

    // 既存トークンは無効化（最新のみ有効にする）
    await prisma.emailChangeToken.deleteMany({
      where: { userId },
    });

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.emailChangeToken.create({
      data: {
        userId,
        newEmail,
        tokenHash,
        expiresAt,
      },
    });

    const origin = process.env.APP_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';
    const confirmUrl = `${origin}/settings/email-change?token=${encodeURIComponent(token)}`;

    fastify.log.info(
      { userId, newEmail, confirmUrl },
      'Email change requested (dev: confirmation URL logged)'
    );

    return reply.status(202).send({
      status: 'queued',
      message: 'Confirmation link generated. Check backend logs in development.',
    });
  });

  // POST /users/me/email-change/confirm - メール変更確定
  fastify.post('/me/email-change/confirm', async (request, reply) => {
    const body = confirmEmailChangeSchema.parse(request.body);
    const { userId, token } = body;
    const tokenHash = sha256Hex(token);

    const record = await prisma.emailChangeToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, newEmail: true, expiresAt: true },
    });

    if (!record || record.userId !== userId) {
      return reply.status(400).send({ error: 'Invalid token' });
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await prisma.emailChangeToken.delete({ where: { id: record.id } });
      return reply.status(400).send({ error: 'Token expired' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: record.newEmail },
      select: { id: true },
    });
    if (existing) {
      await prisma.emailChangeToken.delete({ where: { id: record.id } });
      return reply.status(409).send({ error: 'Email already in use' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { email: record.newEmail },
      select: { id: true, email: true, name: true },
    });

    await prisma.emailChangeToken.delete({ where: { id: record.id } });

    return reply.send({ status: 'ok', user: updated });
  });

  // POST /users/me/password - パスワード変更（現パス必須）
  fastify.post('/me/password', async (request, reply) => {
    const body = changePasswordSchema.parse(request.body);
    const { userId, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    if (!user.password) {
      // OAuthユーザー想定: UIで非表示だが念のため
      return reply.status(400).send({ error: 'Password is not set for this user' });
    }

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      return reply.status(401).send({ error: 'Current password is incorrect' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return reply.send({ status: 'ok' });
  });
}
