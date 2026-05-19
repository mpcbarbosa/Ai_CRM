-- F3: indexes for frequent query patterns.
-- All tables are small (< 2k rows in prod as of 2026-05-19), so CREATE INDEX
-- without CONCURRENTLY is fine — bounded blocking writes for milliseconds.
-- Names follow Prisma's convention (Table_col_idx, Table_col1_col2_idx) so
-- that `prisma migrate diff` against the schema doesn't report drift.

CREATE INDEX "LeadSignal_triggerType_idx" ON "LeadSignal"("triggerType");
CREATE INDEX "LeadSignal_companyId_createdAt_idx" ON "LeadSignal"("companyId", "createdAt" DESC);

CREATE INDEX "Activity_leadId_createdAt_idx" ON "Activity"("leadId", "createdAt" DESC);

CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_nextContactDate_idx" ON "Lead"("nextContactDate");

CREATE INDEX "AuditLog_leadId_createdAt_idx" ON "AuditLog"("leadId", "createdAt" DESC);

CREATE INDEX "ScoreHistory_leadId_createdAt_idx" ON "ScoreHistory"("leadId", "createdAt");

CREATE INDEX "Note_leadId_createdAt_idx" ON "Note"("leadId", "createdAt" DESC);

CREATE INDEX "Task_leadId_done_dueAt_idx" ON "Task"("leadId", "done", "dueAt");
