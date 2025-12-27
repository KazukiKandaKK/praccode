import { IWritingSubmissionRepository } from '../../../domain/ports/IWritingSubmissionRepository';
import { WritingSubmission } from '../../../domain/entities/WritingSubmission';
import { ApplicationError } from '../../errors/ApplicationError';

export class GetWritingSubmissionUseCase {
  constructor(private readonly repo: IWritingSubmissionRepository) {}

  async execute(id: string): Promise<WritingSubmission> {
    const submission = await this.repo.findById(id);
    if (!submission) {
      throw new ApplicationError('Submission not found', 404);
    }
    return submission;
  }
}
