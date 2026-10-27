-- Multiple rich-text signatures per mail account.
ALTER TABLE "mail_account"
  ADD COLUMN IF NOT EXISTS "defaultSignatureId" integer;

CREATE TABLE IF NOT EXISTS "mail_signature" (
  "id" serial PRIMARY KEY,
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "userId" text NOT NULL,
  "accountId" integer NOT NULL,
  "name" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "isDefault" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

-- Preserve existing single-signature account settings as the account's default.
INSERT INTO "mail_signature" ("teamId", "userId", "accountId", "name", "body", "isDefault")
SELECT a."teamId", a."userId", a."id", 'Default', a."signature", true
FROM "mail_account" a
WHERE COALESCE(a."signature", '') <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "mail_signature" s
    WHERE s."teamId" = a."teamId" AND s."accountId" = a."id"
  );

UPDATE "mail_account" a
SET "defaultSignatureId" = s."id"
FROM "mail_signature" s
WHERE s."teamId" = a."teamId"
  AND s."accountId" = a."id"
  AND s."isDefault" = true
  AND a."defaultSignatureId" IS NULL;
