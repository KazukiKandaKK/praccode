import { ApplicationError } from '@/application/errors/ApplicationError';
import type { IAutopilotRunRepository } from '@/domain/ports/IAutopilotRunRepository';

export class GetAutopilotRunUseCase {
  constructor(private readonly runs: IAutopilotRunRepository) {}

  async execute(params: { runId: string; userId: string }) {
    const run = await this.runs.getByIdForUser(params.runId, params.userId);
    if (!run) {
      throw new ApplicationError('Autopilot run not found', 404);
    }
    return { run };
  }
}
