# RLS + Next-Auth Integration Guide

This document explains how to properly implement Row Level Security (RLS) with Supabase when using next-auth.

## The Problem

You're using next-auth for authentication but Supabase RLS only works with Supabase auth. Without RLS, you need to manually check permissions in your code everywhere, which is:
- Error-prone (easy to miss a check)
- Inefficient (requires application-level filtering)
- Insecure (vulnerable to bypasses)

## The Solution

Create a hybrid approach:
1. **next-auth** handles user sessions and authentication
2. **JWT tokens** are generated using Supabase's JWT secret
3. **Supabase client** is initialized with these JWT tokens
4. **RLS policies** enforce access control at the database level

## Architecture

```
┌─────────────────────┐
│    User logs in     │
│  with next-auth     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Session created with user.id       │
│  (stored in JWT by next-auth)       │
└──────────┬────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Generate Supabase JWT               │
│  - Sign with SUPABASE_JWT_SECRET     │
│  - Include user ID in token          │
│  - Token is short-lived (5 min)      │
└──────────┬─────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Initialize Supabase client          │
│  - Attach JWT token to auth header   │
│  - Supabase verifies token signature │
└──────────┬─────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Execute database query              │
│  - RLS policies check auth.uid()     │
│  - Only allowed rows are returned    │
│  - Unauthorized access is blocked    │
└──────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Get JWT Secret

1. Open Supabase Dashboard
2. Go to **Project Settings → API**
3. Copy the **JWT Secret** (not the public/anon key)
4. Add to `.env.local`:
   ```env
   SUPABASE_JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 2: Install Dependencies

```bash
pnpm add jsonwebtoken
pnpm add -D @types/jsonwebtoken
```

### Step 3: Use the Created Utilities

The following files have been created for you:

- **`src/lib/rls-jwt.ts`** - JWT generation utilities
- **`src/lib/supabase-server.ts`** - Server-side Supabase client
- **`src/hooks/useSupabaseClient.ts`** - Client-side hook
- **`src/app/api/auth/jwt/route.ts`** - JWT endpoint for clients

### Step 4: Apply RLS Migration

```bash
npx prisma migrate deploy
```

This applies the RLS policies defined in:
```
prisma/migrations/20250204000000_enable_rls_policies/migration.sql
```

## Usage Patterns

### Pattern 1: Server Components

```typescript
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MyPage() {
  const supabase = await getSupabaseServerClient();
  
  // Automatically uses RLS based on current user
  const { data: posts } = await supabase
    .from("Post")
    .select("*");
  
  return <div>{posts?.length} posts</div>;
}
```

**What happens:**
1. `getSupabaseServerClient()` gets the current session from next-auth
2. Generates a JWT token using the user's ID
3. Returns a Supabase client with the token attached
4. All queries respect RLS policies

### Pattern 2: Server Actions

```typescript
"use server"

import { getSupabaseServerClient } from "@/lib/supabase-server";

export async function likePost(postId: string) {
  const supabase = await getSupabaseServerClient();
  
  const { error } = await supabase
    .from("PostLike")
    .insert({ postId, userId: session.user.id });
  
  if (error) throw new Error(error.message);
}
```

### Pattern 3: API Routes

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

### Pattern 4: Client Components

```typescript
"use client";

import { useSupabaseClient } from "@/hooks/useSupabaseClient";
import { useEffect, useState } from "react";

export function Posts() {
  const supabase = useSupabaseClient();
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    if (!supabase) return;
    
    supabase
      .from("Post")
      .select("*")
      .then(({ data }) => setPosts(data || []));
  }, [supabase]);

  return <div>{posts.map(p => <div key={p.id}>{p.content}</div>)}</div>;
}
```

**What happens:**
1. Component mounts
2. `useSupabaseClient` hook makes a request to `/api/auth/jwt`
3. JWT endpoint generates a short-lived token
4. Hook initializes Supabase client with the token
5. Component can now make RLS-protected queries

## RLS Policies Included

The migration creates these policies:

### User Table
- View active users and own profile
- Update own profile
- Admins see all users

### Post Table
- View public posts
- Members see member-only posts
- Create, edit, delete own posts
- Like/save visible posts

### Chat & Messages
- View only chats you're in
- Create messages only in your chats
- See only messages from your chats

### Profile Images
- View active users' images
- Manage only your own images

## Security Benefits

1. **Database-level enforcement** - Can't bypass with application code
2. **No authorization checks in code** - RLS handles it automatically
3. **Principle of least privilege** - Users see only what they should
4. **Tamper-proof** - JWT signature verification prevents forgery
5. **Admin support** - Admins can see all data for moderation

## Removing Prisma Queries

Once RLS is enabled, you can replace Prisma queries:

**Before:**
```typescript
const user = await prisma.user.findUnique({ where: { id: userId } });
if (user.status === "ACTIVE") {
  // show user
}
```

**After (with RLS):**
```typescript
const supabase = await getSupabaseServerClient();
const { data: user } = await supabase
  .from("User")
  .select("*")
  .eq("id", userId)
  .single();
// RLS automatically filters out non-active users unless viewing own profile
```

## Token Expiration

- **API Routes**: 5 minutes (short-lived, less risk)
- **Server Components**: 1 hour (matches typical session duration)
- **Client Components**: Tokens are refreshed by the hook on mount

## Troubleshooting

### "SUPABASE_JWT_SECRET is not set"
```
✓ Add to .env.local
✓ Restart dev server
✓ Check you copied the whole secret
```

### "No rows returned" but data exists
```
✓ Check RLS policy conditions match your data
✓ Verify user has permission in the policy
✓ Test with different user roles
✓ Use Supabase Studio to debug policies
```

### Token verification fails
```
✓ Ensure SUPABASE_JWT_SECRET matches your project
✓ Token hasn't expired
✓ Token signature is correct
```

## Files Reference

| File | Purpose |
|------|---------|
| `src/lib/rls-jwt.ts` | JWT token generation and verification |
| `src/lib/supabase-server.ts` | Server-side authenticated Supabase client |
| `src/hooks/useSupabaseClient.ts` | Client-side hook for Supabase queries |
| `src/app/api/auth/jwt/route.ts` | Endpoint to get JWT tokens for frontend |
| `prisma/migrations/20250204000000_enable_rls_policies/migration.sql` | RLS policies for all tables |
| `RLS_SETUP.md` | Detailed setup guide |
| `QUICK_START_RLS.md` | Quick start (3 steps) |
| `src/lib/api-route-examples.ts` | Example API routes |
| `src/lib/server-component-examples.tsx` | Example server components |

## Next Steps

1. ✅ Install dependencies: `pnpm install`
2. ✅ Add `SUPABASE_JWT_SECRET` to `.env.local`
3. ✅ Apply migration: `npx prisma migrate deploy`
4. ✅ Test with: `curl http://localhost:3000/api/auth/jwt`
5. ✅ Replace Prisma queries with Supabase queries
6. ✅ Monitor that RLS is working with test queries

## Questions?

- Check [RLS_SETUP.md](./RLS_SETUP.md) for detailed explanations
- Check [QUICK_START_RLS.md](./QUICK_START_RLS.md) for quick setup
- Check `src/lib/api-route-examples.ts` for API examples
- Check `src/lib/server-component-examples.tsx` for component examples

Good luck! 🚀
