import { ApplicationError } from '@/application/errors/ApplicationError';
import type {
  IMentorThreadRepository,
  MentorMessageRecord,
  MentorThreadRecord,
} from '@/domain/ports/IMentorThreadRepository';

type Result = {
  thread: MentorThreadRecord;
  messages: MentorMessageRecord[];
};

export class GetMentorThreadUseCase {
  constructor(private readonly threadRepository: IMentorThreadRepository) {}

  async execute(params: { threadId: string; userId: string }): Promise<Result> {
    const thread = await this.threadRepository.getThreadByIdForUser(
      params.threadId,
      params.userId
    );
    if (!thread) {
      throw new ApplicationError('Thread not found', 404);
    }

    const messages = await this.threadRepository.listMessages(params.threadId);
    return { thread, messages };
  }
}
