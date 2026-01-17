#!/bin/bash
set -e

# Define colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           PracCode 開発環境セットアップ                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 現在のディレクトリがプロジェクトルートか確認
if [ ! -f "package.json" ] || [ ! -d "apps" ]; then
    echo -e "${RED}エラー: プロジェクトルートディレクトリで実行してください${NC}"
    exit 1
fi

# Dockerが起動しているか確認
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}エラー: Docker が起動していません。Docker Desktop を起動してください${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/5]${NC} Docker コンテナを起動中..."
docker compose -f docker-compose.dev.yml up -d db

echo -e "${YELLOW}[2/5]${NC} データベースの起動を待機中..."
until docker compose -f docker-compose.dev.yml exec -T db pg_isready -U postgres > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}✓ PostgreSQL が起動しました${NC}"

# Backend コンテナを起動
echo -e "${YELLOW}[3/5]${NC} Backend コンテナを起動中..."
docker compose -f docker-compose.dev.yml up -d backend
sleep 5

# Prisma マイグレーションとシードデータ投入
echo -e "${YELLOW}[4/5]${NC} データベースをセットアップ中..."
docker compose -f docker-compose.dev.yml exec -T backend sh -c "cd /app/apps/backend && pnpm db:migrate" || {
    echo -e "${RED}db:migrate に失敗しました。再試行中...${NC}"
    sleep 3
    docker compose -f docker-compose.dev.yml exec -T backend sh -c "cd /app/apps/backend && pnpm db:migrate"
}

echo -e "${YELLOW}[5/5]${NC} サンプルデータとメタデータを投入中..."
docker compose -f docker-compose.dev.yml exec -T backend sh -c "cd /app/apps/backend && pnpm db:seed"

# Frontend コンテナを起動
echo -e "${CYAN}Frontend コンテナを起動中...${NC}"
docker compose -f docker-compose.dev.yml up -d frontend

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           セットアップ完了！                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}アクセス URL:${NC}"
echo -e "  フロントエンド: ${GREEN}http://localhost:3000${NC}"
echo -e "  API:            ${GREEN}http://localhost:3001${NC}"
echo ""
echo -e "${CYAN}サンプルユーザー:${NC}"
echo -e "  メールアドレス: ${GREEN}user@example.com${NC}"
echo -e "  パスワード:     ${GREEN}user${NC}"
echo ""
echo -e "${YELLOW}ヒント:${NC}"
echo -e "  - ログを見る: ${CYAN}docker compose -f docker-compose.dev.yml logs -f${NC}"
echo -e "  - 停止する:   ${CYAN}docker compose -f docker-compose.dev.yml down${NC}"
echo ""

echo -e "${CYAN}ローカルLLM（Ollama）を使う場合（任意）:${NC}"
echo -e "  1) mac側でOllamaを起動（別ターミナル）:"
echo -e "     ${CYAN}ollama serve${NC}"
echo -e "  2) モデル取得（初回のみ）:"
echo -e "     ${CYAN}./llm/scripts/ollama_setup.sh qwen2.5-coder:14b${NC}"
echo -e "  3) Dockerから疎通確認:"
echo -e "     ${CYAN}docker compose -f docker-compose.dev.yml run --rm llm${NC}"
echo ""
