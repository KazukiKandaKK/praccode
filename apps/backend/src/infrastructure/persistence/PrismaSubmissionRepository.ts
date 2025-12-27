import {
  EvaluationTarget,
  ISubmissionRepository,
  SubmissionDetail,
  SubmissionListItem,
  SubmissionStatus,
} from '../../domain/ports/ISubmissionRepository';
import { Submission } from '../../domain/entities/Submission';
import { prisma } from '../../lib/prisma';

export class PrismaSubmissionRepository implements ISubmissionRepository {
  async findCompletedByUserId(userId: string): Promise<Submission[]> {
    const submissions = await prisma.submission.findMany({
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
    });

    // This casting is not ideal, but it's what the old code did.
    // A better solution would be to ensure the entity and prisma types are aligned.
    return submissions as Submission[];
  }

  async listByUser(
    userId: string,
    status: SubmissionStatus | undefined,
    pagination: { page: number; limit: number }
  ): Promise<{ submissions: SubmissionListItem[]; total: number }> {
    const where = {
      userId,
      ...(status && { status }),
    };

    const [submissions, total] = await Promise.all([
      prisma.submission.findMany({
        where,
        include: {
          exercise: {
            select: {
              id: true,
              title: true,
              language: true,
              difficulty: true,
              genre: true,
            },
          },
          answers: {
            select: {
              score: true,
              level: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      prisma.submission.count({ where }),
    ]);

    const mapped: SubmissionListItem[] = submissions.map((sub) => {
      const evaluatedAnswers = sub.answers.filter((a) => a.score !== null && a.level !== null);
      const avgScore =
        evaluatedAnswers.length > 0
          ? Math.round(
              evaluatedAnswers.reduce((sum, a) => sum + (a.score || 0), 0) / evaluatedAnswers.length
            )
          : null;
      const overallLevel =
        avgScore !== null
          ? avgScore >= 90
            ? 'A'
            : avgScore >= 70
              ? 'B'
              : avgScore >= 50
                ? 'C'
                : 'D'
          : null;

      return {
        id: sub.id,
        status: sub.status as SubmissionStatus,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
        exercise: sub.exercise,
        avgScore,
        overallLevel,
        answerCount: sub.answers.length,
      };
    });

    return { submissions: mapped, total };
  }

  async findById(id: string): Promise<SubmissionDetail | null> {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        answers: {
          orderBy: { questionIndex: 'asc' },
        },
        exercise: {
          include: {
            questions: {
              orderBy: { questionIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!submission) return null;

    return {
      id: submission.id,
      userId: submission.userId,
      status: submission.status as SubmissionStatus,
      answers: submission.answers.map((a) => ({
        id: a.id,
        questionIndex: a.questionIndex,
        answerText: a.answerText,
        score: a.score,
        level: a.level,
        llmFeedback: a.llmFeedback,
        aspects: (a.aspects as Record<string, number> | null) ?? null,
      })),
      exercise: {
        id: submission.exercise.id,
        title: submission.exercise.title,
        code: submission.exercise.code,
        questions: submission.exercise.questions.map((q) => ({
          questionIndex: q.questionIndex,
          questionText: q.questionText,
          idealAnswerPoints: q.idealAnswerPoints as string[],
        })),
      },
    };
  }

  async updateAnswers(
    submissionId: string,
    answers: Array<{ questionIndex: number; answerText: string }>
  ): Promise<void> {
    await Promise.all(
      answers.map((answer) =>
        prisma.submissionAnswer.updateMany({
          where: {
            submissionId,
            questionIndex: answer.questionIndex,
          },
          data: {
            answerText: answer.answerText,
          },
        })
      )
    );
  }

  async getEvaluationTarget(id: string): Promise<EvaluationTarget | null> {
    const submission = await prisma.submission.findUnique({
      where: { id },
      include: {
        answers: {
          orderBy: { questionIndex: 'asc' },
          select: {
            id: true,
            questionIndex: true,
            answerText: true,
          },
        },
        exercise: {
          select: {
            code: true,
            questions: {
              orderBy: { questionIndex: 'asc' },
              select: {
                questionIndex: true,
                questionText: true,
                idealAnswerPoints: true,
              },
            },
          },
        },
      },
    });

    if (!submission) return null;

    return {
      id: submission.id,
      userId: submission.userId,
      status: submission.status as SubmissionStatus,
      answers: submission.answers,
      exercise: {
        code: submission.exercise.code,
        questions: submission.exercise.questions.map((q) => ({
          questionIndex: q.questionIndex,
          questionText: q.questionText,
          idealAnswerPoints: q.idealAnswerPoints as string[],
        })),
      },
    };
  }

  async markStatus(id: string, status: SubmissionStatus): Promise<void> {
    await prisma.submission.update({
      where: { id },
      data: { status },
    });
  }

  async updateAnswerEvaluation(
    answerId: string,
    data: {
      score: number | null;
      level: string | null;
      llmFeedback: string | null;
      aspects: Record<string, number> | null;
    }
  ): Promise<void> {
    await prisma.submissionAnswer.update({
      where: { id: answerId },
      // Prisma Json field: ensure null falls back to empty object for compatibility
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { ...data, aspects: (data.aspects ?? {}) as any },
    });
  }
}
