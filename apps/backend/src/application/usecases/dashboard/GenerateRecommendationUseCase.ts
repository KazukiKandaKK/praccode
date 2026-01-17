import { IDashboardRepository } from '../../../domain/ports/IDashboardRepository';
import { GetLearningAnalysisUseCase } from './GetLearningAnalysisUseCase';
import { getRecommendedProblemContext } from '../../../infrastructure/llm/learning-analyzer';
import { IExerciseGenerator } from '../../../domain/ports/IExerciseGenerator';
import { IWritingChallengeGenerator } from '../../../domain/ports/IWritingChallengeGenerator';
import { IExerciseGenerationEventPublisher } from '../../../domain/ports/IExerciseGenerationEventPublisher';

type Logger = { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void };

export interface GenerateRecommendationInput {
  userId: string;
  language?: string;
  type?: 'reading' | 'writing';
}

export class GenerateRecommendationUseCase {
  constructor(
    private readonly dashboardRepo: IDashboardRepository,
    private readonly getLearningAnalysis: GetLearningAnalysisUseCase,
    private readonly exerciseGenerator: IExerciseGenerator,
    private readonly writingChallengeGenerator: IWritingChallengeGenerator,
    private readonly exerciseEventPublisher: IExerciseGenerationEventPublisher,
    private readonly logger: Logger
  ) {}

  async execute(input: GenerateRecommendationInput) {
    const analysis = await this.getLearningAnalysis.execute({
      userId: input.userId,
      force: false,
    });

    const context = getRecommendedProblemContext({
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      summary: analysis.summary,
    });

    const targetLanguage =
      (input.language as 'javascript' | 'typescript' | 'python' | 'go' | undefined) ||
      context.suggestedLanguage ||
      'javascript';
    const focusArea = context.focusAreas[0] || 'refactoring';

    if (input.type === 'reading') {
      const exerciseId = await this.dashboardRepo.createReadingExercisePlaceholder({
        userId: input.userId,
        language: targetLanguage,
        difficulty: context.difficulty,
        genre: focusArea,
      });

      setImmediate(async () => {
        try {
          const generated = await this.exerciseGenerator.generate({
            language: targetLanguage,
            difficulty: context.difficulty,
            genre: focusArea,
          });

          await this.dashboardRepo.saveGeneratedExercise(exerciseId, generated);
          this.exerciseEventPublisher.emitExerciseReady(exerciseId, generated.title);
          this.logger.info(`Reading exercise generated: ${exerciseId}`);
        } catch (error) {
          this.logger.error('Failed to generate reading exercise', error);
          await this.dashboardRepo.markExerciseFailed(exerciseId);
          this.exerciseEventPublisher.emitExerciseFailed(exerciseId);
        }
      });

      return {
        exerciseId,
        type: 'reading' as const,
        status: 'GENERATING' as const,
        focusAreas: context.focusAreas,
      };
    }

    const challengeId = await this.dashboardRepo.createWritingChallengePlaceholder({
      userId: input.userId,
      language: targetLanguage,
      difficulty: context.difficulty,
    });

    setImmediate(async () => {
      try {
        const generated = await this.writingChallengeGenerator.generate({
          userId: input.userId,
          language: targetLanguage as 'javascript' | 'typescript' | 'python' | 'go',
          difficulty: context.difficulty,
        });

        await this.dashboardRepo.saveGeneratedWritingChallenge(challengeId, generated);
        this.logger.info(`Writing challenge generated: ${challengeId}`);
      } catch (error) {
        this.logger.error('Failed to generate writing challenge', error);
        await this.dashboardRepo.markWritingChallengeFailed(challengeId);
      }
    });

    return {
      challengeId,
      type: 'writing' as const,
      status: 'GENERATING' as const,
      focusAreas: context.focusAreas,
    };
  }
}
