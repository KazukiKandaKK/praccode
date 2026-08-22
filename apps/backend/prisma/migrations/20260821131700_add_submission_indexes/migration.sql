-- CreateIndex
CREATE INDEX "submissions_user_id_idx" ON "submissions"("user_id");

-- CreateIndex
CREATE INDEX "submissions_exercise_id_idx" ON "submissions"("exercise_id");

-- CreateIndex
CREATE INDEX "submissions_user_id_status_idx" ON "submissions"("user_id", "status");

-- CreateIndex
CREATE INDEX "writing_submissions_user_id_idx" ON "writing_submissions"("user_id");

-- CreateIndex
CREATE INDEX "writing_submissions_challenge_id_idx" ON "writing_submissions"("challenge_id");
