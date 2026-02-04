-- Enable RLS on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Chat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostSave" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OAuthAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProfileImage" ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USER TABLE POLICIES
-- ============================================================================

-- Users can view all active users (public profile information)
CREATE POLICY "Users can view active users" ON "User"
FOR SELECT
USING (status = 'ACTIVE' OR auth.uid() = id);

-- Users can view their own full profile
CREATE POLICY "Users can view their own profile" ON "User"
FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON "User"
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON "User"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Admins can update any user
CREATE POLICY "Admins can update users" ON "User"
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- ============================================================================
-- POST TABLE POLICIES
-- ============================================================================

-- Users can view public posts
CREATE POLICY "Users can view public posts" ON "Post"
FOR SELECT
USING (
  visibility = 'PUBLIC'
  OR auth.uid() = "authorId"
  OR EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Users can view member-only posts if they are logged in
CREATE POLICY "Members can view member posts" ON "Post"
FOR SELECT
USING (
  visibility = 'MEMBERS_ONLY'
  AND auth.uid()::text IS NOT NULL
  OR auth.uid() = "authorId"
);

-- Users can create posts
CREATE POLICY "Users can create posts" ON "Post"
FOR INSERT
WITH CHECK (auth.uid() = "authorId");

-- Users can update their own posts
CREATE POLICY "Users can update own posts" ON "Post"
FOR UPDATE
USING (auth.uid() = "authorId")
WITH CHECK (auth.uid() = "authorId");

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON "Post"
FOR DELETE
USING (auth.uid() = "authorId");

-- Admins can manage all posts
CREATE POLICY "Admins can manage posts" ON "Post"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- ============================================================================
-- CHAT TABLE POLICIES
-- ============================================================================

-- Users can view chats they are part of
CREATE POLICY "Users can view their chats" ON "Chat"
FOR SELECT
USING (
  auth.uid() = "createdById"
  OR EXISTS (
    SELECT 1 FROM "ChatParticipant"
    WHERE "chatId" = id AND "userId" = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Users can create chats
CREATE POLICY "Users can create chats" ON "Chat"
FOR INSERT
WITH CHECK (auth.uid() = "createdById");

-- Users can update chats they created
CREATE POLICY "Users can update own chats" ON "Chat"
FOR UPDATE
USING (auth.uid() = "createdById")
WITH CHECK (auth.uid() = "createdById");

-- Admins can manage all chats
CREATE POLICY "Admins can manage chats" ON "Chat"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- ============================================================================
-- CHAT PARTICIPANT POLICIES
-- ============================================================================

-- Users can view chat participants in chats they belong to
CREATE POLICY "Users can view chat participants" ON "ChatParticipant"
FOR SELECT
USING (
  auth.uid() = "userId"
  OR EXISTS (
    SELECT 1 FROM "Chat"
    WHERE id = "chatId"
    AND (
      "createdById" = auth.uid()
      OR EXISTS (
        SELECT 1 FROM "ChatParticipant" cp
        WHERE cp."chatId" = "Chat".id AND cp."userId" = auth.uid()
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Users can update their own participation (e.g., lastReadAt)
CREATE POLICY "Users can update their own participation" ON "ChatParticipant"
FOR UPDATE
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- Admins can manage all chat participants
CREATE POLICY "Admins can manage chat participants" ON "ChatParticipant"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- ============================================================================
-- MESSAGE POLICIES
-- ============================================================================

-- Users can view messages in chats they participate in
CREATE POLICY "Users can view chat messages" ON "Message"
FOR SELECT
USING (
  auth.uid() = "senderId"
  OR EXISTS (
    SELECT 1 FROM "Chat"
    WHERE id = "chatId"
    AND (
      "createdById" = auth.uid()
      OR EXISTS (
        SELECT 1 FROM "ChatParticipant"
        WHERE "chatId" = "Chat".id AND "userId" = auth.uid()
      )
    )
  )
  OR EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- Users can create messages in chats they participate in
CREATE POLICY "Users can create messages" ON "Message"
FOR INSERT
WITH CHECK (
  auth.uid() = "senderId"
  AND EXISTS (
    SELECT 1 FROM "ChatParticipant"
    WHERE "chatId" = "Message"."chatId"
    AND "userId" = auth.uid()
  )
);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages" ON "Message"
FOR DELETE
USING (auth.uid() = "senderId");

-- Admins can manage all messages
CREATE POLICY "Admins can manage messages" ON "Message"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" WHERE id = auth.uid() AND role = 'ADMIN'
  )
);

-- ============================================================================
-- POST LIKE POLICIES
-- ============================================================================

-- Users can view likes
CREATE POLICY "Users can view post likes" ON "PostLike"
FOR SELECT
USING (true);

-- Users can create likes on visible posts
CREATE POLICY "Users can create likes" ON "PostLike"
FOR INSERT
WITH CHECK (
  auth.uid() = "userId"
  AND EXISTS (
    SELECT 1 FROM "Post"
    WHERE id = "postId"
    AND (
      visibility = 'PUBLIC'
      OR "authorId" = auth.uid()
      OR auth.uid()::text IS NOT NULL AND visibility = 'MEMBERS_ONLY'
    )
  )
);

-- Users can delete their own likes
CREATE POLICY "Users can delete own likes" ON "PostLike"
FOR DELETE
USING (auth.uid() = "userId");

-- ============================================================================
-- POST SAVE POLICIES
-- ============================================================================

-- Users can view their own saves
CREATE POLICY "Users can view own saves" ON "PostSave"
FOR SELECT
USING (auth.uid() = "userId");

-- Users can create saves on visible posts
CREATE POLICY "Users can create saves" ON "PostSave"
FOR INSERT
WITH CHECK (
  auth.uid() = "userId"
  AND EXISTS (
    SELECT 1 FROM "Post"
    WHERE id = "postId"
    AND (
      visibility = 'PUBLIC'
      OR "authorId" = auth.uid()
      OR auth.uid()::text IS NOT NULL AND visibility = 'MEMBERS_ONLY'
    )
  )
);

-- Users can delete their own saves
CREATE POLICY "Users can delete own saves" ON "PostSave"
FOR DELETE
USING (auth.uid() = "userId");

-- ============================================================================
-- OAUTH ACCOUNT POLICIES
-- ============================================================================

-- Users can view their own OAuth accounts
CREATE POLICY "Users can view own OAuth accounts" ON "OAuthAccount"
FOR SELECT
USING (auth.uid() = "userId");

-- Users can create OAuth accounts for themselves
CREATE POLICY "Users can create OAuth accounts" ON "OAuthAccount"
FOR INSERT
WITH CHECK (auth.uid() = "userId");

-- Users can update their own OAuth accounts
CREATE POLICY "Users can update own OAuth accounts" ON "OAuthAccount"
FOR UPDATE
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- Users can delete their own OAuth accounts
CREATE POLICY "Users can delete own OAuth accounts" ON "OAuthAccount"
FOR DELETE
USING (auth.uid() = "userId");

-- ============================================================================
-- SESSION POLICIES
-- ============================================================================

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions" ON "Session"
FOR SELECT
USING (auth.uid() = "userId");

-- Users can delete their own sessions
CREATE POLICY "Users can delete own sessions" ON "Session"
FOR DELETE
USING (auth.uid() = "userId");

-- ============================================================================
-- PROFILE IMAGE POLICIES
-- ============================================================================

-- Users can view profile images of active users
CREATE POLICY "Users can view profile images" ON "ProfileImage"
FOR SELECT
USING (
  auth.uid() = "userId"
  OR EXISTS (
    SELECT 1 FROM "User"
    WHERE id = "userId" AND status = 'ACTIVE'
  )
);

-- Users can create profile images for themselves
CREATE POLICY "Users can create profile images" ON "ProfileImage"
FOR INSERT
WITH CHECK (auth.uid() = "userId");

-- Users can update their own profile images
CREATE POLICY "Users can update own profile images" ON "ProfileImage"
FOR UPDATE
USING (auth.uid() = "userId")
WITH CHECK (auth.uid() = "userId");

-- Users can delete their own profile images
CREATE POLICY "Users can delete own profile images" ON "ProfileImage"
FOR DELETE
USING (auth.uid() = "userId");
