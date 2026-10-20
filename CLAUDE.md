# CLAUDE.md

Guidance for AI coding agents working in this repository. `AGENTS.md` contains the full project map; keep both files aligned when behavior changes.

## Commands

```bash
pnpm dev
pnpm build
pnpm lint
node --test scripts/api-request-dedup.test.mjs scripts/read-cache.test.mjs scripts/auth-session.test.mjs scripts/user-authz.test.mjs
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:db-push
pnpm prisma:db-pull
pnpm prisma:studio
pnpm supabase:generate:types
```

There is no test script. Production builds may need network access because `next/font/google` fetches Inter.

## Stack and architecture

- Next.js 16 App Router, React 19, TypeScript.
- Mantine 8, dark/mobile-first UI.
- NextAuth v5 beta with Credentials, Google, and LINE.
- Prisma 6 owns schema/migrations. New user services call authenticated Next.js APIs backed by `src/server/supabase.ts`; `src/server/access.ts` and the explicit operation dispatcher enforce authorization.
- Keep `src/client/supabase.ts` and the anonymous key/policies available during the production transition. New APIs never fall back to anonymous requests. The optional lockdown SQL lives outside automatic Prisma migrations; follow `docs/security/supabase-user-api-rollout.md`.
- Chat message/typing updates poll authorized APIs every three seconds. New attachments upload to public `dating/posts/users/{userId}/...` paths and store Supabase public URLs; uploads require chat membership, but anyone with the URL can read them. Existing private `chat-media` attachments remain served through membership checks/short signed URLs.
- Use pnpm, not npm.

When changing schema, update `prisma/schema.prisma`, run the appropriate Prisma command, regenerate Supabase types when needed, and update queries/casts/service payloads.

## Auth and routing

- Canonical user id: `session.user.id`.
- JWT sessions are configured in `src/auth.ts`.
- The async root layout seeds `SessionProvider` from `auth()` to avoid duplicate initial browser session fetches; pages render dynamically. Focus and cross-tab session synchronization remain enabled.
- NextAuth reloads `status`, `role`, and `isVerified` from `User` on each server session resolution. `requireUser()` reuses these fresh fields. API paths bypass proxy matching and retain their own guards; never use cached JWT claims for authorization.
- `/signin` and `/signup` show credentials UI. LINE remains available at `/line-auth-test`.
- New OAuth users get a UUID-like username, empty legacy `fullName`, `ACTIVE` status, and `isVerified = false`.
- Passwords currently use plain values in `passwordHash`; do not treat this as secure or expand it casually.
- `src/proxy.ts` protects user/admin routes, restricts suspended accounts to `/feed`, and forces empty/UUID-like usernames to `/profile/edit`.
- `ClientLayout` is a second client-side gate for loading, suspension, and admin-controlled verification.

Verification is never completed by LINE scanning. Only admin verify/unverify routes may change `User.isVerified`. Preserve NextAuth callbacks, proxy rules, and client layout behavior together.

## Profile rules

Files: `src/app/profile/*`, `src/services/profile/*`, `src/hooks/useUserProfile.tsx`.

The edit form requires username, birthday, weight, height, gender, relationship status, and email. Relationship status uses `User.relationShipStatus` with options `ชาย`, `หญิง`, and `คู่รัก`. First/last name fields and display are removed from the current UI; the legacy required database `fullName` column remains for compatibility and should not be reintroduced into the form.

Profile images use Supabase Storage bucket `dating`, are compressed client-side, and must trigger `notifyUserProfileUpdated()` after save before navigation.

Shell and edit form share the service's 60-second profile cache. Initialize the form once per user and keep the shell mounted during background profile loading to preserve unsaved edits.

## Localization

- `src/i18n/messages.ts` stores Thai (`th`) and English (`en`) messages.
- `src/i18n/LocaleProvider.tsx` is mounted in `src/app/layout.tsx`.
- Thai is the default; the selected locale is persisted in localStorage.
- `LocaleSwitcher` remains implemented but its UI is intentionally hidden for now.
- New user-visible labels should use `useLocale()`/translation keys. Current profile terminology includes `แนะนำตัว`, `รหัสผ่าน`, `ไลน์ ไอดี`, `แก้ไขโปรไฟล์`, and `ออกจากระบบ`.

LINE verification button clicks are tracked by `VerifyPrompt` through generic `trackEvent()` in `src/lib/mixpanel.ts`. `identifyUser(session.user.id, profileProperties)` associates events with the authenticated app user and updates Mixpanel user profile properties. If no authenticated user id exists, skip identify/profile updates and click tracking while still opening LINE. Mixpanel uses its batched queue and page-hide/page-exit flush behavior rather than a raw request for every event. The event is `Line Verification Click` with `line_type` (`single_men` or `couples_single_women`) and `link_type` (`primary`/`alternative`). The token is `NEXT_PUBLIC_MIXPANEL_TOKEN`; tracking is best-effort and must not block LINE deep-link fallback.

## Services and performance

Prefer domain services and hooks over new raw Supabase calls in pages. Important services include `src/services/supabase/{users,posts,messages,media,storage,ads}.ts`, `src/services/profile/*`, and `src/services/{admin,user,post}.ts`.

Use batch user lookup patterns to avoid N+1 queries. Feed pending-request deduplication must clear entries in `finally`, including failures/timeouts. Supabase builders are `PromiseLike<T>`; timeout helpers must support that type.

`src/services/read-cache.ts` shares concurrent browser reads and overlapping forced refreshes. `user-api.ts` explicitly allows read operations; writes and `getOrCreateDirectChat` remain independent. Keys include session/authorization scope, action, arguments, and write generation. Session changes clear caches and reject old reads; completed writes invalidate affected reads, and stale reads reload current data. Generic GET hooks share the session boundary; browser caches never replace server authorization.

Hybrid read caching: browser feed/hashtag and user search results last 15 seconds; ads last 30 seconds. Browser keys normalize filters and exclude `force`; overlapping refreshes share a request, and explicit refresh reaches the server cache too. The browser cache retains at most 100 results and prunes expired entries on access.

`src/server/read-cache.ts` bounds each public feed, ads, and user-search cache to 100 entries and 5 MiB of serialized payload. One unref'ed cleanup timer per cache removes idle expired data; at most 100 active loads per cache are tracked, with a 15-second aborting timeout. Superseded/invalidated loads cannot repopulate results. These are per-process limits, not a total heap limit or distributed invalidation.

Post writes, image reorders, profile edits and relevant moderation routes invalidate affected caches. Server cache TTLs are feed/search 30 seconds and ads 60 seconds; browser + server TTLs can compound across users/instances (feed/search up to 45 seconds, ads up to 90). Explicit refresh bypasses both tiers. Auth, membership, message/typing polling, chat lists and summaries retain fresh server checks/queries; private chat result caches are removed.

Unread reads share a 15-second cache. Inbox effects depend on user ID; chat initialization keeps locale/sound changes out of data dependencies. The chat page owns receipts on open and newly received messages; inbox navigation does not issue another receipt. Message/typing polling remains separate, and private Realtime work is deferred.

Feed search in the shared `src/components/feed/FeedContent.tsx`, mounted by `src/app/feed/page.tsx`, uses `src/services/supabase/posts.ts` to match post text case-insensitively before pagination, within the existing 30-day public-post scope. Include search terms in cache/pending-request keys. Clearing restores the normal feed; stale responses must not replace or append to a newer search. The shared `SearchInput` cancels queued searches when cleared.

Verified, non-suspended users can delete their own posts from the existing options/confirmation UI in feed and hashtag results. `posts/deletePost` checks the stored author on the server and filters the deletion by post ID and authenticated author ID. Other users' posts are rejected; existing admin moderation stays separate. Successful deletion removes the card and invalidates post caches. Apply `20261012000000_enable_owned_post_deletion` for cascading `PostLike`/`PostSave` cleanup before deploying; rollout and rollback are documented in `docs/security/owned-post-deletion-rollout.md`.

Run feed search regression checks with `node --test scripts/feed-search.test.mjs scripts/user-authz.test.mjs scripts/chat-media-migration.test.mjs scripts/auth-session.test.mjs`.

Feed results pass the active search to the optional `highlight` prop in `PostContentText`, which highlights all literal, case-insensitive matches while preserving original text and clickable URLs. Other callers keep their existing rendering.

Hashtags are typed inside post text and open the protected `/feed/hashtag/[tag]` page, reusing `FeedContent`. `src/shared/hashtags.ts` parses letters (including Thai combining marks), numbers, and underscores, skips HTTP/HTTPS/www URL fragments, and rejects embedded/doubled hashes. Results match whole tags case-insensitively, highlight only the active tag, and show public posts from the last 30 days. Supabase scans narrow text candidates in batches before paginating exact matches, then fetches full details for matching IDs; upgrade to stored/indexed tags when traffic grows. Existing posts need no rewrite or schema migration. Existing suspension restrictions remain; suspended accounts do not get hashtag links.

## UI conventions

- Reuse `TOP_NAVBAR_HEIGHT_PX` and `BOTTOM_NAVBAR_HEIGHT_PX`.
- Preserve safe-area insets on fixed mobile navigation.
- Shared runtime shell is `MantineAppProvider` → `LocaleProvider` → `ClientLayout`.
- Admin authorization is role-based through `User.role`; admin APIs return `401`/`403`, not redirects.

Before editing auth, profile, chat, admin, or schema code, read the corresponding source files and verify current behavior rather than relying only on documentation. Preserve business behavior and update `AGENTS.md` when the map changes.
