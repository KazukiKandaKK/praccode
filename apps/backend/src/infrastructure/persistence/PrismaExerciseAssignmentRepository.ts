import { Prisma, prisma } from '../../lib/prisma';
import {
  IExerciseAssignmentRepository,
  OwnedExerciseSummary,
} from '../../domain/ports/IExerciseAssignmentRepository';

export class PrismaExerciseAssignmentRepository implements IExerciseAssignmentRepository {
  async findOwnedReadyExercises(createdById: string): Promise<OwnedExerciseSummary[]> {
    const exercises = await prisma.exercise.findMany({
      where: { createdById, status: 'READY' },
      select: { id: true, title: true, language: true, difficulty: true, genre: true },
      orderBy: { createdAt: 'desc' },
    });
    return exercises;
  }

  async isOwnedExercise(exerciseId: string, createdById: string): Promise<boolean> {
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      select: { createdById: true },
    });
    return exercise?.createdById === createdById;
  }

  async copyExerciseToUsers(exerciseId: string, userIds: string[]): Promise<Record<string, string>> {
    const preset = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { questions: true },
    });
    if (!preset) return {};

    const result: Record<string, string> = {};
    for (const userId of userIds) {
      const created = await prisma.exercise.create({
        data: {
          title: preset.title,
          language: preset.language,
          difficulty: preset.difficulty,
          genre: preset.genre,
          status: preset.status,
          sourceType: preset.sourceType,
          sourceUrl: preset.sourceUrl,
          code: preset.code,
          learningGoals: preset.learningGoals as unknown as Prisma.InputJsonValue,
          createdById: preset.createdById,
          assignedToId: userId,
          isAssessment: false,
          questions: {
            create: preset.questions.map((q) => ({
              questionIndex: q.questionIndex,
              questionText: q.questionText,
              idealAnswerPoints: q.idealAnswerPoints as unknown as Prisma.InputJsonValue,
            })),
          },
        },
      });
      result[userId] = created.id;
    }
    return result;
  }
}
