-- Add contactId to Opportunity
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Opportunity_contactId_fkey'
  ) THEN
    ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create Note table
CREATE TABLE IF NOT EXISTS "Note" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Note_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Note_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create Task table
CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "done" BOOLEAN NOT NULL DEFAULT false,
  "doneAt" TIMESTAMP(3),
  "assignedTo" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Task_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
