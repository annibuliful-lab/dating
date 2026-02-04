# Before & After: RLS Implementation

This document shows concrete before/after examples of how your code changes with RLS.

## Example 1: Fetching User Profile

### Before (Prisma - No RLS)

```typescript
// Problem: No security at database level
// Problem: Need to manually check status and permissions

export async function GET(req: Request, { params }) {
  const userId = params.id;

  // Manual authorization check
  const session = await auth();

  // Query without filtering
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Manual status check - easy to forget!
  if (user.status !== 'ACTIVE' && user.id !== session?.user?.id) {
    return Response.json(
      { error: 'User not available' },
      { status: 403 },
    );
  }

  return Response.json(user);
}
```

### After (Supabase + RLS)

```typescript
// Benefit: RLS handles all filtering automatically
// Benefit: Simple, clean code

export async function GET(req: Request, { params }) {
  const userId = params.id;

  const session = await auth();
  const token = generateShortLivedToken(session?.user?.id);
  const supabase = getSupabaseClientWithToken(token);

  // RLS automatically:
  // - Shows active users to everyone
  // - Shows own profile even if suspended
  // - Returns null if user doesn't have permission
  const { data: user } = await supabase
    .from('User')
    .select('*')
    .eq('id', userId)
    .single();

  if (!user) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  return Response.json(user);
}
```

**Key Differences:**

- RLS handles status checking automatically
- No manual permission validation
- Cleaner, fewer lines of code
- Database enforces security, not application

---

## Example 2: Updating Own Post

### Before (Prisma - No RLS)

```typescript
// Problem: Three queries needed
// Problem: Authorization checks could be missed
// Problem: Vulnerable to copy-paste errors

export async function PUT(req: Request, { params }) {
  const postId = params.id;
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  // Query 1: Check if post exists and get author
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Manual ownership check - easy to miss!
  if (post.authorId !== session.user.id) {
    return Response.json(
      { error: "Cannot modify other users' posts" },
      { status: 403 },
    );
  }

  // Query 2: Update the post
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      content: body.content,
      imageUrl: body.imageUrl,
      visibility: body.visibility,
    },
  });

  return Response.json(updated);
}
```

### After (Supabase + RLS)

```typescript
// Benefit: Single query with automatic security
// Benefit: No manual authorization needed
// Benefit: RLS prevents unauthorized updates

export async function PUT(req: Request, { params }) {
  const postId = params.id;
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const token = generateShortLivedToken(session.user.id);
  const supabase = getSupabaseClientWithToken(token);

  // Single query - RLS handles everything:
  // - Can only update if user is the author
  // - Returns 0 rows if unauthorized
  const { data: updated } = await supabase
    .from('Post')
    .update({
      content: body.content,
      imageUrl: body.imageUrl,
      visibility: body.visibility,
    })
    .eq('id', postId)
    .select()
    .single();

  if (!updated) {
    return Response.json(
      { error: 'Post not found or no permission to modify' },
      { status: 404 },
    );
  }

  return Response.json(updated);
}
```

**Key Differences:**

- One query instead of two
- No manual ownership check
- RLS prevents unauthorized updates at database level
- Much simpler error handling

---

## Example 3: Viewing Chat Messages

### Before (Prisma - No RLS)

```typescript
// Problem: No check if user is in the chat
// Problem: Vulnerable to unauthorized access
// Problem: Easy to accidentally expose messages

export async function GET(req: Request, { params }) {
  const chatId = params.chatId;
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Query 1: Check if user is a participant
  const participant = await prisma.chatParticipant.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId: session.user.id,
      },
    },
  });

  if (!participant) {
    return Response.json(
      { error: 'You are not a member of this chat' },
      { status: 403 },
    );
  }

  // Query 2: Get messages
  // But what if someone manually edited the request?
  // Still need to fetch and validate messages belong to this chat
  const messages = await prisma.message.findMany({
    where: { chatId },
    include: { sender: true },
    orderBy: { createdAt: 'asc' },
  });

  return Response.json(messages);
}
```

### After (Supabase + RLS)

```typescript
// Benefit: RLS enforces chat membership
// Benefit: Cannot bypass with request manipulation
// Benefit: Database level security

export async function GET(req: Request, { params }) {
  const chatId = params.chatId;
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = generateShortLivedToken(session.user.id);
  const supabase = getSupabaseClientWithToken(token);

  // Single query - RLS checks:
  // - Is user a chat participant?
  // - Does this chat exist?
  // - Returns empty array if no access
  const { data: messages } = await supabase
    .from('Message')
    .select(
      `
      id, text, imageUrl, createdAt,
      sender:User!senderId(id, fullName, profileImageKey)
    `,
    )
    .eq('chatId', chatId)
    .order('createdAt', { ascending: true });

  // Even if user manually modifies chatId in request,
  // RLS prevents seeing unauthorized messages
  return Response.json(messages || []);
}
```

**Key Differences:**

- One query instead of two
- RLS enforces participation check
- Cannot bypass with request manipulation
- Even if attacker changes chatId, RLS blocks unauthorized access

---

## Example 4: Liking a Post

### Before (Prisma - No RLS)

```typescript
// Problem: Need to check post exists and is visible
// Problem: Need to check if already liked
// Problem: Multiple authorization checks

'use server';

export async function likePost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  // Query 1: Check if post exists and is visible
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) throw new Error('Post not found');

  // Manual visibility check
  if (
    post.visibility === 'PRIVATE' &&
    post.authorId !== session.user.id
  ) {
    throw new Error('Cannot like this post');
  }

  // Query 2: Check if already liked
  const existing = await prisma.postLike.findUnique({
    where: {
      postId_userId: {
        postId,
        userId: session.user.id,
      },
    },
  });

  if (existing) {
    // Query 3: Unlike
    await prisma.postLike.delete({
      where: { id: existing.id },
    });
    return { liked: false };
  } else {
    // Query 4: Like
    await prisma.postLike.create({
      data: { postId, userId: session.user.id },
    });
    return { liked: true };
  }
}
```

### After (Supabase + RLS)

```typescript
// Benefit: RLS handles visibility check
// Benefit: Fewer queries
// Benefit: Cannot like posts you can't see

'use server';

export async function likePost(postId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const supabase = await getSupabaseServerClient();

  // Query 1: Check if already liked
  const { data: existing } = await supabase
    .from('PostLike')
    .select('id')
    .eq('postId', postId)
    .eq('userId', session.user.id)
    .single();

  if (existing) {
    // Unlike
    await supabase.from('PostLike').delete().eq('id', existing.id);
    return { liked: false };
  } else {
    // Like - RLS checks:
    // - Post exists and is visible to user
    // - User has permission to like
    const { error } = await supabase.from('PostLike').insert({
      postId,
      userId: session.user.id,
    });

    if (error) {
      throw new Error('Cannot like this post');
    }
    return { liked: true };
  }
}
```

**Key Differences:**

- RLS handles post visibility check
- Fewer manual checks
- Cannot like posts you can't see (enforced at database)
- Simpler error handling

---

## Security Comparison

| Aspect                   | Before (Prisma)            | After (RLS)                       |
| ------------------------ | -------------------------- | --------------------------------- |
| **Authorization Checks** | Manual (in code)           | Automatic (database)              |
| **Default Security**     | Insecure (must remember)   | Secure by default                 |
| **Error Prone**          | Easy to forget checks      | Cannot forget (database enforced) |
| **Code Duplication**     | Often repeated             | Single source of truth            |
| **Attack Surface**       | Large (every route)        | Small (database policies)         |
| **Maintainability**      | Hard (scattered checks)    | Easy (centralized policies)       |
| **Performance**          | Need application filtering | Database filters (faster)         |

---

## Cost Comparison

### Before (Without RLS)

```
✗ Every endpoint needs authorization logic
✗ Authorization logic repeated across routes
✗ Need to fetch extra data to check permissions
✗ Risk of missing authorization checks
✗ Harder to audit security
✗ More code to maintain
✗ Vulnerable to mistakes
```

### After (With RLS)

```
✓ Authorization in one place (database)
✓ No code duplication
✓ Authorization enforced at database level
✓ Cannot miss checks (impossible to bypass)
✓ Easy to audit (just check policies)
✓ Less code to maintain
✓ Secure by default
```

---

## Confidence Levels

### Before

```
⚠️ Did I check permissions?
⚠️ Did I check visibility?
⚠️ Did I check ownership?
⚠️ What if someone modifies the request?
⚠️ Is this route vulnerable?
```

### After

```
✅ RLS checks permissions
✅ RLS checks visibility
✅ RLS checks ownership
✅ RLS prevents request tampering
✅ This route is secure
```

---

This is why implementing RLS is so important for security and maintainability! 🔒
