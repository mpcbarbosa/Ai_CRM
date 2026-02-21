-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COMMERCIAL', 'READONLY');

-- CreateEnum  
CREATE TYPE "AuditAction" AS ENUM ('LEAD_CREATED', 'STATUS_CHANGED', 'SIGNAL_RECEIVED', 'COMPANY_EDITED', 'CONTACT_ADDED', 'ACTIVITY_CREATED', 'OPPORTUNITY_CREATED', 'OPPORTUNITY_UPDATED', 'LEAD_ASSIGNED', 'LEAD_QUALIFIED', 'LEAD_TAGGED', 'NOTE_ADDED', 'SCORE_UPDATED');

-- CreateTable User
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'COMMERCIAL',
  "avatar" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable AuditLog
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "userId" TEXT,
  "userName" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable ScoreHistory
CREATE TABLE "ScoreHistory" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "triggerType" TEXT,
  "agentName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScoreHistory_pkey" PRIMARY KEY ("id")
);

-- AlterTable Lead - add new columns
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lostReason" TEXT;

-- AlterTable Activity - add new columns
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "nextAction" TEXT;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "nextActionAt" TIMESTAMP(3);

-- AlterTable Contact - add new columns
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "linkedin" TEXT;

-- AlterTable Opportunity - add new columns
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "lostReason" TEXT;
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScoreHistory" ADD CONSTRAINT "ScoreHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert system user
INSERT INTO "User" ("id", "email", "name", "role", "isActive", "createdAt", "updatedAt")
VALUES ('system-gobii-agent', 'gobii@system.internal', 'System_GobiiAgent', 'ADMIN', true, NOW(), NOW())
ON CONFLICT ("email") DO NOTHING;
