#!/bin/bash
set -e

echo "データベースの初期化を開始します..."

# Dockerコンテナが起動するまで待機
echo "PostgreSQL コンテナを起動中..."
docker compose -f docker-compose.dev.yml up -d db

echo "データベースの起動を待機中..."
until docker compose -f docker-compose.dev.yml exec -T db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "PostgreSQL が起動しました"

# Prisma の生成とマイグレーション
echo "Prisma クライアントを生成中..."
cd apps/api
pnpm db:generate

echo "データベーススキーマを適用中..."
pnpm db:migrate

echo "シードデータを投入中..."
pnpm db:seed

echo ""
echo "データベースの初期化が完了しました！"
echo ""
echo "次のステップ:"
echo "  make dev     # Docker で開発サーバーを起動"
echo "  または"
echo "  make dev-local  # ローカルで開発サーバーを起動"




