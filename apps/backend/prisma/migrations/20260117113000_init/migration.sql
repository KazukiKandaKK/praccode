-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LEARNER');

-- CreateEnum
CREATE TYPE "MentorWorkflowStep" AS ENUM ('PLAN', 'DO', 'CHECK', 'NEXT_PLAN');

-- CreateEnum
CREATE TYPE "MentorSprintStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "EvaluationMetricSource" AS ENUM ('READING', 'WRITING');

-- CreateEnum
CREATE TYPE "MentorFeedbackInsightType" AS ENUM ('STRENGTH', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'EVALUATED');

-- CreateEnum
CREATE TYPE "ExerciseStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "WritingChallengeStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "WritingSubmissionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'LEARNER',
    "email_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "email_change_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "new_email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_change_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "genre" TEXT,
    "status" "ExerciseStatus" NOT NULL DEFAULT 'READY',
    "source_type" TEXT NOT NULL DEFAULT 'embedded',
    "source_url" TEXT,
    "code" TEXT NOT NULL,
    "learning_goals" JSONB NOT NULL DEFAULT '[]',
    "created_by_id" TEXT NOT NULL,
    "assigned_to_id" TEXT,
    "is_assessment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_reference_answers" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "question_index" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "ideal_answer_points" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_reference_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_answers" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "question_index" INTEGER NOT NULL,
    "answer_text" TEXT NOT NULL DEFAULT '',
    "score" INTEGER,
    "level" TEXT,
    "llm_feedback" TEXT,
    "aspects" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hints" (
    "id" TEXT NOT NULL,
    "exercise_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "question_index" INTEGER NOT NULL,
    "hint_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_challenges" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "status" "WritingChallengeStatus" NOT NULL DEFAULT 'READY',
    "test_code" TEXT NOT NULL DEFAULT '',
    "starter_code" TEXT,
    "sample_code" TEXT,
    "created_by_id" TEXT,
    "assigned_to_id" TEXT,
    "is_assessment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writing_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "writing_submissions" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "WritingSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "stdout" TEXT,
    "stderr" TEXT,
    "exit_code" INTEGER,
    "passed" BOOLEAN,
    "executed_at" TIMESTAMP(3),
    "llm_feedback" TEXT,
    "llm_feedback_status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "llm_feedback_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "writing_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_learning_analyses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "recommendations" JSONB NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL DEFAULT '',
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_learning_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "preset_answers" JSONB NOT NULL DEFAULT '[]',
    "target_language" TEXT,
    "model_id" TEXT,
    "temperature" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_feedback_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "feedback" JSONB NOT NULL,
    "model_id" TEXT,
    "temperature" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_feedback_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_time_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "duration_sec" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_metrics" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" "EvaluationMetricSource" NOT NULL,
    "aspect" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "submission_id" TEXT,
    "writing_submission_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_feedback_insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mentor_feedback_id" TEXT NOT NULL,
    "type" "MentorFeedbackInsightType" NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "example" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_feedback_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_sprints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "learning_plan_id" TEXT,
    "sequence" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "focus_areas" JSONB NOT NULL DEFAULT '[]',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "MentorSprintStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_workflow_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "current_step" "MentorWorkflowStep" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_threads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "exercise_id" TEXT,
    "submission_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentor_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentor_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastra_threads" (
    "id" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "title" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mastra_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastra_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "tool_call_ids" JSONB,
    "tool_call_args" JSONB,
    "tool_names" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mastra_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "email_change_tokens_token_hash_key" ON "email_change_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_change_tokens_user_id_idx" ON "email_change_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "exercises_assigned_to_id_idx" ON "exercises"("assigned_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_reference_answers_exercise_id_question_index_key" ON "exercise_reference_answers"("exercise_id", "question_index");

-- CreateIndex
CREATE UNIQUE INDEX "submission_answers_submission_id_question_index_key" ON "submission_answers"("submission_id", "question_index");

-- CreateIndex
CREATE INDEX "writing_challenges_assigned_to_id_idx" ON "writing_challenges"("assigned_to_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_learning_analyses_user_id_key" ON "user_learning_analyses"("user_id");

-- CreateIndex
CREATE INDEX "learning_plans_user_id_idx" ON "learning_plans"("user_id");

-- CreateIndex
CREATE INDEX "mentor_feedback_logs_user_id_idx" ON "mentor_feedback_logs"("user_id");

-- CreateIndex
CREATE INDEX "mentor_feedback_logs_submission_id_idx" ON "mentor_feedback_logs"("submission_id");

-- CreateIndex
CREATE INDEX "learning_time_logs_user_id_started_at_idx" ON "learning_time_logs"("user_id", "started_at");

-- CreateIndex
CREATE INDEX "evaluation_metrics_user_id_source_type_created_at_idx" ON "evaluation_metrics"("user_id", "source_type", "created_at");

-- CreateIndex
CREATE INDEX "evaluation_metrics_submission_id_idx" ON "evaluation_metrics"("submission_id");

-- CreateIndex
CREATE INDEX "evaluation_metrics_writing_submission_id_idx" ON "evaluation_metrics"("writing_submission_id");

-- CreateIndex
CREATE INDEX "mentor_feedback_insights_user_id_type_created_at_idx" ON "mentor_feedback_insights"("user_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "mentor_feedback_insights_mentor_feedback_id_idx" ON "mentor_feedback_insights"("mentor_feedback_id");

-- CreateIndex
CREATE INDEX "mentor_sprints_user_id_status_start_date_idx" ON "mentor_sprints"("user_id", "status", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_workflow_states_user_id_key" ON "mentor_workflow_states"("user_id");

-- CreateIndex
CREATE INDEX "mentor_threads_user_id_idx" ON "mentor_threads"("user_id");

-- CreateIndex
CREATE INDEX "mentor_threads_user_id_updated_at_idx" ON "mentor_threads"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "mentor_threads_exercise_id_idx" ON "mentor_threads"("exercise_id");

-- CreateIndex
CREATE INDEX "mentor_threads_submission_id_idx" ON "mentor_threads"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_threads_user_id_exercise_id_key" ON "mentor_threads"("user_id", "exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "mentor_threads_user_id_submission_id_key" ON "mentor_threads"("user_id", "submission_id");

-- CreateIndex
CREATE INDEX "mentor_messages_thread_id_idx" ON "mentor_messages"("thread_id");

-- CreateIndex
CREATE INDEX "mentor_messages_thread_id_created_at_idx" ON "mentor_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "mastra_threads_resource_id_idx" ON "mastra_threads"("resource_id");

-- CreateIndex
CREATE INDEX "mastra_messages_thread_id_idx" ON "mastra_messages"("thread_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_change_tokens" ADD CONSTRAINT "email_change_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_reference_answers" ADD CONSTRAINT "exercise_reference_answers_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_answers" ADD CONSTRAINT "submission_answers_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hints" ADD CONSTRAINT "hints_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hints" ADD CONSTRAINT "hints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_challenges" ADD CONSTRAINT "writing_challenges_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_challenges" ADD CONSTRAINT "writing_challenges_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "writing_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "writing_submissions" ADD CONSTRAINT "writing_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_analyses" ADD CONSTRAINT "user_learning_analyses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_plans" ADD CONSTRAINT "learning_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_feedback_logs" ADD CONSTRAINT "mentor_feedback_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_feedback_logs" ADD CONSTRAINT "mentor_feedback_logs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_time_logs" ADD CONSTRAINT "learning_time_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_metrics" ADD CONSTRAINT "evaluation_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_metrics" ADD CONSTRAINT "evaluation_metrics_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_metrics" ADD CONSTRAINT "evaluation_metrics_writing_submission_id_fkey" FOREIGN KEY ("writing_submission_id") REFERENCES "writing_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_feedback_insights" ADD CONSTRAINT "mentor_feedback_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_feedback_insights" ADD CONSTRAINT "mentor_feedback_insights_mentor_feedback_id_fkey" FOREIGN KEY ("mentor_feedback_id") REFERENCES "mentor_feedback_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_sprints" ADD CONSTRAINT "mentor_sprints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_sprints" ADD CONSTRAINT "mentor_sprints_learning_plan_id_fkey" FOREIGN KEY ("learning_plan_id") REFERENCES "learning_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_workflow_states" ADD CONSTRAINT "mentor_workflow_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_threads" ADD CONSTRAINT "mentor_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_threads" ADD CONSTRAINT "mentor_threads_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_threads" ADD CONSTRAINT "mentor_threads_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentor_messages" ADD CONSTRAINT "mentor_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mentor_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastra_messages" ADD CONSTRAINT "mastra_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "mastra_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

