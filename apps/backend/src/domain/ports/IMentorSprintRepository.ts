export type MentorSprintStatus = 'ACTIVE' | 'COMPLETED';

export type MentorSprint = {
  id: string;
  userId: string;
  learningPlanId: string | null;
  sequence: number;
  goal: string;
  focusAreas: string[];
  startDate: Date;
  endDate: Date;
  status: MentorSprintStatus;
  updatedAt: Date;
};

export interface IMentorSprintRepository {
  getCurrent(userId: string): Promise<MentorSprint | null>;
  startSprint(params: {
    userId: string;
    learningPlanId?: string | null;
    goal: string;
    focusAreas: string[];
    startDate: Date;
    endDate: Date;
  }): Promise<MentorSprint>;
}
