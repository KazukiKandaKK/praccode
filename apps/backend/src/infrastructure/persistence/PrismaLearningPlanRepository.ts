import type { ILearningPlanRepository, LearningPlanRecord } from '@/domain/ports/ILearningPlanRepository';
import type { LearningPlan, PresetAnswer } from '@/mastra/mentorAgent';
import { PrismaClient } from '@prisma/client';

const client = new PrismaClient();

export class PrismaLearningPlanRepository implements ILearningPlanRepository {
  async savePlan(params: {
    userId: string;
    plan: LearningPlan;
    presetAnswers: PresetAnswer[];
    targetLanguage?: string;
    modelId?: string | null;
    temperature?: number | null;
  }): Promise<LearningPlanRecord> {
    const created = await client.learningPlan.create({
      data: {
        userId: params.userId,
        plan: params.plan,
        presetAnswers: params.presetAnswers,
        targetLanguage: params.targetLanguage,
        modelId: params.modelId ?? null,
        temperature: params.temperature ?? null,
      },
    });

    return this.toRecord(created);
  }

  async getLatestByUser(userId: string): Promise<LearningPlanRecord | null> {
    const plan = await client.learningPlan.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!plan) return null;
    return this.toRecord(plan);
  }

  async listByUser(userId: string, limit = 20): Promise<LearningPlanRecord[]> {
    const plans = await client.learningPlan.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return plans.map((p) => this.toRecord(p));
  }

  private toRecord(plan: any): LearningPlanRecord {
    return {
      id: plan.id,
      userId: plan.userId,
      plan: plan.plan as LearningPlan,
      presetAnswers: (plan.presetAnswers || []) as PresetAnswer[],
      targetLanguage: plan.targetLanguage,
      modelId: plan.modelId,
      temperature: plan.temperature,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
