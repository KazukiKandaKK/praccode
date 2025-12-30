import { PrismaClient } from '@prisma/client';
import type {
  IMentorFeedbackInsightRepository,
  MentorFeedbackInsightRecord,
  MentorFeedbackInsightType,
} from '@/domain/ports/IMentorFeedbackInsightRepository';

const client = new PrismaClient();

export class PrismaMentorFeedbackInsightRepository
  implements IMentorFeedbackInsightRepository
{
  async saveInsights(params: {
    userId: string;
    mentorFeedbackId: string;
    strengths: string[];
    improvements: Array<{ area: string; advice: string; example?: string }>;
  }): Promise<void> {
    const strengths = params.strengths
      .map((label) => label.trim())
      .filter(Boolean)
      .map((label) => ({
        userId: params.userId,
        mentorFeedbackId: params.mentorFeedbackId,
        type: 'STRENGTH' as const,
        label,
        detail: null,
        example: null,
      }));

    const improvements = params.improvements.map((item) => ({
      userId: params.userId,
      mentorFeedbackId: params.mentorFeedbackId,
      type: 'IMPROVEMENT' as const,
      label: item.area,
      detail: item.advice,
      example: item.example ?? null,
    }));

    const data = [...strengths, ...improvements];
    if (!data.length) {
      return;
    }

    await client.mentorFeedbackInsight.createMany({ data });
  }

  async listByUser(userId: string, limit = 200): Promise<MentorFeedbackInsightRecord[]> {
    const rows = await client.mentorFeedbackInsight.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      mentorFeedbackId: row.mentorFeedbackId,
      type: row.type as MentorFeedbackInsightType,
      label: row.label,
      detail: row.detail,
      example: row.example,
      createdAt: row.createdAt,
    }));
  }
}
