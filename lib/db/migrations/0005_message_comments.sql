CREATE TABLE IF NOT EXISTS "message_comment" (
  "id" serial PRIMARY KEY,
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "messageId" integer NOT NULL REFERENCES "message"("id") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "message_comment_message_created_idx"
  ON "message_comment" ("teamId", "messageId", "createdAt");
