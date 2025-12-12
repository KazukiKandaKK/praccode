#!/usr/bin/env bash
set -euo pipefail

MODEL="${1:-qwen2.5-coder:7b}"

if ! command -v ollama >/dev/null 2>&1; then
  echo "ollama が見つかりません。mac側で Ollama をインストールしてください。"
  echo "例: brew install ollama"
  exit 1
fi

echo "Ollama の起動確認..."
if ! ollama list >/dev/null 2>&1; then
  echo "ollama が起動していない可能性があります。別ターミナルで以下を実行してください:"
  echo "  ollama serve"
  exit 1
fi

echo "モデルを取得します: ${MODEL}"
ollama pull "${MODEL}"

echo "OK: ollama pull 完了"


