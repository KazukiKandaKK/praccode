# PracCode - コードリーディング・トレーニング SaaS

実務コードが読めるエンジニアを増やすための **コードリーディング特化トレーニングプラットフォーム** です。

## 特徴

- 📖 **実務レベルのコード教材**: TypeScript, Go, Ruby など実際の開発で使われるコードパターンを題材にした学習
- 🤖 **AI フィードバック**: OpenAI を活用した詳細なフィードバック（良い点・改善点を明確に）
- 📊 **スキル可視化**: 責務理解・データフロー・エラーハンドリングなど観点別にスキルを可視化
- 💡 **ヒント機能**: 答えを出しすぎない範囲でヒントを提供

## 技術スタック

| 領域 | 技術 |
|------|------|
| パッケージ管理 | pnpm + Turborepo |
| フロントエンド | Next.js 14 (App Router), React, Tailwind CSS |
| バックエンド | Fastify |
| ORM | Prisma |
| 認証 | NextAuth.js v5 |
| LLM | OpenAI (GPT-4o-mini) |
| データベース | PostgreSQL |

## ディレクトリ構成

```
praccode/
├── apps/
│   ├── web/          # Next.js フロントエンド
│   └── api/          # Fastify バックエンド
├── packages/
│   └── shared/       # 共通型定義
├── package.json      # pnpm workspace 設定
└── turbo.json        # Turborepo 設定
```

## クイックスタート

### 必要なもの

- Docker & Docker Compose
- OpenAI API Key (オプション: AI評価機能に必要)

### ローカルLLM（Ollama）を使う場合

macでOllamaを起動し、Dockerコンテナから `host.docker.internal:11434` 経由で叩けるようにしています。

```bash
# 1) Ollama を起動（別ターミナル）
ollama serve

# 2) モデル取得（初回のみ）
./llm/scripts/ollama_setup.sh qwen2.5-coder:7b

# 3) 疎通確認（DockerコンテナからホストOllamaへ）
docker compose -f docker-compose.dev.yml run --rm llm
```

### セットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/your-org/praccode.git
cd praccode

# 2. セットアップスクリプトを実行
chmod +x scripts/setup.sh
./scripts/setup.sh
```

これだけで開発環境が起動します！

### サンプルユーザー

| 種別 | メールアドレス | パスワード |
|------|---------------|-----------|
| 一般ユーザー | user@example.com | user |
| 管理者 | admin@example.com | admin |

### アクセス URL

- フロントエンド: http://localhost:3000
- API: http://localhost:3001

---

## 詳細セットアップ

### 環境変数の設定（オプション）

```bash
# 環境変数を設定（AI評価機能を使う場合）
cp env.example .env
# .env ファイルを編集して OPENAI_API_KEY を設定

# 2. 開発サーバーを起動
make dev
# または
docker compose -f docker-compose.dev.yml up --build
```

### 方法2: ローカル環境で実行

#### 必要なもの（ローカル実行時）

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

```bash
# 1. 依存関係のインストール
pnpm install

# 2. 環境変数の設定
# apps/api/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/praccode?schema=public"
OPENAI_API_KEY="sk-..."
PORT=3001

# apps/web/.env.local
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
NEXT_PUBLIC_API_URL="http://localhost:3001"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/praccode?schema=public"

# 3. データベースのセットアップ
make db-setup
# または
pnpm db:generate && pnpm db:push && pnpm db:seed

# 4. 開発サーバーの起動
pnpm dev
```

### アクセス

- フロントエンド: http://localhost:3000
- API: http://localhost:3001

## Docker コマンド

```bash
make help       # 使用可能なコマンド一覧
make dev        # 開発サーバー起動 (Docker)
make stop       # コンテナ停止
make logs       # ログ表示
make db-studio  # Prisma Studio 起動
make clean      # クリーンアップ
```

## API エンドポイント

### 学習

- `GET /exercises` - 一覧取得
- `GET /exercises/:id` - 詳細取得
- `POST /exercises/:id/submissions` - 解答作成

### サブミッション

- `GET /submissions/:id` - 詳細取得
- `PUT /submissions/:id/answers` - 解答保存
- `POST /submissions/:id/evaluate` - LLM 評価実行

### 進捗

- `GET /me/progress` - ユーザー進捗取得

### ヒント

- `POST /hints` - ヒント生成

## MVP スコープ

- [x] 認証（GitHub OAuth + メール/パスワード）
- [x] 学習一覧・詳細表示
- [x] 回答入力 → LLM 評価
- [x] 評価結果の保存・表示
- [x] 簡易ダッシュボード（解いた数・平均スコア）

## 今後の予定

- [ ] 管理者向け学習登録機能
- [ ] 組織・チーム機能
- [ ] GitHub リポジトリからのコード取り込み
- [ ] より詳細な分析ダッシュボード

## ライセンス

Apache-2.0

