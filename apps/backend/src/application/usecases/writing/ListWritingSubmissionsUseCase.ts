import { IWritingSubmissionRepository } from '../../../domain/ports/IWritingSubmissionRepository';
import { WritingSubmission } from '../../../domain/entities/WritingSubmission';

export class ListWritingSubmissionsUseCase {
  constructor(private readonly repo: IWritingSubmissionRepository) {}

  async execute(userId: string): Promise<WritingSubmission[]> {
    return this.repo.findByUser(userId);
  }
}
