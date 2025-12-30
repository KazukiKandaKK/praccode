import { PrismaClient } from '@prisma/client';
import type {
  EvaluationMetric,
  EvaluationMetricRecord,
  EvaluationMetricSource,
  IEvaluationMetricRepository,
} from '@/domain/ports/IEvaluationMetricRepository';

const client = new PrismaClient();

export class PrismaEvaluationMetricRepository implements IEvaluationMetricRepository {
  async saveMetrics(params: {
    userId: string;
    sourceType: EvaluationMetricSource;
    submissionId?: string;
    writingSubmissionId?: string;
    metrics: EvaluationMetric[];
  }): Promise<void> {
    if (!params.metrics.length) {
      return;
    }

    await client.evaluationMetric.createMany({
      data: params.metrics.map((metric) => ({
        userId: params.userId,
        sourceType: params.sourceType,
        aspect: metric.aspect,
        score: Math.round(metric.score),
        submissionId: params.submissionId ?? null,
        writingSubmissionId: params.writingSubmissionId ?? null,
      })),
    });
  }

  async listByUser(userId: string, limit = 200): Promise<EvaluationMetricRecord[]> {
    const rows = await client.evaluationMetric.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      sourceType: row.sourceType as EvaluationMetricSource,
      aspect: row.aspect,
      score: row.score,
      createdAt: row.createdAt,
    }));
  }
}
