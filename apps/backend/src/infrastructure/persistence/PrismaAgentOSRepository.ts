import { prisma } from '../../lib/prisma';
import {
  type AgentRunMode,
  type AgentRunRecord,
  type AgentRunStatus,
  type AgentStepKind,
  type AgentStepRecord,
  type ToolInvocationRecord,
  type ToolInvocationStatus,
  type SafetyDecisionRecord,
  type SafetyDecisionType,
  type RoutingDecisionRecord,
  type EvidenceRecord,
  type EvidenceSourceType,
  type AgentExperienceRecord,
  type AgentMemoryRecord,
  type AgentMemoryType,
  type AgentRunDetails,
  type IAgentOSRepository,
} from '../../domain/ports/IAgentOSRepository';

const toJson = (value?: Record<string, unknown> | null) => value ?? null;

const normalizeTags = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === 'string') as string[];
  }
  return [];
};

export class PrismaAgentOSRepository implements IAgentOSRepository {
  async createRun(params: {
    userId: string;
    mode: AgentRunMode;
    goal: string;
    inputJson?: Record<string, unknown>;
  }): Promise<AgentRunRecord> {
    const run = await prisma.agentRun.create({
      data: {
        userId: params.userId,
        mode: params.mode,
        goal: params.goal,
        inputJson: toJson(params.inputJson),
        status: 'queued',
      },
    });
    return {
      id: run.id,
      userId: run.userId,
      mode: run.mode as AgentRunMode,
      goal: run.goal,
      inputJson: (run.inputJson as Record<string, unknown> | null) ?? null,
      status: run.status as AgentRunStatus,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      resultJson: (run.resultJson as Record<string, unknown> | null) ?? null,
      errorMessage: run.errorMessage,
    };
  }

  async startRun(runId: string): Promise<void> {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  async completeRun(runId: string, resultJson: Record<string, unknown>): Promise<void> {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: 'completed', resultJson, finishedAt: new Date() },
    });
  }

  async failRun(runId: string, errorMessage: string): Promise<void> {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: 'failed', errorMessage, finishedAt: new Date() },
    });
  }

  async cancelRun(runId: string): Promise<void> {
    await prisma.agentRun.update({
      where: { id: runId },
      data: { status: 'cancelled', finishedAt: new Date() },
    });
  }

  async createStep(params: {
    runId: string;
    stepIndex: number;
    kind: AgentStepKind;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown>;
  }): Promise<AgentStepRecord> {
    const step = await prisma.agentStep.create({
      data: {
        runId: params.runId,
        stepIndex: params.stepIndex,
        kind: params.kind,
        inputJson: toJson(params.inputJson),
        outputJson: toJson(params.outputJson),
      },
    });

    return {
      id: step.id,
      runId: step.runId,
      stepIndex: step.stepIndex,
      kind: step.kind as AgentStepKind,
      inputJson: (step.inputJson as Record<string, unknown> | null) ?? null,
      outputJson: (step.outputJson as Record<string, unknown> | null) ?? null,
      createdAt: step.createdAt,
    };
  }

  async updateStepOutput(stepId: string, outputJson: Record<string, unknown>): Promise<void> {
    await prisma.agentStep.update({
      where: { id: stepId },
      data: { outputJson },
    });
  }

  async createToolInvocation(params: {
    runId: string;
    stepId: string;
    toolName: string;
    argsJson?: Record<string, unknown>;
    status: ToolInvocationStatus;
  }): Promise<ToolInvocationRecord> {
    const invocation = await prisma.toolInvocation.create({
      data: {
        runId: params.runId,
        stepId: params.stepId,
        toolName: params.toolName,
        argsJson: toJson(params.argsJson),
        status: params.status,
      },
    });

    return {
      id: invocation.id,
      runId: invocation.runId,
      stepId: invocation.stepId,
      toolName: invocation.toolName,
      argsJson: (invocation.argsJson as Record<string, unknown> | null) ?? null,
      resultJson: (invocation.resultJson as Record<string, unknown> | null) ?? null,
      status: invocation.status as ToolInvocationStatus,
      startedAt: invocation.startedAt,
      finishedAt: invocation.finishedAt,
      errorMessage: invocation.errorMessage,
    };
  }

  async updateToolInvocation(
    invocationId: string,
    params: { status: ToolInvocationStatus; resultJson?: Record<string, unknown>; errorMessage?: string }
  ): Promise<void> {
    const shouldFinish = params.status !== 'needs_confirmation';
    await prisma.toolInvocation.update({
      where: { id: invocationId },
      data: {
        status: params.status,
        resultJson: toJson(params.resultJson),
        errorMessage: params.errorMessage ?? null,
        ...(shouldFinish && { finishedAt: new Date() }),
      },
    });
  }

  async createSafetyDecision(params: {
    invocationId: string;
    decision: SafetyDecisionType;
    reasonsJson?: Record<string, unknown>;
    feedbackToAgent?: string;
  }): Promise<SafetyDecisionRecord> {
    const decision = await prisma.safetyDecision.create({
      data: {
        invocationId: params.invocationId,
        decision: params.decision,
        reasonsJson: toJson(params.reasonsJson),
        feedbackToAgent: params.feedbackToAgent ?? null,
      },
    });

    return {
      id: decision.id,
      invocationId: decision.invocationId,
      decision: decision.decision as SafetyDecisionType,
      reasonsJson: (decision.reasonsJson as Record<string, unknown> | null) ?? null,
      feedbackToAgent: decision.feedbackToAgent,
      createdAt: decision.createdAt,
    };
  }

  async createRoutingDecision(params: {
    runId: string;
    stepId?: string;
    chosenProvider: string;
    chosenModel: string;
    toolset: string;
    reason: string;
  }): Promise<RoutingDecisionRecord> {
    const decision = await prisma.routingDecision.create({
      data: {
        runId: params.runId,
        stepId: params.stepId ?? null,
        chosenProvider: params.chosenProvider,
        chosenModel: params.chosenModel,
        toolset: params.toolset,
        reason: params.reason,
      },
    });

    return {
      id: decision.id,
      runId: decision.runId,
      stepId: decision.stepId,
      chosenProvider: decision.chosenProvider,
      chosenModel: decision.chosenModel,
      toolset: decision.toolset,
      reason: decision.reason,
      createdAt: decision.createdAt,
    };
  }

  async createEvidence(params: {
    runId: string;
    claim: string;
    evidenceText: string;
    sourceType: EvidenceSourceType;
    sourceRef?: string;
    confidence?: number;
  }): Promise<EvidenceRecord> {
    const evidence = await prisma.evidence.create({
      data: {
        runId: params.runId,
        claim: params.claim,
        evidenceText: params.evidenceText,
        sourceType: params.sourceType,
        sourceRef: params.sourceRef ?? null,
        confidence: params.confidence ?? null,
      },
    });

    return {
      id: evidence.id,
      runId: evidence.runId,
      claim: evidence.claim,
      evidenceText: evidence.evidenceText,
      sourceType: evidence.sourceType as EvidenceSourceType,
      sourceRef: evidence.sourceRef,
      confidence: evidence.confidence,
      createdAt: evidence.createdAt,
    };
  }

  async createExperience(params: {
    userId: string;
    tags?: string[];
    situation: string;
    actionsSummary: string;
    outcome: string;
    evalScore?: number;
  }): Promise<AgentExperienceRecord> {
    const experience = await prisma.agentExperience.create({
      data: {
        userId: params.userId,
        tags: params.tags ?? [],
        situation: params.situation,
        actionsSummary: params.actionsSummary,
        outcome: params.outcome,
        evalScore: params.evalScore ?? null,
      },
    });

    return {
      id: experience.id,
      userId: experience.userId,
      tags: normalizeTags(experience.tags),
      situation: experience.situation,
      actionsSummary: experience.actionsSummary,
      outcome: experience.outcome,
      evalScore: experience.evalScore,
      createdAt: experience.createdAt,
    };
  }

  async saveMemory(params: {
    userId: string;
    type: AgentMemoryType;
    content: string;
    linksJson?: Record<string, unknown>;
  }): Promise<AgentMemoryRecord> {
    const record = await prisma.agentMemory.create({
      data: {
        userId: params.userId,
        type: params.type,
        content: params.content,
        linksJson: toJson(params.linksJson),
      },
    });

    return {
      id: record.id,
      userId: record.userId,
      type: record.type as AgentMemoryType,
      content: record.content,
      linksJson: (record.linksJson as Record<string, unknown> | null) ?? null,
      createdAt: record.createdAt,
    };
  }

  async readMemory(params: {
    userId: string;
    query?: string;
    type?: AgentMemoryType;
    limit?: number;
  }): Promise<AgentMemoryRecord[]> {
    const records = await prisma.agentMemory.findMany({
      where: {
        userId: params.userId,
        ...(params.type ? { type: params.type } : {}),
        ...(params.query
          ? {
              content: {
                contains: params.query,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 20,
    });

    return records.map((record) => ({
      id: record.id,
      userId: record.userId,
      type: record.type as AgentMemoryType,
      content: record.content,
      linksJson: (record.linksJson as Record<string, unknown> | null) ?? null,
      createdAt: record.createdAt,
    }));
  }

  async getRunDetailsForUser(runId: string, userId: string): Promise<AgentRunDetails | null> {
    const run = await prisma.agentRun.findFirst({
      where: { id: runId, userId },
    });
    if (!run) return null;

    const [steps, toolInvocations, routingDecisions, evidence] = await Promise.all([
      prisma.agentStep.findMany({
        where: { runId },
        orderBy: { stepIndex: 'asc' },
      }),
      prisma.toolInvocation.findMany({
        where: { runId },
        orderBy: { startedAt: 'asc' },
      }),
      prisma.routingDecision.findMany({
        where: { runId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.evidence.findMany({
        where: { runId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const invocationIds = toolInvocations.map((i) => i.id);
    const safety = await prisma.safetyDecision.findMany({
      where: { invocationId: { in: invocationIds } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      run: {
        id: run.id,
        userId: run.userId,
        mode: run.mode as AgentRunMode,
        goal: run.goal,
        inputJson: (run.inputJson as Record<string, unknown> | null) ?? null,
        status: run.status as AgentRunStatus,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        resultJson: (run.resultJson as Record<string, unknown> | null) ?? null,
        errorMessage: run.errorMessage,
      },
      steps: steps.map((step) => ({
        id: step.id,
        runId: step.runId,
        stepIndex: step.stepIndex,
        kind: step.kind as AgentStepKind,
        inputJson: (step.inputJson as Record<string, unknown> | null) ?? null,
        outputJson: (step.outputJson as Record<string, unknown> | null) ?? null,
        createdAt: step.createdAt,
      })),
      toolInvocations: toolInvocations.map((invocation) => ({
        id: invocation.id,
        runId: invocation.runId,
        stepId: invocation.stepId,
        toolName: invocation.toolName,
        argsJson: (invocation.argsJson as Record<string, unknown> | null) ?? null,
        resultJson: (invocation.resultJson as Record<string, unknown> | null) ?? null,
        status: invocation.status as ToolInvocationStatus,
        startedAt: invocation.startedAt,
        finishedAt: invocation.finishedAt,
        errorMessage: invocation.errorMessage,
      })),
      safetyDecisions: safety.map((decision) => ({
        id: decision.id,
        invocationId: decision.invocationId,
        decision: decision.decision as SafetyDecisionType,
        reasonsJson: (decision.reasonsJson as Record<string, unknown> | null) ?? null,
        feedbackToAgent: decision.feedbackToAgent,
        createdAt: decision.createdAt,
      })),
      routingDecisions: routingDecisions.map((decision) => ({
        id: decision.id,
        runId: decision.runId,
        stepId: decision.stepId,
        chosenProvider: decision.chosenProvider,
        chosenModel: decision.chosenModel,
        toolset: decision.toolset,
        reason: decision.reason,
        createdAt: decision.createdAt,
      })),
      evidence: evidence.map((item) => ({
        id: item.id,
        runId: item.runId,
        claim: item.claim,
        evidenceText: item.evidenceText,
        sourceType: item.sourceType as EvidenceSourceType,
        sourceRef: item.sourceRef,
        confidence: item.confidence,
        createdAt: item.createdAt,
      })),
    };
  }

  async getPendingInvocations(runId: string): Promise<ToolInvocationRecord[]> {
    const invocations = await prisma.toolInvocation.findMany({
      where: { runId, status: 'needs_confirmation' },
      orderBy: { startedAt: 'asc' },
    });
    return invocations.map((invocation) => ({
      id: invocation.id,
      runId: invocation.runId,
      stepId: invocation.stepId,
      toolName: invocation.toolName,
      argsJson: (invocation.argsJson as Record<string, unknown> | null) ?? null,
      resultJson: (invocation.resultJson as Record<string, unknown> | null) ?? null,
      status: invocation.status as ToolInvocationStatus,
      startedAt: invocation.startedAt,
      finishedAt: invocation.finishedAt,
      errorMessage: invocation.errorMessage,
    }));
  }

  async updateInvocationStatus(invocationId: string, status: ToolInvocationStatus): Promise<void> {
    await prisma.toolInvocation.update({
      where: { id: invocationId },
      data: { status },
    });
  }
}
