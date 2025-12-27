import { IWritingChallengeRepository } from '../../../domain/ports/IWritingChallengeRepository';
import { WritingChallenge } from '../../../domain/entities/WritingChallenge';
import { ApplicationError } from '../../errors/ApplicationError';

export class GetWritingChallengeUseCase {
  constructor(private readonly repo: IWritingChallengeRepository) {}

  async execute(input: { id: string; userId: string }): Promise<WritingChallenge> {
    const challenge = await this.repo.findAssignedById(input.id, input.userId);
    if (!challenge) {
      throw new ApplicationError('Challenge not found', 404);
    }
    return challenge;
  }
}
