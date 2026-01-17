import type { AgentRunMode, IAgentOSRepository } from '@/domain/ports/IAgentOSRepository';
import type { AgentRuntime } from '@/infrastructure/agent-os/agent-runtime';

export class CreateAgentRunUseCase {
  constructor(
    private readonly repo: IAgentOSRepository,
    private readonly runtime: AgentRuntime,
    private readonly logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void }
  ) {}

  async execute(params: {
    userId: string;
    mode: AgentRunMode;
    goal: string;
    inputJson?: Record<string, unknown>;
  }): Promise<{ runId: string }> {
    const run = await this.repo.createRun({
      userId: params.userId,
      mode: params.mode,
      goal: params.goal,
      inputJson: params.inputJson,
    });

    setImmediate(async () => {
      try {
        await this.runtime.run({
          runId: run.id,
          userId: params.userId,
          mode: params.mode,
          goal: params.goal,
          inputJson: params.inputJson,
        });
      } catch (error) {
        this.logger.error(error, 'Agent runtime failed');
        await this.repo.failRun(run.id, error instanceof Error ? error.message : 'Runtime error');
      }
    });

    this.logger.info(`Agent run created: ${run.id}`);
    return { runId: run.id };
  }
}
