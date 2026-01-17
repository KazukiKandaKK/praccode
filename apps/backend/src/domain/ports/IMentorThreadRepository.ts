export type MentorMessageRole = 'user' | 'assistant' | 'system';

export type MentorThreadRecord = {
  id: string;
  userId: string;
  exerciseId: string | null;
  submissionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type MentorMessageRecord = {
  id: string;
  threadId: string;
  role: MentorMessageRole;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};

export interface IMentorThreadRepository {
  createThread(params: {
    userId: string;
    exerciseId?: string | null;
    submissionId?: string | null;
  }): Promise<MentorThreadRecord>;

  getThreadById(id: string): Promise<MentorThreadRecord | null>;
  getThreadByIdForUser(id: string, userId: string): Promise<MentorThreadRecord | null>;

  findByUserAndExerciseId(
    userId: string,
    exerciseId: string
  ): Promise<MentorThreadRecord | null>;

  findByUserAndSubmissionId(
    userId: string,
    submissionId: string
  ): Promise<MentorThreadRecord | null>;

  listMessages(threadId: string, limit?: number): Promise<MentorMessageRecord[]>;

  addMessage(params: {
    threadId: string;
    role: MentorMessageRole;
    content: string;
    metadata?: Record<string, unknown> | null;
  }): Promise<MentorMessageRecord>;
}
