CREATE TABLE IF NOT EXISTS "plan_upgrade_request" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "teamId" uuid NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "requestedBy" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "requestedPlan" text NOT NULL,
  "message" text,
  "status" text NOT NULL DEFAULT 'pending',
  "reviewedBy" text REFERENCES "user"("id") ON DELETE SET NULL,
  "adminNotes" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "reviewedAt" timestamp
);

CREATE INDEX IF NOT EXISTS "plan_upgrade_request_team_status_created_idx"
  ON "plan_upgrade_request" ("teamId", "status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "plan_upgrade_request_one_pending_per_team_idx"
  ON "plan_upgrade_request" ("teamId")
  WHERE "status" = 'pending';
