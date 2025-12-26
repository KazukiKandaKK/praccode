import { IWritingChallengeRepository } from '../../domain/ports/IWritingChallengeRepository';
import { WritingChallenge } from '../../domain/entities/WritingChallenge';
import { prisma } from '../../lib/prisma';
import { WritingChallengeGenerateInput } from '../../domain/ports/IWritingChallengeGenerator';

export class PrismaWritingChallengeRepository implements IWritingChallengeRepository {
  async findAssignedReady(userId: string): Promise<WritingChallenge[]> {
    const challenges = await prisma.writingChallenge.findMany({
      where: { status: 'READY', assignedToId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        language: true,
        difficulty: true,
        status: true,
        testCode: true,
        starterCode: true,
        sampleCode: true,
        assignedToId: true,
      },
    });
    return challenges as WritingChallenge[];
  }

  async findAssignedById(id: string, userId: string): Promise<WritingChallenge | null> {
    const challenge = await prisma.writingChallenge.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        language: true,
        difficulty: true,
        status: true,
        testCode: true,
        starterCode: true,
        sampleCode: true,
        assignedToId: true,
      },
    });
    if (!challenge || challenge.assignedToId !== userId) return null;
    return challenge as WritingChallenge;
  }

  async createChallenge(data: {
    title: string;
    description: string;
    language: WritingChallenge['language'];
    difficulty: number;
    testCode: string;
    sampleCode?: string | null;
  }): Promise<WritingChallenge> {
    const challenge = await prisma.writingChallenge.create({
      data: {
        title: data.title,
        description: data.description,
        language: data.language,
        difficulty: data.difficulty,
        testCode: data.testCode,
        sampleCode: data.sampleCode,
        status: 'READY',
      },
      select: {
        id: true,
        title: true,
        description: true,
        language: true,
        difficulty: true,
        status: true,
        testCode: true,
        starterCode: true,
        sampleCode: true,
        assignedToId: true,
      },
    });
    return challenge as WritingChallenge;
  }

  async createGenerating(
    userId: string,
    language: WritingChallenge['language'],
    difficulty: number
  ): Promise<WritingChallenge> {
    const challenge = await prisma.writingChallenge.create({
      data: {
        title: '',
        description: '',
        language,
        difficulty,
        testCode: '',
        status: 'GENERATING',
        createdById: userId,
        assignedToId: userId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        language: true,
        difficulty: true,
        status: true,
        testCode: true,
        starterCode: true,
        sampleCode: true,
        assignedToId: true,
      },
    });
    return challenge as WritingChallenge;
  }

  async updateGenerated(
    challengeId: string,
    generated: WritingChallengeGenerateInput & {
      title: string;
      description: string;
      testCode: string;
      starterCode?: string | null;
      sampleCode?: string | null;
    }
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

  async markFailed(challengeId: string): Promise<void> {
    await prisma.writingChallenge.update({
      where: { id: challengeId },
      data: { status: 'FAILED' },
    });
  }
}
