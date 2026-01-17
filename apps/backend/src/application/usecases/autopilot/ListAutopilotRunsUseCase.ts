import type { IAutopilotRunRepository } from '@/domain/ports/IAutopilotRunRepository';

export class ListAutopilotRunsUseCase {
  constructor(private readonly runs: IAutopilotRunRepository) {}

  async execute(params: { userId: string; limit?: number }) {
    const runs = await this.runs.listByUser(params.userId, params.limit);
    return { runs };
  }
}
