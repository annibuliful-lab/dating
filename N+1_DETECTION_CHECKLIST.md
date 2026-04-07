# N+1 Query Detection Checklist

Use this checklist to identify N+1 query patterns in your code.

## 🚨 Red Flags - These are N+1 Patterns

### Flag 1: Query Inside a Loop

```typescript
// ❌ RED FLAG - N+1 QUERY
const userIds = [1, 2, 3, 4, 5];
for (const userId of userIds) {
  const user = await getUserById(userId); // Query in loop!
}

// Also RED FLAG:
userIds.map(async (id) => await getUserById(id)); // N queries!
```

**Fix:**

```typescript
// ✅ GOOD
const users = await getUsersByIds(userIds); // Single batch query
```

---

### Flag 2: Query After Initial Query To Get Related Data

```typescript
// ❌ RED FLAG - N+1 QUERY
const posts = await getPosts(); // Query 1

// Extract IDs from results
const authorIds = posts.map((p) => p.authorId);

// Query again for missing data
const authors = await getUsersByIds(authorIds); // Query 2 (N+1!)
```

**Fix:**

```typescript
// ✅ GOOD - Fetch with relations in single query
const posts = await supabase.from('Post').select(`
    *,
    User!Post_authorId_fkey (id, name, email)  // Join in query
  `);
```

---

### Flag 3: Separate Queries for Related Entities

```typescript
// ❌ RED FLAG - N+1 QUERY
async function getPostDetails(postId: string) {
  const post = await getPostById(postId); // Query 1
  const likes = await getPostLikes(postId); // Query 2
  const saves = await getPostSaves(postId); // Query 3
  const comments = await getComments(postId); // Query 4

  return { post, likes, saves, comments }; // 4 queries!
}

// Or inside a loop:
posts.map(async (post) => {
  post.likes = await getPostLikes(post.id); // N queries for N posts!
});
```

**Fix:**

```typescript
// ✅ GOOD - Batch or join in single query
async function getPostDetails(postId: string) {
  const post = await supabase
    .from('Post')
    .select(
      `
      *,
      PostLike!PostLike_postId_fkey (count),
      PostSave!PostSave_postId_fkey (count),
      Comment!Comment_postId_fkey (*)
    `,
    )
    .eq('id', postId)
    .single(); // 1 query!

  return post;
}

// Or batch instead of loop:
const [likesData, savesData, commentsData] = await Promise.all([
  supabase.from('PostLike').select('postId').in('postId', postIds),
  supabase.from('PostSave').select('postId').in('postId', postIds),
  supabase.from('Comment').select('postId').in('postId', postIds),
]); // 3 queries total, not N×3 queries
```

---

### Flag 4: Unnecessary Duplicate Queries

```typescript
// ❌ RED FLAG - Duplicate queries
const user1 = await getUserById('123'); // Query 1
// ... some code ...
const user2 = await getUserById('123'); // Query 2 (same user!)
```

**Fix:**

```typescript
// ✅ GOOD - Cache the result
function getCachedUser(userId: string) {
  return withCache(getCacheKey('user', userId), () =>
    getUserById(userId),
  );
}

const user1 = await getCachedUser('123'); // Query
const user2 = await getCachedUser('123'); // Cached!
```

---

### Flag 5: Querying All Instead of Filtering

```typescript
// ❌ RED FLAG - Fetches everything, then filters in code
const users = await supabase.from('User').select('*'); // All users!
const activeUsers = users.filter((u) => u.status === 'ACTIVE');
```

**Fix:**

```typescript
// ✅ GOOD - Filter in query
const activeUsers = await supabase
  .from('User')
  .select('*')
  .eq('status', 'ACTIVE'); // Filters at database level
```

---

## ✅ Good Patterns

### Pattern 1: Batch Operations with `.in()`

```typescript
// ✅ GOOD - Single query for multiple IDs
const users = await supabase
  .from('User')
  .select('*')
  .in('id', userIds);
```

### Pattern 2: Query with Relations/Joins

```typescript
// ✅ GOOD - Single query with related data
const posts = await supabase.from('Post').select(`
    *,
    User!Post_authorId_fkey (*),
    PostLike!PostLike_postId_fkey (count)
  `);
```

### Pattern 3: Promise.all() for Parallel Queries

```typescript
// ✅ GOOD - Queries run in parallel (3 queries, not sequential)
const [posts, users, comments] = await Promise.all([
  supabase.from('Post').select('*'),
  supabase.from('User').select('*'),
  supabase.from('Comment').select('*'),
]);
```

### Pattern 4: Caching Results

```typescript
// ✅ GOOD - Returns cached result if available
const data = await withCache(key, () => expensiveQuery());
```

### Pattern 5: Effective Field Selection

```typescript
// ✅ GOOD - Only select needed fields
const data = await supabase.from('User').select('id, name, email'); // Not '*'
```

---

## 🔍 How to Scan Your Code

### 1. Search for These Patterns:

```bash
# Find potential N+1 (.map with async)
grep -r "\.map.*async" src/

# Find potential loops with queries
grep -r "for.*await\|while.*await" src/

# Find multiple consecutive supabase calls
grep -rn "supabase.*select" src/ | head -20
```

### 2. Manual Review Checklist:

For each service method, ask:

- [ ] Does this method call another query method inside?
- [ ] Is there a loop that might contain queries?
- [ ] Are multiple separate queries made that could be joined?
- [ ] Should this result be cached?
- [ ] Are all fields necessary or can I select fewer columns?

### 3. Use Browser DevTools:

- Open Network tab
- Load a page
- Count Supabase requests
- Look for repeats or patterns
- Check if requests could be batched

---

## 📊 Impact Assessment

| Pattern                   | Queries             | Impact           |
| ------------------------- | ------------------- | ---------------- |
| N+1 Loop (10 items)       | 1 + 10 = 11 queries | ❌ Very Bad      |
| Batch Query               | 1 query             | ✅ Excellent     |
| Separate relation queries | 3-4 queries         | ⚠️ Needs joining |
| Joined relations          | 1 query             | ✅ Excellent     |
| Cached queries            | 0 queries\*         | ✅ Best          |
| Duplicate queries         | 2+ queries          | ⚠️ Use cache     |

\*First load is 1 query, subsequent loads within TTL are cached

---

## Common Culprits in Your Code

Based on the codebase analysis:

### 🚨 CRITICAL - Already Identified:

1. **`getPublicPosts()` in posts.ts**
   - Issue: Fetches posts (Query 1), then extracts verifiedBy IDs, then queries for usernames (Query 2)
   - Fix: Use batch query with deduplication
   - Status: Optimized version created ✅

2. **`getUserPostLike()` + `getUserPostSave()`**
   - Issue: Called separately for same post
   - Fix: Combine into `getUserPostInteractions()`
   - Status: New method created ✅

3. **Missing `getUsersByIds()`**
   - Issue: Users fetched individually
   - Fix: Batch fetch added
   - Status: New method created ✅

### ⚠️ INVESTIGATE:

- Check all API routes in `/src/app/api/` for loops
- Review message loading in chat features
- Check admin endpoints for large data fetches

---

## Quick Fix Template

When you find an N+1 pattern:

```typescript
// ❌ BEFORE
const items = await getItems();
const enriched = items.map((item) => ({
  ...item,
  related: await getRelated(item.id), // N+1!
}));

// ✅ AFTER
const items = await getItems();
const relatedIds = [...new Set(items.map((i) => i.id))];
const relatedMap = Object.fromEntries(
  (await getRelatedByIds(relatedIds)).map((r) => [r.id, r]),
);
const enriched = items.map((item) => ({
  ...item,
  related: relatedMap[item.id],
}));
```

---

## Resources

- **Supabase Docs:** https://supabase.com/docs/guides/api/rest/relationships
- **Query Performance:** https://supabase.com/docs/guides/performance
- **N+1 Explained:** https://stackoverflow.com/questions/97197/what-is-n1-query-problem
