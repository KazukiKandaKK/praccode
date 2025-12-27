# Frontend State Machines

フロント主要フローの状態遷移図。UI実装と付き合わせるためのドキュメントです。

## Auth
```mermaid
stateDiagram-v2
    [*] --> Unauthenticated
    Unauthenticated --> Registering : POST /auth/register
    Registering --> PendingEmailVerification : 201 OK
    PendingEmailVerification --> EmailVerified : POST /auth/verify-email (成功)
    Unauthenticated --> LoggingIn : signIn(credentials/github)
    LoggingIn --> Authenticated : 成功
    LoggingIn --> Unauthenticated : 失敗/未認証/入力エラー
    Unauthenticated --> RequestingReset : POST /auth/forgot-password
    RequestingReset --> ResetLinkSent : 成功(メール送付)
    ResetLinkSent --> ResettingPassword : POST /auth/reset-password
    ResettingPassword --> Unauthenticated : 成功
    Authenticated --> Unauthenticated : signOut
```

## コードリーディング提出 (`app/(app)/exercises/[id]/page.tsx`)
```mermaid
stateDiagram-v2
    [*] --> SessionLoading
    SessionLoading --> LoadingExercise : session ready & userIdあり
    LoadingExercise --> ExerciseLoaded : fetch OK
    LoadingExercise --> FetchError : 404/403/その他
    ExerciseLoaded --> Editing
    Editing --> HintLoading : ヒント要求
    HintLoading --> Editing : ヒント受信
    Editing --> Submitting : create submission -> save answers -> kick evaluate
    Submitting --> Submitted : 一連のAPI成功
    Submitting --> SubmitError : API失敗
    Submitted --> Editing : 「もう一度解く」でリセット
    FetchError --> [*]
```

## コードライティング提出/フィードバック (`app/(app)/writing/[id]/page.tsx`)
```mermaid
stateDiagram-v2
    [*] --> LoadingChallenge
    LoadingChallenge --> Ready : 取得成功
    LoadingChallenge --> ErrorRedirect : 403/404 -> /writing
    Ready --> Submitting : POST /writing/submissions
    Submitting --> Executing : submit成功 -> ポーリング開始 (status PENDING/RUNNING)
    Executing --> Completed : status COMPLETED/ERROR
    Completed --> Ready : 再提出でリセット
    Completed --> FeedbackNotStarted : executedAtあり & llmFeedbackStatus=NOT_STARTED
    FeedbackNotStarted --> FeedbackGenerating : POST /writing/submissions/:id/feedback
    FeedbackGenerating --> FeedbackCompleted : llmFeedbackStatus=COMPLETED
    FeedbackGenerating --> FeedbackFailed : llmFeedbackStatus=FAILED
    FeedbackFailed --> FeedbackGenerating : 再リクエスト
```

メモ:
- フロントはライティングの `llmFeedbackStatus` を `NOT_STARTED | GENERATING | COMPLETED | FAILED` と想定。
- コードリーディングのヒント生成は現在API接続済み、失敗時はエラーメッセージを表示。
