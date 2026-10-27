CREATE TABLE IF NOT EXISTS "message_activity" (
  "id" serial PRIMARY KEY NOT NULL,
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "messageId" integer NOT NULL REFERENCES "message"("id") ON DELETE CASCADE,
  "actorId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "description" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "message_activity_team_message_created_idx"
  ON "message_activity" ("teamId", "messageId", "createdAt");
