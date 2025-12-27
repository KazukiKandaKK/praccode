import { IDashboardRepository } from '../../../domain/ports/IDashboardRepository';
import { ILearningAnalyzer } from '../../../domain/ports/ILearningAnalyzer';

export interface GetLearningAnalysisInput {
  userId: string;
  force?: boolean;
}

export class GetLearningAnalysisUseCase {
  constructor(
    private readonly dashboardRepo: IDashboardRepository,
    private readonly analyzer: ILearningAnalyzer
  ) {}

  async execute(input: GetLearningAnalysisInput) {
    const cached = await this.dashboardRepo.getLearningAnalysis(input.userId);
    const now = Date.now();

    if (!input.force && cached) {
      const hoursSinceAnalysis = (now - cached.analyzedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceAnalysis < 24) {
        return { ...cached, cached: true };
      }
    }

    const [readingSubmissions, writingSubmissions] = await Promise.all([
      this.dashboardRepo.getReadingSubmissions(input.userId),
      this.dashboardRepo.getWritingSubmissions(input.userId),
    ]);

    const readingData = readingSubmissions.flatMap((s) =>
      s.answers.map((a) => ({
        exerciseTitle: s.exercise.title,
        language: s.exercise.language,
        genre: s.exercise.genre,
        score: a.score || 0,
        level: a.level || 'D',
        aspects: a.aspects,
        feedback: a.llmFeedback,
      }))
    );

    const writingData = writingSubmissions.map((s) => ({
      challengeTitle: s.challenge.title,
      language: s.challenge.language,
      passed: s.passed === true,
      feedback: s.llmFeedback,
    }));

    const analysis = await this.analyzer.analyze(readingData, writingData);
    const analyzedAt = new Date();

    await this.dashboardRepo.saveLearningAnalysis(input.userId, {
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      summary: analysis.summary,
      analyzedAt,
    });

    return {
      ...analysis,
      analyzedAt,
      cached: false,
    };
  }
}
