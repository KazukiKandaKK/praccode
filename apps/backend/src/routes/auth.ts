import { FastifyInstance } from 'fastify';
import { Prisma, prisma } from '../lib/prisma.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { sendEmailVerification, sendWelcomeEmail, sendPasswordResetEmail } from '../lib/mail.js';

function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

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

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login - ログイン
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { email, password } = body.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // メール認証が完了していない場合
    if (!user.emailVerified) {
      return reply.status(403).send({ error: 'Email not verified' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
    });
  });

  // POST /auth/register - 新規登録
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { email, password, name } = body.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return reply.status(409).send({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ユーザーを未認証状態で作成
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'LEARNER',
        emailVerified: null, // 未認証
      },
    });

    // 認証トークンを生成
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3日間

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // 確認メールを送信
    const origin = process.env.APP_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';
    const confirmUrl = `${origin}/verify-email?token=${encodeURIComponent(token)}`;

    sendEmailVerification(user.email, user.name || undefined, confirmUrl).catch((err) => {
      fastify.log.error({ err, userId: user.id }, 'Failed to send verification email');
    });

    // プリセットデータをユーザーに割り当て（各ユーザーにコピーを作成）
    const presetExerciseIds = [
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000003',
    ];
    const presetWritingChallengeIds = [
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003',
      '10000000-0000-0000-0000-000000000004',
    ];

    // コードリーディングのプリセットをコピーして割り当て
    for (const presetId of presetExerciseIds) {
      const preset = await prisma.exercise.findUnique({
        where: { id: presetId },
        include: { questions: true },
      });

      if (preset) {
        await prisma.exercise.create({
          data: {
            title: preset.title,
            language: preset.language,
            difficulty: preset.difficulty,
            genre: preset.genre,
            status: preset.status,
            sourceType: preset.sourceType,
            sourceUrl: preset.sourceUrl,
            code: preset.code,
            learningGoals: preset.learningGoals as unknown as Prisma.InputJsonValue,
            createdById: preset.createdById,
            assignedToId: user.id,
            questions: {
              create: preset.questions.map((q) => ({
                questionIndex: q.questionIndex,
                questionText: q.questionText,
                idealAnswerPoints: q.idealAnswerPoints as unknown as Prisma.InputJsonValue,
              })),
            },
          },
        });
      }
    }

    // コードライティングのプリセットをコピーして割り当て
    for (const presetId of presetWritingChallengeIds) {
      const preset = await prisma.writingChallenge.findUnique({
        where: { id: presetId },
      });

      if (preset) {
        await prisma.writingChallenge.create({
          data: {
            title: preset.title,
            description: preset.description,
            language: preset.language,
            difficulty: preset.difficulty,
            status: preset.status,
            testCode: preset.testCode,
            starterCode: preset.starterCode,
            sampleCode: preset.sampleCode,
            createdById: preset.createdById,
            assignedToId: user.id,
          },
        });
      }
    }

    fastify.log.info(
      { userId: user.id, email: user.email, confirmUrl },
      'User registered, verification email sent, preset data assigned'
    );

    return reply.status(201).send({
      id: user.id,
      email: user.email,
      name: user.name,
      message: 'Registration successful. Please check your email to verify your account.',
    });
  });

  // POST /auth/verify-email - メール認証
  fastify.post('/verify-email', async (request, reply) => {
    const body = verifyEmailSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { token } = body.data;
    const tokenHash = sha256Hex(token);

    // トークンを検索
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!verificationToken) {
      // トークンが見つからない場合、ユーザーが既に認証済みかどうかを確認
      // ただし、トークンからメールアドレスを特定できないため、
      // 一般的なメッセージを返す
      return reply.status(404).send({ error: 'Invalid or expired token' });
    }

    // トークンの有効期限をチェック
    if (verificationToken.expiresAt < new Date()) {
      await prisma.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });
      return reply.status(410).send({ error: 'Token expired' });
    }

    // ユーザーが既に認証済みかどうかチェック
    if (verificationToken.user.emailVerified) {
      // トークンを削除してクリーンアップ（エラーが発生しても無視）
      try {
        await prisma.emailVerificationToken.delete({
          where: { id: verificationToken.id },
        });
      } catch {
        // トークンが既に削除されている場合は無視
        fastify.log.info({ tokenId: verificationToken.id }, 'Token already deleted or not found');
      }
      return reply.status(200).send({
        message: 'Email already verified. You can now log in.',
        alreadyVerified: true,
      });
    }

    // トランザクションで認証完了とトークン削除を実行
    await prisma.$transaction(async (tx) => {
      // ユーザーのメール認証を完了
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: new Date() },
      });

      // トークンを削除
      await tx.emailVerificationToken.delete({
        where: { id: verificationToken.id },
      });
    });

    // ウェルカムメールを送信
    sendWelcomeEmail(verificationToken.user.email, verificationToken.user.name || undefined).catch(
      (err) => {
        fastify.log.error(
          { err, userId: verificationToken.userId },
          'Failed to send welcome email'
        );
      }
    );

    fastify.log.info({ userId: verificationToken.userId }, 'Email verified successfully');

    return reply.send({
      message: 'Email verified successfully. You can now log in.',
    });
  });

  // POST /auth/forgot-password - パスワードリセットリクエスト
  fastify.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { name, email } = body.data;

    // ユーザー名とメールアドレスの両方が一致するユーザーを検索
    const user = await prisma.user.findFirst({
      where: {
        email,
        name,
        emailVerified: { not: null }, // メール認証済みのユーザーのみ
      },
    });

    // セキュリティのため、ユーザーが見つからない場合も成功メッセージを返す
    if (!user) {
      return reply.send({
        message:
          'If the name and email match a verified account, a password reset link has been sent.',
      });
    }

    // パスワードリセットトークンを生成
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1時間

    // 既存のトークンを削除
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    // 新しいトークンを作成
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // リセットメールを送信
    const origin = process.env.APP_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:3000';
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(token)}`;

    sendPasswordResetEmail(user.email, user.name || undefined, resetUrl).catch((err) => {
      fastify.log.error({ err, userId: user.id }, 'Failed to send password reset email');
    });

    fastify.log.info({ userId: user.id, email: user.email }, 'Password reset requested');

    return reply.send({
      message: 'If the email exists and is verified, a password reset link has been sent.',
    });
  });

  // POST /auth/reset-password - パスワードリセット実行
  fastify.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const { token, password } = body.data;
    const tokenHash = sha256Hex(token);

    // トークンを検索
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken) {
      return reply.status(404).send({ error: 'Invalid or expired token' });
    }

    // トークンの有効期限をチェック
    if (resetToken.expiresAt < new Date()) {
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
      return reply.status(410).send({ error: 'Token expired' });
    }

    // パスワードをハッシュ化して更新
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      });

      // トークンを削除
      await tx.passwordResetToken.delete({
        where: { id: resetToken.id },
      });
    });

    fastify.log.info({ userId: resetToken.userId }, 'Password reset successfully');

    return reply.send({
      message: 'Password has been reset successfully. You can now log in.',
    });
  });
}
