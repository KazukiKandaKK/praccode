import type { IAutopilotOutboxRepository } from '@/domain/ports/IAutopilotOutboxRepository';
import type {
  AutopilotTriggerType,
  IAutopilotRunRepository,
} from '@/domain/ports/IAutopilotRunRepository';
import type { AutopilotAgent } from '@/mastra/autopilotAgent';
import type { AutopilotToolRegistry } from '@/mastra/tools/autopilot-tools';

const MAX_RETRIES = parseInt(process.env.AUTOPILOT_MAX_RETRIES || '5', 10);
const DEFAULT_LIMIT = parseInt(process.env.AUTOPILOT_WORKER_BATCH_SIZE || '5', 10);

const backoffMinutes = [1, 5, 30, 120, 360];

type Logger = { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

type AutopilotAction = {
  tool: string;
  args: Record<string, unknown>;
  why?: string;
};

export class RunAutopilotFromOutboxUseCase {
  constructor(
    private readonly outbox: IAutopilotOutboxRepository,
    private readonly runs: IAutopilotRunRepository,
    private readonly agent: AutopilotAgent,
    private readonly tools: AutopilotToolRegistry,
    private readonly logger: Logger
  ) {}

  async execute(params?: { limit?: number; now?: Date }): Promise<void> {
    const limit = params?.limit ?? DEFAULT_LIMIT;
    const now = params?.now ?? new Date();

    const events = await this.outbox.leaseNextBatch({ limit, now });
    for (const event of events) {
      await this.processEvent(event).catch((error) => {
        this.logger.error(error, `Autopilot event failed: ${event.id}`);
      });
    }
  }

  private async processEvent(event: {
    id: string;
    type: string;
    payloadJson: Record<string, unknown> | null;
    dedupKey: string;
    errorCount: number;
  }) {
    const payload = event.payloadJson ?? {};
    const userId = String(payload.userId ?? '');
    const submissionId = payload.submissionId ? String(payload.submissionId) : undefined;

    if (!userId) {
      await this.markFailed(event, 'Invalid payload: userId missing');
      return;
    }

    const triggerType = this.mapTriggerType(event.type);
    const run = await this.runs.createQueued({
      userId,
      triggerType,
      triggerKey: event.dedupKey,
      payloadJson: payload,
    });

    if (!run) {
      this.logger.info(`Autopilot dedup: run already exists for ${event.dedupKey}`);
      await this.outbox.markProcessed(event.id);
      return;
    }

    try {
      await this.runs.markRunning(run.id);
      this.logger.info(`Autopilot run started: ${run.id} (${event.dedupKey})`);

      const context = await this.buildContext({ userId, submissionId, runId: run.id });

      const availableTools = this.tools.list().filter((tool) => tool.name !== 'getSubmissionContext');

      const plan = await this.agent.generatePlan({
        input: {
          triggerType,
          userId,
          submissionId: submissionId ?? null,
          locale: 'ja-JP',
          triggerKey: event.dedupKey,
          constraints: { noDirectAnswer: true, maxHints: 3 },
        },
        context,
        availableTools,
      });

      const actionResults: Array<{ tool: string; result: Record<string, unknown> }> = [];

      for (const action of plan.actions as AutopilotAction[]) {
        const result = await this.tools.execute(action.tool, action.args ?? {}, {
          userId,
          runId: run.id,
        });
        actionResults.push({ tool: action.tool, result });
      }

      await this.runs.markCompleted(run.id, {
        plan: plan.plan,
        actions: plan.actions,
        final: plan.final,
        actionResults,
      });

      await this.outbox.markProcessed(event.id);
      this.logger.info(`Autopilot run completed: ${run.id} (${event.dedupKey})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Autopilot failed';
      await this.runs.markFailed(run.id, message);
      await this.markFailed(event, message);
      this.logger.error(error, `Autopilot run failed: ${run.id} (${event.dedupKey})`);
    }
  }

  private mapTriggerType(type: string): AutopilotTriggerType {
    if (type === 'SubmissionEvaluated') return 'submission_evaluated';
    return 'manual';
  }

  private async buildContext(params: {
    userId: string;
    submissionId?: string;
    runId: string;
  }): Promise<string> {
    if (params.submissionId) {
      const submission = await this.tools.execute(
        'getSubmissionContext',
        { submissionId: params.submissionId },
        { userId: params.userId, runId: params.runId }
      );
      return JSON.stringify({ submission }, null, 2);
    }

    // TODO: include progress snapshot for weekly planning / inactivity nudge.
    return JSON.stringify({ note: 'No submission context provided.' }, null, 2);
  }

  private async markFailed(
    event: { id: string; errorCount: number },
    error: string
  ): Promise<void> {
    const attempt = event.errorCount + 1;
    const nextRetryAt = this.computeNextRetry(attempt);

    await this.outbox.markFailed({
      id: event.id,
      error,
      nextRetryAt,
    });

    if (attempt >= MAX_RETRIES) {
      await this.outbox.markProcessed(event.id);
    }
  }

  private computeNextRetry(attempt: number): Date | null {
    if (attempt <= 0) return null;
    const index = Math.min(attempt - 1, backoffMinutes.length - 1);
    const minutes = backoffMinutes[index];
    return new Date(Date.now() + minutes * 60 * 1000);
  }
}
