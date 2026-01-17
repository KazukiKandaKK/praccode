-- CreateEnum
CREATE TYPE "AgentRunMode" AS ENUM ('mentor', 'coach', 'deep_research', 'code_assist', 'generic');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AgentStepKind" AS ENUM ('plan', 'tool', 'verify', 'final', 'note');

-- CreateEnum
CREATE TYPE "ToolInvocationStatus" AS ENUM ('success', 'failed', 'blocked', 'needs_confirmation');

-- CreateEnum
CREATE TYPE "SafetyDecisionType" AS ENUM ('allow', 'block', 'confirm');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('exercise', 'submission', 'progress', 'web', 'memory', 'other');

-- CreateEnum
CREATE TYPE "AgentMemoryType" AS ENUM ('fact', 'procedure', 'preference', 'warning', 'concept');

-- CreateTable
CREATE TABLE "agent_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mode" "AgentRunMode" NOT NULL,
    "goal" TEXT NOT NULL,
    "input_json" JSONB,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "result_json" JSONB,
    "error_message" TEXT,

    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_steps" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_index" INTEGER NOT NULL,
    "kind" "AgentStepKind" NOT NULL,
    "input_json" JSONB,
    "output_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_invocations" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "args_json" JSONB,
    "result_json" JSONB,
    "status" "ToolInvocationStatus" NOT NULL DEFAULT 'success',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,

    CONSTRAINT "tool_invocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety_decisions" (
    "id" TEXT NOT NULL,
    "invocation_id" TEXT NOT NULL,
    "decision" "SafetyDecisionType" NOT NULL,
    "reasons_json" JSONB,
    "feedback_to_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routing_decisions" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT,
    "chosen_provider" TEXT NOT NULL,
    "chosen_model" TEXT NOT NULL,
    "toolset" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routing_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_evidence" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "evidence_text" TEXT NOT NULL,
    "source_type" "EvidenceSourceType" NOT NULL,
    "source_ref" TEXT,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_experiences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tags" JSONB,
    "situation" TEXT NOT NULL,
    "actions_summary" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "eval_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "AgentMemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "links_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_runs_user_id_updated_at_idx" ON "agent_runs"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "agent_steps_run_id_step_index_idx" ON "agent_steps"("run_id", "step_index");

-- CreateIndex
CREATE INDEX "tool_invocations_run_id_started_at_idx" ON "tool_invocations"("run_id", "started_at");

-- CreateIndex
CREATE INDEX "tool_invocations_step_id_idx" ON "tool_invocations"("step_id");

-- CreateIndex
CREATE INDEX "safety_decisions_invocation_id_idx" ON "safety_decisions"("invocation_id");

-- CreateIndex
CREATE INDEX "routing_decisions_run_id_created_at_idx" ON "routing_decisions"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_evidence_run_id_created_at_idx" ON "agent_evidence"("run_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_experiences_user_id_created_at_idx" ON "agent_experiences"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_memories_user_id_type_created_at_idx" ON "agent_memories"("user_id", "type", "created_at");

-- AddForeignKey
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_steps" ADD CONSTRAINT "agent_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_invocations" ADD CONSTRAINT "tool_invocations_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "agent_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_decisions" ADD CONSTRAINT "safety_decisions_invocation_id_fkey" FOREIGN KEY ("invocation_id") REFERENCES "tool_invocations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routing_decisions" ADD CONSTRAINT "routing_decisions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "agent_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_evidence" ADD CONSTRAINT "agent_evidence_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "agent_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_experiences" ADD CONSTRAINT "agent_experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
