import { prisma } from '../../lib/prisma';
import {
  IMentorAssessmentRepository,
  MentorAssessmentTask,
  MentorAssessmentTaskStatus,
} from '../../domain/ports/IMentorAssessmentRepository';

type ReadingSubmission = {
  exerciseId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'EVALUATED';
  updatedAt: Date;
};

type WritingSubmission = {
  challengeId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  createdAt: Date;
};

export class PrismaMentorAssessmentRepository implements IMentorAssessmentRepository {
  async listTasks(userId: string): Promise<MentorAssessmentTask[]> {
    const [readingTasks, writingTasks] = await Promise.all([
      prisma.exercise.findMany({
        where: {
          assignedToId: userId,
          isAssessment: true,
          status: 'READY',
        },
        select: {
          id: true,
          title: true,
          language: true,
          difficulty: true,
          genre: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.writingChallenge.findMany({
        where: {
          assignedToId: userId,
          isAssessment: true,
          status: 'READY',
        },
        select: {
          id: true,
          title: true,
          language: true,
          difficulty: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const readingIds = readingTasks.map((task) => task.id);
    const writingIds = writingTasks.map((task) => task.id);

    const [readingSubmissions, writingSubmissions] = await Promise.all([
      readingIds.length > 0
        ? prisma.submission.findMany({
            where: {
              userId,
              exerciseId: { in: readingIds },
            },
            select: {
              exerciseId: true,
              status: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: 'desc' },
          })
        : Promise.resolve([] as ReadingSubmission[]),
      writingIds.length > 0
        ? prisma.writingSubmission.findMany({
            where: {
              userId,
              challengeId: { in: writingIds },
            },
            select: {
              challengeId: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as WritingSubmission[]),
    ]);

    const readingStatusByExercise = new Map<string, MentorAssessmentTaskStatus>();
    for (const submission of readingSubmissions) {
      if (readingStatusByExercise.has(submission.exerciseId)) continue;
      readingStatusByExercise.set(
        submission.exerciseId,
        resolveReadingStatus(submission.status)
      );
    }

    const writingStatusByChallenge = new Map<string, MentorAssessmentTaskStatus>();
    for (const submission of writingSubmissions) {
      if (writingStatusByChallenge.has(submission.challengeId)) continue;
      writingStatusByChallenge.set(
        submission.challengeId,
        resolveWritingStatus(submission.status)
      );
    }

    const reading = readingTasks.map((task) => ({
      id: task.id,
      type: 'reading' as const,
      title: task.title,
      language: task.language,
      difficulty: task.difficulty,
      genre: task.genre,
      status: readingStatusByExercise.get(task.id) ?? 'NOT_STARTED',
    }));

    const writing = writingTasks.map((task) => ({
      id: task.id,
      type: 'writing' as const,
      title: task.title,
      language: task.language,
      difficulty: task.difficulty,
      status: writingStatusByChallenge.get(task.id) ?? 'NOT_STARTED',
    }));

    return [...reading, ...writing];
  }
}

function resolveReadingStatus(
  status: ReadingSubmission['status']
): MentorAssessmentTaskStatus {
  switch (status) {
    case 'EVALUATED':
      return 'COMPLETED';
    case 'SUBMITTED':
    case 'DRAFT':
      return 'IN_PROGRESS';
    default:
      return 'NOT_STARTED';
  }
}

function resolveWritingStatus(
  status: WritingSubmission['status']
): MentorAssessmentTaskStatus {
  switch (status) {
    case 'COMPLETED':
      return 'COMPLETED';
    case 'ERROR':
      return 'FAILED';
    case 'PENDING':
    case 'RUNNING':
      return 'IN_PROGRESS';
    default:
      return 'NOT_STARTED';
  }
}
