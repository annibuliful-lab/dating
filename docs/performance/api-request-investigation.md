# Duplicate API request investigation

Investigated 2026-10-11 against commit `84daeb2`. The original investigation changed no application code or database permissions. The subsequent implementation and verification are recorded below. Realtime work remains deferred.

## Implemented fixes and verification

User API reads now share pending browser requests through an explicit read-action allowlist. Writes remain independent, including `getOrCreateDirectChat`. Profile and unread caches live at the service boundary, with 60-second and 15-second lifetimes. Forced refreshes join current pending reads; completing writes invalidate affected reads, and an older in-flight read reloads the current generation instead of returning stale data. Pending entries clear on success, rejection, and timeout. Session/authorization changes clear browser caches and reject old-session reads. Generic GET hooks use the same session boundary.

Profile edit uses the shared profile hook and initializes its fields once per user. Background profile refresh keeps the shell mounted and preserves unsaved input. Inbox initialization depends on the user ID, unread callbacks are stable, and chat initialization does not restart for locale/sound changes. The chat page owns read receipts, including newly received messages; inbox navigation no longer sends a receipt.

The root layout seeds `SessionProvider` from the server. Normal focus and cross-tab session synchronization remain enabled; no library patch or BroadcastChannel suppression is used. This makes pages dynamically rendered and adds server session resolution to page rendering. API paths bypass the proxy, and each route retains its own guards. NextAuth reloads `id`, `status`, `role`, and `isVerified` from `User` on each server session resolution; `requireUser()` reuses those fresh fields rather than querying the same actor again. Chat membership remains freshly checked by the route guards.

Repeated the browser scenarios against the production build and an isolated development copy with Strict Mode enabled, using the same fixture-only setup and 100 ms API latency:

| Scenario | Before: production / development | After: production / development |
| --- | --- | --- |
| Feed posts and ads | Each action: 1 / 2 | Each action: 1 / 1 |
| Profile edit current-user read | 2 / 3 | 1 / 1 |
| Initial chat messages and summary | Each action: 1 / 2 | Each action: 1 / 1 |
| Initial browser session fetch | 2 / 2 | 0 / 0; session supplied by server |
| One profile-update event on `/profile` | 2 / not measured | 1 / not separately measured |
| Two overlapping focus events | 2 unread reads / not measured | 1 unread read / not separately measured |
| Inbox navigation into chat | 2 receipts / not measured | 1 receipt / not separately measured |

Additional browser assertions confirmed that unsaved username input survives profile refresh, a cross-tab session event fetches one session without reloading the unchanged user's inbox, and a newly polled message appears and sends one receipt. No page exceptions occurred. Direct chat opening now performs two expected unread reads: the initial count and the updated count after its receipt. Message updates and typing remain separate polling actions every three seconds.

Actual local API requests, with server-side Supabase fixture interception, returned `200` and performed:

- `/api/auth/session`: one `User` query, down from two.
- `/api/data/ads`: one `User` query plus one `Ad` query, down from three `User` queries plus one `Ad` query.

Validation: `pnpm lint`, `pnpm exec tsc --noEmit --incremental false`, `pnpm build`, and 55 Node regression tests passed. The 12 new request tests cover deduplication, forced refreshes, expiry, independent mutations, rejected/aborted requests, write invalidation, session changes, server cache isolation, targeted typing/receipt invalidation, and Next.js proxy matching. Existing authorization, session, feed/hashtag, and media migration checks also passed. The separate SQL integration test could not run because its disposable PostgreSQL server on port `55432` was unavailable. No SQL, schema, key, policy, password-format, or production-data changes are required or applied.

Rollout is application-only. Deploy these changes together so the session callback and actor guard remain aligned; monitor API errors, profile initialization, read receipts, and session synchronization. Roll back by redeploying the previous application release; there is no database rollback for this change. Production accounts, OAuth sign-in, and production traffic were not exercised by the fixture browser checks.

## Evidence and scope

Used a real browser against the locally built production app and an isolated development copy of the current sources. The browser received a synthetic account and mocked API responses with 100 ms latency. Server-side Supabase fetches were intercepted with fixture responses; external database writes were blocked. No production accounts or messages were used. Browser requests were compared by URL, action, and arguments, because several different operations share `/api/data/messages`.

| Scenario | Observed production requests | Observed development requests |
| --- | --- | --- |
| Open feed | `getPublicPosts`: 1; `getActiveAds`: 1 | Each action: 2 |
| Open profile edit | `getUserProfile` for the current user: 2 | Same profile: 3 |
| Open chat directly | `getChatMessages`: 1; `getChatSummary`: 1 | Each action: 2 |
| Initial session load | `/api/auth/session`: 2 | `/api/auth/session`: 2 in the measured run |
| Dispatch one profile-update event on `/profile` | Identical `getUserProfile` requests: 2 | Not separately measured |
| Dispatch two overlapping focus events | Identical `getUnreadCount` requests: 2 | Not separately measured |
| Open a chat from inbox | Identical `markMessagesAsRead` requests: 2 across navigation | Not separately measured |

These are measured scenarios, not guaranteed counts for every timing or navigation. Development compilation/Fast Refresh can introduce additional reloads.

## Confirmed causes

### 1. Profile edit bypasses the shared profile cache

`ClientLayout` first loads the signed-in profile through `useUserProfile`. After the shell allows its children to render, the edit page calls `getUserProfile` directly again. Both reads request the same user. Development repeats the edit page's effect, giving three requests in the measured case.

Locations: `src/components/layout/ClientLayout.tsx:38`, `src/app/profile/edit/page.tsx:145`, `src/hooks/useUserProfile.tsx:42`.

Use the same profile read/cache for the shell and form. Form initialization must preserve unsaved edits when profile data is refreshed.

### 2. Forced refreshes bypass pending-request deduplication

In `useUserProfile` and `useUnreadCount`, the pending-promise lookup is inside `if (!force)`. Forced requests always start a new fetch. On `/profile`, the shell and page each subscribe to the profile-update event; both force a read. Overlapping focus events likewise force independent unread reads.

The maps also delete entries unconditionally in `finally`. An older forced request can delete the entry for a newer request, and an older response can overwrite refreshed cached data.

Locations: `src/hooks/useUserProfile.tsx:42`, `src/hooks/useUserProfile.tsx:90`, `src/hooks/useUnreadCount.ts:28`, `src/hooks/useUnreadCount.ts:70`.

Share refreshes for the same current data generation. After a mutation, do not reuse a request started before that mutation. Clear a pending entry only if it still refers to the completing request, and prevent stale responses from replacing newer cached data.

### 3. Read receipts have two owners

The inbox click handler marks the chat read before navigating. The chat page marks it read again after initial messages finish loading. A persistent browser request trace confirmed two requests with the same chat ID and user ID across that navigation. Both trigger unread-count invalidation.

Locations: `src/app/inbox/page.tsx:226`, `src/app/inbox/[chatId]/page.tsx:103`.

Give the chat page ownership so direct links still work. Decide separately how newly received messages in an open chat should be marked read; removing one initial call alone does not address that behavior.

### 4. The new browser request helper does not deduplicate reads

`userApi` always creates a fetch. Existing post/ad caches now live on the server, so they can reduce domain queries but cannot eliminate duplicate HTTP requests or their authentication overhead. Development effect replay confirmed duplicate initial feed/ad/message/summary requests. React documents the extra effect cycle as a development-only Strict Mode check; Next.js enables Strict Mode by default in the App Router.

Locations: `src/services/user-api.ts:10`, `src/components/feed/FeedContent.tsx:133`, `src/components/feed/FeedContent.tsx:243`, `src/hooks/useChatMessages.tsx:685`.

Use explicit read-only action deduplication at the browser service boundary and retain Strict Mode. Do not deduplicate all POSTs: these endpoints also create posts, send messages, and mutate profiles. Even `getOrCreateDirectChat` can write. Request identity must include the authenticated session boundary, action, arguments, pagination, search, and hashtag.

### 5. NextAuth beta emits a second initial session fetch

The installed `next-auth@5.0.0-beta.29` calls `getSession`, which posts a `getSession` event using a newly created BroadcastChannel. The provider listens on another channel instance of the same name and handles that event as a storage event, fetching the session again. This occurred in production too.

A browser-only diagnostic control suppressed that specific broadcast: initial session requests dropped from two to one. That suppression was not added to application code and is not a proposed production patch. Cross-tab sign-in/sign-out synchronization must be preserved when addressing the library behavior.

Locations: `src/app/layout.tsx:28`, installed `node_modules/next-auth/src/react.tsx:181`, `:406`, `:460`.

### 6. One browser API call performs repeated user lookups

The proxy is wrapped by `auth()` and matches API paths. Its internal `/api` early return happens after the auth wrapper has already resolved the session. The API handler then calls `auth()` again, and `requireUser` fetches fresh authorization fields.

Metadata-only server instrumentation with assertions measured:

- One `/api/auth/session` request: two `User` queries selecting `id,status,role`.
- One `/api/data/ads` request: two identical session `User` queries, one `User` query selecting `id,status,role,isVerified`, then one `Ad` query.

Locations: `src/proxy.ts:24`, `src/proxy.ts:48`, `src/auth.ts:138`, `src/server/access.ts:11`.

Avoid redundant proxy authentication for API routes while preserving each handler's guards. Keep authorization data fresh; a shared long-lived role/membership cache would introduce a security regression.

## Additional refetch triggers

- Inbox initialization depends on the entire `session` object. A broadcast-driven session refresh with an unchanged user ID reproduced another `getUserChats` request. Prefer stable identity dependencies and an explicit refresh policy (`src/app/inbox/page.tsx:196`).
- `useUnreadCount` returns a new `refreshIfStale` function each render. The navbar effect therefore runs on every render, although its cache usually prevents an extra HTTP request (`src/hooks/useUnreadCount.ts:89`, `src/components/element/BottomNavbar.tsx:31`).
- Chat initialization depends on callbacks that change with locale and notification-sound state. Those changes can reload messages and recreate subscriptions. This path was identified by source inspection, not an observed production UI control (`src/hooks/useChatMessages.tsx:77`, `:344`, `:685`).
- Generic admin/status cache keys do not include user identity. Any deduplication fix should also account for sign-out/account changes. The server's permission checks remain independent (`src/hooks/useAdmin.ts:6`, `src/hooks/useUser.ts:3`).

## Expected repeated calls

- `getMessageUpdates` and `getTyping` are separate polling actions, each scheduled three seconds after its previous request completes. Seeing the same `/api/data/messages` URL twice per polling cycle does not mean the requests are duplicates.
- Inbox has a two-minute refresh timer.
- An unread refresh after a successful mark-as-read operation is intentional. It must not share an older pre-write count request.
- Current user API reads do not automatically retry. Some generic admin hooks explicitly request one retry after a failed call.
- Shared admin/status checks already have cache and pending-request deduplication; the measured simultaneous feed/navbar consumers produced one request per endpoint.
- `NewUserRedirect` and `InviteUserModal` have additional direct-fetch paths, but no mounted callers were found. They were not counted as active duplicate sources.

## Suggested implementation order

1. Share profile reads, merge overlapping refreshes safely, and choose one owner for the initial read receipt.
2. Deduplicate explicitly approved concurrent reads and stabilize effect dependencies, with regression checks for Strict Mode, session changes, failures, and invalidation during an in-flight read.
3. Remove redundant API proxy authentication while retaining fresh route authorization; confirm the session-library behavior separately.
4. Consider combining message updates and typing in one membership-checked polling response if request volume still matters. Realtime migration remains deferred.

No blanket mutation deduplication, long-lived authorization caching, Strict Mode disabling, SQL changes, or dependency upgrades were made.

References: [React Strict Mode](https://react.dev/reference/react/StrictMode), [Next.js reactStrictMode](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactStrictMode).
