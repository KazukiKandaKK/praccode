import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma';
import { analyzeLearningProgress, getRecommendedProblemContext } from '../llm/learning-analyzer';
import { generateWritingChallenge, GenerateWritingChallengeInput } from '../llm/writing-generator';
import { generateExercise } from '../llm/generator';

interface StatsQuery {
  userId: string;
}

interface GenerateRecommendationBody {
  userId: string;
  language?: string;
  type?: 'reading' | 'writing';
}

const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * ダッシュボード統計取得
   */
  fastify.get<{ Querystring: StatsQuery }>('/dashboard/stats', async (request, reply) => {
    const { userId } = request.query;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      // リーディング提出統計
      const readingSubmissions = await prisma.submission.findMany({
        where: {
          userId,
          status: 'EVALUATED',
        },
        include: {
          exercise: {
            select: {
              title: true,
              language: true,
              genre: true,
            },
          },
          answers: {
            select: {
              score: true,
              level: true,
              aspects: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // ライティング提出統計
      const writingSubmissions = await prisma.writingSubmission.findMany({
        where: {
          userId,
          status: 'COMPLETED',
        },
        include: {
          challenge: {
            select: {
              title: true,
              language: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // 統計計算
      const totalReadingSubmissions = readingSubmissions.length;
      const totalWritingSubmissions = writingSubmissions.length;

      // リーディング平均スコア
      let avgReadingScore = 0;
      let totalScore = 0;
      let scoreCount = 0;
      for (const sub of readingSubmissions) {
        for (const ans of sub.answers) {
          if (ans.score !== null) {
            totalScore += ans.score;
            scoreCount++;
          }
        }
      }
      if (scoreCount > 0) {
        avgReadingScore = Math.round(totalScore / scoreCount);
      }

      // ライティング成功率
      const writingPassedCount = writingSubmissions.filter(
        (s: (typeof writingSubmissions)[0]) => s.passed === true
      ).length;
      const writingPassRate =
        totalWritingSubmissions > 0
          ? Math.round((writingPassedCount / totalWritingSubmissions) * 100)
          : 0;

      // アスペクト別スコア集計
      const aspectScores: Record<string, { total: number; count: number }> = {};
      for (const sub of readingSubmissions) {
        for (const ans of sub.answers) {
          if (ans.aspects && typeof ans.aspects === 'object') {
            const aspects = ans.aspects as Record<string, number>;
            for (const [aspect, score] of Object.entries(aspects)) {
              if (!aspectScores[aspect]) {
                aspectScores[aspect] = { total: 0, count: 0 };
              }
              aspectScores[aspect].total += score;
              aspectScores[aspect].count++;
            }
          }
        }
      }

      const aspectAverages: Record<string, number> = {};
      for (const [aspect, data] of Object.entries(aspectScores)) {
        aspectAverages[aspect] = Math.round(data.total / data.count);
      }

      // 最近の提出（リーディング + ライティング混合、最新5件）
      const recentActivity = [
        ...readingSubmissions.slice(0, 5).map((s: (typeof readingSubmissions)[0]) => ({
          type: 'reading' as const,
          id: s.id,
          title: s.exercise.title,
          language: s.exercise.language,
          score:
            s.answers.length > 0
              ? Math.round(
                  s.answers.reduce(
                    (sum: number, a: (typeof s.answers)[0]) => sum + (a.score || 0),
                    0
                  ) / s.answers.length
                )
              : null,
          passed: null,
          date: s.updatedAt,
        })),
        ...writingSubmissions.slice(0, 5).map((s: (typeof writingSubmissions)[0]) => ({
          type: 'writing' as const,
          id: s.id,
          title: s.challenge.title,
          language: s.challenge.language,
          score: null,
          passed: s.passed,
          date: s.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      // 今週の提出数
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeekReadingCount = readingSubmissions.filter(
        (s: (typeof readingSubmissions)[0]) => new Date(s.updatedAt) >= oneWeekAgo
      ).length;
      const thisWeekWritingCount = writingSubmissions.filter(
        (s: (typeof writingSubmissions)[0]) => new Date(s.createdAt) >= oneWeekAgo
      ).length;

      return {
        totalReadingSubmissions,
        totalWritingSubmissions,
        avgReadingScore,
        writingPassRate,
        aspectAverages,
        recentActivity,
        thisWeekCount: thisWeekReadingCount + thisWeekWritingCount,
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return reply.status(500).send({ error: 'Failed to fetch dashboard stats' });
    }
  });

  /**
   * 学習活動カレンダー用データ取得（直近365日の日次提出件数）
   */
  fastify.get<{ Querystring: StatsQuery }>('/dashboard/activity', async (request, reply) => {
    const { userId } = request.query;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      // 直近365日の開始日時を計算
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365);

      // リーディング提出（EVALUATED）を日付でグループ化
      const readingSubmissions = await prisma.submission.findMany({
        where: {
          userId,
          status: 'EVALUATED',
          updatedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          updatedAt: true,
        },
      });

      // ライティング提出（COMPLETED）を日付でグループ化
      const writingSubmissions = await prisma.writingSubmission.findMany({
        where: {
          userId,
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          createdAt: true,
        },
      });

      // 日付文字列（YYYY-MM-DD）でグループ化してカウント
      const activityMap = new Map<string, number>();

      // リーディング提出を日付で集計
      for (const sub of readingSubmissions) {
        const dateStr = sub.updatedAt.toISOString().split('T')[0];
        activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
      }

      // ライティング提出を日付で集計（合算）
      for (const sub of writingSubmissions) {
        const dateStr = sub.createdAt.toISOString().split('T')[0];
        activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
      }

      // 直近365日分の日付配列を生成（提出がない日は0件）
      const activityData: Array<{ date: string; count: number }> = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        activityData.push({
          date: dateStr,
          count: activityMap.get(dateStr) || 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return reply.send({ activity: activityData });
    } catch (error) {
      console.error('Dashboard activity error:', error);
      return reply.status(500).send({ error: 'Failed to fetch dashboard activity' });
    }
  });

  /**
   * 学習分析結果取得（キャッシュ済み or 新規生成）
   */
  fastify.get<{ Querystring: StatsQuery }>('/dashboard/analysis', async (request, reply) => {
    const { userId } = request.query;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      // キャッシュされた分析結果を確認
      const cached = await prisma.userLearningAnalysis.findUnique({
        where: { userId },
      });

      // 24時間以内の分析結果があればそれを返す
      if (cached) {
        const hoursSinceAnalysis = (Date.now() - cached.analyzedAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceAnalysis < 24) {
          return {
            strengths: cached.strengths,
            weaknesses: cached.weaknesses,
            recommendations: cached.recommendations,
            summary: cached.summary,
            analyzedAt: cached.analyzedAt,
            cached: true,
          };
        }
      }

      // 新規分析を実行
      const analysis = await generateAnalysis(userId);

      return {
        ...analysis,
        cached: false,
      };
    } catch (error) {
      console.error('Dashboard analysis error:', error);
      return reply.status(500).send({ error: 'Failed to fetch analysis' });
    }
  });

  /**
   * 分析を強制的に再実行
   */
  fastify.post<{ Body: { userId: string } }>('/dashboard/analyze', async (request, reply) => {
    const { userId } = request.body;

    if (!userId) {
      return reply.status(400).send({ error: 'userId is required' });
    }

    try {
      const analysis = await generateAnalysis(userId);
      return analysis;
    } catch (error) {
      console.error('Dashboard analyze error:', error);
      return reply.status(500).send({ error: 'Failed to analyze' });
    }
  });

  /**
   * 弱みに基づいて問題を生成
   */
  fastify.post<{ Body: GenerateRecommendationBody }>(
    '/dashboard/generate-recommendation',
    async (request, reply) => {
      const { userId, language, type = 'writing' } = request.body;

      if (!userId) {
        return reply.status(400).send({ error: 'userId is required' });
      }

      try {
        // 最新の分析結果を取得
        let analysis = await prisma.userLearningAnalysis.findUnique({
          where: { userId },
        });

        // 分析がなければ生成
        if (!analysis) {
          await generateAnalysis(userId);
          analysis = await prisma.userLearningAnalysis.findUnique({
            where: { userId },
          });
        }

        if (!analysis) {
          return reply.status(400).send({ error: 'No analysis available' });
        }

        // 弱みに基づいた問題コンテキストを取得
        const context = getRecommendedProblemContext({
          strengths: analysis.strengths as string[],
          weaknesses: analysis.weaknesses as string[],
          recommendations: analysis.recommendations as string[],
          summary: analysis.summary,
        });

        const targetLanguage = language || 'javascript';

        if (type === 'reading') {
          // リーディング問題を生成
          const exercise = await prisma.exercise.create({
            data: {
              title: '',
              code: '',
              language: targetLanguage,
              difficulty: context.difficulty,
              genre: context.focusAreas[0] || 'refactoring',
              status: 'GENERATING',
              learningGoals: [],
              createdById: userId,
            },
          });

          // バックグラウンドで問題を生成
          generateReadingExercise(
            exercise.id,
            targetLanguage,
            context.difficulty,
            context.focusAreas[0] || 'refactoring'
          ).catch((err) => {
            console.error('Failed to generate reading exercise:', err);
          });

          return {
            exerciseId: exercise.id,
            type: 'reading',
            status: 'GENERATING',
            focusAreas: context.focusAreas,
          };
        } else {
          // ライティング問題を生成
          const challenge = await prisma.writingChallenge.create({
            data: {
              title: '',
              description: '',
              language: targetLanguage,
              difficulty: context.difficulty,
              status: 'GENERATING',
              createdById: userId,
            },
          });

          // バックグラウンドで問題を生成
          generateWritingChallengeAsync(challenge.id, {
            language: targetLanguage as 'javascript' | 'typescript' | 'python' | 'go',
            difficulty: context.difficulty,
          }).catch((err) => {
            console.error('Failed to generate writing challenge:', err);
          });

          return {
            challengeId: challenge.id,
            type: 'writing',
            status: 'GENERATING',
            focusAreas: context.focusAreas,
          };
        }
      } catch (error) {
        console.error('Generate recommendation error:', error);
        return reply.status(500).send({ error: 'Failed to generate recommendation' });
      }
    }
  );
};

/**
 * リーディング問題をLLMで生成
 */
async function generateReadingExercise(
  exerciseId: string,
  language: string,
  difficulty: number,
  genre: string
) {
  try {
    const generated = await generateExercise({ language, difficulty, genre });

    // 問題本体を更新
    await prisma.exercise.update({
      where: { id: exerciseId },
      data: {
        title: generated.title,
        code: generated.code,
        learningGoals: generated.learningGoals,
        status: 'READY',
      },
    });

    // 設問を作成
    await prisma.exerciseReferenceAnswer.createMany({
      data: generated.questions.map((q, index) => ({
        exerciseId,
        questionIndex: index,
        questionText: q.questionText,
        idealAnswerPoints: q.idealAnswerPoints,
      })),
    });

    console.info(`Reading exercise generated: ${exerciseId}`);
  } catch (error) {
    console.error('Reading exercise generation failed:', error);
    await prisma.exercise.update({
      where: { id: exerciseId },
      data: { status: 'FAILED' },
    });
  }
}

/**
 * ユーザーの学習分析を実行してDBに保存
 */
async function generateAnalysis(userId: string) {
  // 提出データを取得
  const readingSubmissions = await prisma.submission.findMany({
    where: {
      userId,
      status: 'EVALUATED',
    },
    include: {
      exercise: {
        select: {
          title: true,
          language: true,
          genre: true,
        },
      },
      answers: {
        select: {
          score: true,
          level: true,
          aspects: true,
          llmFeedback: true,
        },
      },
    },
  });

  const writingSubmissions = await prisma.writingSubmission.findMany({
    where: {
      userId,
      status: 'COMPLETED',
    },
    include: {
      challenge: {
        select: {
          title: true,
          language: true,
        },
      },
    },
  });

  // 分析用データに変換
  const readingData = readingSubmissions.flatMap((s: (typeof readingSubmissions)[0]) =>
    s.answers.map((a: (typeof s.answers)[0]) => ({
      exerciseTitle: s.exercise.title,
      language: s.exercise.language,
      genre: s.exercise.genre,
      score: a.score || 0,
      level: a.level || 'D',
      aspects: a.aspects as Record<string, number> | null,
      feedback: a.llmFeedback,
    }))
  );

  const writingData = writingSubmissions.map((s: (typeof writingSubmissions)[0]) => ({
    challengeTitle: s.challenge.title,
    language: s.challenge.language,
    passed: s.passed === true,
    feedback: s.llmFeedback,
  }));

  // LLM分析を実行
  const analysis = await analyzeLearningProgress(readingData, writingData);

  // DBに保存
  await prisma.userLearningAnalysis.upsert({
    where: { userId },
    create: {
      userId,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      summary: analysis.summary,
      analyzedAt: new Date(),
    },
    update: {
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      summary: analysis.summary,
      analyzedAt: new Date(),
    },
  });

  return {
    ...analysis,
    analyzedAt: new Date(),
  };
}

/**
 * ライティング問題をLLMで生成（非同期）
 */
async function generateWritingChallengeAsync(
  challengeId: string,
  input: GenerateWritingChallengeInput
) {
  try {
    const generated = await generateWritingChallenge(input);

    await prisma.writingChallenge.update({
      where: { id: challengeId },
      data: {
        title: generated.title,
        description: generated.description,
        difficulty: generated.difficulty,
        testCode: generated.testCode,
        starterCode: generated.starterCode,
        sampleCode: generated.sampleCode,
        status: 'READY',
      },
    });

    console.info(`Writing challenge generated: ${challengeId}`);
  } catch (error) {
    console.error('Writing challenge generation failed:', error);
    await prisma.writingChallenge.update({
      where: { id: challengeId },
      data: { status: 'FAILED' },
    });
  }
}

export default dashboardRoutes;
