ALTER TABLE "Chat"
  ADD COLUMN IF NOT EXISTS "lastMessageId" UUID,
  ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMPTZ(6);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Chat_lastMessageId_fkey'
  ) THEN
    ALTER TABLE "Chat"
      ADD CONSTRAINT "Chat_lastMessageId_fkey"
      FOREIGN KEY ("lastMessageId")
      REFERENCES "Message" ("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "Chat" AS c
SET
  "lastMessageId" = latest.id,
  "lastMessageAt" = latest."createdAt"
FROM (
  SELECT DISTINCT ON ("chatId")
    id,
    "chatId",
    "createdAt"
  FROM "Message"
  ORDER BY "chatId", "createdAt" DESC
) AS latest
WHERE c.id = latest."chatId";

CREATE INDEX IF NOT EXISTS "Chat_lastMessageAt_idx"
  ON "Chat" ("lastMessageAt" DESC);
