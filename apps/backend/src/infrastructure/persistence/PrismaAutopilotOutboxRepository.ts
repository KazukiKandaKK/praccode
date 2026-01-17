import { prisma } from '../../lib/prisma';
import type {
  AutopilotOutboxEventRecord,
  IAutopilotOutboxRepository,
} from '../../domain/ports/IAutopilotOutboxRepository';

const LEASE_MS = parseInt(process.env.AUTOPILOT_LEASE_MS || '300000', 10);

const toRecord = (event: {
  id: string;
  type: string;
  payloadJson: unknown;
  dedupKey: string;
  createdAt: Date;
  processedAt: Date | null;
  errorCount: number;
  nextRetryAt: Date | null;
  lastError: string | null;
}): AutopilotOutboxEventRecord => ({
  id: event.id,
  type: event.type,
  payloadJson: (event.payloadJson as Record<string, unknown> | null) ?? null,
  dedupKey: event.dedupKey,
  createdAt: event.createdAt,
  processedAt: event.processedAt,
  errorCount: event.errorCount,
  nextRetryAt: event.nextRetryAt,
  lastError: event.lastError,
});

export class PrismaAutopilotOutboxRepository implements IAutopilotOutboxRepository {
  async enqueue(params: {
    type: string;
    payloadJson: Record<string, unknown>;
    dedupKey: string;
  }): Promise<{ id: string; dedupKey: string; enqueued: boolean }> {
    try {
      const created = await prisma.autopilotOutboxEvent.create({
        data: {
          type: params.type,
          payloadJson: params.payloadJson,
          dedupKey: params.dedupKey,
        },
      });
      return { id: created.id, dedupKey: created.dedupKey, enqueued: true };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return { id: '', dedupKey: params.dedupKey, enqueued: false };
      }
      throw error;
    }
  }

  async leaseNextBatch(params: {
    limit: number;
    now: Date;
  }): Promise<AutopilotOutboxEventRecord[]> {
    const candidates = await prisma.autopilotOutboxEvent.findMany({
      where: {
        processedAt: null,
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: params.now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: params.limit,
    });

    if (candidates.length === 0) return [];

    const leased: AutopilotOutboxEventRecord[] = [];
    const leaseUntil = new Date(params.now.getTime() + LEASE_MS);

    for (const candidate of candidates) {
      const updated = await prisma.autopilotOutboxEvent.updateMany({
        where: {
          id: candidate.id,
          processedAt: null,
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: params.now } }],
        },
        data: { nextRetryAt: leaseUntil },
      });
      if (updated.count === 1) {
        leased.push(
          toRecord({
            ...candidate,
            nextRetryAt: leaseUntil,
          })
        );
      }
    }

    return leased;
  }

  async markProcessed(id: string): Promise<void> {
    await prisma.autopilotOutboxEvent.update({
      where: { id },
      data: {
        processedAt: new Date(),
        nextRetryAt: null,
      },
    });
  }

  async markFailed(params: {
    id: string;
    error: string;
    nextRetryAt?: Date | null;
  }): Promise<void> {
    await prisma.autopilotOutboxEvent.update({
      where: { id: params.id },
      data: {
        errorCount: { increment: 1 },
        lastError: params.error,
        nextRetryAt: params.nextRetryAt ?? null,
      },
    });
  }
}
