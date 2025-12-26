import { ISubmissionRepository } from '../../../domain/ports/ISubmissionRepository';
import { Submission } from '../../../domain/entities/Submission';
import { prisma } from '../../../lib/prisma';

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
}
