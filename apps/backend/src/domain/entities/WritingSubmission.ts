export interface WritingSubmission {
  id: string;
  challengeId: string;
  userId: string;
  language: string;
  code: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';
  stdout: string | null;
  stderr: string | null;
  exitCode: number | null;
  passed: boolean | null;
  executedAt: Date | null;
  llmFeedback: string | null;
  llmFeedbackStatus: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED' | null;
  llmFeedbackAt: Date | null;
  challenge: {
    id: string;
    title: string;
    language: string;
    description?: string;
    testCode?: string;
  };
}
