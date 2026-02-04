# RLS Migration Checklist

This checklist helps you systematically migrate your existing API routes and components to use RLS.

## Pre-Flight Checklist

- [ ] Add `SUPABASE_JWT_SECRET` to `.env.local`
- [ ] Run `pnpm install` (for jsonwebtoken)
- [ ] Run `npx prisma migrate deploy` (to apply RLS policies)
- [ ] Restart dev server
- [ ] Test JWT endpoint: `curl http://localhost:3000/api/auth/jwt` (while logged in)

## Phase 1: API Routes (Start Here)

RLS policies are most effective when enforced at API boundaries.

### User APIs

- [ ] `/api/user/profile` - GET current user profile
- [ ] `/api/user/profile` - PUT update profile
- [ ] `/api/user/login` - POST (if using API auth)
- [ ] `/api/users/[id]` - GET user by ID (respects status)

### Post APIs

- [ ] `/api/posts` - GET all posts (filters by visibility)
- [ ] `/api/posts` - POST create post (enforces authorId)
- [ ] `/api/posts/[id]` - PUT update post (checks ownership)
- [ ] `/api/posts/[id]` - DELETE delete post (checks ownership)
- [ ] `/api/posts/[id]/like` - POST like post
- [ ] `/api/posts/[id]/save` - POST save post

### Chat APIs

- [ ] `/api/chats` - GET user's chats
- [ ] `/api/chats` - POST create chat
- [ ] `/api/chats/[id]/messages` - GET messages (checks membership)
- [ ] `/api/chats/[id]/messages` - POST send message
- [ ] `/api/chats/[id]/participants` - GET participants

### Admin APIs

- [ ] `/api/admin/users` - GET all users (admin only)
- [ ] `/api/admin/posts` - GET all posts (admin only)
- [ ] `/api/admin/chats` - GET all chats (admin only)

## Phase 2: Server Components

Server Components can use `getSupabaseServerClient()` for RLS.

### User Pages

- [ ] `src/app/profile/[userId]/page.tsx` - User profile view
- [ ] `src/app/profile/edit/page.tsx` - Edit own profile

### Feed/Discovery

- [ ] `src/app/feed/page.tsx` - Main feed (visibility filtering)
- [ ] `src/app/users/page.tsx` - Discover users (active only)

### Messaging

- [ ] `src/app/inbox/page.tsx` - List user's chats
- [ ] `src/app/chats/[id]/page.tsx` - Chat messages (membership check)

### Admin

- [ ] `src/app/admin/users/page.tsx` - User management
- [ ] `src/app/admin/posts/page.tsx` - Post moderation
- [ ] `src/app/admin/chats/page.tsx` - Chat moderation

## Phase 3: Client Components

Use `useSupabaseClient()` hook for client-side queries.

### Feed Components

- [ ] Like button component (liking posts)
- [ ] Save button component (saving posts)
- [ ] Delete post component (checking ownership)

### Chat Components

- [ ] Message list (scrolling/infinite scroll)
- [ ] Send message component
- [ ] Chat list (real-time updates)

### User Components

- [ ] User card (profile preview)
- [ ] Follow/block actions
- [ ] Profile image gallery

## Phase 4: Server Actions

Server Actions in components use `getSupabaseServerClient()`.

- [ ] Like/unlike post action
- [ ] Save/unsave post action
- [ ] Delete post action
- [ ] Send message action
- [ ] Create chat action
- [ ] Update profile action

## Phase 5: Hooks

Custom hooks that use Supabase.

- [ ] `usePosts()` - Fetch posts with pagination
- [ ] `useMessages()` - Fetch chat messages
- [ ] `useUser()` - Fetch user profile
- [ ] `useChats()` - Fetch user's chats
- [ ] Update existing hooks to use Supabase instead of Prisma

## Migration Patterns

### Pattern 1: Simple GET Endpoint

Before (Prisma):

```typescript
export async function GET(req: Request, { params }) {
  const { data: post } = await supabase
    .from('Post')
    .select('*')
    .eq('id', params.id)
    .single();
  return Response.json(post);
}
```

After (RLS - same code!):

```typescript
const session = await auth();
const token = generateShortLivedToken(session.user.id);
const supabase = getSupabaseClientWithToken(token);

const { data: post } = await supabase
  .from('Post')
  .select('*')
  .eq('id', params.id)
  .single();
// RLS automatically filters by visibility
return Response.json(post);
```

### Pattern 2: Create/Modify Endpoint

Before (Prisma):

```typescript
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return Response.json({ error: 'Unauthorized' });

  const body = await req.json();
  const post = await prisma.post.create({
    data: { ...body, authorId: session.user.id },
  });
  return Response.json(post);
}
```

After (RLS):

```typescript
const session = await auth();
if (!session?.user?.id)
  return Response.json({ error: 'Unauthorized' });

const token = generateShortLivedToken(session.user.id);
const supabase = getSupabaseClientWithToken(token);

const body = await req.json();
const { data: post } = await supabase
  .from('Post')
  .insert({ ...body, authorId: session.user.id })
  .select()
  .single();
// RLS "Users can create posts" ensures authorId == auth.uid()
return Response.json(post);
```

### Pattern 3: Update Own Resource

Before (Prisma):

```typescript
const post = await prisma.post.findUnique({ where: { id: postId } });
if (post.authorId !== session.user.id) {
  return Response.json({ error: 'Forbidden' }, { status: 403 });
}
const updated = await prisma.post.update({
  where: { id: postId },
  data: body,
});
return Response.json(updated);
```

After (RLS - much simpler!):

```typescript
const token = generateShortLivedToken(session.user.id);
const supabase = getSupabaseClientWithToken(token);

const { data: updated } = await supabase
  .from('Post')
  .update(body)
  .eq('id', postId)
  .select()
  .single();
// RLS "Users can update own posts" enforces ownership
// If user isn't the author, updated will be null
if (!updated)
  return Response.json({ error: 'Forbidden' }, { status: 403 });
return Response.json(updated);
```

## Testing Your Changes

### Test Checklist

For each endpoint/component, test:

- [ ] **Authorized user** can access their own data
- [ ] **Different user** cannot access data
- [ ] **Admin user** can access all data
- [ ] **Unauthenticated user** cannot access protected data
- [ ] **Visibility rules** work correctly (public vs member-only)
- [ ] **Cascading deletes** work with RLS
- [ ] **Relationships** are properly loaded with RLS

### Manual Testing

```typescript
// 1. Test as User A
const supabase = await getSupabaseServerClient();
const { data } = await supabase.from('Post').select('*');
// Should see only posts User A can view

// 2. Test as User B (switch user)
const { data } = await supabase.from('Post').select('*');
// Should see only posts User B can view (different results)

// 3. Test unauthorized query
const { data } = await supabase
  .from('User')
  .update({ status: 'SUSPENDED' })
  .eq('id', 'some-other-user-id');
// Should return 0 rows updated (RLS prevents it)
```

## Debugging RLS Issues

### If a query returns no data when it should:

1. Check that RLS policies exist: `SELECT * FROM pg_policies WHERE tablname = 'User';`
2. Verify the JWT token: Decode it to check user ID is correct
3. Check policy conditions: Are they matching your test case?
4. Enable RLS logs in Supabase dashboard (if available)
5. Test with Supabase Studio using the JWT token

### If you're getting permission errors:

1. Make sure `SUPABASE_JWT_SECRET` is correct
2. Verify token hasn't expired
3. Check that the user exists in the User table
4. Make sure role in policy matches user's role in RLS policies

## Common Mistakes to Avoid

❌ **Don't** use client's Supabase instance in server components
✅ **Do** use `getSupabaseServerClient()` in server components

❌ **Don't** forget to add JWT secret to environment
✅ **Do** copy it from Supabase dashboard settings

❌ **Don't** forget user authorization checks
✅ **Do** let RLS handle authorization (once implemented)

❌ **Don't** assume a query will return data
✅ **Do** check the response for null (permission denied)

❌ **Don't** hardcode user IDs in queries
✅ **Do** use `auth.uid()` in policies

## Rollback Plan

If RLS causes issues, you can temporarily disable it:

```sql
ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
-- ... repeat for other tables
```

Then re-enable:

```sql
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
-- ... repeat for other tables
```

Or drop all policies and start over:

```sql
DROP POLICY IF EXISTS "Users can view active users" ON "User";
-- ... etc
```

## Success Metrics

✅ All endpoints return correct data per user's permissions
✅ Unauthorized access is blocked at database level
✅ No authorization checks needed in application code
✅ Admin users can see all data
✅ Performance is good (queries are fast)
✅ Tests pass for all user roles

---

## Next Steps

1. Follow Phase 1 (API Routes) first
2. Then Phase 2 (Server Components)
3. Then Phase 3 (Client Components)
4. Test as you go
5. Monitor database queries in Supabase dashboard

Good luck! Check the example files if you get stuck. 🚀
