# Supabase Performance Optimization Guide - N+1 Prevention

## Issues Identified

### 1. **N+1 Query in `getPublicPosts()` (CRITICAL)**

**File:** `src/services/supabase/posts.ts` - Lines 24-73

**Problem:**

```typescript
// First query: Fetch all posts
const { data, error } = await supabase
  .from('Post')
  .select(/*...*/)  // Query 1

// Then loop through results to extract verifiedByUserIds
const verifiedByUserIds = data?.map(...).filter(...) || []

// Second query: Fetch usernames for verified users (N+1)
if (verifiedByUserIds.length > 0) {
  const { data: verifiedByUsers } = await supabase
    .from('User')
    .select('id, username')
    .in('id', verifiedByUserIds);  // Query 2 (N+1 Issue!)
}
```

**Impact:** Every time public posts are loaded, an extra query is made. With 20 posts per page, this is a separate query just for verification metadata.

**Solution:** Use a JOIN in the initial query to fetch verified-by usernames directly.

---

### 2. **Multiple Queries for Related Data**

**Files:** Various service files

**Problem Pattern:**

- Fetch entity (Query 1)
- Extract IDs from results (Client-side processing)
- Fetch related data for those IDs (Query 2+)

---

### 3. **No Batch Queries**

Multiple individual operations instead of batch operations:

- `getUserPostLike()` + `getUserPostSave()` called separately
- Users fetched individually when multiple are needed

---

### 4. **No Query Result Caching**

- Same data fetched multiple times in a user session
- No memoization strategy

---

## Optimization Strategies

### Strategy 1: Optimize JOINs (Reduce Queries)

#### ✅ BEFORE - N+1 Problem:

```typescript
async getPublicPosts(limit = 20, offset = 0) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('Post')
    .select(`...`)  // Query 1
    .eq('visibility', 'PUBLIC')
    .gte('createdAt', thirtyDaysAgo.toISOString())
    .order('createdAt', { ascending: false })
    .range(offset, offset + limit - 1);

  // Extract verified user IDs
  const verifiedByUserIds = data?.map(p => p.User?.verifiedBy).filter(Boolean) || [];

  // Query 2 - SEPARATE CALL (N+1!)
  if (verifiedByUserIds.length > 0) {
    const { data: verifiedByUsers } = await supabase
      .from('User')
      .select('id, username')
      .in('id', verifiedByUserIds);
    // ...map and attach results
  }
}
```

#### ✅ AFTER - Single Query:

```typescript
async getPublicPosts(limit = 20, offset = 0) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('Post')
    .select(`
      *,
      User!Post_authorId_fkey (
        id,
        fullName,
        username,
        profileImageKey,
        isVerified,
        verifiedBy,
        role,
        VerifiedByUser:User!User_id_fkey (id, username)
      ),
      PostLike!PostLike_postId_fkey (count),
      PostSave!PostSave_postId_fkey (count)
    `)
    .eq('visibility', 'PUBLIC')
    .gte('createdAt', thirtyDaysAgo.toISOString())
    .order('createdAt', { ascending: false })
    .range(offset, offset + limit - 1);

  return data; // No second query needed!
}
```

---

### Strategy 2: Batch Operations

#### ✅ BEFORE - Two Separate Queries:

```typescript
// In a component or hook
const userLike = await postService.getUserPostLike(userId, postId); // Query 1
const userSave = await postService.getUserPostSave(userId, postId); // Query 2
```

#### ✅ AFTER - Single Batch Query:

```typescript
async getUserPostInteractions(userId: string, postId: string) {
  const { data: interactions, error } = await supabase
    .from('Post')
    .select(`
      id,
      PostLike!PostLike_postId_fkey (
        id,
        userId
      ),
      PostSave!PostSave_postId_fkey (
        id,
        userId
      )
    `)
    .eq('id', postId)
    .single();

  if (error) throw new Error(error.message);

  return {
    postId: interactions.id,
    hasLiked: interactions.PostLike?.some(like => like.userId === userId) || false,
    hasSaved: interactions.PostSave?.some(save => save.userId === userId) || false,
  };
}
```

---

### Strategy 3: Query Result Caching & Memoization

#### ✅ Add Response Caching:

```typescript
// Create a cache utility
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(...args: any[]) {
  return JSON.stringify(args);
}

function getCachedResult<T>(key: string): T | null {
  const cached = queryCache.get(key);
  if (!cached) return null;

  // Check if cache is still valid (TTL)
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    queryCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCachedResult(key: string, data: any) {
  queryCache.set(key, { data, timestamp: Date.now() });
}

// Apply to service methods:
async getActiveUsers() {
  const cacheKey = getCacheKey('activeUsers');
  const cached = getCachedResult(cacheKey);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('User')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('createdAt', { ascending: false });

  if (error) throw new Error(error.message);

  setCachedResult(cacheKey, data);
  return data;
}
```

---

### Strategy 4: Use `in()` for Batch Queries (Not Individual)

#### ✅ BEFORE - Multiple Queries in Loop:

```typescript
const userProfiles = [];
for (const userId of userIds) {
  const profile = await supabase
    .from('User')
    .select('*')
    .eq('id', userId)
    .single(); // ❌ Query for each user!
  userProfiles.push(profile.data);
}
```

#### ✅ AFTER - Single Batch Query:

```typescript
const { data: userProfiles } = await supabase
  .from('User')
  .select('*')
  .in('id', userIds); // ✅ Single query for all users!
```

---

### Strategy 5: Select Only Needed Fields

#### ✅ BEFORE - Fetching Everything:

```typescript
const { data } = await supabase
  .from('User')
  .select('*') // ❌ Fetches all columns
  .eq('id', userId);
```

#### ✅ AFTER - Specific Columns Only:

```typescript
const { data } = await supabase
  .from('User')
  .select('id, fullName, username, profileImageKey') // ✅ Only needed fields
  .eq('id', userId);
```

---

### Strategy 6: Implement Prefetching

#### ✅ React Query / SWR Example:

```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function usePosts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['posts'],
    queryFn: () => postService.getPublicPosts(),
  });

  // Prefetch next page
  useEffect(() => {
    queryClient.prefetchInfiniteQuery({
      queryKey: ['posts'],
      queryFn: ({ pageParam = 0 }) => postService.getPublicPosts(20, pageParam),
      getNextPageParam: (lastPage) => /* calculate next page */,
    });
  }, [queryClient]);

  return query;
}
```

---

## Implementation Checklist

### Priority 1 (High Impact, Quick Wins):

- [ ] Fix `getPublicPosts()` N+1 query - add VerifiedByUser JOIN
- [ ] Create `getUserPostInteractions()` batch query
- [ ] Create batch user fetch function using `.in()`
- [ ] Replace individual loops with batch queries

### Priority 2 (Medium Impact):

- [ ] Add query result caching with TTL
- [ ] Implement field selection (reduce payload)
- [ ] Profile API routes for N+1 issues
- [ ] Update admin API endpoints

### Priority 3 (Long-term):

- [ ] Implement React Query for client-side caching
- [ ] Add request deduplication
- [ ] Implement pagination cursor optimization
- [ ] Add database indexes for frequently filtered fields

---

## Performance Wins Expected

| Issue                            | Current    | After   | Reduction  |
| -------------------------------- | ---------- | ------- | ---------- |
| getPublicPosts()                 | 2 queries  | 1 query | **50%**    |
| getUserPostInteractions()        | 2 queries  | 1 query | **50%**    |
| Loading user profiles (10 users) | 10 queries | 1 query | **90%**    |
| Session queries (with cache)     | 100+       | 20-30   | **70-80%** |

---

## Resources

- [Supabase Query Relationships](https://supabase.com/docs/guides/api/rest/relationships)
- [Query Performance Tips](https://supabase.com/docs/guides/performance)
- [Supabase Filters & Operators](https://supabase.com/docs/reference/javascript/filter_based_query_operators)
