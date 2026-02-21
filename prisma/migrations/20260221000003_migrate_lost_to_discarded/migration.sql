-- Step 2: Migrate existing LOST records to DISCARDED (separate transaction)
UPDATE "Lead" SET status = 'DISCARDED' WHERE status = 'LOST';
