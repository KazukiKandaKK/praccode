import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { userRoutes } from './users';
import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import * as mail from '../lib/mail';

// Mock dependencies
vi.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailChangeToken: {
        deleteMany: vi.fn(),
        create: vi.fn(),
        findUnique: vi.fn(),
        delete: vi.fn(),
    },
  },
}));

vi.mock('../lib/mail.js', () => ({
    sendEmailChangeConfirmation: vi.fn().mockResolvedValue(undefined),
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
    return {
      ...cryptoMock,
      default: cryptoMock,
    };
  });

const mockPrisma = prisma as any;
const mockBcrypt = bcrypt as any;
const mockCrypto = crypto as any;
const mockMail = mail as any;


describe('userRoutes', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = Fastify();
    app.setErrorHandler((error, request, reply) => {
        if (error.validation) {
          reply.status(400).send({ error: 'Invalid input', details: error.validation });
        } else {
          console.error(error);
          reply.status(500).send({ error: 'Internal Server Error' });
        }
      });
    app.register(userRoutes, { prefix: '/users' });
    vi.clearAllMocks();
  });

  //--- GET /users/me ---
  describe('GET /users/me', () => {
    const userId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
    const mockUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test User',
        image: null,
        role: 'LEARNER',
        password: 'hashedpassword',
        accounts: [{ provider: 'github' }],
    };

    it('正常系: ユーザープロフィールを返す', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);

        const response = await app.inject({
            method: 'GET',
            url: `/users/me?userId=${userId}`,
        });

        expect(response.statusCode).toBe(200);
        const data = JSON.parse(response.payload);
        expect(data.id).toBe(userId);
        expect(data.email).toBe(mockUser.email);
        expect(data.hasPassword).toBe(true);
        expect(data.oauthProviders).toEqual(['github']);
    });

    it('異常系: ユーザーが見つからない場合404を返す', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);
        const response = await app.inject({
            method: 'GET',
            url: `/users/me?userId=${userId}`,
        });
        expect(response.statusCode).toBe(404);
    });

    it('異常系: userIdが不正な場合400を返す', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/users/me?userId=invalid-uuid',
        });
        expect(response.statusCode).toBe(400);
    });
  });

  //--- PATCH /users/me ---
  describe('PATCH /users/me', () => {
    const userId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
    const patchPayload = { userId, name: 'New Name' };

    it('正常系: ユーザー名を変更し、更新されたユーザー情報を返す', async () => {
        const updatedUser = { id: userId, email: 'test@example.com', name: 'New Name', image: null };
        mockPrisma.user.update.mockResolvedValue(updatedUser);

        const response = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: patchPayload,
        });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual(updatedUser);
        expect(mockPrisma.user.update).toHaveBeenCalledWith({
            where: { id: userId },
            data: { name: 'New Name' },
            select: { id: true, email: true, name: true, image: true },
        });
    });

    it('異常系: 名前の入力が空の場合400を返す', async () => {
        const response = await app.inject({
            method: 'PATCH',
            url: '/users/me',
            payload: { userId, name: '' },
        });
        expect(response.statusCode).toBe(400);
    });
  });

  //--- POST /users/me/password ---
  describe('POST /users/me/password', () => {
    const userId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
    const passwordPayload = { userId, currentPassword: 'old-password', newPassword: 'new-password' };
    const mockUserWithPassword = { id: userId, password: 'hashed-old-password' };

    it('正常系: パスワードを正常に変更する', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(mockUserWithPassword);
        mockBcrypt.compare.mockResolvedValue(true);
        mockBcrypt.hash.mockResolvedValue('hashed-new-password');

        const response = await app.inject({ method: 'POST', url: '/users/me/password', payload: passwordPayload });

        expect(response.statusCode).toBe(200);
        expect(JSON.parse(response.payload)).toEqual({ status: 'ok' });
        expect(mockPrisma.user.update).toHaveBeenCalledWith({ where: { id: userId }, data: { password: 'hashed-new-password' } });
    });

    it('異常系: 現在のパスワードが間違っている場合401を返す', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(mockUserWithPassword);
        mockBcrypt.compare.mockResolvedValue(false);

        const response = await app.inject({ method: 'POST', url: '/users/me/password', payload: passwordPayload });
        expect(response.statusCode).toBe(401);
    });
  });

  //--- POST /users/me/email-change/request ---
  describe('POST /users/me/email-change/request', () => {
    const userId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
    const emailChangePayload = { userId, newEmail: 'new@example.com' };
    
    it('正常系: メール変更リクエストをキューに追加し、202を返す', async () => {
        mockPrisma.user.findUnique.mockResolvedValueOnce({ id: userId, email: 'old@example.com' }); // for user check
        mockPrisma.user.findUnique.mockResolvedValueOnce(null); // for existing email check
        mockCrypto.randomBytes.mockReturnValue(Buffer.from('test-token'));
        mockCrypto.createHash().update().digest.mockReturnValue('hashed-token');

        const response = await app.inject({ method: 'POST', url: '/users/me/email-change/request', payload: emailChangePayload });

        expect(response.statusCode).toBe(202);
        expect(mockPrisma.emailChangeToken.deleteMany).toHaveBeenCalledWith({ where: { userId }});
        expect(mockPrisma.emailChangeToken.create).toHaveBeenCalled();
        expect(mockMail.sendEmailChangeConfirmation).toHaveBeenCalled();
    });

    it('異常系: 新しいメールアドレスが既に使用されている場合409を返す', async () => {
        mockPrisma.user.findUnique.mockResolvedValueOnce({ id: userId, email: 'old@example.com' });
        mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'other-user-id' }); // Email exists

        const response = await app.inject({ method: 'POST', url: '/users/me/email-change/request', payload: emailChangePayload });
        expect(response.statusCode).toBe(409);
    });
  });

    //--- POST /users/me/email-change/confirm ---
    describe('POST /users/me/email-change/confirm', () => {
        const userId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';
        const confirmPayload = { userId, token: 'valid-token' };
        const hashedToken = 'hashed-valid-token';
        const mockTokenRecord = { id: 'token-id', userId, newEmail: 'new@example.com', expiresAt: new Date(Date.now() + 3600 * 1000) };

        beforeEach(() => {
            mockCrypto.createHash().update().digest.mockReturnValue(hashedToken);
        });

        it('正常系: 有効なトークンでメールアドレスを変更する', async () => {
            mockPrisma.emailChangeToken.findUnique.mockResolvedValue(mockTokenRecord);
            mockPrisma.user.findUnique.mockResolvedValue(null); // new email not in use
            mockPrisma.user.update.mockResolvedValue({ id: userId, email: 'new@example.com', name: 'Test User' });

            const response = await app.inject({ method: 'POST', url: '/users/me/email-change/confirm', payload: confirmPayload });
            
            expect(response.statusCode).toBe(200);
            expect(JSON.parse(response.payload).status).toBe('ok');
            expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { email: 'new@example.com' } }));
            expect(mockPrisma.emailChangeToken.delete).toHaveBeenCalledWith({ where: { id: mockTokenRecord.id } });
        });

        it('異常系: トークンが無効な場合400を返す', async () => {
            mockPrisma.emailChangeToken.findUnique.mockResolvedValue(null);
            const response = await app.inject({ method: 'POST', url: '/users/me/email-change/confirm', payload: confirmPayload });
            expect(response.statusCode).toBe(400);
        });
    });
});
