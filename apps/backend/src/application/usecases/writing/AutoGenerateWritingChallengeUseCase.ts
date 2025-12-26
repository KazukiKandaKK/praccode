import { IWritingChallengeRepository } from '../../../domain/ports/IWritingChallengeRepository';
import { IWritingChallengeGenerator } from '../../../domain/ports/IWritingChallengeGenerator';
import { ILlmHealthChecker } from '../../../domain/ports/ILlmHealthChecker';
import { ApplicationError } from '../../errors/ApplicationError';
import { WritingChallenge } from '../../../domain/entities/WritingChallenge';

export interface AutoGenerateInput {
  userId: string;
  language: WritingChallenge['language'];
  difficulty: number;
  topic?: string;
}

export interface AutoGenerateResult {
  challengeId: string;
  status: 'GENERATING';
}

export class AutoGenerateWritingChallengeUseCase {
  constructor(
    private readonly repo: IWritingChallengeRepository,
    private readonly generator: IWritingChallengeGenerator,
    private readonly healthChecker: ILlmHealthChecker
  ) {}

  async execute(input: AutoGenerateInput): Promise<AutoGenerateResult> {
    const healthy = await this.healthChecker.isHealthy();
    if (!healthy) {
      throw new ApplicationError('LLM service is not available', 503);
    }

    const challenge = await this.repo.createGenerating(input.userId, input.language, input.difficulty);

    // 非同期で生成を実行
    setImmediate(async () => {
      try {
        const generated = await this.generator.generate(input);
        await this.repo.updateGenerated(challenge.id, {
          ...input,
          title: generated.title,
          description: generated.description,
          testCode: generated.testCode,
          starterCode: generated.starterCode,
          sampleCode: generated.sampleCode,
        });
      } catch {
        await this.repo.markFailed(challenge.id);
      }
    });

    return { challengeId: challenge.id, status: 'GENERATING' };
  }
}
