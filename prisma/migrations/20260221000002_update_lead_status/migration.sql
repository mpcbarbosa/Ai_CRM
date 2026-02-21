-- Step 1: Add new enum values (must be in separate transaction from usage)
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'UNDER_QUALIFICATION';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'DISCARDED';
