import type { MentorFeedback } from '@/mastra/mentorAgent';

export type MentorFeedbackRecord = {
  id: string;
  userId: string;
  submissionId: string;
  feedback: MentorFeedback;
  modelId: string | null;
  temperature: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface IMentorFeedbackRepository {
  saveFeedback(params: {
    userId: string;
    submissionId: string;
    feedback: MentorFeedback;
    modelId?: string | null;
    temperature?: number | null;
  }): Promise<MentorFeedbackRecord>;

  listByUser(userId: string, limit?: number): Promise<MentorFeedbackRecord[]>;
}
