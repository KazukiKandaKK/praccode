import type { IAgentOSRepository } from '@/domain/ports/IAgentOSRepository';
import { ApplicationError } from '@/application/errors/ApplicationError';

export class GetAgentRunUseCase {
  constructor(private readonly repo: IAgentOSRepository) {}

  async execute(params: { runId: string; userId: string }) {
    const details = await this.repo.getRunDetailsForUser(params.runId, params.userId);
    if (!details) {
      throw new ApplicationError('Agent run not found', 404);
    }
    return details;
  }
}
