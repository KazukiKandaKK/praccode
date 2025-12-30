import type {
  EvaluationMetricRecord,
  IEvaluationMetricRepository,
} from '@/domain/ports/IEvaluationMetricRepository';
import type {
  IMentorFeedbackInsightRepository,
  MentorFeedbackInsightRecord,
} from '@/domain/ports/IMentorFeedbackInsightRepository';

type MetricSummary = {
  aspect: string;
  currentAvg: number;
  previousAvg: number | null;
  delta: number | null;
  sampleSize: number;
};

type CountSummary = {
  label: string;
  count: number;
};

type AdviceSummary = {
  area: string;
  advice: string;
  createdAt: Date;
};

export type MentorMetadataSummary = {
  metrics: MetricSummary[];
  strengths: CountSummary[];
  improvements: CountSummary[];
  recentAdvice: AdviceSummary[];
};

export class GetMentorMetadataSummaryUseCase {
  constructor(
    private readonly evaluationMetricRepository: IEvaluationMetricRepository,
    private readonly mentorFeedbackInsightRepository: IMentorFeedbackInsightRepository
  ) {}

  async execute(userId: string): Promise<MentorMetadataSummary> {
    const [metrics, insights] = await Promise.all([
      this.evaluationMetricRepository.listByUser(userId, 200),
      this.mentorFeedbackInsightRepository.listByUser(userId, 200),
    ]);

    return {
      metrics: buildMetricSummary(metrics),
      strengths: buildInsightCounts(insights, 'STRENGTH'),
      improvements: buildInsightCounts(insights, 'IMPROVEMENT'),
      recentAdvice: buildRecentAdvice(insights),
    };
  }
}

function buildMetricSummary(metrics: EvaluationMetricRecord[]): MetricSummary[] {
  const byAspect = new Map<string, EvaluationMetricRecord[]>();

  for (const metric of metrics) {
    if (!byAspect.has(metric.aspect)) {
      byAspect.set(metric.aspect, []);
    }
    byAspect.get(metric.aspect)!.push(metric);
  }

  const summaries: MetricSummary[] = [];

  for (const [aspect, records] of byAspect) {
    const sorted = [...records].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const current = sorted.slice(0, 5);
    const previous = sorted.slice(5, 10);
    const currentAvg = average(current.map((item) => item.score));
    const previousAvg = previous.length > 0 ? average(previous.map((item) => item.score)) : null;
    const delta = previousAvg !== null ? currentAvg - previousAvg : null;

    summaries.push({
      aspect,
      currentAvg,
      previousAvg,
      delta,
      sampleSize: current.length,
    });
  }

  return summaries.sort((a, b) => b.currentAvg - a.currentAvg);
}

function buildInsightCounts(
  insights: MentorFeedbackInsightRecord[],
  type: 'STRENGTH' | 'IMPROVEMENT'
): CountSummary[] {
  const counts = new Map<string, number>();

  for (const insight of insights) {
    if (insight.type !== type) continue;
    counts.set(insight.label, (counts.get(insight.label) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

function buildRecentAdvice(insights: MentorFeedbackInsightRecord[]): AdviceSummary[] {
  return insights
    .filter((insight) => insight.type === 'IMPROVEMENT' && insight.detail)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 3)
    .map((item) => ({
      area: item.label,
      advice: item.detail || '',
      createdAt: item.createdAt,
    }));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}
