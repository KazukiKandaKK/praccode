import { randomUUID } from 'crypto';
import { MastraMemory, type CoreMessage, type MemoryConfig, type MessageType } from '@mastra/core';
import { PrismaClient } from '@prisma/client';

const client = new PrismaClient();

type RememberArgs = {
  threadId?: string;
  resourceId?: string;
  vectorMessageSearch?: string;
  config?: MemoryConfig;
};

export class PrismaMastraMemory extends MastraMemory {
  constructor() {
    super({ name: 'mentor-memory' });
  }

  async getSystemMessage(): Promise<string | null> {
    return null;
  }

  getTools(): Record<string, never> {
    return {};
  }

  async rememberMessages({ threadId, resourceId, config }: RememberArgs) {
    let thread = threadId ? await this.getThreadById({ threadId }) : null;

    if (!thread && resourceId) {
      const threads = await this.getThreadsByResourceId({ resourceId });
      thread = threads[0] || null;
    }

    if (!thread && resourceId) {
      thread = await this.createThread({ resourceId });
    }

    if (!thread) {
      return { threadId: '', messages: [], uiMessages: [] };
    }

    const { messages, uiMessages } = await this.query({
      threadId: thread.id,
      selectBy: { last: config?.lastMessages ?? 50 },
      threadConfig: config,
    });

    return {
      threadId: thread.id,
      messages,
      uiMessages,
    };
  }

  async getThreadById({ threadId }: { threadId: string }) {
    const thread = await client.mastraThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) return null;
    return {
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title ?? undefined,
      metadata: thread.metadata ?? undefined,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
    };
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }) {
    const threads = await client.mastraThread.findMany({
      where: { resourceId },
      orderBy: { updatedAt: 'desc' },
    });
    return threads.map((t) => ({
      id: t.id,
      resourceId: t.resourceId,
      title: t.title ?? undefined,
      metadata: t.metadata ?? undefined,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async saveThread({
    thread,
  }: {
    thread: {
      id: string;
      resourceId: string;
      title?: string;
      metadata?: Record<string, unknown>;
    };
  }) {
    const saved = await client.mastraThread.upsert({
      where: { id: thread.id },
      create: {
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: thread.metadata,
      },
      update: {
        resourceId: thread.resourceId,
        title: thread.title,
        metadata: thread.metadata,
      },
    });

    return {
      id: saved.id,
      resourceId: saved.resourceId,
      title: saved.title ?? undefined,
      metadata: saved.metadata ?? undefined,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }

  async saveMessages({ messages }: { messages: MessageType[] }) {
    await client.$transaction(
      messages.map((m) =>
        client.mastraMessage.create({
          data: {
            id: m.id || randomUUID(),
            threadId: m.threadId,
            role: m.role,
            type: m.type,
            content: m.content,
            toolCallIds: m.toolCallIds ?? undefined,
            toolCallArgs: m.toolCallArgs ?? undefined,
            toolNames: m.toolNames ?? undefined,
            createdAt: m.createdAt || new Date(),
          },
        })
      )
    );

    return messages;
  }

  async query({
    threadId,
    selectBy,
  }: {
    threadId: string;
    resourceId?: string;
    selectBy?: { last?: number | false };
    threadConfig?: MemoryConfig;
  }): Promise<{ messages: CoreMessage[]; uiMessages: any[] }> {
    const take = selectBy?.last && selectBy.last > 0 ? selectBy.last : undefined;
    const records = await client.mastraMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const ordered = records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const messageTypes: MessageType[] = ordered.map((r) => ({
      id: r.id,
      threadId: r.threadId,
      role: r.role as MessageType['role'],
      type: (r.type as MessageType['type']) || 'text',
      content: r.content,
      createdAt: r.createdAt,
      toolCallIds: r.toolCallIds ?? undefined,
      toolCallArgs: r.toolCallArgs ?? undefined,
      toolNames: r.toolNames ?? undefined,
    }));

    const parsed = this.parseMessages(messageTypes);
    return {
      messages: parsed,
      uiMessages: this.convertToUIMessages(messageTypes),
    };
  }

  async deleteThread(threadId: string) {
    await client.$transaction([
      client.mastraMessage.deleteMany({ where: { threadId } }),
      client.mastraThread.deleteMany({ where: { id: threadId } }),
    ]);
  }

  // Helpers to make sure MessageType has ids/timestamps before saving
  addMessage({
    threadId,
    config,
    content,
    role,
    type,
    toolNames,
    toolCallArgs,
    toolCallIds,
  }: {
    threadId: string;
    config?: MemoryConfig;
    content: any;
    role: 'user' | 'assistant';
    type: 'text' | 'tool-call' | 'tool-result';
    toolNames?: string[];
    toolCallArgs?: Record<string, unknown>[];
    toolCallIds?: string[];
  }) {
    return super.addMessage({
      threadId,
      config,
      content,
      role,
      type,
      toolNames,
      toolCallArgs,
      toolCallIds,
    });
  }
}
