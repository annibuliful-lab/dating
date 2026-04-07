# Quick Reference: N+1 Fixes

**Use this one-page reference while implementing optimizations**

---

## 🚨 How to Spot N+1

### Red Flag #1: Loop + Query

```typescript
for (const item of items) {
  await query(item.id); // ❌ N+1
}

// Fix:
await batchQuery(items.map((i) => i.id)); // ✅ Single query
```

### Red Flag #2: Query Inside `.map()`

```typescript
users.map((u) => getUserProfile(u.id)); // ❌ N+1
await Promise.all(users.map((u) => getUserProfile(u.id))); // Still N+1!

// Fix:
await getUsersByIds(users.map((u) => u.id)); // ✅ Batch query
```

### Red Flag #3: Extract IDs, Then Query Again

```typescript
const posts = await getPosts(); // Query 1
const authorIds = posts.map((p) => p.authorId);
const authors = await getAuthors(authorIds); // Query 2 ❌ N+1

// Fix:
const posts = await supabase.from('Post').select(`
  *, User!Post_authorId_fkey(*)  // Join in query ✅
`);
```

---

## ✅ Solutions at a Glance

### Solution 1: Use JOIN (Best when relationship exists)

```typescript
// ❌ BEFORE - 2 queries
const posts = await supabase.from('Post').select('*');
const authors = await supabase.from('User').select('*');

// ✅ AFTER - 1 query
const posts = await supabase.from('Post').select(`
  *,
  User!Post_authorId_fkey (id, name, email)
`);
```

### Solution 2: Use `.in()` for Batch (Best for multiple items)

```typescript
// ❌ BEFORE - N queries
for (const userId of userIds) {
  await getUserById(userId);
}

// ✅ AFTER - 1 query
await supabase.from('User').select('*').in('id', userIds);
```

### Solution 3: Cache Results (Best for repeated queries)

```typescript
// ❌ BEFORE - Query every time
const user = await getUserById(userId);
const user = await getUserById(userId); // Query again!

// ✅ AFTER - Query once, then cache
const user = await withCache(getCacheKey('user', userId), () =>
  getUserById(userId),
);
```

### Solution 4: Deduplicate (Best for concurrent calls)

```typescript
// ❌ BEFORE - Two components fetch same data
<Component1 /> // Calls getPosts()
<Component2 /> // Calls getPosts() - duplicate query!

// ✅ AFTER - Reuse same request
await deduplicatedFetch(getCacheKey('posts'), () => getPosts());
```

### Solution 5: Select Only Needed Fields (Reduces payload)

```typescript
// ❌ BEFORE - Fetches all columns
const users = await supabase.from('User').select('*');

// ✅ AFTER - Only needed columns
const users = await supabase.from('User').select('id, name, email');
```

---

## 🔧 Code Snippets (Copy & Paste)

### Batch Fetch Multiple IDs

```typescript
const { data: items } = await supabase
  .from('TableName')
  .select('*')
  .in('id', itemIds); // ← Fetches all in one query
```

### Cache a Query

```typescript
import { withCache, getCacheKey } from '@/lib/supabase-optimization';

const user = await withCache(
  getCacheKey('user', userId),
  () => userService.getUserById(userId),
  5 * 60 * 1000, // 5 minute cache
);
```

### Deduplicate Concurrent Requests

```typescript
import {
  deduplicatedFetch,
  getCacheKey,
} from '@/lib/supabase-optimization';

const data = await deduplicatedFetch(getCacheKey('posts'), () =>
  postService.getPublicPosts(),
);
```

### Query with Relations

```typescript
const { data: posts } = await supabase.from('Post').select(`
    id,
    content,
    User!Post_authorId_fkey (
      id,
      fullName,
      profileImageKey
    )
  `);
```

### Batch Parallel Queries (Multiple different tables)

```typescript
const [posts, users, comments] = await Promise.all([
  supabase.from('Post').select('*'),
  supabase.from('User').select('*'),
  supabase.from('Comment').select('*'),
]);
```

---

## 📊 Query Reduction Chart

```
Scenario               Before  After  Reduction
────────────────────────────────────────────────
Load 20 posts           2       1     50% ⭐
Get like+save            2       1     50% ⭐
10 user profiles        10       1     90% ⭐⭐⭐
Repeated data (cached)   2       1     50% ⭐
Session total          50+     5-10   80%+ ⭐⭐⭐⭐
```

---

## 🚀 Implementation Order

### Priority 1: Critical N+1s (Do First!)

1. [ ] `getPublicPosts()` - Use optimized version
2. [ ] `getUserPostInteractions()` - Replace two calls with one
3. [ ] Add caching to most-used methods

### Priority 2: Medium Impact (Do Next)

4. [ ] Add batch operations for users
5. [ ] Cache static data (active users, status, etc.)
6. [ ] Deduplicate concurrent requests in hooks

### Priority 3: Nice to Have (Do Last)

7. [ ] Optimize other services
8. [ ] Add prefetching for pagination
9. [ ] Profile and fine-tune TTLs

---

## ⚡ Before & After Examples

### Example 1: Feed Page

```typescript
// ❌ BEFORE (3-4 queries)
const posts = await postService.getPublicPosts();
const likeStatus = await postService.getUserPostLike(userId, postId);
const saveStatus = await postService.getUserPostSave(userId, postId);

// ✅ AFTER (1 query)
const posts = await postService.getPublicPosts(); // Already has counts
const interactions = await postService.getUserPostInteractions(
  userId,
  postIds,
);
```

### Example 2: User Profiles List

```typescript
// ❌ BEFORE (N queries in loop)
for (const userId of userIds) {
  const profile = await userService.getUserProfile(userId);
  profiles.push(profile);
}

// ✅ AFTER (1 batch query)
const profiles = await userService.getUsersByIds(userIds);
```

### Example 3: Message Thread

```typescript
// ❌ BEFORE (N+1 for each message's sender)
const messages = await messageService.getChatMessages(chatId);
const enriched = messages.map((m) => ({
  ...m,
  sender: await userService.getUserById(m.senderId), // N queries!
}));

// ✅ AFTER (1 query with JOIN + batch)
const messages = await messageService.getChatMessages(chatId);
// Already has sender info from JOIN
```

---

## 🧪 Testing Checklist

After each optimization:

- [ ] Open DevTools → Network tab
- [ ] Look for Supabase requests
- [ ] Verify count decreased
- [ ] Check response times improved
- [ ] Test in different scenarios (scrolling, pagination, etc.)
- [ ] Monitor for 24 hours after deployment

---

## ⚙️ Utility Functions Reference

```typescript
// Cache a query result
withCache(key, queryFn, ttlMs);

// Get/set cache manually
getCachedResult(key);
setCachedResult(key, data);

// Deduplicate concurrent requests
deduplicatedFetch(key, queryFn);

// Create consistent cache keys
getCacheKey(...args);

// Clear caches
clearCacheEntry(key);
clearAllCache();

// Batch in groups
chunkArray(array, size);
batchFetch(items, batchSize, fetchFn);

// Prefetch in background
prefetch(key, queryFn, options);

// Rate limit requests
supabaseRateLimiter.execute(queryFn);

// Field selection helpers
selectFields.user.minimal;
selectFields.post.feed;
selectFields.message.full;
```

---

## 🎯 Golden Rules

1. **Always batch, never loop queries**
2. **Join related data in queries, don't fetch separately**
3. **Cache static data (users, posts from earlier)**
4. **Deduplicate concurrent identical requests**
5. **Select only fields you need**
6. **Prefetch next page while user views current**
7. **Monitor after changes**

---

## 🐛 Common Mistakes

| Mistake               | Wrong                     | Right                           |
| --------------------- | ------------------------- | ------------------------------- |
| **Loop queries**      | `for(id) await fetch(id)` | `await fetch(ids)` with `.in()` |
| **Forget JOIN**       | Two queries separately    | `.select('*, Related(*)'>`      |
| **Cache same key**    | `key = 'user'` always     | `key = getCacheKey('user', id)` |
| **No error handle**   | Fire and forget           | Try/catch with logging          |
| **Select all fields** | `.select('*')`            | `.select('id, name, email')`    |
| **Ignore TTL**        | Cache forever             | Set 5-30 min TTL                |

---

## 📈 Expected Results

✅ **50-90% fewer API calls**
✅ **Faster page loads**
✅ **Lower Supabase costs**
✅ **Better user experience**
✅ **Reduced server strain**

---

## 🆘 Troubleshooting

| Problem               | Cause                  | Solution                          |
| --------------------- | ---------------------- | --------------------------------- |
| Stale data            | Cache TTL too high     | Reduce TTL or invalidate manually |
| Missing fields        | Selected too few       | Add field to `.select()`          |
| Requests still high   | Forgot to apply?       | Check if code deployed            |
| Type errors           | New function signature | Check imports and usage           |
| Performance unchanged | N+1 elsewhere          | Use DevTools to find other issues |

---

**Save this file for quick reference during implementation!**
