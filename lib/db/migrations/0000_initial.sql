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
