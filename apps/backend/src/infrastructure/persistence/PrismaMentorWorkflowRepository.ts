import { PrismaClient } from '@prisma/client';
import type {
  IMentorWorkflowRepository,
  MentorWorkflowState,
  MentorWorkflowStep,
} from '@/domain/ports/IMentorWorkflowRepository';

const client = new PrismaClient();

export class PrismaMentorWorkflowRepository implements IMentorWorkflowRepository {
  async getByUser(userId: string): Promise<MentorWorkflowState | null> {
    const row = await client.mentorWorkflowState.findUnique({
      where: { userId },
    });

    if (!row) {
      return null;
    }

    return {
      userId: row.userId,
      step: row.currentStep as MentorWorkflowStep,
      updatedAt: row.updatedAt,
    };
  }

  async upsertStep(userId: string, step: MentorWorkflowStep): Promise<MentorWorkflowState> {
    const row = await client.mentorWorkflowState.upsert({
      where: { userId },
      create: {
        userId,
        currentStep: step,
      },
      update: {
        currentStep: step,
      },
    });

    return {
      userId: row.userId,
      step: row.currentStep as MentorWorkflowStep,
      updatedAt: row.updatedAt,
    };
  }
}
