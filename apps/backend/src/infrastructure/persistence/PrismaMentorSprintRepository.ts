import { PrismaClient } from '@prisma/client';
import type {
  IMentorSprintRepository,
  MentorSprint,
  MentorSprintStatus,
} from '@/domain/ports/IMentorSprintRepository';

const client = new PrismaClient();

export class PrismaMentorSprintRepository implements IMentorSprintRepository {
  async getCurrent(userId: string): Promise<MentorSprint | null> {
    const row = await client.mentorSprint.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    });

    if (!row) return null;

    return {
      id: row.id,
      userId: row.userId,
      learningPlanId: row.learningPlanId,
      sequence: row.sequence,
      goal: row.goal,
      focusAreas: (row.focusAreas as string[]) || [],
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status as MentorSprintStatus,
      updatedAt: row.updatedAt,
    };
  }

  async startSprint(params: {
    userId: string;
    learningPlanId?: string | null;
    goal: string;
    focusAreas: string[];
    startDate: Date;
    endDate: Date;
  }): Promise<MentorSprint> {
    const result = await client.$transaction(async (tx) => {
      await tx.mentorSprint.updateMany({
        where: { userId: params.userId, status: 'ACTIVE' },
        data: { status: 'COMPLETED' },
      });

      const last = await tx.mentorSprint.findFirst({
        where: { userId: params.userId },
        orderBy: { sequence: 'desc' },
      });

      const sequence = (last?.sequence ?? 0) + 1;

      const created = await tx.mentorSprint.create({
        data: {
          userId: params.userId,
          learningPlanId: params.learningPlanId ?? null,
          sequence,
          goal: params.goal,
          focusAreas: params.focusAreas,
          startDate: params.startDate,
          endDate: params.endDate,
          status: 'ACTIVE',
        },
      });

      return created;
    });

    return {
      id: result.id,
      userId: result.userId,
      learningPlanId: result.learningPlanId,
      sequence: result.sequence,
      goal: result.goal,
      focusAreas: (result.focusAreas as string[]) || [],
      startDate: result.startDate,
      endDate: result.endDate,
      status: result.status as MentorSprintStatus,
      updatedAt: result.updatedAt,
    };
  }
}
