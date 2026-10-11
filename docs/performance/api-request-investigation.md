# Duplicate API request investigation

Investigated 2026-10-11 against commit `84daeb2`. Application code and database permissions were not changed. Realtime work remains deferred.

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
