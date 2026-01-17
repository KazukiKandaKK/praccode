import type {
  IMentorThreadRepository,
  MentorMessageRecord,
  MentorThreadRecord,
} from '@/domain/ports/IMentorThreadRepository';
import { prisma } from '@/lib/prisma';

export class PrismaMentorThreadRepository implements IMentorThreadRepository {
  async createThread(params: {
    userId: string;
    exerciseId?: string | null;
    submissionId?: string | null;
  }): Promise<MentorThreadRecord> {
    const thread = await prisma.mentorThread.create({
      data: {
        userId: params.userId,
        exerciseId: params.exerciseId ?? null,
        submissionId: params.submissionId ?? null,
      },
    });

    return {
      id: thread.id,
      userId: thread.userId,
      exerciseId: thread.exerciseId,
      submissionId: thread.submissionId,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async getThreadById(id: string): Promise<MentorThreadRecord | null> {
    const thread = await prisma.mentorThread.findUnique({ where: { id } });
    if (!thread) return null;

    return {
      id: thread.id,
      userId: thread.userId,
      exerciseId: thread.exerciseId,
      submissionId: thread.submissionId,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async getThreadByIdForUser(id: string, userId: string): Promise<MentorThreadRecord | null> {
    const thread = await prisma.mentorThread.findFirst({
      where: { id, userId },
    });
    if (!thread) return null;

    return {
      id: thread.id,
      userId: thread.userId,
      exerciseId: thread.exerciseId,
      submissionId: thread.submissionId,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async findByUserAndExerciseId(
    userId: string,
    exerciseId: string
  ): Promise<MentorThreadRecord | null> {
    const thread = await prisma.mentorThread.findFirst({
      where: { userId, exerciseId },
    });
    if (!thread) return null;

    return {
      id: thread.id,
      userId: thread.userId,
      exerciseId: thread.exerciseId,
      submissionId: thread.submissionId,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async findByUserAndSubmissionId(
    userId: string,
    submissionId: string
  ): Promise<MentorThreadRecord | null> {
    const thread = await prisma.mentorThread.findFirst({
      where: { userId, submissionId },
    });
    if (!thread) return null;

    return {
      id: thread.id,
      userId: thread.userId,
      exerciseId: thread.exerciseId,
      submissionId: thread.submissionId,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async listMessages(threadId: string, limit?: number): Promise<MentorMessageRecord[]> {
    const messages = await prisma.mentorMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: limit ? 'desc' : 'asc' },
      take: limit,
    });

    const ordered = limit ? messages.reverse() : messages;

    return ordered.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      role: message.role as MentorMessageRecord['role'],
      content: message.content,
      metadata: (message.metadata as Record<string, unknown> | null) ?? null,
      createdAt: message.createdAt,
    }));
  }

  async addMessage(params: {
    threadId: string;
    role: MentorMessageRecord['role'];
    content: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<MentorMessageRecord> {
    const message = await prisma.mentorMessage.create({
      data: {
        threadId: params.threadId,
        role: params.role,
        content: params.content,
        metadata: params.metadata ?? undefined,
      },
    });

    return {
      id: message.id,
      threadId: message.threadId,
      role: message.role as MentorMessageRecord['role'],
      content: message.content,
      metadata: (message.metadata as Record<string, unknown> | null) ?? null,
      createdAt: message.createdAt,
    };
  }
}
