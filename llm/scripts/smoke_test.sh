#!/usr/bin/env bash
set -euo pipefail

HOST="${OLLAMA_HOST:-http://host.docker.internal:11434}"
MODEL="${OLLAMA_MODEL:-qwen2.5-coder:14b}"
PROMPT="${OLLAMA_PROMPT:-次のTypeScriptコードの責務を1文で説明して: export function add(a:number,b:number){return a+b}}"

echo "Ollama smoke test"
echo "  host : ${HOST}"
echo "  model: ${MODEL}"

# health check
if ! curl -fsS "${HOST}/api/tags" >/dev/null; then
  echo "ERROR: Ollama に接続できません: ${HOST}"
  echo "mac側で `ollama serve` が起動しているか確認してください。"
  exit 1
fi

echo "モデルが存在するか確認..."
if ! curl -fsS "${HOST}/api/tags" | jq -e --arg m "${MODEL}" '.models[]? | select(.name==$m)' >/dev/null; then
  echo "ERROR: モデルが見つかりません: ${MODEL}"
  echo "mac側で以下を実行してください:"
  echo "  ollama pull ${MODEL}"
  exit 1
fi

echo "生成テスト..."
curl -fsS "${HOST}/api/generate" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg model "${MODEL}" --arg prompt "${PROMPT}" '{model:$model,prompt:$prompt,stream:false}')" \
  | jq -r '.response'

echo "OK"


