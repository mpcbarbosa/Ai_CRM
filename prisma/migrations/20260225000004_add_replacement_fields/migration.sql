ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "replacementTier"     TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "replacementScore"    FLOAT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "replacementRationale" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "attackAngle"         TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "recommendedProduct"  TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "entryRole"           TEXT;
