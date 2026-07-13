-- Indexes for general user workflows: feed, inbox, direct chat lookup, unread count, and active ads.
CREATE INDEX IF NOT EXISTS "Chat_lastMessageAt_idx"
  ON "Chat" ("lastMessageAt");

CREATE INDEX IF NOT EXISTS "ChatParticipant_userId_idx"
  ON "ChatParticipant" ("userId");

CREATE INDEX IF NOT EXISTS "Message_chatId_createdAt_idx"
  ON "Message" ("chatId", "createdAt");

CREATE INDEX IF NOT EXISTS "Message_chatId_senderId_createdAt_idx"
  ON "Message" ("chatId", "senderId", "createdAt");

CREATE INDEX IF NOT EXISTS "Post_visibility_createdAt_idx"
  ON "Post" ("visibility", "createdAt");

CREATE INDEX IF NOT EXISTS "Ad_isActive_createdAt_idx"
  ON "Ad" ("isActive", "createdAt");
