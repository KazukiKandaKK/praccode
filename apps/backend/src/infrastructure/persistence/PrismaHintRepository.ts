import { IHintRepository } from '../../domain/ports/IHintRepository';
import { Hint } from '../../domain/entities/Hint';
import { prisma } from '../../lib/prisma';

export class PrismaHintRepository implements IHintRepository {
  async save(hint: Hint): Promise<void> {
    await prisma.hint.create({
      data: {
        exerciseId: hint.exerciseId,
        userId: hint.userId,
        questionIndex: hint.questionIndex,
        hintText: hint.hintText,
      },
    });
  }
}
