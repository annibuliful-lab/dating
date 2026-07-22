# AGENTS.md

This file is a project map for AI coding agents working in this repository. It is intentionally practical: it focuses on how the app actually behaves today, where the main codepaths live, and which assumptions are safe or unsafe when making changes.

## Project Snapshot

- Product: mobile-first dating/community app with feed, profile, chat, and admin moderation.
- Framework: Next.js 16 App Router with React 19 and TypeScript.
- UI: Mantine 8.
- Auth: NextAuth v5 beta with Credentials, Google, and LINE providers.
- Database model source of truth: Prisma schema in `prisma/schema.prisma`.
- Runtime data access: Supabase client and Supabase Storage.
- Database: PostgreSQL via Supabase.

## High-Level Architecture

The most important architectural fact in this repo:

1. Prisma owns schema and migration history.
2. Runtime reads and writes mostly happen through `@supabase/supabase-js`, not Prisma.
3. Many components still call Supabase-backed services directly from the client.

That means schema changes usually require all of the following:

1. Update `prisma/schema.prisma`.
2. Run a Prisma migration or `prisma db push`.
3. Regenerate Supabase types if the generated file is being used.
4. Update Supabase queries, selected fields, and any handwritten casts.

## Main User Flows

### Authentication

- Entry points:
  - `src/auth.ts`
  - `src/app/signin/page.tsx`
  - `src/app/signup/page.tsx`
  - `src/app/line-auth-test/page.tsx`
  - `src/app/api/auth/register/route.ts`
- Providers:
  - Credentials
  - Google
  - LINE
- Session strategy: JWT.
- Canonical app user id: `session.user.id`.

Important behavior:

- The main `/signin` and `/signup` pages are currently email/password only in the UI.
- LINE auth is still enabled in NextAuth, but it is exposed through the dedicated public test page at `/line-auth-test`.
- The `LineSignIn` button component is reusable and currently drives all visible LINE auth entry points.
- OAuth sign-in uses `upsertUserAccount()` in `src/auth.ts`.
- New OAuth users are created with placeholder values:
  - empty `fullName`
  - UUID-like `username`
  - `isVerified = false`
- Credentials registration also creates users with `isVerified = false`.
- Credentials registration also creates an `OAuthAccount` row with provider `credentials`.
- Passwords are currently stored in `passwordHash` without hashing. Treat this as existing behavior, not a good pattern.

### Route Protection and Onboarding

- Middleware/proxy logic lives in `src/proxy.ts`.
- Public routes: `/`, `/auth/error`, `/line-auth-test`.
- Auth routes: `/signin`, `/signup`.
- Protected routes: `/feed`, `/profile`, `/inbox`, `/create`.
- Admin routes: `/admin/*`.

Critical behavior enforced by `src/proxy.ts`:

- Unauthenticated users are redirected to `/signin`.
- Authenticated users are redirected away from auth pages to `/feed`.
- Suspended users are effectively read-only and redirected back to `/feed`.
- New users are detected by incomplete profile data and forced to `/profile/edit`.
- New-user detection treats empty `fullName` or `username.length > 30` as incomplete. Profile save flows must not allow a UUID-like generated username to remain if the user should be able to leave onboarding.

### Verification Gate

- `src/components/layout/ClientLayout.tsx` blocks authenticated but unverified users with `VerifyPrompt`.
- Verification is admin-controlled only:
  - Users remain `isVerified = false` after registration and login.
  - Users can add/scan LINE OA from the verification prompt, but that does not update `User.isVerified`.
  - Only admins manually update verification status.
  - The admin UI calls `/api/users/[userId]/verify` and `/api/users/[userId]/unverify`.
  - `/api/users/[userId]/verify` must reject non-admin self-verification.
- `src/components/auth/SuspendedUserRedirect.tsx` and status-check hooks reinforce suspension behavior on the client.

When changing auth or navigation, preserve all three layers:

1. NextAuth callbacks in `src/auth.ts`
2. middleware rules in `src/proxy.ts`
3. client layout redirects/prompts

## Feature Areas

### Feed

- Page: `src/app/feed/page.tsx`
- Service: `src/services/supabase/posts.ts`
- Related hooks: `src/hooks/usePosts.ts`, `src/hooks/useInfiniteQuery.tsx`

Behavior:

- Loads public posts ordered by `createdAt`.
- Feed page currently resolves profile image public URLs client-side.
- Supports post deletion for admins from the feed UI.
- Some docs mention N+1 fixes; not all of them are consistently applied.

### Profile

- Current user profile page: `src/app/profile/page.tsx`
- Public profile page: `src/app/profile/[userId]/page.tsx`
- Edit page: `src/app/profile/edit/page.tsx`
- Services:
  - `src/services/profile/get.ts`
  - `src/services/profile/update.ts`
  - `src/services/profile/images.ts`

Behavior:

- Profile fetch pulls both `User` and `ProfileImage` data.
- Profile images are stored in Supabase Storage under `dating/users/{userId}/profile-images/...`.
- Avatar/public URLs are derived from `profileImageKey` and storage keys.
- Age is derived from birthday in `updateUserProfile()`.
- `useUserProfile()` maintains a short-lived module cache and exposes `notifyUserProfileUpdated()`. After successful profile updates or profile image saves, call `notifyUserProfileUpdated()` before navigating so `ClientLayout`, `/profile`, and `/feed` do not keep using stale profile data.
- Profile/onboarding bugs can look like feed loading bugs because `ClientLayout` wraps authenticated routes and returns `null` while profile/session state is loading.

### Chat / Inbox

- Inbox list: `src/app/inbox/page.tsx`
- Chat detail: `src/app/inbox/[chatId]/page.tsx`
- Service: `src/services/supabase/messages.ts`
- Chat UI components live under `src/components/chat/`.

Behavior:

- Uses Supabase tables `Chat`, `ChatParticipant`, and `Message`.
- Chat list hydrates latest message and unread state.
- Message sending broadcasts over a Supabase realtime channel.
- Group chat admin flows exist for invite, remove member, and rename.

### Admin

- Dashboard: `src/app/admin/page.tsx`
- Admin pages:
  - `src/app/admin/users/page.tsx`
  - `src/app/admin/posts/page.tsx`
  - `src/app/admin/chats/page.tsx`
- Admin helper: `src/lib/admin.ts`
- Admin service wrapper: `src/services/admin.ts`

Behavior:

- Admin authorization is role-based using `User.role === "ADMIN"`.
- Admin APIs use `requireAdmin()` and return `401` or `403` instead of redirecting.
- Admin can:
  - search/list users
  - change user status
  - change verification state
  - inspect chats
  - add/remove chat members
  - delete posts

## Data Model Summary

Primary Prisma models:

- `User`
- `OAuthAccount`
- `Session`
- `Chat`
- `ChatParticipant`
- `Message`
- `Post`
- `PostLike`
- `PostSave`
- `Ad`
- `ProfileImage`

Important enums:

- `UserStatus`: `ACTIVE`, `INACTIVE`, `SUSPENDED`
- `UserRole`: `USER`, `ADMIN`
- `PostVisibility`: Prisma says `PUBLIC` or `MEMBERS_ONLY`

Important note:

- Some TypeScript service code still assumes post visibility can be `PRIVATE`. Prisma currently defines `MEMBERS_ONLY` instead. Treat this as an inconsistency to be careful with when editing post-related code.

## Service Layer Map

Use these files first before editing pages directly:

- Supabase service files:
  - `src/services/supabase/users.ts`
  - `src/services/supabase/posts.ts`
  - `src/services/supabase/messages.ts`
  - `src/services/supabase/media.ts`
- Profile-specific services:
  - `src/services/profile/get.ts`
  - `src/services/profile/update.ts`
  - `src/services/profile/images.ts`
- Thin API wrappers for client fetch:
  - `src/services/admin.ts`
  - `src/services/user.ts`
  - `src/services/post.ts`

Practical rule:

- If a page already uses a service, extend the service first.
- Avoid sprinkling new raw Supabase queries across page components unless the repo already does so in that feature area and a refactor is out of scope.

## Hook Map

Generic hooks:

- `src/hooks/useApiQuery.tsx`
- `src/hooks/useApiMutation.tsx`
- `src/hooks/useInfiniteQuery.tsx`
- `src/hooks/useLazyApiRequest.tsx`

Domain hooks:

- `src/hooks/useUserProfile.tsx`
- `src/hooks/useChatMessages.tsx`
- `src/hooks/useUnreadCount.ts`
- `src/hooks/useAdmin.ts`
- `src/hooks/useAdminChats.ts`
- `src/hooks/useAdminPosts.ts`

When adding new client data fetching, prefer existing generic hooks over ad hoc `fetch()` state machines unless the surrounding file is already hand-rolled.

## Storage and Media

- Supabase bucket constant: `BUCKET_NAME = "dating"` in `src/client/supabase.ts`
- Profile images:
  - compressed client-side via `src/lib/image-compression.ts`
  - stored under user-specific storage paths
- Chat media service exists in `src/services/supabase/media.ts`

Be careful:

- Some storage code uses bucket `dating`, while generic media helpers default to `chat-media` in some functions.
- Do not assume all media flows use the same bucket without checking the caller.

## Query and Performance Notes

Optimization docs in the repo:

- `N+1_DETECTION_CHECKLIST.md`
- `QUICK_REFERENCE.md`
- `IMPLEMENTATION_GUIDE.md`
- `OPTIMIZATION_SUMMARY.md`
- `SUPABASE_OPTIMIZATION_GUIDE.md`

Current reality:

- The repo contains explicit work to reduce N+1 queries.
- Some hotspots are still present, especially in admin and feed-related data assembly.
- There is a utility file for cache/dedup/prefetch: `src/lib/supabase-optimization.ts`.
- `src/services/supabase/posts.ts` uses cache and pending-request deduplication for the feed. If adding or changing pending request maps, make sure rejected or timed-out requests are cleared in `finally`; otherwise future navigation can reuse a stuck promise and show an endless feed loader.
- Supabase PostgREST query builders are awaitable but typed as `PromiseLike`, not concrete `Promise`. Shared timeout helpers that wrap Supabase builders should accept `PromiseLike<T>`.

When changing query-heavy code:

1. Look for loops that trigger queries.
2. Prefer Supabase joins or `.in()` batch fetches.
3. Reuse `getUsersByIds()` patterns.
4. Keep selected columns narrow where reasonable.

## UI and Layout Conventions

- Mantine is the default UI system.
- Root layout: `src/app/layout.tsx`
- Shared client wrapper: `src/components/layout/ClientLayout.tsx`
- Navigation components:
  - `src/components/element/TopNavbar.tsx`
  - `src/components/element/BottomNavbar.tsx`

Conventions to preserve:

- Mobile-first layout.
- Top and bottom nav spacing uses exported pixel constants.
- Safe-area-aware spacing patterns are already used in several places.
- Dark styling is common across the app; match existing page tone unless doing an intentional redesign.
- Routes excluded from the standard navbar/client shell currently include `/signin`, `/signup`, `/auth/error`, and `/line-auth-test`.

## Environment and Commands

Main scripts from `package.json`:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:db-push
pnpm prisma:db-pull
pnpm prisma:studio
pnpm supabase:generate:types
```

Notable environment variables from `env.sample`:

- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_LINE_ID`
- `AUTH_LINE_SECRET`

## Agent Working Rules For This Repo

### Safe assumptions

- `session.user.id` is the app-level user key.
- Supabase table names are capitalized to match Prisma model names.
- Admin access is determined from `User.role`.
- Suspension behavior is business-critical.
- Verification state affects rendering and navigation, not just badge display.
- LINE OAuth still works in the backend even though it is hidden from the main auth screens.

### Unsafe assumptions

- Do not assume Prisma client is used for runtime mutations.
- Do not assume passwords are securely implemented today.
- Do not assume docs describing optimizations reflect the exact current code.
- Do not assume a field name is consistent across old and new code. Example: `name` vs `fullName`, `PRIVATE` vs `MEMBERS_ONLY`.
- Do not assume generated Supabase types are current; some files use casts and `as never` to bypass gaps.

### Before editing

Check these first if the change touches:

- auth: `src/auth.ts`, `src/proxy.ts`, `src/@types/next-auth.d.ts`, `src/components/social-button/LineSignIn.tsx`
- profile: `src/services/profile/*`, `src/app/profile/*`
- chat: `src/services/supabase/messages.ts`, `src/app/inbox/*`, `src/components/chat/*`
- admin: `src/lib/admin.ts`, `src/app/api/admin/*`, `src/app/admin/*`
- schema: `prisma/schema.prisma`, migrations, and Supabase type generation

### When documenting or refactoring

- Preserve current business behavior before cleaning architecture.
- Call out inconsistencies explicitly instead of silently normalizing them.
- Prefer small, local improvements unless the task is explicitly architectural.

## Known Footguns

- `README.md` is still the default Next.js scaffold and is not a reliable project guide.
- There is both `CLAUDE.md` and now this file; if they drift, update both or consolidate later.
- Several route handlers use App Router `params` as `Promise<{ ... }>` and await them.
- Some pages transform Supabase data heavily in the component instead of in services.
- The project has no configured automated test script today.

## Best First Reads For A New Agent

If time is limited, read in this order:

1. `prisma/schema.prisma`
2. `src/auth.ts`
3. `src/proxy.ts`
4. `src/app/layout.tsx`
5. `src/components/layout/ClientLayout.tsx`
6. `src/services/supabase/messages.ts`
7. `src/services/supabase/posts.ts`
8. `src/services/profile/get.ts`
9. `src/lib/admin.ts`
10. `src/app/api/admin/*`

This order gives the fastest understanding of auth, routing, data shape, and high-risk business rules.
