/**
 * EXAMPLE: Server Component with RLS
 * 
 * This shows how to use RLS in server components and server actions.
 */

import { getSupabaseServerClient } from "@/lib/supabase-server";
import { auth } from "@/auth";

// ============================================================================
// Server Component Example
// ============================================================================

/**
 * OLD WAY (Prisma):
 * 
 * export default async function PostsFeed() {
 *   const posts = await prisma.post.findMany({
 *     where: { visibility: "PUBLIC" },
 *     include: { author: true }
 *   });
 *   return <div>{posts.map(p => <PostCard key={p.id} post={p} />)}</div>;
 * }
 * 
 * Problems:
 * - Doesn't respect member-only posts for logged-in users
 * - No RLS enforcement
 * - Need to add visibility checks manually
 */

/**
 * NEW WAY (Supabase with RLS):
 * 
 * RLS automatically:
 * - Shows public posts to everyone
 * - Shows member-only posts only to logged-in users
 * - Shows private posts only to author
 */
export async function PostsFeedExample() {
  const supabase = await getSupabaseServerClient();

  // RLS will filter results based on the current user's permissions
  const { data: posts, error } = await supabase
    .from("Post")
    .select(
      `
      id,
      content,
      imageUrl,
      visibility,
      createdAt,
      authorId,
      author:User!authorId(id, fullName, profileImageKey),
      likes:PostLike(count),
      saves:PostSave(count)
    `
    )
    .order("createdAt", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching posts:", error);
    return <div>Error loading posts</div>;
  }

  return (
    <div>
      {posts?.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

// ============================================================================
// Server Action with RLS
// ============================================================================

/**
 * OLD WAY (Prisma):
 * 
 * "use server"
 * 
 * export async function likePost(postId: string) {
 *   const session = await auth();
 *   if (!session?.user?.id) throw new Error("Unauthorized");
 *   
 *   const existing = await prisma.postLike.findUnique({
 *     where: { postId_userId: { postId, userId: session.user.id } }
 *   });
 *   
 *   if (existing) {
 *     return prisma.postLike.delete({ where: { id: existing.id } });
 *   } else {
 *     return prisma.postLike.create({
 *       data: { postId, userId: session.user.id }
 *     });
 *   }
 * }
 * 
 * Problems:
 * - Need to manually check authentication
 * - Need to verify user can like the post
 * - Authorization logic in business code
 */

/**
 * NEW WAY (Supabase with RLS):
 * 
 * RLS ensures:
 * - Users can only like posts they can view
 * - Database enforces access control
 */
export async function likePostExample(postId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const supabase = await getSupabaseServerClient();

  // First, check if the like already exists
  const { data: existing } = await supabase
    .from("PostLike")
    .select("id")
    .eq("postId", postId)
    .eq("userId", session.user.id)
    .single();

  if (existing) {
    // Remove the like
    const { error } = await supabase
      .from("PostLike")
      .delete()
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
    return { liked: false };
  } else {
    // Add the like
    // RLS policy "Users can create likes" ensures:
    // - User can see the post they're liking
    // - Post is visible to them
    const { error } = await supabase.from("PostLike").insert({
      postId,
      userId: session.user.id,
    });

    if (error) throw new Error(error.message);
    return { liked: true };
  }
}

// ============================================================================
// User Profile Component with RLS
// ============================================================================

/**
 * OLD WAY (Prisma):
 * 
 * export async function UserProfile({ userId }: { userId: string }) {
 *   const user = await prisma.user.findUnique({
 *     where: { id: userId },
 *     include: { posts: { take: 10 } }
 *   });
 *   
 *   if (!user) return <div>User not found</div>;
 *   return <div>{user.name}</div>;
 * }
 * 
 * Problems:
 * - Shows all users, including suspended ones
 * - Shows all posts, regardless of visibility
 * - No visibility control
 */

/**
 * NEW WAY (Supabase with RLS):
 * 
 * RLS ensures:
 * - Can only view active users
 * - Can see own profile even if suspended
 * - Posts are filtered by visibility
 */
export async function UserProfileExample({ userId }: { userId: string }) {
  const supabase = await getSupabaseServerClient();

  // RLS policy "Users can view active users" ensures:
  // - Only active users are returned (unless viewing own profile)
  const { data: user, error: userError } = await supabase
    .from("User")
    .select("id, fullName, bio, profileImageKey, createdAt")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    return <div>User not found</div>;
  }

  // RLS will only return posts the current user can see
  const { data: posts } = await supabase
    .from("Post")
    .select("*")
    .eq("authorId", userId)
    .order("createdAt", { ascending: false })
    .limit(10);

  return (
    <div>
      <h1>{user.fullName}</h1>
      <p>{user.bio}</p>
      <div className="posts">
        {posts?.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Chat Messages with RLS
// ============================================================================

/**
 * OLD WAY (Prisma):
 * 
 * export async function ChatMessages({ chatId }: { chatId: string }) {
 *   const messages = await prisma.message.findMany({
 *     where: { chatId },
 *     include: { sender: true }
 *   });
 *   return <div>{messages.map(m => <Message key={m.id} message={m} />)}</div>;
 * }
 * 
 * Problems:
 * - No check if user is in the chat
 * - Anyone could see any chat's messages
 * - Vulnerable to data leakage
 */

/**
 * NEW WAY (Supabase with RLS):
 * 
 * RLS ensures:
 * - Only chat participants can see messages
 * - Unauthorized users get no results
 * - Database enforces access at row level
 */
export async function ChatMessagesExample({ chatId }: { chatId: string }) {
  const session = await auth();

  if (!session?.user?.id) {
    return <div>Please log in</div>;
  }

  const supabase = await getSupabaseServerClient();

  // RLS policy "Users can view chat messages" ensures:
  // - Only returns messages from chats the user participates in
  // - Returns empty array if user doesn't have access
  const { data: messages, error } = await supabase
    .from("Message")
    .select(
      `
      id,
      text,
      imageUrl,
      createdAt,
      sender:User!senderId(id, fullName, profileImageKey)
    `
    )
    .eq("chatId", chatId)
    .order("createdAt", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return <div>Error loading messages</div>;
  }

  if (!messages || messages.length === 0) {
    return <div>You don't have access to this chat</div>;
  }

  return (
    <div className="messages">
      {messages.map((msg) => (
        <Message key={msg.id} message={msg} />
      ))}
    </div>
  );
}

// ============================================================================
// Admin-Only Component with RLS
// ============================================================================

/**
 * Shows all users - only accessible to admins
 */
export async function AdminUsersList() {
  const session = await auth();

  // Check if admin (could also be done with RLS)
  if (session?.user?.role !== "ADMIN") {
    return <div>Admin access only</div>;
  }

  const supabase = await getSupabaseServerClient();

  // RLS policy "Admins can view all users" ensures:
  // - Only works for admin users
  // - Returns all users for admins
  const { data: users, error } = await supabase
    .from("User")
    .select("id, fullName, email, status, role, createdAt");

  if (error) {
    console.error("Error fetching users:", error);
    return <div>Error loading users</div>;
  }

  return (
    <table>
      <tbody>
        {users?.map((user) => (
          <tr key={user.id}>
            <td>{user.fullName}</td>
            <td>{user.email}</td>
            <td>{user.status}</td>
            <td>{user.role}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Placeholder components - replace with your actual components
function PostCard({ post }: any) {
  return <div>{post.content}</div>;
}

function Message({ message }: any) {
  return <div>{message.text}</div>;
}
