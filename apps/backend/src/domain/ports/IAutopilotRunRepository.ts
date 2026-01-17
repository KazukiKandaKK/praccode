export type AutopilotTriggerType = 'submission_evaluated' | 'manual';
export type AutopilotRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export type AutopilotRunRecord = {
  id: string;
  userId: string;
  triggerType: AutopilotTriggerType;
  triggerKey: string;
  payloadJson: Record<string, unknown> | null;
  status: AutopilotRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  resultJson: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface IAutopilotRunRepository {
  createQueued(params: {
    userId: string;
    triggerType: AutopilotTriggerType;
    triggerKey: string;
    payloadJson: Record<string, unknown>;
  }): Promise<AutopilotRunRecord | null>;

  markRunning(runId: string): Promise<void>;
  markCompleted(runId: string, resultJson: Record<string, unknown>): Promise<void>;
  markFailed(runId: string, errorMessage: string): Promise<void>;

  listByUser(userId: string, limit?: number): Promise<AutopilotRunRecord[]>;
  getByIdForUser(runId: string, userId: string): Promise<AutopilotRunRecord | null>;
}
