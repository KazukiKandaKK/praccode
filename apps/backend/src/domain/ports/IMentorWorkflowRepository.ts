export type MentorWorkflowStep = 'PLAN' | 'DO' | 'CHECK' | 'NEXT_PLAN';

export type MentorWorkflowState = {
  userId: string;
  step: MentorWorkflowStep;
  updatedAt: Date;
};

export interface IMentorWorkflowRepository {
  getByUser(userId: string): Promise<MentorWorkflowState | null>;
  upsertStep(userId: string, step: MentorWorkflowStep): Promise<MentorWorkflowState>;
}
