import {
  ExerciseFilter,
  IExerciseRepository,
  Pagination,
} from '../../domain/ports/IExerciseRepository';
import { Exercise, ExerciseEntity } from '../../domain/entities/Exercise';
import { prisma } from '../../lib/prisma';

export class PrismaExerciseRepository implements IExerciseRepository {
  async findById(id: string): Promise<Exercise | null> {
    const exerciseData = await prisma.exercise.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { questionIndex: 'asc' },
        },
      },
    });

    if (!exerciseData) {
      return null;
    }

    return new ExerciseEntity(
      exerciseData.id,
      exerciseData.code,
      exerciseData.learningGoals as string[],
      exerciseData.questions.map((q) => ({
        questionIndex: q.questionIndex,
        questionText: q.questionText,
      }))
    );
  }

  async find(filter: ExerciseFilter, pagination: Pagination): Promise<Exercise[]> {
    const where = this.buildWhereClause(filter);
    const exercisesData = await prisma.exercise.findMany({
      where,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    });

    return exercisesData.map(
      (data) => new ExerciseEntity(data.id, data.code, data.learningGoals as string[], [])
    ); // Assuming questions are not needed for list view
  }

  async count(filter: ExerciseFilter): Promise<number> {
    const where = this.buildWhereClause(filter);
    return prisma.exercise.count({ where });
  }

  async countAll(): Promise<number> {
    return prisma.exercise.count();
  }

  private buildWhereClause(filter: ExerciseFilter) {
    return {
      assignedToId: filter.userId,
      ...(filter.language && { language: filter.language }),
      ...(filter.difficulty && { difficulty: filter.difficulty }),
      ...(filter.genre && { genre: filter.genre }),
      status: 'READY' as const,
    };
  }
}
