import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { mentorChatController } from '@/infrastructure/web/mentorChatController';
import { CreateMentorThreadUseCase } from '@/application/usecases/mentor-chat/CreateMentorThreadUseCase';
import { GetMentorThreadUseCase } from '@/application/usecases/mentor-chat/GetMentorThreadUseCase';
import { PostMentorMessageUseCase } from '@/application/usecases/mentor-chat/PostMentorMessageUseCase';
import { PostMentorMessageStreamUseCase } from '@/application/usecases/mentor-chat/PostMentorMessageStreamUseCase';
import { ApplicationError } from '@/application/errors/ApplicationError';

const mockCreateThread = {
  execute: vi.fn(),
} as unknown as Mocked<CreateMentorThreadUseCase>;

const mockGetThread = {
  execute: vi.fn(),
} as unknown as Mocked<GetMentorThreadUseCase>;

const mockPostMessage = {
  execute: vi.fn(),
} as unknown as Mocked<PostMentorMessageUseCase>;

const mockPostMessageStream = {
  execute: vi.fn(),
} as unknown as Mocked<PostMentorMessageStreamUseCase>;

describe('mentorChatController', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify();
    app.register((instance: FastifyInstance, _opts: unknown, done: (err?: Error) => void) => {
      mentorChatController(instance, {
        createThread: mockCreateThread,
        getThread: mockGetThread,
        postMessage: mockPostMessage,
        postMessageStream: mockPostMessageStream,
      });
      done();
    });
    vi.clearAllMocks();
    await app.ready();
  });

  it('should create a mentor thread', async () => {
    mockCreateThread.execute.mockResolvedValue({
      id: 'thread-123',
      userId: 'd2d3b878-348c-4f70-9a57-7988351f5c69',
      exerciseId: null,
      submissionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mentor/threads',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ threadId: 'thread-123' });
  });

  it('should return thread with messages', async () => {
    mockGetThread.execute.mockResolvedValue({
      thread: {
        id: 'thread-123',
        userId: 'd2d3b878-348c-4f70-9a57-7988351f5c69',
        exerciseId: null,
        submissionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      messages: [
        {
          id: 'message-1',
          threadId: 'thread-123',
          role: 'assistant',
          content: 'こんにちは',
          createdAt: new Date(),
        },
      ],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/mentor/threads/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.thread.id).toBe('thread-123');
    expect(payload.messages).toHaveLength(1);
  });

  it('should return 404 when accessing another user thread', async () => {
    mockGetThread.execute.mockRejectedValue(new ApplicationError('Thread not found', 404));

    const response = await app.inject({
      method: 'GET',
      url: '/mentor/threads/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should append mentor messages', async () => {
    mockPostMessage.execute.mockResolvedValue({
      userMessage: {
        id: 'message-user',
        threadId: 'thread-123',
        role: 'user',
        content: '質問があります',
        createdAt: new Date(),
      },
      assistantMessage: {
        id: 'message-assistant',
        threadId: 'thread-123',
        role: 'assistant',
        content: 'ヒントです',
        createdAt: new Date(),
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/mentor/threads/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0/messages',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
      payload: { content: '質問があります' },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.userMessage.role).toBe('user');
    expect(payload.assistantMessage.role).toBe('assistant');
  });

  it('should return 404 when posting message to another user thread', async () => {
    mockPostMessage.execute.mockRejectedValue(new ApplicationError('Thread not found', 404));

    const response = await app.inject({
      method: 'POST',
      url: '/mentor/threads/7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0/messages',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
      payload: { content: '質問があります' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('should return 404 when creating thread with another user submission', async () => {
    mockCreateThread.execute.mockRejectedValue(new ApplicationError('Thread not found', 404));

    const response = await app.inject({
      method: 'POST',
      url: '/mentor/threads',
      headers: { 'x-user-id': 'd2d3b878-348c-4f70-9a57-7988351f5c69' },
      payload: { submissionId: '7ef84a3d-8f80-4b45-b07b-0bd6b0fc8ab0' },
    });

    expect(response.statusCode).toBe(404);
  });
});
