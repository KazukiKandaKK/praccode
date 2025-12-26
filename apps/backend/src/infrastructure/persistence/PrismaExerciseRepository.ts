import { IExerciseRepository } from '../../../domain/ports/IExerciseRepository';
import { Exercise, ExerciseEntity } from '../../../domain/entities/Exercise';
import { prisma } from '../../../lib/prisma';

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
      exerciseData.questions.map(q => ({
        questionIndex: q.questionIndex,
        questionText: q.questionText,
      }))
    );
  }
}
