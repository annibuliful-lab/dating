CREATE INDEX IF NOT EXISTS "Message_chatId_senderId_createdAt_idx"
  ON "Message" ("chatId", "senderId", "createdAt" DESC);
