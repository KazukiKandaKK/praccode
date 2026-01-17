# PracCode - コードリーディング・トレーニング

ソフトウェアエンジニアのコーディングの力を伸ばすための **コードリーディング特化トレーニングプラットフォーム** です。
![PracCode demo](./docs/demo.gif)

## 対象ユーザー

**Webエンジニア経験2〜5年目くらい**を想定しています。実務でコードを書く経験はあるが、「他人のコードを読んで理解する力」を体系的に鍛えたい方向けです。

## 現状ステータス

- **状態**: Alpha（開発中）
- **想定用途**: 個人利用・学習目的
- **本番運用**: 未対応（開発・検証環境での利用を想定）

## 1セッションの流れ

1. **問題を選ぶ** - 言語・難易度・ジャンルから問題を選択
2. **コードを読む** - 提示された実務レベルのコードを読み解く
3. **自分の回答を書く** - 設問に対して自分の理解を記述
4. **AI評価を見る** - LLMが回答を評価し、スコアとフィードバックを提供
5. **弱点の観点を振り返る** - 責務理解・データフロー・エラーハンドリングなど観点別のスコアを確認

```
[問題選択] → [コード読解] → [回答記述] → [AI評価] → [フィードバック確認] → [ダッシュボードで振り返り]
```

## 特徴

- **実務レベルのコード教材**: TypeScript, Go, Ruby など実際の開発で使われるコードパターンを題材にした学習
- **AI フィードバック**: LLM（Ollama / Gemini）を活用した詳細なフィードバック（良い点・改善点を明確に）
- **スキル可視化**: 責務理解・データフロー・エラーハンドリングなど観点別にスキルを可視化
- **ヒント機能**: 答えを出しすぎない範囲でヒントを提供

## AIメンター機能

- **事前質問から学習計画を生成**: 学習目標や得意領域などを入力し、最適な学習計画を作成
- **学習結果のフィードバック**: 提出物の評価を保存し、強み・改善点・次のフォーカスを整理
- **学習の流れを継続**: 学習 → 提出 → 振り返り → 次の学習計画を繰り返して成長を支援
- **履歴の蓄積とサマリ**: メタデータ（評価スコア/指摘/テスト結果）を保存し、成長を可視化
- **スプリント運用**: 1週間単位で目標とフォーカスを管理し、週ごとの達成度を見える化

## アーキテクチャ

```
┌─────────────────┐
│   Next.js App   │  (フロントエンド)
│   (React)       │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐
│   Fastify API   │  (バックエンド)
│                 │
│  ┌──────────┐   │  domain / application / infrastructure / web(controller)
│  │  Prisma  │   │  (Clean Architecture ベース)
│  └────┬─────┘   │
└───────┼─────────┘
        │
        ▼
┌─────────────────┐
│   PostgreSQL    │  (データベース)
└─────────────────┘

        │
        ▼
┌─────────────────┐
│  LLM Provider   │  (Ollama / Gemini)
│  - 評価生成      │
│  - 問題生成      │
│  - コードレビュー │
└─────────────────┘
```

## 技術スタック

| 領域           | 技術                                         |
| -------------- | -------------------------------------------- |
| パッケージ管理 | pnpm + Turborepo                             |
| フロントエンド | Next.js 14 (App Router), React, Tailwind CSS |
| バックエンド   | Fastify                                      |
| ORM            | Prisma                                       |
| 認証           | NextAuth.js v5                               |
| LLM            | Ollama (ローカル) / Google Gemini API        |
| データベース   | PostgreSQL                                   |

## ディレクトリ構成

```
praccode/
├── apps/
│   ├── frontend/     # Next.js フロントエンド (App Router)
│   └── backend/      # Fastify バックエンド (Clean Architecture: domain/application/infrastructure/web)
├── packages/
│   └── shared/       # 共通型定義
├── docs/             # ドキュメント（デモ、設計メモ）
├── package.json      # pnpm workspace 設定
└── turbo.json        # Turborepo 設定
```

## クイックスタート

### 必要なもの

- Docker & Docker Compose
- LLMプロバイダー（Ollama または Google Gemini API Key）

### LLMプロバイダーの設定

#### Ollama（ローカルLLM）を使う場合

macでOllamaを起動し、Dockerコンテナから `host.docker.internal:11434` 経由で叩けるようにしています。

```bash
# 1) Ollama を起動（別ターミナル）
ollama serve

# 2) モデル取得（初回のみ）
./llm-tools/scripts/ollama_setup.sh qwen2.5-coder:14b

# 3) 疎通確認（DockerコンテナからホストOllamaへ）
docker compose -f docker-compose.dev.yml run --rm llm-tools
```

環境変数（オプション）:

- `LLM_PROVIDER=ollama`
- `OLLAMA_HOST=http://host.docker.internal:11434` (デフォルト)
- `OLLAMA_MODEL=qwen2.5-coder:14b` (デフォルト)

#### Gemini API Key を使う場合（推奨）

```bash
# 環境変数を設定
export LLM_PROVIDER=gemini
export GEMINI_AUTH_MODE=api_key
export GEMINI_API_KEY=your-gemini-api-key
export GEMINI_MODEL=gemini-2.5-flash-lite  # オプション（デフォルト: gemini-2.5-flash-lite）

# Docker Composeで起動
docker compose -f docker-compose.dev.yml up
```

環境変数:

- `LLM_PROVIDER=gemini` - Gemini APIを使用
- `GEMINI_AUTH_MODE=api_key` - API Key 方式（推奨）
- `GEMINI_API_KEY` - Gemini API Key（必須）
- `GEMINI_MODEL` - 使用するモデル（オプション、デフォルト: gemini-2.5-flash-lite）

#### Vertex AI (Gemini) を使う場合（任意）

```bash
export LLM_PROVIDER=gemini
export GEMINI_AUTH_MODE=vertex
export GOOGLE_CLOUD_PROJECT=your-gcp-project-id
export GOOGLE_CLOUD_LOCATION=us-central1
export GOOGLE_APPLICATION_CREDENTIALS_FILE=./secrets/gcp-sa.json
export GEMINI_MODEL=gemini-2.5-flash-lite
```

環境変数:

- `GEMINI_AUTH_MODE=vertex` - Vertex AI 方式
- `GOOGLE_CLOUD_PROJECT` - GCPプロジェクトID（必須）
- `GOOGLE_CLOUD_LOCATION` - Vertexリージョン（オプション、デフォルト: us-central1）
- `GOOGLE_APPLICATION_CREDENTIALS_FILE` - サービスアカウントJSON（必須）

#### レート制限の設定

LLM APIへの連続呼び出しを制限するため、レート制限機能が実装されています：

```bash
# レート制限の設定（オプション）
export LLM_RATE_LIMIT_WINDOW_MS=60000  # ウィンドウ時間（ミリ秒、デフォルト: 60秒）
export LLM_RATE_LIMIT_MAX_REQUESTS=10  # ウィンドウ内の最大リクエスト数（デフォルト: 10）
export LLM_RATE_LIMIT_MAX_RETRIES=3    # 429エラー時の最大リトライ回数（デフォルト: 3）
```

レート制限機能:

- スライディングウィンドウ方式で一定時間内のリクエスト数を制限
- 429エラー発生時はエクスポネンシャルバックオフでリトライ
- Retry-Afterヘッダーを尊重

### Agent OS（Playground）

Agent OS は Observe -> Plan -> Guard -> Act -> Verify -> Learn の安全なループを回す基盤です。
UI は `/agent-playground` から利用できます。

主なAPI:

```
POST /agent/runs
GET  /agent/runs/:id
POST /agent/runs/:id/continue
POST /agent/runs/:id/confirm
```

例（x-user-id 必須）:

```bash
curl -X POST http://localhost:3001/agent/runs \\
  -H 'Content-Type: application/json' \\
  -H 'x-user-id: <USER_ID>' \\
  -d '{\"mode\":\"mentor\",\"goal\":\"Explain the code structure\",\"inputJson\":{}}'
```

Agent OSの環境変数:

- `AGENT_STEP_LIMIT` (default: 12)
- `AGENT_PARALLEL_PLANS` (default: 3)
- `AGENT_GUARD_LLM` (default: false)
- `ENABLE_WEB_SEARCH` (default: false)

### Autopilot（自動学習コーチ）

Autopilot は提出評価完了などのイベントをトリガーに、Mastra Agent が
自動でフィードバック生成とメンターチャット投稿を実行する仕組みです。

主な流れ:
- Evaluate完了 → Outboxに積む
- WorkerがOutboxを処理 → AutopilotRunを記録
- Mastra Autopilot Agentがplan/actionsを生成
- allowlist toolで mentor feedback / mentor message を保存

手動トリガーAPI:
```
POST /autopilot/trigger
GET  /autopilot/runs
GET  /autopilot/runs/:id
```

手動トリガー例（x-user-id 必須）:
```bash
curl -X POST http://localhost:3001/autopilot/trigger \\
  -H 'Content-Type: application/json' \\
  -H 'x-user-id: <USER_ID>' \\
  -d '{\"triggerType\":\"submission_evaluated\",\"submissionId\":\"<SUBMISSION_ID>\"}'
```

Worker 起動:
```bash
pnpm --filter @praccode/api autopilot:worker
```

Autopilotの環境変数:
- `AUTOPILOT_WORKER_INTERVAL_MS` (default: 10000)
- `AUTOPILOT_WORKER_BATCH_SIZE` (default: 5)
- `AUTOPILOT_MAX_RETRIES` (default: 5)
- `AUTOPILOT_LEASE_MS` (default: 300000)

### セットアップ

```bash
# 1. リポジトリをクローン
git clone https://github.com/KazukiKandaKK/praccode.git
cd praccode

# 2. セットアップスクリプトを実行
chmod +x scripts/setup.sh
./scripts/setup.sh
```

これだけで開発環境が起動します！

### サンプルユーザー

| 種別         | メールアドレス    | パスワード |
| ------------ | ----------------- | ---------- |
| 一般ユーザー | user@example.com  | user       |
| 管理者       | admin@example.com | admin      |

### アクセス URL

- フロントエンド: http://localhost:3000
- API: http://localhost:3001

### 開発環境でのメール送信

開発環境では、メール送信機能は実際のメールサーバーを使用せず、**`apps/backend/tmp/mail/`** ディレクトリにHTMLファイルとして保存されます。

- メール確認リンク（ユーザー登録時）
- パスワードリセットリンク
- その他の通知メール

すべてのメールは `apps/backend/tmp/mail/` に保存され、ファイル名には送信日時（JST）が含まれます。メールの内容を確認するには、このディレクトリ内のHTMLファイルをブラウザで開いてください。

---

## 詳細セットアップ

### 環境変数の設定（オプション）

```bash
# 環境変数を設定
cp env.example .env
# .env ファイルを編集して LLMプロバイダーの設定を行う
# - Ollama使用時: LLM_PROVIDER=ollama（デフォルト）
# - Gemini API Key使用時: LLM_PROVIDER=gemini, GEMINI_AUTH_MODE=api_key, GEMINI_API_KEY=...
# - Vertex AI使用時: LLM_PROVIDER=gemini, GEMINI_AUTH_MODE=vertex, GOOGLE_CLOUD_PROJECT=..., GOOGLE_APPLICATION_CREDENTIALS_FILE=...

# 2. 開発サーバーを起動
make dev
# または
docker compose -f docker-compose.dev.yml up --build
```

**環境変数の設定場所について**:

- **Docker環境**: `docker-compose.dev.yml` の `environment` セクションで設定するか、ホストの `.env` ファイルを参照（`${VARIABLE_NAME:-default}`形式）
- **ローカル環境**: `apps/backend/.env` と `apps/frontend/.env.local` にそれぞれ設定が必要

### 方法2: ローカル環境で実行

#### 必要なもの（ローカル実行時）

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+

```bash
# 1. 依存関係のインストール
pnpm install

# 2. 環境変数の設定
# apps/backend/.env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/praccode?schema=public"
LLM_PROVIDER="gemini"  # または "ollama"
GEMINI_AUTH_MODE="api_key"
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash-lite"
OLLAMA_MODEL="qwen2.5-coder:14b"  # Ollama使用時
PORT=3001

# apps/frontend/.env.local
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
NEXT_PUBLIC_API_URL="http://localhost:3001"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/praccode?schema=public"

# 3. データベースのセットアップ
make db-setup
# または（推奨: migrate）
pnpm db:generate && pnpm db:migrate && pnpm db:seed
# db:push は補助的な同期手段（初期検証用途）として残しています

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

## テスト / Lint

### テストの実行

```bash
# バックエンド
pnpm --filter @praccode/api lint
pnpm --filter @praccode/api test

# フロントエンド
pnpm --filter @praccode/web lint
pnpm --filter @praccode/web test

# カバレッジ付き
pnpm --filter @praccode/api test --coverage
pnpm --filter @praccode/web test --coverage
```

※ 登録〜メール認証のE2Eは `DATABASE_URL` が設定されている場合のみ実行されます。

### テスト範囲

**現状カバーしている範囲**:

- ✅ LLMロジック（評価、問題生成、学習分析）
- ✅ ユーティリティ関数（境界値・エッジケース含む）
- ✅ APIエンドポイント（主要なルート）
- ✅ 登録〜メール認証のE2E（DBがあるときのみ）

**今後の課題**:

- ⏳ フロントエンドコンポーネントの統合テスト
- ⏳ エラーハンドリングの網羅的なテスト

## エラー処理・LLM失敗時の挙動

### LLM API エラー処理

- **API Key 未設定時**: エラーメッセージを返し、機能を無効化
- **タイムアウト時**: デフォルト60秒のタイムアウトを設定。タイムアウト時はエラーメッセージを返す
- **レート制限時**: HTTPステータスコードを確認し、適切なエラーメッセージを返す
- **LLM生成失敗時**: フォールバック処理を実装（例：学習分析では統計ベースの分析に切り替え）

### エラーハンドリングの方針

- ユーザーには分かりやすい日本語のエラーメッセージを表示
- 開発者向けには詳細なログを出力（`fastify.log`を使用）
- 非同期処理（問題生成など）では、失敗時にステータスを`FAILED`に更新

### レート制限と輻輳制御

**実装済みの機能**:

- ✅ スライディングウィンドウ方式のレート制限
- ✅ 429エラー時のエクスポネンシャルバックオフ
- ✅ Retry-Afterヘッダーの処理
- ✅ 環境変数による設定のカスタマイズ

**動作**:

1. すべてのLLM API呼び出しに自動的にレート制限が適用される
2. レート制限超過時は自動的に待機してから実行
3. 429エラー発生時は最大3回まで自動リトライ（待機時間: 1秒 → 2秒 → 4秒）

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

- [x] 認証（メール/パスワード）
- [x] 学習一覧・詳細表示
- [x] 回答入力 → LLM 評価
- [x] 評価結果の保存・表示
- [x] 簡易ダッシュボード（解いた数・平均スコア）

## 今後の予定

- [ ] 管理者向け学習登録機能
- [ ] 組織・チーム機能
- [ ] GitHub リポジトリからのコード取り込み
- [ ] より詳細な分析ダッシュボード
- [ ] E2Eテストの追加
- [ ] エラーハンドリングの強化

## ライセンス

Apache-2.0
