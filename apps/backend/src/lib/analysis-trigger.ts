/**
 * 学習分析トリガー
 * 一定条件で学習分析を実行する
 */

import { prisma } from './prisma.js';
import { analyzeLearningProgress } from '../llm/learning-analyzer.js';

// 分析トリガー条件: N回提出ごと
const ANALYSIS_TRIGGER_INTERVAL = 3;

/**
 * 学習分析をトリガー
 * 条件を満たす場合のみ実行
 */
export async function triggerLearningAnalysis(userId: string): Promise<void> {
  try {
    // 現在の分析状態を確認
    const existingAnalysis = await prisma.userLearningAnalysis.findUnique({
      where: { userId },
    });

    // 総提出数を取得
    const [readingCount, writingCount] = await Promise.all([
      prisma.submission.count({
        where: { userId, status: 'EVALUATED' },
      }),
      prisma.writingSubmission.count({
        where: { userId, status: 'COMPLETED' },
      }),
    ]);

    const totalSubmissions = readingCount + writingCount;

    // 分析がない場合、または一定間隔で分析を実行
    const shouldAnalyze = !existingAnalysis || totalSubmissions % ANALYSIS_TRIGGER_INTERVAL === 0;

    if (!shouldAnalyze) {
      return;
    }

    console.info(
      `Triggering learning analysis for user ${userId} (${totalSubmissions} submissions)`
    );

    // 提出データを取得
    const readingSubmissions = await prisma.submission.findMany({
      where: { userId, status: 'EVALUATED' },
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
      where: { userId, status: 'COMPLETED' },
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

    console.info(`Learning analysis completed for user ${userId}`);
  } catch (error) {
    console.error('Learning analysis trigger failed:', error);
    // エラーは握りつぶして、メイン処理には影響を与えない
  }
}
