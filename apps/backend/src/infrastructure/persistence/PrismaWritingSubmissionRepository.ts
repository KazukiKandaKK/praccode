import { prisma } from '../../lib/prisma';
import { IWritingSubmissionRepository } from '../../domain/ports/IWritingSubmissionRepository';
import { WritingSubmission } from '../../domain/entities/WritingSubmission';

export class PrismaWritingSubmissionRepository implements IWritingSubmissionRepository {
  async createSubmission(data: {
    challengeId: string;
    userId: string;
    language: string;
    code: string;
  }): Promise<{ id: string; userId: string; challengeId: string }> {
    const submission = await prisma.writingSubmission.create({
      data: {
        challengeId: data.challengeId,
        userId: data.userId,
        language: data.language,
        code: data.code,
        status: 'PENDING',
      },
      select: { id: true, userId: true, challengeId: true },
    });
    return submission;
  }

  async findById(id: string): Promise<WritingSubmission | null> {
    const submission = await prisma.writingSubmission.findUnique({
      where: { id },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            language: true,
            description: true,
            testCode: true,
          },
        },
      },
    });
    return submission as unknown as WritingSubmission | null;
  }

  async findByUser(userId: string): Promise<WritingSubmission[]> {
    const submissions = await prisma.writingSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        challenge: {
          select: {
            id: true,
            title: true,
            language: true,
            difficulty: true,
          },
        },
      },
    });
    return submissions as unknown as WritingSubmission[];
  }

  async markRunning(id: string): Promise<void> {
    await prisma.writingSubmission.update({
      where: { id },
      data: { status: 'RUNNING' },
    });
  }

  async updateExecutionResult(
    id: string,
    data: { stdout: string | null; stderr: string | null; exitCode: number; passed: boolean }
  ): Promise<{ userId: string }> {
    const updated = await prisma.writingSubmission.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        stdout: data.stdout,
        stderr: data.stderr,
        exitCode: data.exitCode,
        passed: data.passed,
        executedAt: new Date(),
      },
      select: { userId: true },
    });
    return updated;
  }

  async markError(id: string, errorMessage: string): Promise<void> {
    await prisma.writingSubmission.update({
      where: { id },
      data: {
        status: 'ERROR',
        stderr: errorMessage,
        passed: false,
        executedAt: new Date(),
      },
    });
  }

  async markFeedbackGenerating(id: string): Promise<void> {
    await prisma.writingSubmission.update({
      where: { id },
      data: { llmFeedbackStatus: 'GENERATING' },
    });
  }

  async updateFeedback(id: string, feedback: string): Promise<void> {
    await prisma.writingSubmission.update({
      where: { id },
      data: {
        llmFeedback: feedback,
        llmFeedbackStatus: 'COMPLETED',
        llmFeedbackAt: new Date(),
      },
    });
  }

  async markFeedbackFailed(id: string): Promise<void> {
    await prisma.writingSubmission.update({
      where: { id },
      data: { llmFeedbackStatus: 'FAILED' },
    });
  }
}
