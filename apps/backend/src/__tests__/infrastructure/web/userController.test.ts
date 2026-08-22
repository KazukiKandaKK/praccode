import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { userController } from '@/infrastructure/web/userController';
import { GetUserProfileUseCase } from '@/application/usecases/users/GetUserProfileUseCase';
import { UpdateUserProfileUseCase } from '@/application/usecases/users/UpdateUserProfileUseCase';
import { RequestEmailChangeUseCase } from '@/application/usecases/users/RequestEmailChangeUseCase';
import { ConfirmEmailChangeUseCase } from '@/application/usecases/users/ConfirmEmailChangeUseCase';
import { ChangePasswordUseCase } from '@/application/usecases/users/ChangePasswordUseCase';
import { ApplicationError } from '@/application/errors/ApplicationError';

const validUserId = 'd2d3b878-348c-4f70-9a57-7988351f5c69';

const mockGetProfile = { execute: vi.fn() } as unknown as Mocked<GetUserProfileUseCase>;
const mockUpdateProfile = { execute: vi.fn() } as unknown as Mocked<UpdateUserProfileUseCase>;
const mockRequestEmailChange = { execute: vi.fn() } as unknown as Mocked<RequestEmailChangeUseCase>;
const mockConfirmEmailChange = { execute: vi.fn() } as unknown as Mocked<ConfirmEmailChangeUseCase>;
const mockChangePassword = { execute: vi.fn() } as unknown as Mocked<ChangePasswordUseCase>;

const deps = {
  getProfile: mockGetProfile,
  updateProfile: mockUpdateProfile,
  requestEmailChange: mockRequestEmailChange,
  confirmEmailChange: mockConfirmEmailChange,
  changePassword: mockChangePassword,
};

describe('userController', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    app.register(
      (instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
        userController(instance, deps);
        done();
      },
      { prefix: '/users' }
    );
    vi.resetAllMocks();
    await app.ready();
  });

  describe('GET /users/me', () => {
    it('should return profile for valid userId', async () => {
      mockGetProfile.execute.mockResolvedValue({
        id: validUserId,
        email: 'taro@example.com',
        name: 'Taro',
        image: null,
        role: 'LEARNER',
        hasPassword: true,
        oauthProviders: [],
      } as any);

      const response = await app.inject({
        method: 'GET',
        url: `/users/me?userId=${validUserId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.payload)).toEqual({
        id: validUserId,
        email: 'taro@example.com',
        name: 'Taro',
        image: null,
        role: 'LEARNER',
        hasPassword: true,
        oauthProviders: [],
      });
      expect(mockGetProfile.execute).toHaveBeenCalledWith(validUserId);
    });

    it('should return 400 for invalid userId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/me?userId=bad-id',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /users/me', () => {
    it('should update profile', async () => {
      mockUpdateProfile.execute.mockResolvedValue({
        id: validUserId,
        email: 'taro@example.com',
        name: 'Jiro',
        image: null,
      } as any);

      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        payload: { userId: validUserId, name: 'Jiro' },
      });

      expect(response.statusCode).toBe(200);
      expect(mockUpdateProfile.execute).toHaveBeenCalledWith({ userId: validUserId, name: 'Jiro' });
    });

    it('should return 400 for empty name', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/users/me',
        payload: { userId: validUserId, name: '' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /users/me/email-change/request', () => {
    it('should request email change', async () => {
      mockRequestEmailChange.execute.mockResolvedValue({
        status: 'queued',
        message: 'Confirmation email sent. Check backend/tmp/mail directory.',
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/users/me/email-change/request',
        payload: { userId: validUserId, newEmail: 'new@example.com' },
      });

      expect(response.statusCode).toBe(202);
      expect(mockRequestEmailChange.execute).toHaveBeenCalledWith({
        userId: validUserId,
        newEmail: 'new@example.com',
        origin: expect.any(String),
      });
    });

    it('should return 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users/me/email-change/request',
        payload: { userId: validUserId, newEmail: 'not-an-email' },
      });

      expect(response.statusCode).toBe(400);
      expect(mockRequestEmailChange.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /users/me/email-change/confirm', () => {
    it('should confirm email change', async () => {
      mockConfirmEmailChange.execute.mockResolvedValue({
        status: 'ok',
        user: { id: validUserId, email: 'confirmed@example.com', name: 'Taro' },
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/users/me/email-change/confirm',
        payload: { userId: validUserId, token: 'valid-token-123' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 400 for short token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users/me/email-change/confirm',
        payload: { userId: validUserId, token: 'short' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /users/me/password', () => {
    it('should change password', async () => {
      mockChangePassword.execute.mockResolvedValue({ status: 'ok' } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/users/me/password',
        payload: {
          userId: validUserId,
          currentPassword: 'oldpass',
          newPassword: 'newpass123',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(mockChangePassword.execute).toHaveBeenCalledWith({
        userId: validUserId,
        currentPassword: 'oldpass',
        newPassword: 'newpass123',
      });
    });

    it('should return 400 when currentPassword is too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/users/me/password',
        payload: {
          userId: validUserId,
          currentPassword: '123',
          newPassword: 'newpass123',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should propagate ApplicationError status', async () => {
      mockChangePassword.execute.mockRejectedValue(new ApplicationError('Unauthorized', 401));

      const response = await app.inject({
        method: 'POST',
        url: '/users/me/password',
        payload: {
          userId: validUserId,
          currentPassword: 'oldpass',
          newPassword: 'newpass123',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.payload)).toEqual({ error: 'Unauthorized' });
    });
  });
});
