import { Prisma, prisma } from '../../lib/prisma';
import { IInitialAssignmentService } from '../../domain/ports/IInitialAssignmentService';

export class InitialAssignmentService implements IInitialAssignmentService {
  private presetExerciseIds = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
  ];

  private presetWritingChallengeIds = [
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
  ];

  async assignPresetsToUser(userId: string): Promise<void> {
    await this.copyPresetExercises(userId);
    await this.copyPresetWritingChallenges(userId);
  }

  private async copyPresetExercises(userId: string) {
    for (const presetId of this.presetExerciseIds) {
      const preset = await prisma.exercise.findUnique({
        where: { id: presetId },
        include: { questions: true },
      });

      if (!preset) continue;

      await prisma.exercise.create({
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
          questions: {
            create: preset.questions.map((q) => ({
              questionIndex: q.questionIndex,
              questionText: q.questionText,
              idealAnswerPoints: q.idealAnswerPoints as unknown as Prisma.InputJsonValue,
            })),
          },
        },
      });
    }
  }

  private async copyPresetWritingChallenges(userId: string) {
    for (const presetId of this.presetWritingChallengeIds) {
      const preset = await prisma.writingChallenge.findUnique({
        where: { id: presetId },
      });

      if (!preset) continue;

      await prisma.writingChallenge.create({
        data: {
          title: preset.title,
          description: preset.description,
          language: preset.language,
          difficulty: preset.difficulty,
          status: preset.status,
          testCode: preset.testCode,
          starterCode: preset.starterCode,
          sampleCode: preset.sampleCode,
          createdById: preset.createdById,
          assignedToId: userId,
        },
      });
    }
  }
}
