import { IWritingSubmissionRepository } from '../../../domain/ports/IWritingSubmissionRepository';
import { IWritingChallengeRepository } from '../../../domain/ports/IWritingChallengeRepository';
import { ICodeExecutor } from '../../../domain/ports/ICodeExecutor';
import { ILearningAnalysisScheduler } from '../../../domain/ports/ILearningAnalysisScheduler';
import { ApplicationError } from '../../errors/ApplicationError';
import { IEvaluationMetricRepository } from '../../../domain/ports/IEvaluationMetricRepository';

export interface SubmitWritingCodeInput {
  userId: string;
  challengeId: string;
  language: string;
  code: string;
}

export interface SubmitWritingCodeResult {
  submissionId: string;
  status: 'PENDING';
}

export class SubmitWritingCodeUseCase {
  constructor(
    private readonly challengeRepo: IWritingChallengeRepository,
    private readonly submissionRepo: IWritingSubmissionRepository,
    private readonly executor: ICodeExecutor,
    private readonly learningAnalysisScheduler: ILearningAnalysisScheduler,
    private readonly evaluationMetricRepository: IEvaluationMetricRepository
  ) {}

  async execute(input: SubmitWritingCodeInput): Promise<SubmitWritingCodeResult> {
    const challenge = await this.challengeRepo.findAssignedById(input.challengeId, input.userId);
    if (!challenge) {
      throw new ApplicationError('Challenge not found', 404);
    }

    if (challenge.assignedToId !== input.userId) {
      throw new ApplicationError('Forbidden', 403);
    }

    const submission = await this.submissionRepo.createSubmission({
      challengeId: input.challengeId,
      userId: input.userId,
      language: input.language,
      code: input.code,
    });

    // 非同期で実行
    setImmediate(async () => {
      try {
        await this.submissionRepo.markRunning(submission.id);

        const result = await this.executor.execute({
          userCode: input.code,
          testCode: challenge.testCode,
          language: input.language,
        });

        const updated = await this.submissionRepo.updateExecutionResult(submission.id, {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          passed: result.passed,
        });

        await this.evaluationMetricRepository.saveMetrics({
          userId: updated.userId,
          sourceType: 'WRITING',
          writingSubmissionId: updated.id,
          metrics: [
            {
              aspect: 'tests_passed',
              score: updated.passed ? 100 : 0,
            },
          ],
        });

        await this.learningAnalysisScheduler.trigger(updated.userId);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        await this.submissionRepo.markError(submission.id, message);
      }
    });

    return { submissionId: submission.id, status: 'PENDING' };
  }
}
