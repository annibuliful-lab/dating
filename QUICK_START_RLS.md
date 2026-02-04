# Quick Start: RLS with Next-Auth

Get Row Level Security working in 3 steps:

## Step 1: Add Environment Variable

Get your JWT secret from Supabase and add to `.env.local`:

```env
SUPABASE_JWT_SECRET=your_jwt_secret_from_supabase_dashboard
```

**How to find it:**
1. Go to Supabase Dashboard
2. Project Settings → API → JWT Secret
3. Copy and paste into `.env.local`

## Step 2: Apply Database Migration

Run the migration to enable RLS:

```bash
npx prisma migrate deploy
```

This creates RLS policies for all tables automatically.

## Step 3: Update Your Code

### For Server Components:
```typescript
import { getSupabaseServerClient } from "@/lib/supabase-server";

export default async function MyPage() {
  const supabase = await getSupabaseServerClient();
  
  // RLS automatically filters data based on current user
  const { data } = await supabase.from("Post").select("*");
  
  return <div>{data?.length} posts</div>;
}
```

### For Client Components:
```typescript
"use client";

import { useSupabaseClient } from "@/hooks/useSupabaseClient";
import { useEffect, useState } from "react";

export function Posts() {
  const supabase = useSupabaseClient();
  const [posts, setPosts] = useState([]);
  
  useEffect(() => {
    if (!supabase) return;
    supabase.from("Post").select("*").then(({ data }) => setPosts(data || []));
  }, [supabase]);
  
  return <div>{posts.map(p => <div key={p.id}>{p.content}</div>)}</div>;
}
```

### For API Routes:
```typescript
import { auth } from "@/auth";
import { generateShortLivedToken } from "@/lib/rls-jwt";
import { getSupabaseClientWithToken } from "@/lib/supabase-server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  
  const token = generateShortLivedToken(session.user.id);
  const supabase = getSupabaseClientWithToken(token);
  
  const { data } = await supabase.from("Post").select("*");
  return Response.json(data);
}
```

---

## That's It! 🎉

RLS is now enabled. Users can only see data they should see, enforced at the database level.

### What Happens Next:

1. ✅ Users see only posts they can view (public/members-only/own)
2. ✅ Users can only modify their own posts
3. ✅ Users can only see chats they're part of
4. ✅ Admins can see everything
5. ✅ All access control happens at database level (more secure)

### What to Do Now:

- Replace Prisma queries with Supabase queries where possible
- Test that unauthorized access is blocked
- Check the full [RLS_SETUP.md](./RLS_SETUP.md) for detailed explanations

### Files Created:

- `src/lib/rls-jwt.ts` - JWT token generation
- `src/lib/supabase-server.ts` - Server-side Supabase client
- `src/hooks/useSupabaseClient.ts` - Client-side hook
- `src/app/api/auth/jwt/route.ts` - JWT endpoint
- `prisma/migrations/20250204000000_enable_rls_policies/migration.sql` - RLS policies
- `RLS_SETUP.md` - Detailed guide
- `QUICK_START_RLS.md` - This file

### Troubleshooting:

**"SUPABASE_JWT_SECRET is not set"**
→ Add it to `.env.local` and restart dev server

**"No rows returned" but data exists**
→ Check RLS policies match your use case in the migration file

**Want to modify RLS policies?**
→ Edit `prisma/migrations/20250204000000_enable_rls_policies/migration.sql` and run `npx prisma migrate deploy` again
