ALTER TABLE "mail_account"
  ADD COLUMN IF NOT EXISTS "syncAttemptAt" timestamp,
  ADD COLUMN IF NOT EXISTS "syncError" text;

-- A previous process may have died while syncing. Let the scheduler recover it.
UPDATE "mail_account"
SET "syncAttemptAt" = now()
WHERE "syncStatus" = 'syncing' AND "syncAttemptAt" IS NULL;
