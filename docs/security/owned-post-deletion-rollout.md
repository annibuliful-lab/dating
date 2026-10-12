# Delete your own posts

Verified users who are not suspended can delete their own posts from the existing post-options menu in feed and hashtag pages. Confirmation, cancellation, loading, and error feedback reuse the existing localized UI. The post stays visible if deletion fails. Admins retain the separate moderation endpoint.

`POST /api/data/posts` with `{ "action": "deletePost", "args": ["post UUID"] }` requires the authenticated NextAuth session, same-origin checks, and the existing community gate. The dispatcher reads the stored `Post.authorId`, rejects another author with `403`, and returns `404` for a missing post. The delete query also filters by both post ID and the authenticated actor ID, so a caller cannot supply an author or delete a row that changes ownership between the check and mutation. No client-supplied role or author grants access.

The original schema uses restrictive foreign keys for likes and saves. Apply the migration below so deleting a post also removes its likes and saves in the same database transaction. The migration changes two foreign keys, deletes no existing rows by itself, and does not alter columns, grants, RLS, or Storage. Post image objects remain in Storage, matching existing admin behavior; file cleanup is outside this change.

## Production rollout

1. Record the current application release and a database backup/PITR restore point. Check the current foreign-key definitions with the read-only SQL below; the provided rollback restores the repository's original `RESTRICT` behavior.
2. Apply only [`20261012000000_enable_owned_post_deletion/migration.sql`](../../prisma/migrations/20261012000000_enable_owned_post_deletion/migration.sql) before deploying the application. It uses a transaction, a five-second lock timeout, and a thirty-second statement timeout. If it times out, roll back the failed transaction and retry during quieter traffic. The old application remains compatible.
3. If applying the SQL manually, record it with `pnpm exec prisma migrate resolve --applied 20261012000000_enable_owned_post_deletion`. Review existing migration history/drift before using `migrate deploy`; do not apply unrelated migrations accidentally.
4. Deploy the application. Check a disposable own post with likes/saves, cancel confirmation, successful deletion, and a second account's direct API attempt (`403`). Confirm logged-out requests return `401`, suspended/unverified accounts remain blocked, and existing admin moderation works.

```sql
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN ('public."PostLike"'::regclass, 'public."PostSave"'::regclass)
  AND conname IN ('PostLike_postId_fkey', 'PostSave_postId_fkey')
ORDER BY conname;
```

Both definitions should contain `ON DELETE CASCADE` after migration. Existing `(postId, userId)` unique indexes support the cascade lookups.

## Rollback

Redeploy the previous application release first. Keeping the cascade migration is compatible with that release. If the foreign-key behavior also needs reverting, run [`rollback-owned-post-deletion.sql`](sql/rollback-owned-post-deletion.sql), then rerun the verification query and confirm `ON DELETE RESTRICT`. Record this manual reversal in deployment/migration history; do not delete a successfully applied migration record. A future Prisma migration must restore cascade behavior before re-enabling this feature.

Rollback does **not** recover deleted posts, likes, or saves. Recover those rows from the recorded backup/PITR restore point if needed. This change has not been applied to production by the coding agent.

## Authorization boundary during the compatibility period

These ownership checks protect the authenticated application API. The existing anonymous client and production permissions remain unchanged, as requested for the dual-client transition. If legacy anonymous permissions/policies permit direct deletion, callers can bypass application ownership checks using Supabase's Data API; full database protection still requires the separately planned [production lockdown](supabase-user-api-rollout.md). This cascade migration does not close that existing exposure.

Server feed-cache invalidation applies to the instance processing the delete. Other instances can retain an older feed list for its existing thirty-second TTL; the confirming user's card is removed immediately. The database row and its likes/saves are deleted atomically.

## Verification

All 64 Node tests passed, including direct API ownership/401/403/404 checks, author-filtered delete queries, cache invalidation, and PostgreSQL cascade/rollback tests against a disposable local database. Prisma validation/client generation, lint, TypeScript, and the production build passed. A fixture browser against the local production build confirmed own-only menus in feed/hashtag pages, cancellation, error preservation, successful card removal, and the existing admin moderation route. Production accounts, data, and permissions were not changed or exercised.
