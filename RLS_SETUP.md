# Supabase RLS Integration with Next-Auth

This guide shows how to use Row Level Security (RLS) with Supabase and next-auth.

## Setup

### 1. Environment Variables

Add these to your `.env.local`:

```env
# Existing Supabase vars
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# New: JWT Secret (copy from Supabase Project Settings > API > JWT Secret)
SUPABASE_JWT_SECRET=your_jwt_secret_here
```

To get the JWT secret:
1. Go to Supabase dashboard
2. Navigate to Project Settings → API
3. Copy the "JWT Secret" value
4. Add it to your `.env.local`

### 2. Apply Database Migration

Run the migration to enable RLS on all tables:

```bash
npx prisma migrate deploy
```

This migration enables RLS and creates policies for all tables.

## Usage

### Server Components & Server Actions

Use `getSupabaseServerClient()` to get an authenticated Supabase client:

```typescript
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MyPage() {
  const supabase = await getSupabaseServerClient();
  
  // RLS will automatically enforce based on the current user
  const { data: posts } = await supabase
    .from("Post")
    .select("*");
  
  return <div>{/* ... */}</div>;
}
```

### API Routes

For API routes, get the token and use the helper:

```typescript
import { auth } from "@/auth";
import { generateShortLivedToken } from "@/lib/rls-jwt";
import { getSupabaseClientWithToken } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const session = await auth();
  
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const token = generateShortLivedToken(session.user.id);
  const supabase = getSupabaseClientWithToken(token);
  
  const { data } = await supabase.from("Post").select("*");
  
  return Response.json(data);
}
```

### Client Components (Browser)

Use the `useSupabaseClient` hook:

```typescript
"use client";

import { useSupabaseClient } from "@/hooks/useSupabaseClient";
import { useEffect, useState } from "react";

export function PostList() {
  const supabase = useSupabaseClient();
  const [posts, setPosts] = useState([]);
  
  useEffect(() => {
    if (!supabase) return;
    
    supabase
      .from("Post")
      .select("*")
      .then(({ data }) => setPosts(data || []));
  }, [supabase]);
  
  return <div>{/* ... */}</div>;
}
```

## Security Policies

The migration enables these RLS policies:

### User Table
- Users can view active users and their own profile
- Users can update their own profile
- Admins can view and update all users

### Post Table
- Users can view public posts
- Users can view member-only posts if logged in
- Users can create, update, delete their own posts
- Admins can manage all posts

### Chat & Messages
- Users can only view/access chats they participate in
- Users can only see messages in their chats
- Users can only create messages in chats they're part of

### Post Likes & Saves
- Users can like/save posts they can view
- Users can only manage their own likes and saves

## How It Works

1. **next-auth generates a session** when user logs in
2. **JWT token is created** using the SUPABASE_JWT_SECRET
3. **Token is attached to Supabase client** automatically
4. **Supabase verifies the token** and applies RLS policies
5. **Database enforces access control** at the row level

This ensures:
- ✅ Users can only see data they should see
- ✅ No need to check permissions in application code
- ✅ Attacks are prevented at the database level
- ✅ Works seamlessly with existing next-auth setup

## Removing Prisma Queries

Since you now have RLS, you can replace direct Prisma queries with Supabase queries:

**Before (Prisma):**
```typescript
const user = await prisma.user.findUnique({
  where: { id: userId }
});
```

**After (Supabase with RLS):**
```typescript
const supabase = await getSupabaseServerClient();
const { data: user } = await supabase
  .from("User")
  .select("*")
  .eq("id", userId)
  .single();
```

This is safer because RLS prevents unauthorized access at the database level.

## Testing RLS

To verify RLS is working:

```typescript
// This should only return posts the user can see
const supabase = await getSupabaseServerClient();
const { data: posts } = await supabase
  .from("Post")
  .select("*");

// Try with a different user's token - it should return different data
```

## Troubleshooting

### "SUPABASE_JWT_SECRET is not set"
- Add the JWT secret to `.env.local`
- Restart your development server

### "No rows returned" when data exists
- Check that RLS policies are enabled
- Verify the user has permission to view that data
- Check the policy conditions match your use case

### Token expiration
- Short-lived tokens (5 min) are used in API routes
- Long-lived tokens (1 hour) are used in server components
- Tokens refresh automatically in client components via useSupabaseClient hook

## Next Steps

1. Run `npx prisma migrate deploy` to apply RLS policies
2. Replace Prisma queries with Supabase queries where possible
3. Test that unauthorized users cannot access protected data
4. Monitor API usage to ensure RLS is working correctly
