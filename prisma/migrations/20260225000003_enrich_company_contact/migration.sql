-- Company new fields
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "legalName"          TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "nif"                TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subsector"          TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "numberOfSites"      INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "phone"              TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "email"              TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "street"             TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "postalCode"         TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "city"               TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "municipality"       TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "district"           TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "digitalMaturityScore" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "partOfGroup"        BOOLEAN;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "parentCompany"      TEXT;

-- Contact new fields
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "department"   TEXT;
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "confidence"   TEXT;
