import type { IAgentOSRepository, ToolInvocationStatus } from '@/domain/ports/IAgentOSRepository';
import { ApplicationError } from '@/application/errors/ApplicationError';
import type { AgentRuntime } from '@/infrastructure/agent-os/agent-runtime';

export class ConfirmAgentToolInvocationUseCase {
  constructor(
    private readonly repo: IAgentOSRepository,
    private readonly runtime: AgentRuntime,
    private readonly logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void }
  ) {}

  async execute(params: {
    runId: string;
    userId: string;
    invocationId: string;
    decision: 'allow' | 'deny';
  }): Promise<{ status: ToolInvocationStatus }> {
    const details = await this.repo.getRunDetailsForUser(params.runId, params.userId);
    if (!details) {
      throw new ApplicationError('Agent run not found', 404);
    }

    const invocation = details.toolInvocations.find((i) => i.id === params.invocationId);
    if (!invocation) {
      throw new ApplicationError('Invocation not found', 404);
    }

    if (params.decision === 'deny') {
      await this.repo.updateToolInvocation(params.invocationId, {
        status: 'blocked',
        errorMessage: 'User denied',
      });
      return { status: 'blocked' };
    }

    await this.repo.updateInvocationStatus(params.invocationId, 'needs_confirmation');

    setImmediate(async () => {
      try {
        await this.runtime.executeConfirmedTool({
          runId: params.runId,
          userId: params.userId,
          invocationId: params.invocationId,
        });
        await this.runtime.continueRun({ runId: params.runId, userId: params.userId });
      } catch (error) {
        this.logger.error(error, 'Failed to execute confirmed tool');
        await this.repo.failRun(
          params.runId,
          error instanceof Error ? error.message : 'Runtime error'
        );
      }
    });

    return { status: 'success' };
  }
}
