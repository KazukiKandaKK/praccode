import { AgentRunMode } from './IAgentOSRepository';

export interface IAgentRuntime {
  run(params: {
    runId: string;
    userId: string;
    mode: AgentRunMode;
    goal: string;
    inputJson?: Record<string, unknown>;
  }): Promise<void>;

  continueRun(params: { runId: string; userId: string }): Promise<void>;

  executeConfirmedTool(params: {
    runId: string;
    userId: string;
    invocationId: string;
  }): Promise<void>;
}
