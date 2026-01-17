export type AutopilotOutboxEventRecord = {
  id: string;
  type: string;
  payloadJson: Record<string, unknown> | null;
  dedupKey: string;
  createdAt: Date;
  processedAt: Date | null;
  errorCount: number;
  nextRetryAt: Date | null;
  lastError: string | null;
};

export interface IAutopilotOutboxRepository {
  enqueue(params: {
    type: string;
    payloadJson: Record<string, unknown>;
    dedupKey: string;
  }): Promise<{ id: string; dedupKey: string; enqueued: boolean }>;

  leaseNextBatch(params: {
    limit: number;
    now: Date;
  }): Promise<AutopilotOutboxEventRecord[]>;

  markProcessed(id: string): Promise<void>;

  markFailed(params: {
    id: string;
    error: string;
    nextRetryAt?: Date | null;
  }): Promise<void>;
}
