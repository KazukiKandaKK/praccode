import { EventEmitter } from 'events';

// シングルトンのEventEmitter
const evaluationEmitter = new EventEmitter();

// メモリリーク防止のため、リスナー数の上限を増やす
evaluationEmitter.setMaxListeners(100);

export type EvaluationEventType = 'evaluated' | 'failed';

export interface EvaluationEvent {
  submissionId: string;
  type: EvaluationEventType;
  timestamp: number;
}

/**
 * 評価完了イベントを発行
 */
export function emitEvaluationComplete(submissionId: string): void {
  const event: EvaluationEvent = {
    submissionId,
    type: 'evaluated',
    timestamp: Date.now(),
  };
  evaluationEmitter.emit(`submission:${submissionId}`, event);
}

/**
 * 評価失敗イベントを発行
 */
export function emitEvaluationFailed(submissionId: string): void {
  const event: EvaluationEvent = {
    submissionId,
    type: 'failed',
    timestamp: Date.now(),
  };
  evaluationEmitter.emit(`submission:${submissionId}`, event);
}

/**
 * 特定サブミッションのイベントをリスン
 */
export function onEvaluationEvent(
  submissionId: string,
  callback: (event: EvaluationEvent) => void
): () => void {
  const eventName = `submission:${submissionId}`;
  evaluationEmitter.on(eventName, callback);

  // クリーンアップ関数を返す
  return () => {
    evaluationEmitter.off(eventName, callback);
  };
}

export { evaluationEmitter };
