CREATE TABLE IF NOT EXISTS "message_assignment" (
  "id" serial PRIMARY KEY NOT NULL,
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "messageId" integer NOT NULL REFERENCES "message"("id") ON DELETE CASCADE,
  "assignedTo" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "assignedBy" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "message_assignment_message_unique" ON "message_assignment" ("messageId");
