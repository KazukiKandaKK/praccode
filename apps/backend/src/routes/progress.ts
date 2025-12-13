import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function progressRoutes(fastify: FastifyInstance) {
  // GET /me/progress - ユーザー進捗取得
  fastify.get('/progress', async (request, reply) => {
    const userId = (request.query as { userId?: string }).userId;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    // 総学習数
    const totalExercises = await prisma.exercise.count();

    // 完了したサブミッション
    const completedSubmissions = (await prisma.submission.findMany({
      where: {
        userId,
        status: 'EVALUATED',
      },
      include: {
        answers: true,
        exercise: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })) as Array<{
      id: string;
      exerciseId: string;
      userId: string;
      status: string;
      answers: Array<{
        score: number | null;
        aspects: Record<string, number> | null;
      }>;
      exercise: {
        id: string;
        title: string;
      };
      updatedAt: Date;
    }>;

    // ユニークな学習IDをカウント
    const completedExerciseIds = new Set(completedSubmissions.map((s) => s.exerciseId));
    const completedExercises = completedExerciseIds.size;

    // スコア計算
    const allScores: number[] = [];
    const aspectScoresMap: Record<string, { total: number; count: number }> = {};

    for (const submission of completedSubmissions) {
      for (const answer of submission.answers) {
        if (answer.score !== null) {
          allScores.push(answer.score);
        }
        if (answer.aspects) {
          const aspects = answer.aspects as Record<string, number>;
          for (const [aspect, score] of Object.entries(aspects)) {
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

    // 最近のサブミッション（5件）
    const recentSubmissions = completedSubmissions.slice(0, 5).map((s) => {
      const scores = s.answers
        .filter((a: { score: number | null }) => a.score !== null)
        .map((a: { score: number | null }) => a.score ?? 0);
      const avgScore =
        scores.length > 0
          ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
          : 0;

      return {
        exerciseId: s.exerciseId,
        exerciseTitle: s.exercise.title,
        submittedAt: s.updatedAt,
        averageScore: avgScore,
      };
    });

    return reply.send({
      userId,
      totalExercises,
      completedExercises,
      averageScore,
      aspectScores,
      recentSubmissions,
    });
  });
}
