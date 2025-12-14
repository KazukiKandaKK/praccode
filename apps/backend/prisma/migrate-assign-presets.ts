import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('既存ユーザーにプリセットデータを割り当て中...');

  // プリセットデータのID
  const presetExerciseIds = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
  ];
  const presetWritingChallengeIds = [
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000004',
  ];

  // メール認証済みのユーザーを取得
  const users = await prisma.user.findMany({
    where: {
      emailVerified: { not: null },
    },
  });

  console.log(`${users.length}人のユーザーが見つかりました`);

  for (const user of users) {
    // 既に割り当てられているデータ数を確認
    const existingExerciseCount = await prisma.exercise.count({
      where: { assignedToId: user.id },
    });
    const existingWritingChallengeCount = await prisma.writingChallenge.count({
      where: { assignedToId: user.id },
    });

    // 既にデータが割り当てられている場合はスキップ
    if (existingExerciseCount > 0 && existingWritingChallengeCount > 0) {
      console.log(
        `ユーザー ${user.email} には既にデータが割り当てられています（exercises: ${existingExerciseCount}, writing_challenges: ${existingWritingChallengeCount}）`
      );
      continue;
    }

    console.log(`ユーザー ${user.email} (${user.name}) にプリセットデータを割り当て中...`);

    // コードリーディングのプリセットをコピーして割り当て
    for (const presetId of presetExerciseIds) {
      const preset = await prisma.exercise.findUnique({
        where: { id: presetId },
        include: { questions: true },
      });

      if (preset) {
        // 既にこのユーザーに同じプリセットが割り当てられているか確認
        const existing = await prisma.exercise.findFirst({
          where: {
            assignedToId: user.id,
            title: preset.title,
            language: preset.language,
          },
        });

        if (!existing) {
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
              assignedToId: user.id,
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
    }

    // コードライティングのプリセットをコピーして割り当て
    for (const presetId of presetWritingChallengeIds) {
      const preset = await prisma.writingChallenge.findUnique({
        where: { id: presetId },
      });

      if (preset) {
        // 既にこのユーザーに同じプリセットが割り当てられているか確認
        const existing = await prisma.writingChallenge.findFirst({
          where: {
            assignedToId: user.id,
            title: preset.title,
            language: preset.language,
          },
        });

        if (!existing) {
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
              assignedToId: user.id,
            },
          });
        }
      }
    }

    console.log(`ユーザー ${user.email} への割り当てが完了しました`);
  }

  console.log('マイグレーション完了！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
