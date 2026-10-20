# Production rollout and rollback

## Current transition state

The existing anonymous key/client and database policies remain available for the production version and already-open browser sessions. New user services call authenticated Next.js APIs; their Supabase connection reads the server-only `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`). Never add a `NEXT_PUBLIC_` prefix to that key. There is no automatic fallback from a denied API request to anonymous queries.

The additive preparation SQL has been applied to the connected Supabase project and its server key was verified with a read-only query. **The lockdown SQL has not been applied. Existing chat files have not been moved.** Direct anonymous database access remains a known exposure during this transition. Password storage/comparison was deliberately kept unchanged at the owner's request. Admin behavior was not redesigned; its server imports and public URL helper were updated for connection compatibility.

New chat uploads intentionally use public `dating/posts/users/{userId}/...` URLs. Uploads still pass the authenticated API's chat-membership check, but downloads do not; anyone with a URL can read the file. The private `chat-media` bucket and membership-checked route continue to serve older private attachments. The lockdown SQL does not make new public chat uploads private.

SQL files:

1. [`20261011000000_secure_user_api_support/migration.sql`](../../prisma/migrations/20261011000000_secure_user_api_support/migration.sql): server schema/table grants, atomic credentials registration, `ChatParticipant.typingUntil`, `Message.videoUrl`, private `chat-media` bucket. It does not revoke existing clients.
2. [`lock-down-direct-user-access.sql`](sql/lock-down-direct-user-access.sql): **future, explicit cutover only**. Revokes browser table/column/function/schema/storage access and default grants; removes unrestricted policies; retains server access.
3. [`snapshot-access-control.sql`](../../scripts/snapshot-access-control.sql): read-only SQL that generates an emergency rollback script containing the current grants, policies, RLS flags, and default privileges. It reads catalog metadata, not user rows.

The final lockdown SQL is deliberately outside Prisma's automatic migration directory, so a routine migration deployment cannot revoke the old clients. For an environment without preparation, apply the additive migration through the normal reviewed Prisma deployment. The connected project received that SQL manually; record it with `prisma migrate resolve --applied 20261011000000_secure_user_api_support` before later deployments. Existing unrelated migration drift must be reviewed separately.

## Deploy while retaining existing clients

1. Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` configured. Add the server secret to the deployed environment; do not change `AUTH_SECRET`, which preserves existing NextAuth cookies.
2. Apply only additive preparation, transactionally, if not already applied. Record a database backup/PITR restore point and the previous production release identifier. Retain an export/backup of Storage objects too: database backups do not restore object bytes.
3. Deploy the new API-capable version. Old clients can continue their anonymous requests while new clients use the authenticated APIs. New chat files are public in the `dating` bucket; existing private and legacy public chat URLs remain rendered during this stage.
4. Smoke-test credentials and OAuth login, onboarding, profile edits/images, feed/search/Thai hashtags, new posts/images, direct/group chat, invitations/renaming/removal, unread state, typing, image/video attachments, and sign-out. Check logged-out requests return 401 and cross-user requests return 403. Existing admin routes should still work through their shared server connection.
5. Monitor authentication errors, API 401/403/500 rates, and chat/upload failures. Chat updates use membership-checked polling every three seconds instead of public broadcasts. Keep this API-capable release as the rollback target for later releases.

## Future lockdown, only after the transition is explicitly approved

1. Schedule maintenance and stop old browser writes/uploads. Keep a working API-capable rollback release available. Snapshot current access controls immediately before cutover to a private, persistent backup location:

   ```bash
   node scripts/snapshot-access-control.mjs /secure-backup/dating-cutover/access-control-rollback.sql
   node scripts/migrate-chat-media.mjs
   ```

   The second command is a read-only dry run. The initial live dry run found 2,944 referenced attachments and 3,000 objects under `dating/messages/`. Re-run it immediately before migration because production is active.

2. Apply **only** the lockdown SQL in Supabase SQL Editor (it includes a transaction), or using the deployment's approved PostgreSQL connection. This closes anonymous database and upload writes before files are moved; a maintenance page alone cannot prevent direct Supabase requests. Track this explicit access-policy change in the deployment record; once approved for automatic rollout, introduce a separate reviewed Prisma migration for it. Disable public Realtime channels in Supabase Realtime Settings as a separate dashboard action: revoking `realtime.messages` does not disable public broadcasts. The new app does not use those channels.

3. Migrate legacy chat media with a private backup directory:

   ```bash
   node scripts/migrate-chat-media.mjs --apply --backup-dir /secure-backup/dating-cutover
   ```

   The helper copies referenced objects to private chat paths, updates only the matching message URL, backs up every old `messages/` object privately under `chat-media/archive/`, then removes public originals. It writes URL/object metadata to a mode-0600 rollback file before mutation. It stops on unsupported URLs, references shared with public posts, upload failures, or concurrent message changes. Re-runs retain the original backup and resume safely. This is a file migration through Storage APIs; SQL alone cannot move stored object bytes. Account for bandwidth, duration, and Storage capacity before moving thousands of files.

4. Confirm the anonymous and authenticated Supabase roles cannot SELECT User/OAuthAccount/Session/Message, edit account roles/status/verification, modify another user's posts, upload/list/delete storage files, or execute server registration RPCs. Repeat the app smoke tests with verified, unverified, suspended, and logged-out sessions. Legacy public chat objects moved by the migration should no longer be publicly readable; new chat objects under `dating/posts/users/` remain public by design. Copies already downloaded by a user or cached at a CDN cannot be recalled immediately; follow Storage cache-purge guidance where needed.
5. Reopen production after these checks pass. Do not remove backups or the compatible rollback release until production behavior has been verified.

## Rollback

### During the current dual-client transition

Leave the additive fields, function, server grants, and private bucket in place: they are backward-compatible and removing them destroys rollback options. Anonymous permissions have not changed, so no access-control rollback SQL is needed.

Prefer a rollback that retains the new media API and server handlers while reverting affected client/UI changes. Old client code can run against that backend. A complete redeploy of the pre-change application lacks `/api/chat/[chatId]/media`; it cannot render existing private attachment URLs. New public chat URLs do not depend on that route. Before a full rollback, keep maintenance enabled and restore private media compatibility as described below. Never switch the server client to the anonymous key to conceal an API authorization failure.

### After file migration or final lockdown

1. Enable maintenance; stop all writers and keep the current server running while fixing/rolling back data. Prefer the last healthy API-capable release and leave database access locked down.
2. If the full pre-change app must return, media must be restored first. Use the same backup directory:

   ```bash
   node scripts/migrate-chat-media.mjs --rollback --backup-dir /secure-backup/dating-cutover
   ```

   This restores archived originals and original message URLs. It also copies new private attachments to compatible public `messages/rollback/` paths and records their former private URLs. Private copies are retained. **This emergency mode makes restored chat attachments public again.** Review/approve that tradeoff before executing it. If no legacy migration was run, create the media backup with the dry-run/preparation command in the next section before using rollback.

3. Only if anonymous access was revoked and the old app requires it, review and execute the previously saved `access-control-rollback.sql`. It restores the actual pre-cutover grants/policies rather than invented permissive policies. **This reopens the original anonymous database exposure, including any previously permissive User/chat policies.** Do not restore it as a routine troubleshooting step. If a future cutover migration was recorded in Prisma history, database rollback does not undo that record: retain the applied record and introduce a reviewed follow-up rollback migration before any later migration deployment.
4. Re-deploy the saved pre-change release with its original environment and unchanged `AUTH_SECRET`; smoke-test login, feed, profile updates, messages, attachments, and admin connectivity before ending maintenance.
5. Stop if a file is missing in both buckets, a message changed during rollback, or anonymous access tests do not match the snapshot. Keep maintenance on and recover from the saved backups/PITR; do not overwrite newer production rows by restoring an entire database snapshot without reviewing writes since the restore point.

### Prepare rollback metadata without migrating files

For a full rollback during the current transition, run:

```bash
node scripts/migrate-chat-media.mjs --prepare-rollback --backup-dir /secure-backup/dating-cutover
```

This writes the private metadata needed by `--rollback` and performs no file moves or database mutations. The rollback helper will preserve originals that are still present even if no archive was created.

## Local checks

```bash
node --test scripts/feed-search.test.mjs scripts/user-authz.test.mjs scripts/chat-media-migration.test.mjs scripts/auth-session.test.mjs
pnpm prisma:validate
pnpm prisma:generate
pnpm lint
pnpm build
```

The isolated SQL test refuses any host/port except loopback port 55432. Start a disposable PostgreSQL container with that port and test-only credentials, then run `node --test scripts/authz-sql.test.mjs`. It applies the real migration history, verifies denied browser grants/RLS/RPC/storage access, and verifies the generated rollback restores the previous grants and policy. It does not connect to production.

References: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Realtime settings](https://supabase.com/docs/guides/realtime/settings).
