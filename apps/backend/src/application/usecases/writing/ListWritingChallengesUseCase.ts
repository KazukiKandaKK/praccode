import { IWritingChallengeRepository } from '../../../domain/ports/IWritingChallengeRepository';
import { WritingChallenge } from '../../../domain/entities/WritingChallenge';

export class ListWritingChallengesUseCase {
  constructor(private readonly repo: IWritingChallengeRepository) {}

  async execute(userId: string): Promise<WritingChallenge[]> {
    return this.repo.findAssignedReady(userId);
  }
}
