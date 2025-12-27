import { ISubmissionRepository, SubmissionStatus } from '../../../domain/ports/ISubmissionRepository';

export interface ListSubmissionsInput {
  userId: string;
  status?: SubmissionStatus;
  page: number;
  limit: number;
}

export class ListSubmissionsUseCase {
  constructor(private readonly submissions: ISubmissionRepository) {}

  async execute(input: ListSubmissionsInput) {
    const { submissions, total } = await this.submissions.listByUser(
      input.userId,
      input.status,
      { page: input.page, limit: input.limit }
    );

    return {
      submissions,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }
}
