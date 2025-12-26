import { ISubmissionRepository } from '../../domain/ports/ISubmissionRepository';
import { IExerciseRepository } from '../../domain/ports/IExerciseRepository';

export class GetUserProgressUseCase {
  constructor(
    private readonly submissionRepository: ISubmissionRepository,
    private readonly exerciseRepository: IExerciseRepository
  ) {}

  async execute(userId: string) {
    const [totalExercises, completedSubmissions] = await Promise.all([
      this.exerciseRepository.countAll(),
      this.submissionRepository.findCompletedByUserId(userId),
    ]);

    const completedExerciseIds = new Set(completedSubmissions.map((s) => s.exerciseId));
    const completedExercises = completedExerciseIds.size;

    const allScores: number[] = [];
    const aspectScoresMap: Record<string, { total: number; count: number }> = {};

    for (const submission of completedSubmissions) {
      for (const answer of submission.answers) {
        if (answer.score !== null) {
          allScores.push(answer.score);
        }
        if (answer.aspects) {
          for (const [aspect, score] of Object.entries(answer.aspects)) {
            if (!aspectScoresMap[aspect]) {
              aspectScoresMap[aspect] = { total: 0, count: 0 };
            }
            aspectScoresMap[aspect].total += score;
            aspectScoresMap[aspect].count += 1;
          }
        }
      }
    }

    const averageScore =
      allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;

    const aspectScores: Record<string, number> = {};
    for (const [aspect, data] of Object.entries(aspectScoresMap)) {
      aspectScores[aspect] = Math.round(data.total / data.count);
    }

    const recentSubmissions = completedSubmissions.slice(0, 5).map((s) => {
      const scores = s.answers.map((a) => a.score ?? 0);
      const avgScore =
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return {
        exerciseId: s.exerciseId,
        exerciseTitle: s.exercise.title,
        submittedAt: s.updatedAt,
        averageScore: avgScore,
      };
    });

    return {
      userId,
      totalExercises,
      completedExercises,
      averageScore,
      aspectScores,
      recentSubmissions,
    };
  }
}
