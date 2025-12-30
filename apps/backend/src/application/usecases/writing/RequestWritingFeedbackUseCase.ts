import { IWritingSubmissionRepository } from '../../../domain/ports/IWritingSubmissionRepository';
import { ICodeWritingFeedbackGenerator } from '../../../domain/ports/ICodeWritingFeedbackGenerator';
import { ILlmHealthChecker } from '../../../domain/ports/ILlmHealthChecker';
import { ApplicationError } from '../../errors/ApplicationError';
import { PromptSanitizer } from '../../../llm/prompt-sanitizer';

export class RequestWritingFeedbackUseCase {
  constructor(
    private readonly submissionRepo: IWritingSubmissionRepository,
    private readonly feedbackGenerator: ICodeWritingFeedbackGenerator,
    private readonly healthChecker: ILlmHealthChecker
  ) {}

  async execute(submissionId: string) {
    const healthy = await this.healthChecker.isHealthy();
    if (!healthy) {
      throw new ApplicationError('LLM service is not available', 503);
    }

    const submission = await this.submissionRepo.findById(submissionId);
    if (!submission) {
      throw new ApplicationError('Submission not found', 404);
    }

    if (!submission.executedAt) {
      throw new ApplicationError('Please run the code first', 400);
    }

    if (submission.llmFeedbackStatus === 'GENERATING') {
      return { id: submission.id, status: 'GENERATING' as const };
    }

    const testOutput = [submission.stdout, submission.stderr].filter(Boolean).join('\n\n');
    const trimmedOutput =
      testOutput.length > 500 ? testOutput.slice(0, 500) + '\n... (省略)' : testOutput;

    PromptSanitizer.sanitize(submission.code, 'USER_CODE', { allowBase64: true });
    PromptSanitizer.sanitize(submission.challenge.title, 'CHALLENGE_TITLE');
    PromptSanitizer.sanitize(
      submission.challenge.description ?? '',
      'CHALLENGE_DESCRIPTION'
    );
    PromptSanitizer.sanitize(submission.challenge.testCode ?? '', 'TEST_CODE', {
      allowBase64: true,
    });
    PromptSanitizer.sanitize(trimmedOutput, 'TEST_OUTPUT');

    await this.submissionRepo.markFeedbackGenerating(submission.id);

    setImmediate(async () => {
      try {
        const feedback = await this.feedbackGenerator.generate({
          language: submission.language,
          challengeTitle: submission.challenge.title,
          challengeDescription: submission.challenge.description ?? '',
          userCode: submission.code,
          testCode: submission.challenge.testCode ?? '',
          testOutput,
          passed: submission.passed || false,
        });

        await this.submissionRepo.updateFeedback(submission.id, feedback);
      } catch {
        await this.submissionRepo.markFeedbackFailed(submission.id);
      }
    });

    return { id: submission.id, status: 'GENERATING' as const };
  }
}
