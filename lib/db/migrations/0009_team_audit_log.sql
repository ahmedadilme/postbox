CREATE TABLE IF NOT EXISTS "team_audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "actorId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "targetType" text NOT NULL,
  "targetId" text NOT NULL,
  "metadata" jsonb,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "team_audit_log_team_created_idx"
  ON "team_audit_log" ("teamId", "createdAt");
