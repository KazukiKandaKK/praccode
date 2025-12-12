.PHONY: help setup install dev build start stop logs db-setup db-seed clean

# デフォルトターゲット
help:
	@echo "PracCode - コードリーディング・トレーニング SaaS"
	@echo ""
	@echo "使用可能なコマンド:"
	@echo "  make setup       - 開発環境をセットアップ（推奨）"
	@echo "  make install     - 依存関係をインストール"
	@echo "  make dev         - 開発サーバーを起動 (Docker)"
	@echo "  make dev-local   - ローカル開発サーバーを起動"
	@echo "  make build       - プロダクションビルド"
	@echo "  make start       - プロダクション起動"
	@echo "  make stop        - コンテナを停止"
	@echo "  make logs        - ログを表示"
	@echo "  make db-setup    - データベースをセットアップ"
	@echo "  make db-seed     - シードデータを投入"
	@echo "  make db-studio   - Prisma Studio を起動"
	@echo "  make clean       - ビルド成果物を削除"

# 開発環境セットアップ（初回用）
setup:
	@chmod +x scripts/setup.sh
	@./scripts/setup.sh

# 依存関係のインストール
install:
	pnpm install

# 開発サーバー起動 (Docker)
dev:
	docker compose -f docker-compose.dev.yml up --build

# 開発サーバー起動 (ローカル)
dev-local:
	pnpm dev

# プロダクションビルド
build:
	docker compose build

# プロダクション起動
start:
	docker compose up -d

# コンテナ停止
stop:
	docker compose down

# ログ表示
logs:
	docker compose logs -f

# データベースセットアップ
db-setup:
	docker compose -f docker-compose.dev.yml up -d db
	sleep 3
	cd apps/api && pnpm db:generate && pnpm db:push

# シードデータ投入
db-seed:
	cd apps/api && pnpm db:seed

# Prisma Studio
db-studio:
	cd apps/api && pnpm prisma studio

# クリーンアップ
clean:
	rm -rf node_modules
	rm -rf apps/web/.next
	rm -rf apps/web/node_modules
	rm -rf apps/api/dist
	rm -rf apps/api/node_modules
	rm -rf packages/shared/node_modules
	docker compose down -v

