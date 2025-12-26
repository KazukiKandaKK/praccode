import { WritingSubmission } from '../entities/WritingSubmission';

export interface IWritingSubmissionRepository {
  createSubmission(data: {
    challengeId: string;
    userId: string;
    language: string;
    code: string;
  }): Promise<{ id: string; userId: string; challengeId: string }>;
  findById(id: string): Promise<WritingSubmission | null>;
  findByUser(userId: string): Promise<WritingSubmission[]>;
  markRunning(id: string): Promise<void>;
  updateExecutionResult(id: string, data: { stdout: string | null; stderr: string | null; exitCode: number; passed: boolean }): Promise<{ userId: string }>;
  markError(id: string, errorMessage: string): Promise<void>;
  markFeedbackGenerating(id: string): Promise<void>;
  updateFeedback(id: string, feedback: string): Promise<void>;
  markFeedbackFailed(id: string): Promise<void>;
}
