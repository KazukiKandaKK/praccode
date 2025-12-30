export type MentorFeedbackInsightType = 'STRENGTH' | 'IMPROVEMENT';

export type MentorFeedbackInsightRecord = {
  id: string;
  userId: string;
  mentorFeedbackId: string;
  type: MentorFeedbackInsightType;
  label: string;
  detail: string | null;
  example: string | null;
  createdAt: Date;
};

export interface IMentorFeedbackInsightRepository {
  saveInsights(params: {
    userId: string;
    mentorFeedbackId: string;
    strengths: string[];
    improvements: Array<{ area: string; advice: string; example?: string }>;
  }): Promise<void>;

  listByUser(userId: string, limit?: number): Promise<MentorFeedbackInsightRecord[]>;
}
