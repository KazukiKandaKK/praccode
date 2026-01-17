export type MentorMessageRole = 'user' | 'assistant' | 'system';

export type MentorThread = {
  id: string;
  userId: string;
  exerciseId: string | null;
  submissionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MentorMessage = {
  id: string;
  threadId: string;
  role: MentorMessageRole;
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

export type MentorThreadWithMessages = {
  thread: MentorThread;
  messages: MentorMessage[];
};

export type MentorPostMessageResult = {
  userMessage: MentorMessage;
  assistantMessage: MentorMessage;
};
