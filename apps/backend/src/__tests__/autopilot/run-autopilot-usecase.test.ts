import { describe, it, expect } from 'vitest';
import { RunAutopilotFromOutboxUseCase } from '@/application/usecases/autopilot/RunAutopilotFromOutboxUseCase';
import type { IAutopilotOutboxRepository, AutopilotOutboxEventRecord } from '@/domain/ports/IAutopilotOutboxRepository';
import type { IAutopilotRunRepository, AutopilotRunRecord } from '@/domain/ports/IAutopilotRunRepository';

class InMemoryOutboxRepo implements IAutopilotOutboxRepository {
  events: AutopilotOutboxEventRecord[] = [];

  async enqueue() {
    return { id: 'event-1', dedupKey: 'dedup', enqueued: true };
  }

  async leaseNextBatch(params: { limit: number; now: Date }) {
    return this.events
      .filter((e) => !e.processedAt && (!e.nextRetryAt || e.nextRetryAt <= params.now))
      .slice(0, params.limit);
  }

  async markProcessed(id: string) {
    const event = this.events.find((e) => e.id === id);
    if (event) {
      event.processedAt = new Date();
      event.nextRetryAt = null;
    }
  }

  async markFailed(params: { id: string; error: string; nextRetryAt?: Date | null }) {
    const event = this.events.find((e) => e.id === params.id);
    if (event) {
      event.errorCount += 1;
      event.lastError = params.error;
      event.nextRetryAt = params.nextRetryAt ?? null;
    }
  }
}

class InMemoryRunRepo implements IAutopilotRunRepository {
  runs = new Map<string, AutopilotRunRecord>();
  triggerKeys = new Set<string>();

  async createQueued(params: {
    userId: string;
    triggerType: 'submission_evaluated' | 'manual';
    triggerKey: string;
    payloadJson: Record<string, unknown>;
  }): Promise<AutopilotRunRecord | null> {
    if (this.triggerKeys.has(params.triggerKey)) return null;
    this.triggerKeys.add(params.triggerKey);
    const now = new Date();
    const run: AutopilotRunRecord = {
      id: `run-${this.runs.size + 1}`,
      userId: params.userId,
      triggerType: params.triggerType,
      triggerKey: params.triggerKey,
      payloadJson: params.payloadJson,
      status: 'queued',
      startedAt: null,
      finishedAt: null,
      resultJson: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(run.id, run);
    return run;
  }

  async markRunning(runId: string) {
    const run = this.runs.get(runId);
    if (run) run.status = 'running';
  }

  async markCompleted(runId: string, resultJson: Record<string, unknown>) {
    const run = this.runs.get(runId);
    if (run) {
      run.status = 'completed';
      run.resultJson = resultJson;
      run.finishedAt = new Date();
    }
  }

  async markFailed(runId: string, errorMessage: string) {
    const run = this.runs.get(runId);
    if (run) {
      run.status = 'failed';
      run.errorMessage = errorMessage;
      run.finishedAt = new Date();
    }
  }

  async listByUser() {
    return Array.from(this.runs.values());
  }

  async getByIdForUser() {
    return null;
  }
}

const fakeAgent = {
  generatePlan: async () => ({
    plan: 'do actions',
    actions: [
      { tool: 'ensureMentorThreadForSubmission', args: { submissionId: 'sub-1' } },
      { tool: 'postMentorMessage', args: { threadId: 'thread-1', content: 'hi' } },
    ],
    final: {
      summary: 'done',
      userFacing: { message: 'ok', hints: [], questions: [] },
    },
  }),
};

const fakeTools = {
  list: () => [
    { name: 'getSubmissionContext', description: 'ctx' },
    { name: 'ensureMentorThreadForSubmission', description: 'ensure' },
    { name: 'postMentorMessage', description: 'post' },
  ],
  execute: async (name: string) => {
    if (name === 'getSubmissionContext') return { submissionId: 'sub-1' };
    if (name === 'ensureMentorThreadForSubmission') return { threadId: 'thread-1' };
    if (name === 'postMentorMessage') return { messageId: 'msg-1' };
    throw new Error('Unknown tool');
  },
};

describe('RunAutopilotFromOutboxUseCase', () => {
  it('should complete run from outbox event', async () => {
    const outbox = new InMemoryOutboxRepo();
    outbox.events.push({
      id: 'event-1',
      type: 'SubmissionEvaluated',
      payloadJson: { userId: 'user-1', submissionId: 'sub-1' },
      dedupKey: 'SubmissionEvaluated:sub-1',
      createdAt: new Date(),
      processedAt: null,
      errorCount: 0,
      nextRetryAt: null,
      lastError: null,
    });

    const runs = new InMemoryRunRepo();
    const logger = { info: () => undefined, error: () => undefined };

    const usecase = new RunAutopilotFromOutboxUseCase(
      outbox,
      runs,
      fakeAgent as any,
      fakeTools as any,
      logger
    );

    await usecase.execute({ limit: 1, now: new Date() });

    const run = Array.from(runs.runs.values())[0];
    expect(run?.status).toBe('completed');
    expect(outbox.events[0].processedAt).not.toBeNull();
  });

  it('should dedup run creation', async () => {
    const outbox = new InMemoryOutboxRepo();
    outbox.events.push({
      id: 'event-1',
      type: 'SubmissionEvaluated',
      payloadJson: { userId: 'user-1', submissionId: 'sub-1' },
      dedupKey: 'SubmissionEvaluated:sub-1',
      createdAt: new Date(),
      processedAt: null,
      errorCount: 0,
      nextRetryAt: null,
      lastError: null,
    });

    const runs = new InMemoryRunRepo();
    runs.triggerKeys.add('SubmissionEvaluated:sub-1');

    const logger = { info: () => undefined, error: () => undefined };

    const usecase = new RunAutopilotFromOutboxUseCase(
      outbox,
      runs,
      fakeAgent as any,
      fakeTools as any,
      logger
    );

    await usecase.execute({ limit: 1, now: new Date() });

    expect(outbox.events[0].processedAt).not.toBeNull();
  });

  it('should mark failed when tool is unknown', async () => {
    const outbox = new InMemoryOutboxRepo();
    outbox.events.push({
      id: 'event-1',
      type: 'SubmissionEvaluated',
      payloadJson: { userId: 'user-1', submissionId: 'sub-1' },
      dedupKey: 'SubmissionEvaluated:sub-1',
      createdAt: new Date(),
      processedAt: null,
      errorCount: 0,
      nextRetryAt: null,
      lastError: null,
    });

    const runs = new InMemoryRunRepo();
    const logger = { info: () => undefined, error: () => undefined };

    const usecase = new RunAutopilotFromOutboxUseCase(
      outbox,
      runs,
      {
        generatePlan: async () => ({
          plan: 'do',
          actions: [{ tool: 'unknown', args: {} }],
          final: { summary: 'x', userFacing: { message: 'x', hints: [], questions: [] } },
        }),
      } as any,
      fakeTools as any,
      logger
    );

    await usecase.execute({ limit: 1, now: new Date() });

    const run = Array.from(runs.runs.values())[0];
    expect(run?.status).toBe('failed');
    expect(outbox.events[0].errorCount).toBe(1);
  });
});
