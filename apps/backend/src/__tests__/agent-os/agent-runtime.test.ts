import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '@/infrastructure/agent-os/tool-registry';
import { SafetyGuard } from '@/infrastructure/agent-os/guardrail';
import { AgentRouter } from '@/infrastructure/agent-os/router';
import { z } from 'zod';
import type {
  IAgentOSRepository,
  AgentRunMode,
  AgentRunRecord,
  AgentStepRecord,
  ToolInvocationRecord,
  SafetyDecisionRecord,
  RoutingDecisionRecord,
  EvidenceRecord,
  AgentExperienceRecord,
  AgentMemoryRecord,
} from '@/domain/ports/IAgentOSRepository';

vi.mock('@/infrastructure/llm/llm-client', () => ({
  generateWithOllama: vi.fn(),
}));

const { generateWithOllama } = await import('@/infrastructure/llm/llm-client');

class InMemoryAgentOSRepository implements IAgentOSRepository {
  runs = new Map<string, AgentRunRecord>();
  steps: AgentStepRecord[] = [];
  toolInvocations: ToolInvocationRecord[] = [];
  safetyDecisions: SafetyDecisionRecord[] = [];
  routingDecisions: RoutingDecisionRecord[] = [];
  evidence: EvidenceRecord[] = [];
  experiences: AgentExperienceRecord[] = [];
  memories: AgentMemoryRecord[] = [];

  async createRun(params: {
    userId: string;
    mode: AgentRunMode;
    goal: string;
    inputJson?: Record<string, unknown>;
  }): Promise<AgentRunRecord> {
    const now = new Date();
    const run: AgentRunRecord = {
      id: `run-${this.runs.size + 1}`,
      userId: params.userId,
      mode: params.mode,
      goal: params.goal,
      inputJson: params.inputJson ?? null,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      resultJson: null,
      errorMessage: null,
    };
    this.runs.set(run.id, run);
    return run;
  }

  async startRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = 'running';
      run.startedAt = new Date();
    }
  }

  async completeRun(runId: string, resultJson: Record<string, unknown>): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = 'completed';
      run.resultJson = resultJson;
      run.finishedAt = new Date();
    }
  }

  async failRun(runId: string, errorMessage: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = 'failed';
      run.errorMessage = errorMessage;
      run.finishedAt = new Date();
    }
  }

  async cancelRun(runId: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = 'cancelled';
      run.finishedAt = new Date();
    }
  }

  async createStep(params: {
    runId: string;
    stepIndex: number;
    kind: any;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown>;
  }): Promise<AgentStepRecord> {
    const step: AgentStepRecord = {
      id: `step-${this.steps.length + 1}`,
      runId: params.runId,
      stepIndex: params.stepIndex,
      kind: params.kind,
      inputJson: params.inputJson ?? null,
      outputJson: params.outputJson ?? null,
      createdAt: new Date(),
    };
    this.steps.push(step);
    return step;
  }

  async updateStepOutput(stepId: string, outputJson: Record<string, unknown>): Promise<void> {
    const step = this.steps.find((s) => s.id === stepId);
    if (step) step.outputJson = outputJson;
  }

  async createToolInvocation(params: {
    runId: string;
    stepId: string;
    toolName: string;
    argsJson?: Record<string, unknown>;
    status: any;
  }): Promise<ToolInvocationRecord> {
    const invocation: ToolInvocationRecord = {
      id: `inv-${this.toolInvocations.length + 1}`,
      runId: params.runId,
      stepId: params.stepId,
      toolName: params.toolName,
      argsJson: params.argsJson ?? null,
      resultJson: null,
      status: params.status,
      startedAt: new Date(),
      finishedAt: null,
      errorMessage: null,
    };
    this.toolInvocations.push(invocation);
    return invocation;
  }

  async updateToolInvocation(
    invocationId: string,
    params: { status: any; resultJson?: Record<string, unknown>; errorMessage?: string }
  ): Promise<void> {
    const invocation = this.toolInvocations.find((i) => i.id === invocationId);
    if (invocation) {
      invocation.status = params.status;
      invocation.resultJson = params.resultJson ?? null;
      invocation.errorMessage = params.errorMessage ?? null;
      invocation.finishedAt = new Date();
    }
  }

  async createSafetyDecision(params: {
    invocationId: string;
    decision: any;
    reasonsJson?: Record<string, unknown>;
    feedbackToAgent?: string;
  }): Promise<SafetyDecisionRecord> {
    const record: SafetyDecisionRecord = {
      id: `sd-${this.safetyDecisions.length + 1}`,
      invocationId: params.invocationId,
      decision: params.decision,
      reasonsJson: params.reasonsJson ?? null,
      feedbackToAgent: params.feedbackToAgent ?? null,
      createdAt: new Date(),
    };
    this.safetyDecisions.push(record);
    return record;
  }

  async createRoutingDecision(params: {
    runId: string;
    stepId?: string;
    chosenProvider: string;
    chosenModel: string;
    toolset: string;
    reason: string;
  }): Promise<RoutingDecisionRecord> {
    const record: RoutingDecisionRecord = {
      id: `rd-${this.routingDecisions.length + 1}`,
      runId: params.runId,
      stepId: params.stepId ?? null,
      chosenProvider: params.chosenProvider,
      chosenModel: params.chosenModel,
      toolset: params.toolset,
      reason: params.reason,
      createdAt: new Date(),
    };
    this.routingDecisions.push(record);
    return record;
  }

  async createEvidence(params: {
    runId: string;
    claim: string;
    evidenceText: string;
    sourceType: any;
    sourceRef?: string;
    confidence?: number;
  }): Promise<EvidenceRecord> {
    const record: EvidenceRecord = {
      id: `ev-${this.evidence.length + 1}`,
      runId: params.runId,
      claim: params.claim,
      evidenceText: params.evidenceText,
      sourceType: params.sourceType,
      sourceRef: params.sourceRef ?? null,
      confidence: params.confidence ?? null,
      createdAt: new Date(),
    };
    this.evidence.push(record);
    return record;
  }

  async createExperience(params: {
    userId: string;
    tags?: string[];
    situation: string;
    actionsSummary: string;
    outcome: string;
    evalScore?: number;
  }): Promise<AgentExperienceRecord> {
    const record: AgentExperienceRecord = {
      id: `ex-${this.experiences.length + 1}`,
      userId: params.userId,
      tags: params.tags ?? [],
      situation: params.situation,
      actionsSummary: params.actionsSummary,
      outcome: params.outcome,
      evalScore: params.evalScore ?? null,
      createdAt: new Date(),
    };
    this.experiences.push(record);
    return record;
  }

  async saveMemory(params: {
    userId: string;
    type: any;
    content: string;
    linksJson?: Record<string, unknown>;
  }): Promise<AgentMemoryRecord> {
    const record: AgentMemoryRecord = {
      id: `mem-${this.memories.length + 1}`,
      userId: params.userId,
      type: params.type,
      content: params.content,
      linksJson: params.linksJson ?? null,
      createdAt: new Date(),
    };
    this.memories.push(record);
    return record;
  }

  async readMemory(params: {
    userId: string;
    query?: string;
    type?: any;
    limit?: number;
  }): Promise<AgentMemoryRecord[]> {
    return this.memories.filter((m) => m.userId === params.userId).slice(0, params.limit ?? 20);
  }

  async getRunDetailsForUser(runId: string, userId: string) {
    const run = this.runs.get(runId);
    if (!run || run.userId !== userId) return null;
    return {
      run,
      steps: this.steps.filter((s) => s.runId === runId),
      toolInvocations: this.toolInvocations.filter((t) => t.runId === runId),
      safetyDecisions: this.safetyDecisions,
      routingDecisions: this.routingDecisions,
      evidence: this.evidence,
    };
  }

  async getPendingInvocations(runId: string): Promise<ToolInvocationRecord[]> {
    return this.toolInvocations.filter((t) => t.runId === runId && t.status === 'needs_confirmation');
  }

  async updateInvocationStatus(invocationId: string, status: any): Promise<void> {
    const invocation = this.toolInvocations.find((t) => t.id === invocationId);
    if (invocation) invocation.status = status;
  }
}

describe('AgentRuntime', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    process.env.AGENT_PARALLEL_PLANS = '1';
  });

  it('should complete a run and save steps', async () => {
    process.env.AGENT_STEP_LIMIT = '6';
    const repo = new InMemoryAgentOSRepository();
    const registry = new ToolRegistry();
    registry.register({
      name: 'echo',
      description: 'Echo tool',
      inputSchema: z.object({ message: z.string() }),
      outputSchema: z.object({ message: z.string() }),
      permission: 'read',
      sideEffects: false,
      handler: async (_ctx, args) => ({ message: args.message }),
    });
    const guard = new SafetyGuard(false);
    const router = new AgentRouter();
    const { AgentRuntime } = await import('@/infrastructure/agent-os/agent-runtime');
    const runtime = new AgentRuntime(repo, registry, guard, router);

    vi.mocked(generateWithOllama)
      .mockResolvedValueOnce(
        JSON.stringify({
          stage: 'plan',
          toolCalls: [{ tool: 'echo', args: { message: 'hi' } }],
          claims: [{ claim: 'test', needsEvidence: false }],
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({ message: 'done', hints: [{ level: 1, text: 'hint' }] })
      );

    const run = await repo.createRun({
      userId: 'user-1',
      mode: 'mentor',
      goal: 'test goal',
    });
    await runtime.run({ runId: run.id, userId: 'user-1', mode: 'mentor', goal: 'test goal' });

    const updated = await repo.getRunDetailsForUser(run.id, 'user-1');
    expect(updated?.run.status).toBe('completed');
    expect(updated?.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('should block unknown tools', async () => {
    process.env.AGENT_STEP_LIMIT = '1';
    const repo = new InMemoryAgentOSRepository();
    const registry = new ToolRegistry();
    const guard = new SafetyGuard(false);
    const router = new AgentRouter();
    const { AgentRuntime } = await import('@/infrastructure/agent-os/agent-runtime');
    const runtime = new AgentRuntime(repo, registry, guard, router);

    vi.mocked(generateWithOllama).mockResolvedValueOnce(
      JSON.stringify({
        stage: 'plan',
        toolCalls: [{ tool: 'unknown', args: {} }],
        claims: [],
      })
    );

    const run = await repo.createRun({
      userId: 'user-1',
      mode: 'generic',
      goal: 'test goal',
    });
    await runtime.run({ runId: run.id, userId: 'user-1', mode: 'generic', goal: 'test goal' });

    const invocations = repo.toolInvocations.filter((i) => i.runId === run.id);
    expect(invocations[0]?.status).toBe('blocked');
  });

  it('should require confirmation for side-effect tools', async () => {
    process.env.AGENT_STEP_LIMIT = '1';
    const repo = new InMemoryAgentOSRepository();
    const registry = new ToolRegistry();
    registry.register({
      name: 'saveMemory',
      description: 'Side-effect tool',
      inputSchema: z.object({ content: z.string() }),
      outputSchema: z.object({ ok: z.boolean() }),
      permission: 'write',
      sideEffects: true,
      handler: async () => ({ ok: true }),
    });
    const guard = new SafetyGuard(false);
    const router = new AgentRouter();
    const { AgentRuntime } = await import('@/infrastructure/agent-os/agent-runtime');
    const runtime = new AgentRuntime(repo, registry, guard, router);

    vi.mocked(generateWithOllama).mockResolvedValueOnce(
      JSON.stringify({
        stage: 'plan',
        toolCalls: [{ tool: 'saveMemory', args: { content: 'x' } }],
        claims: [],
      })
    );

    const run = await repo.createRun({
      userId: 'user-1',
      mode: 'generic',
      goal: 'test goal',
    });
    await runtime.run({ runId: run.id, userId: 'user-1', mode: 'generic', goal: 'test goal' });

    const invocation = repo.toolInvocations.find((i) => i.runId === run.id);
    expect(invocation?.status).toBe('needs_confirmation');
  });
});
