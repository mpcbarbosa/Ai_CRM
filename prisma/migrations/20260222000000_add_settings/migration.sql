CREATE TABLE "Setting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- Default settings
INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES
  ('email_recipients', '[]', NOW()),
  ('mql_threshold', '70', NOW()),
  ('sql_threshold', '100', NOW());
