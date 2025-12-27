import { ApplicationError } from '../../errors/ApplicationError';
import { ISubmissionRepository } from '../../../domain/ports/ISubmissionRepository';

export class GetSubmissionUseCase {
  constructor(private readonly submissions: ISubmissionRepository) {}

  async execute(id: string) {
    const submission = await this.submissions.findById(id);
    if (!submission) {
      throw new ApplicationError('Submission not found', 404);
    }
    return submission;
  }
}
