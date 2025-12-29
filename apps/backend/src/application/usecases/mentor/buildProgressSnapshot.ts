import type { IExerciseRepository } from '@/domain/ports/IExerciseRepository';
import type { ISubmissionRepository } from '@/domain/ports/ISubmissionRepository';
import type { ProgressSnapshot } from '@/mastra/mentorAgent';

export async function buildProgressSnapshot(
  submissionRepository: ISubmissionRepository,
  exerciseRepository: IExerciseRepository,
  userId: string
): Promise<ProgressSnapshot> {
  const [totalExercises, completedSubmissions] = await Promise.all([
    exerciseRepository.countAll(),
    submissionRepository.findCompletedByUserId(userId),
  ]);

  const completedExerciseIds = new Set(completedSubmissions.map((s) => s.exerciseId));

  const aspectScoresMap: Record<string, { total: number; count: number }> = {};
  const allScores: number[] = [];

  completedSubmissions.forEach((submission) => {
    submission.answers.forEach((answer) => {
      if (answer.score !== null && answer.score !== undefined) {
        allScores.push(answer.score);
      }
      if (answer.aspects) {
        Object.entries(answer.aspects).forEach(([aspect, score]) => {
          if (!aspectScoresMap[aspect]) {
            aspectScoresMap[aspect] = { total: 0, count: 0 };
          }
          aspectScoresMap[aspect].total += score;
          aspectScoresMap[aspect].count += 1;
        });
      }
    });
  });

  const averageScore =
    allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;

  const aspectScores: Record<string, number> = {};
  Object.entries(aspectScoresMap).forEach(([aspect, data]) => {
    aspectScores[aspect] = Math.round(data.total / data.count);
  });

  const weakAspects = Object.entries(aspectScores)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([aspect, score]) => ({ aspect, score }));

  const recentSubmissions = completedSubmissions.slice(0, 5).map((s) => {
    const scores = s.answers.map((a) => a.score ?? 0);
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return {
      exerciseTitle: s.exercise.title,
      averageScore: avgScore,
      updatedAt: s.updatedAt.toISOString(),
    };
  });

  return {
    totalExercises,
    completedExercises: completedExerciseIds.size,
    averageScore,
    aspectScores,
    weakAspects,
    recentSubmissions,
  };
}
