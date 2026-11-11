-- Postbox schema migration
-- Run after drizzle-kit generate, or apply manually:
--   psql $DATABASE_URL -f lib/db/migrations/0000_initial.sql

-- Better Auth tables
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

-- App tables
CREATE TABLE IF NOT EXISTS "mail_account" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "displayName" text NOT NULL,
  "emailAddress" text NOT NULL,
  "color" text NOT NULL DEFAULT '#2563eb',
  "incomingProtocol" text NOT NULL DEFAULT 'imap',
  "incomingHost" text NOT NULL,
  "incomingPort" integer NOT NULL DEFAULT 993,
  "incomingSecure" boolean NOT NULL DEFAULT true,
  "incomingUsername" text NOT NULL,
  "incomingPassword" text NOT NULL,
  "smtpHost" text NOT NULL,
  "smtpPort" integer NOT NULL DEFAULT 465,
  "smtpSecure" boolean NOT NULL DEFAULT true,
  "smtpUsername" text NOT NULL,
  "smtpPassword" text NOT NULL,
  "signature" text NOT NULL DEFAULT '',
  "syncStatus" text NOT NULL DEFAULT 'idle',
  "lastSyncAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "folder" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "accountId" integer NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'custom',
  "sortOrder" integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "message" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "accountId" integer NOT NULL,
  "folderType" text NOT NULL DEFAULT 'inbox',
  "messageUid" integer,
  "folderPath" text,
  "searchVector" text,
  "fromName" text NOT NULL,
  "fromAddress" text NOT NULL,
  "toAddresses" text NOT NULL DEFAULT '',
  "ccAddresses" text NOT NULL DEFAULT '',
  "subject" text NOT NULL DEFAULT '',
  "preview" text NOT NULL DEFAULT '',
  "body" text NOT NULL DEFAULT '',
  "htmlBody" text,
  "isRead" boolean NOT NULL DEFAULT false,
  "isStarred" boolean NOT NULL DEFAULT false,
  "isFlagged" boolean NOT NULL DEFAULT false,
  "hasAttachments" boolean NOT NULL DEFAULT false,
  "receivedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_user_folder ON "message"("userId", "folderType");
CREATE INDEX IF NOT EXISTS idx_message_account ON "message"("accountId");

-- Full-text search index (optional — enables fast text search)
-- CREATE INDEX IF NOT EXISTS idx_message_search ON "message" USING gin(to_tsvector('english', subject || ' ' || body));

CREATE TABLE IF NOT EXISTS "label" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "name" text NOT NULL,
  "color" text NOT NULL DEFAULT '#6366f1',
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "message_label" (
  "id" serial PRIMARY KEY,
  "messageId" integer NOT NULL REFERENCES "message"(id) ON DELETE CASCADE,
  "labelId" integer NOT NULL REFERENCES "label"(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "attachment" (
  "id" serial PRIMARY KEY,
  "userId" text NOT NULL,
  "messageId" integer NOT NULL REFERENCES "message"(id) ON DELETE CASCADE,
  "filename" text NOT NULL,
  "mimeType" text NOT NULL DEFAULT 'application/octet-stream',
  "size" integer NOT NULL DEFAULT 0
);

-- Tenant tables were added after the original baseline migration. Keep their
-- creation here so a fresh install (and an install that stopped part way
-- through the old migration sequence) has the tables required by later files.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "team" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "plan" text NOT NULL DEFAULT 'free',
  "stripeCustomerId" text,
  "stripeSubscriptionId" text,
  "suspended" boolean NOT NULL DEFAULT false,
  "suspendedAt" timestamp,
  "suspensionReason" text,
  "featureOverrides" jsonb NOT NULL DEFAULT '{}',
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "team_member" (
  "id" serial PRIMARY KEY,
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member',
  "joinedAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "invitation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL DEFAULT 'member',
  "token" text NOT NULL UNIQUE,
  "expiresAt" timestamp NOT NULL,
  "acceptedAt" timestamp,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" serial PRIMARY KEY,
  "adminId" text NOT NULL,
  "action" text NOT NULL,
  "targetType" text NOT NULL,
  "targetId" text NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

-- Add columns that were introduced after the original baseline. IF NOT EXISTS
-- makes this block safe to rerun when recovering a partially migrated database.
ALTER TABLE "mail_account"
  ADD COLUMN IF NOT EXISTS "authType" text NOT NULL DEFAULT 'password',
  ADD COLUMN IF NOT EXISTS "oauthProvider" text,
  ADD COLUMN IF NOT EXISTS "oauthRefreshToken" text,
  ADD COLUMN IF NOT EXISTS "oauthAccessToken" text,
  ADD COLUMN IF NOT EXISTS "oauthTokenExpiresAt" timestamp,
  ADD COLUMN IF NOT EXISTS "syncAttemptAt" timestamp,
  ADD COLUMN IF NOT EXISTS "syncError" text;

ALTER TABLE "message"
  ADD COLUMN IF NOT EXISTS "snoozedUntil" timestamp;

-- Existing users receive one personal team. Associate any pre-tenant mail rows
-- with that team before enforcing the tenant foreign keys below.
INSERT INTO "team" ("name", "slug")
SELECT 'My Team', 'team-' || md5(u."id")
FROM "user" u
WHERE NOT EXISTS (
  SELECT 1 FROM "team_member" tm WHERE tm."userId" = u."id"
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "team_member" ("teamId", "userId", "role")
SELECT t."id", u."id", 'admin'
FROM "user" u
JOIN "team" t ON t."slug" = 'team-' || md5(u."id")
WHERE NOT EXISTS (
  SELECT 1 FROM "team_member" tm WHERE tm."userId" = u."id"
);

DO $$
DECLARE
  table_name text;
  constraint_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['mail_account', 'folder', 'message', 'label', 'attachment'] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "teamId" uuid', table_name);
    EXECUTE format(
      'UPDATE %I AS row_data SET "teamId" = member."teamId" FROM "team_member" AS member WHERE row_data."userId" = member."userId" AND row_data."teamId" IS NULL',
      table_name
    );
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "teamId" SET NOT NULL', table_name);

    constraint_name := table_name || '_teamId_team_id_fk';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = to_regclass(format('%I', table_name))
        AND conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE',
        table_name,
        constraint_name
      );
    END IF;
  END LOOP;
END $$;
