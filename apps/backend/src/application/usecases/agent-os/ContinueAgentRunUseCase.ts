import type { IAgentOSRepository } from '@/domain/ports/IAgentOSRepository';
import { ApplicationError } from '@/application/errors/ApplicationError';
import type { AgentRuntime } from '@/infrastructure/agent-os/agent-runtime';

export class ContinueAgentRunUseCase {
  constructor(
    private readonly repo: IAgentOSRepository,
    private readonly runtime: AgentRuntime,
    private readonly logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void }
  ) {}

  async execute(params: { runId: string; userId: string }): Promise<{ status: string }> {
    const details = await this.repo.getRunDetailsForUser(params.runId, params.userId);
    if (!details) {
      throw new ApplicationError('Agent run not found', 404);
    }

    setImmediate(async () => {
      try {
        await this.runtime.continueRun({ runId: params.runId, userId: params.userId });
      } catch (error) {
        this.logger.error(error, 'Agent runtime continue failed');
        await this.repo.failRun(
          params.runId,
          error instanceof Error ? error.message : 'Runtime error'
        );
      }
    });

    return { status: 'running' };
  }
}
