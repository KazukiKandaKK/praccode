import { ApplicationError } from '../../errors/ApplicationError';
import {
  ISubmissionRepository,
  SubmissionStatus,
} from '../../../domain/ports/ISubmissionRepository';
import { IAnswerEvaluationService } from '../../../domain/ports/IAnswerEvaluationService';
import { IEvaluationEventPublisher } from '../../../domain/ports/IEvaluationEventPublisher';
import { ILearningAnalysisScheduler } from '../../../domain/ports/ILearningAnalysisScheduler';

type Logger = { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

export class EvaluateSubmissionUseCase {
  constructor(
    private readonly submissions: ISubmissionRepository,
    private readonly evaluationService: IAnswerEvaluationService,
    private readonly eventPublisher: IEvaluationEventPublisher,
    private readonly learningAnalysisScheduler: ILearningAnalysisScheduler,
    private readonly logger: Logger
  ) {}

  async execute(id: string) {
    const target = await this.submissions.getEvaluationTarget(id);
    if (!target) {
      throw new ApplicationError('Submission not found', 404);
    }

    if (target.status === 'EVALUATED') {
      throw new ApplicationError('Already evaluated', 400);
    }

    if (target.status === 'SUBMITTED') {
      return { submissionId: id, status: 'queued' as SubmissionStatus };
    }

    await this.submissions.markStatus(id, 'SUBMITTED');

    setImmediate(async () => {
      try {
        const jobTarget = await this.submissions.getEvaluationTarget(id);
        if (!jobTarget) return;

        for (const answer of jobTarget.answers) {
          const question = jobTarget.exercise.questions.find(
            (q) => q.questionIndex === answer.questionIndex
          );

          if (!question || !answer.answerText) {
            continue;
          }

          try {
            const result = await this.evaluationService.evaluate({
              code: jobTarget.exercise.code,
              question: question.questionText,
              idealPoints: question.idealAnswerPoints,
              userAnswer: answer.answerText,
            });

            await this.submissions.updateAnswerEvaluation(answer.id, {
              score: result.score,
              level: result.level,
              llmFeedback: result.feedback,
              aspects: result.aspects || {},
            });
          } catch (error) {
            this.logger.error(error, `Failed to evaluate answer ${answer.id}`);
            await this.submissions.updateAnswerEvaluation(answer.id, {
              score: 0,
              level: 'D',
              llmFeedback: '評価中にエラーが発生しました。',
              aspects: {},
            });
          }
        }

        await this.submissions.markStatus(id, 'EVALUATED');
        this.eventPublisher.emitEvaluationComplete(id);
        this.logger.info(`Evaluation completed for submission ${id}`);

        this.learningAnalysisScheduler.trigger(jobTarget.userId).catch((err) => {
          this.logger.error(err, 'Failed to trigger learning analysis');
        });
      } catch (error) {
        this.logger.error(error, `Evaluation job failed for submission ${id}`);
        await this.submissions.markStatus(id, 'EVALUATED');
        this.eventPublisher.emitEvaluationFailed(id);
      }
    });

    return { submissionId: id, status: 'queued' as SubmissionStatus };
  }
}
