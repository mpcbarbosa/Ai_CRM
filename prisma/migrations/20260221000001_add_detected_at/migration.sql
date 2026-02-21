-- Add detectedAt to LeadSignal (was missing from previous migration)
ALTER TABLE "LeadSignal" ADD COLUMN IF NOT EXISTS "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
