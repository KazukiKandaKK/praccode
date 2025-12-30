import { ICodeWritingFeedbackGenerator, CodeWritingFeedbackInput } from '../../domain/ports/ICodeWritingFeedbackGenerator';
import { generateCodeReview } from '../llm/code-reviewer';

export class CodeWritingFeedbackGenerator implements ICodeWritingFeedbackGenerator {
  async generate(input: CodeWritingFeedbackInput): Promise<string> {
    return generateCodeReview({
      language: input.language,
      challengeTitle: input.challengeTitle,
      challengeDescription: input.challengeDescription,
      userCode: input.userCode,
      testCode: input.testCode,
      testOutput: input.testOutput,
      passed: input.passed,
    });
  }
}
