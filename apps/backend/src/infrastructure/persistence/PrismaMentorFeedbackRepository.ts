import type { IMentorFeedbackRepository, MentorFeedbackRecord } from '@/domain/ports/IMentorFeedbackRepository';
import type { MentorFeedback } from '@/mastra/mentorAgent';
import { PrismaClient } from '@prisma/client';

const client = new PrismaClient();

export class PrismaMentorFeedbackRepository implements IMentorFeedbackRepository {
  async saveFeedback(params: {
    userId: string;
    submissionId: string;
    feedback: MentorFeedback;
    modelId?: string | null;
    temperature?: number | null;
  }): Promise<MentorFeedbackRecord> {
    const created = await client.mentorFeedbackLog.create({
      data: {
        userId: params.userId,
        submissionId: params.submissionId,
        feedback: params.feedback,
        modelId: params.modelId ?? null,
        temperature: params.temperature ?? null,
      },
    });

    return this.toRecord(created);
  }

  async listByUser(userId: string, limit = 20): Promise<MentorFeedbackRecord[]> {
    const feedbacks = await client.mentorFeedbackLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return feedbacks.map((f) => this.toRecord(f));
  }

  private toRecord(row: any): MentorFeedbackRecord {
    return {
      id: row.id,
      userId: row.userId,
      submissionId: row.submissionId,
      feedback: row.feedback as MentorFeedback,
      modelId: row.modelId,
      temperature: row.temperature,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
