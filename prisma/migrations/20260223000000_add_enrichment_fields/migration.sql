-- AlterTable Company: add enrichment fields
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "revenue" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "employeeCount" INTEGER;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "enrichedAt" TIMESTAMP(3);

-- AlterTable Contact: add seniority field
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "seniority" TEXT;
