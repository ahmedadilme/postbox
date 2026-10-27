ALTER TABLE "message"
  ADD COLUMN IF NOT EXISTS "draftShared" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "draftRevision" integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "message_team_shared_drafts_idx"
  ON "message" ("teamId", "folderType", "draftShared", "userId");
