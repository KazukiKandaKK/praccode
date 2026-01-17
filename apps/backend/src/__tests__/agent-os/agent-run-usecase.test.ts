import { describe, it, expect } from 'vitest';
import { GetAgentRunUseCase } from '@/application/usecases/agent-os/GetAgentRunUseCase';
import { ApplicationError } from '@/application/errors/ApplicationError';
import type { IAgentOSRepository } from '@/domain/ports/IAgentOSRepository';

const repo = {
  getRunDetailsForUser: async () => null,
} as unknown as IAgentOSRepository;

describe('GetAgentRunUseCase', () => {
  it('should return 404 when run does not belong to user', async () => {
    const useCase = new GetAgentRunUseCase(repo);
    await expect(useCase.execute({ runId: 'run-1', userId: 'user-1' })).rejects.toThrow(
      ApplicationError
    );
  });
});
