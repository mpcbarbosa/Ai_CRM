-- Update LeadStatus enum: add UNDER_QUALIFICATION, DISCARDED; keep LOST for backwards compat
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'UNDER_QUALIFICATION';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'DISCARDED';
-- Migrate existing LOST to DISCARDED
UPDATE "Lead" SET status = 'DISCARDED' WHERE status = 'LOST';
