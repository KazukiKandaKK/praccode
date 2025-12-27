import { ApplicationError } from '../../errors/ApplicationError';
import { ISubmissionRepository } from '../../../domain/ports/ISubmissionRepository';

export interface UpdateSubmissionAnswersInput {
  submissionId: string;
  answers: Array<{ questionIndex: number; answerText: string }>;
}

export class UpdateSubmissionAnswersUseCase {
  constructor(private readonly submissions: ISubmissionRepository) {}

  async execute(input: UpdateSubmissionAnswersInput) {
    const submission = await this.submissions.findById(input.submissionId);
    if (!submission) {
      throw new ApplicationError('Submission not found', 404);
    }

    if (submission.status === 'EVALUATED') {
      throw new ApplicationError('Submission already evaluated', 400);
    }

    await this.submissions.updateAnswers(input.submissionId, input.answers);
    const updated = await this.submissions.findById(input.submissionId);
    if (!updated) {
      throw new ApplicationError('Submission not found after update', 404);
    }

    return updated;
  }
}
