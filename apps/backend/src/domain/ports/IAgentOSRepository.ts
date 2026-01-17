export type AgentRunMode = 'mentor' | 'coach' | 'deep_research' | 'code_assist' | 'generic';
export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type AgentStepKind = 'plan' | 'tool' | 'verify' | 'final' | 'note';
export type ToolInvocationStatus = 'success' | 'failed' | 'blocked' | 'needs_confirmation';
export type SafetyDecisionType = 'allow' | 'block' | 'confirm';
export type EvidenceSourceType =
  | 'exercise'
  | 'submission'
  | 'progress'
  | 'web'
  | 'memory'
  | 'other';
export type AgentMemoryType = 'fact' | 'procedure' | 'preference' | 'warning' | 'concept';

export type AgentRunRecord = {
  id: string;
  userId: string;
  mode: AgentRunMode;
  goal: string;
  inputJson: Record<string, unknown> | null;
  status: AgentRunStatus;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  resultJson: Record<string, unknown> | null;
  errorMessage: string | null;
};

export type AgentStepRecord = {
  id: string;
  runId: string;
  stepIndex: number;
  kind: AgentStepKind;
  inputJson: Record<string, unknown> | null;
  outputJson: Record<string, unknown> | null;
  createdAt: Date;
};

export type ToolInvocationRecord = {
  id: string;
  runId: string;
  stepId: string;
  toolName: string;
  argsJson: Record<string, unknown> | null;
  resultJson: Record<string, unknown> | null;
  status: ToolInvocationStatus;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
};

export type SafetyDecisionRecord = {
  id: string;
  invocationId: string;
  decision: SafetyDecisionType;
  reasonsJson: Record<string, unknown> | null;
  feedbackToAgent: string | null;
  createdAt: Date;
};

export type RoutingDecisionRecord = {
  id: string;
  runId: string;
  stepId: string | null;
  chosenProvider: string;
  chosenModel: string;
  toolset: string;
  reason: string;
  createdAt: Date;
};

export type EvidenceRecord = {
  id: string;
  runId: string;
  claim: string;
  evidenceText: string;
  sourceType: EvidenceSourceType;
  sourceRef: string | null;
  confidence: number | null;
  createdAt: Date;
};

export type AgentExperienceRecord = {
  id: string;
  userId: string;
  tags: string[];
  situation: string;
  actionsSummary: string;
  outcome: string;
  evalScore: number | null;
  createdAt: Date;
};

export type AgentMemoryRecord = {
  id: string;
  userId: string;
  type: AgentMemoryType;
  content: string;
  linksJson: Record<string, unknown> | null;
  createdAt: Date;
};

export type AgentRunDetails = {
  run: AgentRunRecord;
  steps: AgentStepRecord[];
  toolInvocations: ToolInvocationRecord[];
  safetyDecisions: SafetyDecisionRecord[];
  routingDecisions: RoutingDecisionRecord[];
  evidence: EvidenceRecord[];
};

export interface IAgentOSRepository {
  createRun(params: {
    userId: string;
    mode: AgentRunMode;
    goal: string;
    inputJson?: Record<string, unknown>;
  }): Promise<AgentRunRecord>;
  startRun(runId: string): Promise<void>;
  completeRun(runId: string, resultJson: Record<string, unknown>): Promise<void>;
  failRun(runId: string, errorMessage: string): Promise<void>;
  cancelRun(runId: string): Promise<void>;

  createStep(params: {
    runId: string;
    stepIndex: number;
    kind: AgentStepKind;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown>;
  }): Promise<AgentStepRecord>;
  updateStepOutput(stepId: string, outputJson: Record<string, unknown>): Promise<void>;

  createToolInvocation(params: {
    runId: string;
    stepId: string;
    toolName: string;
    argsJson?: Record<string, unknown>;
    status: ToolInvocationStatus;
  }): Promise<ToolInvocationRecord>;
  updateToolInvocation(
    invocationId: string,
    params: {
      status: ToolInvocationStatus;
      resultJson?: Record<string, unknown>;
      errorMessage?: string;
    }
  ): Promise<void>;

  createSafetyDecision(params: {
    invocationId: string;
    decision: SafetyDecisionType;
    reasonsJson?: Record<string, unknown>;
    feedbackToAgent?: string;
  }): Promise<SafetyDecisionRecord>;

  createRoutingDecision(params: {
    runId: string;
    stepId?: string;
    chosenProvider: string;
    chosenModel: string;
    toolset: string;
    reason: string;
  }): Promise<RoutingDecisionRecord>;

  createEvidence(params: {
    runId: string;
    claim: string;
    evidenceText: string;
    sourceType: EvidenceSourceType;
    sourceRef?: string;
    confidence?: number;
  }): Promise<EvidenceRecord>;

  createExperience(params: {
    userId: string;
    tags?: string[];
    situation: string;
    actionsSummary: string;
    outcome: string;
    evalScore?: number;
  }): Promise<AgentExperienceRecord>;

  saveMemory(params: {
    userId: string;
    type: AgentMemoryType;
    content: string;
    linksJson?: Record<string, unknown>;
  }): Promise<AgentMemoryRecord>;

  readMemory(params: {
    userId: string;
    query?: string;
    type?: AgentMemoryType;
    limit?: number;
  }): Promise<AgentMemoryRecord[]>;

  getRunDetailsForUser(runId: string, userId: string): Promise<AgentRunDetails | null>;
  getPendingInvocations(runId: string): Promise<ToolInvocationRecord[]>;
  updateInvocationStatus(invocationId: string, status: ToolInvocationStatus): Promise<void>;
}
