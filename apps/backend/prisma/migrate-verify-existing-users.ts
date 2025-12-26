/**
 * 既存ユーザーのメール認証を完了状態にするマイグレーションスクリプト
 * 実行方法: pnpm --filter @praccode/api tsx prisma/migrate-verify-existing-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('既存ユーザーのメール認証を完了状態に設定中...');

  // emailVerifiedがnullのユーザーを取得
  const users = await prisma.user.findMany({
    where: {
      emailVerified: null,
    },
  });

  console.log(`${users.length}人のユーザーが見つかりました`);

  // 各ユーザーのメール認証を完了状態に設定
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: user.createdAt, // 作成日時を認証日時として設定
      },
    });
    console.log(`ユーザー ${user.email} (${user.id}) のメール認証を完了状態にしました`);
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

