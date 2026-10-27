-- Older label actions could race and create duplicate links. Keep one row per
-- message/label pair before adding the uniqueness guarantee.
DELETE FROM "message_label" newer
USING "message_label" older
WHERE newer."messageId" = older."messageId"
  AND newer."labelId" = older."labelId"
  AND newer."id" > older."id";

CREATE UNIQUE INDEX IF NOT EXISTS "message_label_pair_unique"
  ON "message_label" ("messageId", "labelId");
