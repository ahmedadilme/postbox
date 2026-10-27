-- Preserve sanitized HTML content so the reader can display formatted email bodies.
ALTER TABLE "message"
  ADD COLUMN IF NOT EXISTS "htmlBody" text;
