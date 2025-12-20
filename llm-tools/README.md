# LLM Tools

このディレクトリには、ローカルの LLM 環境（Ollama）をセットアップしたり、疎通確認したりするためのユーティリティ（スクリプトや設定）を置いています。開発時に使う想定で、アプリ本体の実行時（runtime）には関与しません。

## Scripts

- **`scripts/ollama_setup.sh`**: 必要な LLM モデルを、ローカルの Ollama にダウンロードします。ホストマシン側で実行してください。
- **`scripts/smoke_test.sh`**: Docker 環境の中からホストの Ollama サーバーへ接続できるかを確認するスモークテストです。`docker-compose.dev.yml` の `llm-tools` サービスから実行されます。

## Usage

### Ollama のモデルをセットアップする

デフォルトのモデルを落とすには、プロジェクトルートでホストマシンから次を実行します。

```bash
./llm-tools/scripts/ollama_setup.sh
````

### スモークテストを流す

Docker コンテナがホストの Ollama サーバーと通信できるか確認するには、プロジェクトルートで次を実行します。

```bash
docker compose -f docker-compose.dev.yml run --rm llm-tools
```

`llm-tools` サービスをビルドして起動し、その中で `smoke_test.sh` が実行されます。
