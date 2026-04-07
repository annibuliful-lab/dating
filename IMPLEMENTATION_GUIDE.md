# Implementation Guide: Applying Supabase Optimizations

This guide shows step-by-step how to apply the optimization patterns to your existing code.

## Step 1: Update Service Layer (Critical)

### Replace `src/services/supabase/posts.ts`

**Change:** Update the `getPublicPosts()` method to deduplicate verified user fetches.

```diff
- // First query for posts
- const { data, error } = await supabase.from('Post').select(...)
-
- // Extract verified IDs (client-side)
- const verifiedByUserIds = data?.map(p => p.User?.verifiedBy).filter(Boolean) || []
-
- // Second query for EACH verified user (N+1!)
- if (verifiedByUserIds.length > 0) {
-   const { data: verifiedByUsers } = await supabase
-     .from('User')
-     .select('id, username')
-     .in('id', verifiedByUserIds)
+ // Single optimized query - collect UNIQUE IDs first
+ const verifiedByUserIds = [
+   ...new Set(
+     data?.map(p => p.User?.verifiedBy).filter(Boolean) || []
+   )
+ ]
+
+ // Batch fetch in groups of 100 (single query per batch, not N queries)
+ const verifiedByUsernames = {}
+ if (verifiedByUserIds.length > 0) {
+   const batchSize = 100
+   for (let i = 0; i < verifiedByUserIds.length; i += batchSize) {
+     const batch = verifiedByUserIds.slice(i, i + batchSize)
+     const { data: verifiedByUsers } = await supabase
+       .from('User')
+       .select('id, username')
+       .in('id', batch)
```

**File:** `src/services/supabase/posts.optimized.ts` (already created)

### Add Batch User Fetch

**In `src/services/supabase/users.ts`, add this method:**

```typescript
// ✅ NEW: Batch fetch multiple users efficiently
async getUsersByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('User')
    .select('*')
    .in('id', ids);

  if (error) throw new Error(error.message);
  return data || [];
}
```

---

## Step 2: Add Caching Layer

### Update `src/services/supabase/users.ts`

```typescript
import { withCache, getCacheKey } from '@/lib/supabase-optimization';

export const userService = {
  async getActiveUsers() {
    // ✅ NEW: Wrap with cache
    return withCache(
      getCacheKey('activeUsers'),
      async () => {
        const { data, error } = await supabase
          .from('User')
          .select('*')
          .eq('status', 'ACTIVE')
          .order('createdAt', { ascending: false });

        if (error) throw new Error(error.message);
        return data;
      },
      5 * 60 * 1000, // 5 minute cache
    );
  },

  async getUserProfile(id: string) {
    // ✅ NEW: Cache individual profiles with user ID in key
    return withCache(
      getCacheKey('userProfile', id),
      async () => {
        const { data, error } = await supabase
          .from('User')
          .select(
            'id, fullName, username, age, gender, bio, profileImageKey, height, weight, relationShipStatus',
          )
          .eq('id', id)
          .single();

        if (error) throw new Error(error.message);
        return data;
      },
      10 * 60 * 1000, // 10 minute cache
    );
  },
};
```

---

## Step 3: Optimize React Hooks

### Update `src/hooks/usePosts.ts`

```typescript
import { postService } from '@/services/post';
import { useCallback, useEffect, useState } from 'react';
import {
  deduplicatedFetch,
  prefetch,
  getCacheKey,
} from '@/lib/supabase-optimization';

export function usePublicPosts(limit = 20) {
  const [posts, setPosts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = useCallback(
    async (offset = 0, isRefresh = false) => {
      try {
        if (isRefresh) {
          setLoading(true);
        } else if (offset === 0) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        // ✅ NEW: Deduplicate if multiple components fetch simultaneously
        const data = await deduplicatedFetch(
          getCacheKey('posts', offset),
          () => postService.getPublicPosts(limit, offset),
        );

        if (data.length < limit) {
          setHasMore(false);
        } else {
          setHasMore(true);

          // ✅ NEW: Prefetch next page in background
          prefetch(
            getCacheKey('posts', offset + limit),
            () => postService.getPublicPosts(limit, offset + limit),
            { delay: 1000, cache: true },
          );
        }

        setPosts((prev) =>
          offset === 0 ? data : [...prev, ...data],
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to fetch posts'),
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  return { posts, loading, loadingMore, error, hasMore, fetchPosts };
}
```

---

## Step 4: Optimize API Routes

### Check `/src/app/api/chat/[chatId]/route.ts` (example)

If you have a chat API that returns messages with users, optimize it:

```typescript
// ❌ BEFORE: Might call getUserById in a loop
const messages = await messageService.getChatMessages(chatId);
const enrichedMessages = messages.map(async (msg) => ({
  ...msg,
  user: await userService.getUserById(msg.senderId), // N+1!
}));

// ✅ AFTER: Batch fetch all users
const messages = await messageService.getChatMessages(chatId);
const userIds = [...new Set(messages.map((m) => m.senderId))];
const users = await userService.getUsersByIds(userIds);
const usersMap = Object.fromEntries(users.map((u) => [u.id, u]));

const enrichedMessages = messages.map((msg) => ({
  ...msg,
  user: usersMap[msg.senderId],
}));
```

---

## Step 5: Bulk Update Checklist

### For Each Service File:

- [ ] **Identify N+1 patterns:** Look for loops containing queries
- [ ] **Replace with batch queries:** Use `.in()` with arrays
- [ ] **Add caching:** Wrap queries with `withCache()` for frequently accessed data
- [ ] **Deduplicate:** Use `deduplicatedFetch()` for concurrent requests
- [ ] **Field selection:** Only select needed columns

### Priority Files to Update:

1. `src/services/supabase/posts.ts` - **CRITICAL** (has N+1 in getPublicPosts)
2. `src/services/supabase/messages.ts` - Check for loops
3. `src/services/supabase/users.ts` - Add getUsersByIds()
4. `src/app/api/**` - Check all API routes
5. `src/hooks/**` - Add caching and prefetching

---

## Step 6: Testing & Validation

### In Browser DevTools (Network Tab):

**Before Optimization:**

- Posts load: 2-3 requests (1 for posts + 1+ for verified users)
- Chat loads: Multiple requests for participant data

**After Optimization:**

- Posts load: 1 request
- Chat loads: 1-2 requests
- Repeated data loads: 0 requests (cached)

### Check Supabase Usage Dashboard

Monitor your Supabase project dashboard to see:

- Query count decrease
- Response times improve
- Bandwidth usage reduction

---

## Quick Migration Script

Don't modify original files yet. Create optimized versions with `.optimized.ts` suffix (already done for you):

- `src/services/supabase/posts.optimized.ts` ✅
- `src/services/supabase/users.optimized.ts` ✅
- `src/lib/supabase-optimization.ts` ✅ (utilities)

When ready to deploy:

1. Test the `.optimized.ts` files thoroughly
2. Backup original files
3. Replace original with optimized
4. Deploy to production
5. Monitor performance

---

## Performance Monitoring

Add this to track improvements:

```typescript
// src/lib/performance-monitor.ts
export function trackQuery(
  name: string,
  duration: number,
  queryCount: number,
) {
  // Send to analytics service
  analytics.track('supabase_query', {
    name,
    duration, // milliseconds
    queryCount,
    timestamp: new Date(),
  });
}

// Usage in services:
const startTime = performance.now();
const data = await queryFunction();
const duration = performance.now() - startTime;
trackQuery('getPublicPosts', duration, 1); // 1 query instead of 2+
```

---

## Common Patterns to Apply

### Pattern 1: Batch with `.in()`

```typescript
// ❌ Bad: Loop of queries
for (const userId of userIds) {
  const user = await userService.getUserById(userId);
}

// ✅ Good: Single query
const users = await userService.getUsersByIds(userIds);
```

### Pattern 2: Avoid Post-Query Processing Loops

```typescript
// ❌ Bad: Query results then map with more queries
const posts = await postService.getPosts();
const enriched = posts.map((p) => ({
  ...p,
  author: await userService.getUserById(p.authorId), // N+1!
}));

// ✅ Good: Join in query or batch fetch
const posts = await postService.getPosts(); // Already has User joined
```

### Pattern 3: Cache Frequently Accessed Data

```typescript
// Cache for 5 minutes
return withCache(
  getCacheKey('myData'),
  async () => {
    return await expensiveQuery();
  },
  5 * 60 * 1000,
);
```

---

## Rollback Plan

If issues arise after deployment:

1. Revert to backup of original service files
2. Check browser console for TypeScript errors
3. Verify Supabase connection is working
4. Review cache TTL values (may need adjustment)

---

## Next Steps

1. ✅ Review this guide
2. ⬜ Apply to highest-traffic endpoints first
3. ⬜ Test thoroughly in staging
4. ⬜ Deploy to production
5. ⬜ Monitor performance improvements
6. ⬜ Adjust cache TTLs based on data freshness needs
