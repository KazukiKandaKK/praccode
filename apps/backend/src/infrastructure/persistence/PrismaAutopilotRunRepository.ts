import { prisma } from '../../lib/prisma';
import type {
  AutopilotRunRecord,
  AutopilotRunStatus,
  AutopilotTriggerType,
  IAutopilotRunRepository,
} from '../../domain/ports/IAutopilotRunRepository';

const toRecord = (run: {
  id: string;
  userId: string;
  triggerType: string;
  triggerKey: string;
  payloadJson: unknown;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  resultJson: unknown;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AutopilotRunRecord => ({
  id: run.id,
  userId: run.userId,
  triggerType: run.triggerType as AutopilotTriggerType,
  triggerKey: run.triggerKey,
  payloadJson: (run.payloadJson as Record<string, unknown> | null) ?? null,
  status: run.status as AutopilotRunStatus,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  resultJson: (run.resultJson as Record<string, unknown> | null) ?? null,
  errorMessage: run.errorMessage,
  createdAt: run.createdAt,
  updatedAt: run.updatedAt,
});

export class PrismaAutopilotRunRepository implements IAutopilotRunRepository {
  async createQueued(params: {
    userId: string;
    triggerType: AutopilotTriggerType;
    triggerKey: string;
    payloadJson: Record<string, unknown>;
  }): Promise<AutopilotRunRecord | null> {
    try {
      const created = await prisma.autopilotRun.create({
        data: {
          userId: params.userId,
          triggerType: params.triggerType,
          triggerKey: params.triggerKey,
          payloadJson: params.payloadJson,
          status: 'queued',
        },
      });
      return toRecord(created);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  async markRunning(runId: string): Promise<void> {
    await prisma.autopilotRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  async markCompleted(runId: string, resultJson: Record<string, unknown>): Promise<void> {
    await prisma.autopilotRun.update({
      where: { id: runId },
      data: { status: 'completed', resultJson, finishedAt: new Date() },
    });
  }

  async markFailed(runId: string, errorMessage: string): Promise<void> {
    await prisma.autopilotRun.update({
      where: { id: runId },
      data: { status: 'failed', errorMessage, finishedAt: new Date() },
    });
  }

  async listByUser(userId: string, limit = 50): Promise<AutopilotRunRecord[]> {
    const runs = await prisma.autopilotRun.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return runs.map(toRecord);
  }

  async getByIdForUser(runId: string, userId: string): Promise<AutopilotRunRecord | null> {
    const run = await prisma.autopilotRun.findFirst({
      where: { id: runId, userId },
    });
    return run ? toRecord(run) : null;
  }
}
