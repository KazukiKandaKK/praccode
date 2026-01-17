import { ApplicationError } from '../../errors/ApplicationError';
import {
  ISubmissionRepository,
  SubmissionStatus,
} from '../../../domain/ports/ISubmissionRepository';
import { IAnswerEvaluationService } from '../../../domain/ports/IAnswerEvaluationService';
import { IEvaluationEventPublisher } from '../../../domain/ports/IEvaluationEventPublisher';
import { ILearningAnalysisScheduler } from '../../../domain/ports/ILearningAnalysisScheduler';
import { IEvaluationMetricRepository } from '../../../domain/ports/IEvaluationMetricRepository';
import { IAutopilotOutboxRepository } from '../../../domain/ports/IAutopilotOutboxRepository';

type Logger = { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

export class EvaluateSubmissionUseCase {
  constructor(
    private readonly submissions: ISubmissionRepository,
    private readonly evaluationService: IAnswerEvaluationService,
    private readonly eventPublisher: IEvaluationEventPublisher,
    private readonly learningAnalysisScheduler: ILearningAnalysisScheduler,
    private readonly evaluationMetricRepository: IEvaluationMetricRepository,
    private readonly autopilotOutboxRepository: IAutopilotOutboxRepository,
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

        const aspectTotals = new Map<string, { sum: number; count: number }>();

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

            if (result.aspects) {
              for (const [aspect, rawScore] of Object.entries(result.aspects)) {
                const score = typeof rawScore === 'number' ? rawScore : Number(rawScore);
                if (Number.isNaN(score)) continue;
                const entry = aspectTotals.get(aspect) || { sum: 0, count: 0 };
                entry.sum += score;
                entry.count += 1;
                aspectTotals.set(aspect, entry);
              }
            }
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

        if (aspectTotals.size > 0) {
          const metrics = Array.from(aspectTotals.entries()).map(([aspect, entry]) => ({
            aspect,
            score: entry.count > 0 ? entry.sum / entry.count : 0,
          }));
          await this.evaluationMetricRepository.saveMetrics({
            userId: jobTarget.userId,
            sourceType: 'READING',
            submissionId: jobTarget.id,
            metrics,
          });
        }

        await this.submissions.markStatus(id, 'EVALUATED');

        try {
          await this.autopilotOutboxRepository.enqueue({
            type: 'SubmissionEvaluated',
            payloadJson: { userId: jobTarget.userId, submissionId: jobTarget.id },
            dedupKey: `SubmissionEvaluated:${jobTarget.id}`,
          });
        } catch (error) {
          this.logger.error(error, 'Failed to enqueue autopilot outbox');
        }

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
