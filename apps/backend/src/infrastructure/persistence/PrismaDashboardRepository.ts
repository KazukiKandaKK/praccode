import { prisma } from '../../lib/prisma';
import {
  IDashboardRepository,
  LearningAnalysisRecord,
  ReadingSubmissionRecord,
  WritingSubmissionRecord,
} from '../../domain/ports/IDashboardRepository';
import { GeneratedExercise } from '../../domain/ports/IExerciseGenerator';
import { WritingChallengeGenerated } from '../../domain/ports/IWritingChallengeGenerator';

export class PrismaDashboardRepository implements IDashboardRepository {
  async getReadingSubmissions(userId: string): Promise<ReadingSubmissionRecord[]> {
    const submissions = await prisma.submission.findMany({
      where: {
        userId,
        status: 'EVALUATED',
      },
      include: {
        exercise: {
          select: {
            id: true,
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
      orderBy: { updatedAt: 'desc' },
    });

    return submissions.map((s) => ({
      id: s.id,
      userId: s.userId,
      status: s.status as ReadingSubmissionRecord['status'],
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      exercise: s.exercise,
      answers: s.answers.map((a) => ({
        score: a.score,
        level: a.level,
        aspects: (a.aspects as Record<string, number> | null) ?? null,
        llmFeedback: a.llmFeedback,
      })),
    }));
  }

  async getWritingSubmissions(userId: string): Promise<WritingSubmissionRecord[]> {
    const submissions = await prisma.writingSubmission.findMany({
      where: {
        userId,
      },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            language: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map((s) => ({
      id: s.id,
      userId: s.userId,
      status: s.status as WritingSubmissionRecord['status'],
      createdAt: s.createdAt,
      executedAt: s.executedAt,
      passed: s.passed,
      challenge: s.challenge,
      llmFeedback: s.llmFeedback,
      llmFeedbackStatus: s.llmFeedbackStatus as WritingSubmissionRecord['llmFeedbackStatus'],
    }));
  }

  async getReadingActivityDates(userId: string, startDate: Date, endDate: Date): Promise<Date[]> {
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

    return readingSubmissions.map((s) => s.updatedAt);
  }

  async getWritingActivityDates(userId: string, startDate: Date, endDate: Date): Promise<Date[]> {
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

    return writingSubmissions.map((s) => s.createdAt);
  }

  async getLearningAnalysis(userId: string): Promise<LearningAnalysisRecord | null> {
    const record = await prisma.userLearningAnalysis.findUnique({
      where: { userId },
    });

    if (!record) return null;

    return {
      userId: record.userId,
      strengths: record.strengths as string[],
      weaknesses: record.weaknesses as string[],
      recommendations: record.recommendations as string[],
      summary: record.summary,
      analyzedAt: record.analyzedAt,
    };
  }

  async saveLearningAnalysis(
    userId: string,
    record: Omit<LearningAnalysisRecord, 'userId'>
  ): Promise<void> {
    await prisma.userLearningAnalysis.upsert({
      where: { userId },
      create: {
        userId,
        strengths: record.strengths,
        weaknesses: record.weaknesses,
        recommendations: record.recommendations,
        summary: record.summary,
        analyzedAt: record.analyzedAt,
      },
      update: {
        strengths: record.strengths,
        weaknesses: record.weaknesses,
        recommendations: record.recommendations,
        summary: record.summary,
        analyzedAt: record.analyzedAt,
      },
    });
  }

  async createReadingExercisePlaceholder(data: {
    userId: string;
    language: string;
    difficulty: number;
    genre: string;
  }): Promise<string> {
    const exercise = await prisma.exercise.create({
      data: {
        title: '',
        code: '',
        language: data.language,
        difficulty: data.difficulty,
        genre: data.genre,
        status: 'GENERATING',
        learningGoals: [],
        createdById: data.userId,
        assignedToId: data.userId,
      },
    });
    return exercise.id;
  }

  async saveGeneratedExercise(exerciseId: string, generated: GeneratedExercise): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.exercise.update({
        where: { id: exerciseId },
        data: {
          title: generated.title,
          code: generated.code,
          learningGoals: generated.learningGoals,
          status: 'READY',
        },
      });

      await tx.exerciseReferenceAnswer.createMany({
        data: generated.questions.map((q, index) => ({
          exerciseId,
          questionIndex: index,
          questionText: q.questionText,
          idealAnswerPoints: q.idealAnswerPoints,
        })),
      });
    });
  }

  async markExerciseFailed(exerciseId: string): Promise<void> {
    await prisma.exercise.update({
      where: { id: exerciseId },
      data: { status: 'FAILED' },
    });
  }

  async createWritingChallengePlaceholder(data: {
    userId: string;
    language: string;
    difficulty: number;
  }): Promise<string> {
    const challenge = await prisma.writingChallenge.create({
      data: {
        title: '',
        description: '',
        language: data.language,
        difficulty: data.difficulty,
        status: 'GENERATING',
        createdById: data.userId,
        assignedToId: data.userId,
      },
    });
    return challenge.id;
  }

  async saveGeneratedWritingChallenge(
    challengeId: string,
    generated: WritingChallengeGenerated
  ): Promise<void> {
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
  }

  async markWritingChallengeFailed(challengeId: string): Promise<void> {
    await prisma.writingChallenge.update({
      where: { id: challengeId },
      data: { status: 'FAILED' },
    });
  }
}
