# Autopilot Agent（自動学習コーチ）

## トリガー
- SubmissionEvaluated（提出評価完了）

※ 週次/停滞は拡張予定（現在は骨格のみ）

## 全体フロー
1) EvaluateSubmissionUseCase が評価完了後に Outbox へ enqueue
2) Worker が Outbox を lease（重複防止）
3) AutopilotRun を queued → running に更新
4) Mastra Autopilot Agent が plan/actions/final を JSON 生成
5) Allowlist tools を実行して mentor feedback / mentor chat を保存
6) AutopilotRun を completed/failed に更新
7) Outbox を processed or retry

## dedupKey 方針
- SubmissionEvaluated:{submissionId}
- 同一 dedupKey は UNIQUE 制約で二重 enqueue を防止

## 失敗時のリトライ
- errorCount をインクリメントし、指数バックオフで nextRetryAt を設定
- 最大回数超過時は processedAt を付与して打ち切り（lastError は保持）

## 開発時の動かし方
1) submission を evaluate して Outbox が積まれる
2) worker を起動する

```bash
pnpm --filter @praccode/api autopilot:worker
```

### 手動トリガー API
```bash
curl -X POST http://localhost:3001/autopilot/trigger \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: <USER_ID>' \
  -d '{"triggerType":"submission_evaluated","submissionId":"<SUBMISSION_ID>"}'
```

### 実行ログ
```bash
curl -H 'x-user-id: <USER_ID>' http://localhost:3001/autopilot/runs
curl -H 'x-user-id: <USER_ID>' http://localhost:3001/autopilot/runs/<RUN_ID>
```
