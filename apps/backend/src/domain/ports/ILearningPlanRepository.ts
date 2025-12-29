import type { LearningPlan, PresetAnswer } from '@/mastra/mentorAgent';

export type LearningPlanRecord = {
  id: string;
  userId: string;
  plan: LearningPlan;
  presetAnswers: PresetAnswer[];
  targetLanguage: string | null;
  modelId: string | null;
  temperature: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface ILearningPlanRepository {
  savePlan(params: {
    userId: string;
    plan: LearningPlan;
    presetAnswers: PresetAnswer[];
    targetLanguage?: string;
    modelId?: string | null;
    temperature?: number | null;
  }): Promise<LearningPlanRecord>;

  getLatestByUser(userId: string): Promise<LearningPlanRecord | null>;
  listByUser(userId: string, limit?: number): Promise<LearningPlanRecord[]>;
}
