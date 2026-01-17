-- CreateEnum
CREATE TYPE "AutopilotTriggerType" AS ENUM ('submission_evaluated', 'manual');

-- CreateEnum
CREATE TYPE "AutopilotRunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');

-- CreateTable
CREATE TABLE "autopilot_outbox_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload_json" JSONB,
    "dedup_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "autopilot_outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autopilot_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trigger_type" "AutopilotTriggerType" NOT NULL,
    "trigger_key" TEXT NOT NULL,
    "payload_json" JSONB,
    "status" "AutopilotRunStatus" NOT NULL DEFAULT 'queued',
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "result_json" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autopilot_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "autopilot_outbox_events_dedup_key_key" ON "autopilot_outbox_events"("dedup_key");

-- CreateIndex
CREATE INDEX "autopilot_outbox_events_processed_at_idx" ON "autopilot_outbox_events"("processed_at");

-- CreateIndex
CREATE INDEX "autopilot_outbox_events_next_retry_at_idx" ON "autopilot_outbox_events"("next_retry_at");

-- CreateIndex
CREATE UNIQUE INDEX "autopilot_runs_trigger_key_key" ON "autopilot_runs"("trigger_key");

-- CreateIndex
CREATE INDEX "autopilot_runs_user_id_created_at_idx" ON "autopilot_runs"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "autopilot_runs" ADD CONSTRAINT "autopilot_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
