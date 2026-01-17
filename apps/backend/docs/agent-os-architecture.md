# Agent OS Architecture (PracCode)

This document describes the Agent OS execution flow and persistence model.

## Goals
- Safe agent loop: Observe -> Plan -> Guard -> Act -> Verify -> Final -> Learn
- All steps and decisions persisted for audit and future learning
- Tool execution strictly allowlisted and schema validated

## Runtime Flow

```
User Goal/Input
  |
  v
AgentRun (queued -> running)
  |
  v
[Step 1: plan]
  - LLM returns JSON plan with toolCalls + claims
  - Step saved (inputJson/outputJson)
  |
  v
[Guardrail]
  - Rule checks + LLM safety check
  - SafetyDecision saved (allow/block/confirm)
  |
  v
[Act]
  - ToolInvocation persisted (args/result/status)
  - ToolRegistry allowlist enforced
  |
  v
[Verify]
  - Evidence chaining for claims
  - Evidence persisted
  |
  v
[Final]
  - LLM returns JSON final response
  - AgentRun.resultJson saved
  |
  v
[Learn/Practice]
  - Experience + Memory persisted
```

## Context & Injection Safety
- Context is wrapped with <CONTEXT> ... </CONTEXT> and declared as data.
- User input is sanitized and separated from system instructions.
- Tools only execute after guardrail approval.

## Persistence Model
- AgentRun: one execution instance
- AgentStep: each plan/tool/verify/final record
- ToolInvocation: each tool call (status, args, result)
- SafetyDecision: guardrail output per tool call
- RoutingDecision: model/toolset selection per step
- Evidence: claim->evidence link records
- AgentExperience: practice episodes for future prompts
- AgentMemory: structured memory entries (facts/procedures/preferences)

## Ownership / Authorization
- All queries scoped by userId (x-user-id)
- Unauthorized access returns 404

## Extension Points
- Router: choose provider/model/toolset by mode/cost
- Long-context reader tools: search/read/summarize snippets
- Optional web tools behind ENABLE_WEB_SEARCH

