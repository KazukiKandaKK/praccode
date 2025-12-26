/**
 * 既存の問題データに対してassignedToIdを設定するマイグレーションスクリプト
 * 実行方法: pnpm --filter @praccode/api tsx prisma/migrate-assign-exercises.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('既存の問題データにassignedToIdを設定中...');

  // assignedToIdがnullの問題を取得
  const exercises = await prisma.exercise.findMany({
    where: {
      assignedToId: null,
    },
  });

  console.log(`${exercises.length}件の問題が見つかりました`);

  // 各問題をcreatedByIdに割り当て
  for (const exercise of exercises) {
    await prisma.exercise.update({
      where: { id: exercise.id },
      data: {
        assignedToId: exercise.createdById,
      },
    });
    console.log(
      `問題 "${exercise.title}" (${exercise.id}) をユーザー ${exercise.createdById} に割り当てました`
    );
  }

  console.log('マイグレーション完了！');
}

main()
  .catch((e) => {
    console.error('エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
