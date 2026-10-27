CREATE TABLE IF NOT EXISTS "outgoing_queue" (
  "id" serial PRIMARY KEY,
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "userId" text NOT NULL,
  "accountId" integer NOT NULL REFERENCES "mail_account"("id") ON DELETE CASCADE,
  "payload" jsonb,
  "status" text NOT NULL DEFAULT 'queued',
  "scheduledAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "errorMessage" text
);
CREATE INDEX IF NOT EXISTS "outgoing_queue_due_idx" ON "outgoing_queue" ("status", "scheduledAt");
