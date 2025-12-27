import { IWritingChallengeGenerator, WritingChallengeGenerateInput, WritingChallengeGenerated } from '../../domain/ports/IWritingChallengeGenerator';
import { generateWritingChallenge } from '../../llm/writing-generator';

export class WritingChallengeGenerator implements IWritingChallengeGenerator {
  async generate(input: WritingChallengeGenerateInput): Promise<WritingChallengeGenerated> {
    const generated = await generateWritingChallenge(input);
    return {
      title: generated.title,
      description: generated.description,
      difficulty: generated.difficulty,
      testCode: generated.testCode,
      starterCode: generated.starterCode,
      sampleCode: generated.sampleCode,
    };
  }
}
