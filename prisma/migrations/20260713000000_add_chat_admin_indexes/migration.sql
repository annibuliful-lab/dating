CREATE INDEX IF NOT EXISTS "Chat_createdAt_idx"
  ON "Chat" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ChatParticipant_chatId_idx"
  ON "ChatParticipant" ("chatId");

CREATE INDEX IF NOT EXISTS "Message_chatId_createdAt_idx"
  ON "Message" ("chatId", "createdAt" DESC);
