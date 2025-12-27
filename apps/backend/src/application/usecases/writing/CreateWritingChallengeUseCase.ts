import { IWritingChallengeRepository } from '../../../domain/ports/IWritingChallengeRepository';
import { WritingChallenge } from '../../../domain/entities/WritingChallenge';

export interface CreateChallengeInput {
  title: string;
  description: string;
  language: WritingChallenge['language'];
  difficulty: number;
  testCode: string;
  sampleCode?: string;
}

export class CreateWritingChallengeUseCase {
  constructor(private readonly repo: IWritingChallengeRepository) {}

  async execute(input: CreateChallengeInput) {
    return this.repo.createChallenge({
      title: input.title,
      description: input.description,
      language: input.language,
      difficulty: input.difficulty,
      testCode: input.testCode,
      sampleCode: input.sampleCode,
    });
  }
}
