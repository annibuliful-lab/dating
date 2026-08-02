# AGENTS.md

Project map and working rules for AI coding agents in this repository. Keep this file and `CLAUDE.md` aligned when architecture or business behavior changes.

## Project snapshot

- Product: mobile-first dating/community app with feed, profiles, chat, and admin moderation.
- Framework: Next.js 16 App Router, React 19, TypeScript.
- UI: Mantine 8 with a dark, mobile-first layout.
- Auth: NextAuth v5 beta with Credentials, Google, and LINE providers.
- Schema/migrations: Prisma schema and migrations in `prisma/`.
- Runtime data access: Supabase client and Supabase Storage.
- Database: PostgreSQL through Supabase.
- Package manager: pnpm. Use the scripts in `package.json`; there is no automated test script.

## Architecture and data access

1. Prisma owns the database model and migration history.
2. Runtime reads and writes mostly use `@supabase/supabase-js` from `src/client/supabase.ts`.
3. Pages and client components commonly call domain services; do not assume Prisma is used for runtime mutations.

For schema changes:

1. Update `prisma/schema.prisma`.
2. Run `pnpm prisma:validate` and the appropriate migration or `pnpm prisma:db-push`.
3. Regenerate Supabase types when the generated types are used.
4. Update selected fields, casts, and service payloads.

Important model details:

- `User` still has legacy required database column `fullName`, plus nullable `name` and `lastname`.
- The current profile UI no longer collects or displays first/last name. Do not reintroduce those fields unless explicitly requested.
- Profile onboarding requires username, birthday, weight, height, gender, relationship status, and email in `src/app/profile/edit/page.tsx`.
- `User.relationShipStatus` is the profile status field with UI options `ชาย`, `หญิง`, and `คู่รัก`.
- `User.status` is a separate account status enum: `ACTIVE`, `INACTIVE`, `SUSPENDED`.
- `Post.visibility` is `PUBLIC` or `MEMBERS_ONLY`; do not introduce `PRIVATE` based on stale code/docs.

## Authentication, routing, and verification

Primary files:

- `src/auth.ts`
- `src/proxy.ts`
- `src/@types/next-auth.d.ts`
- `src/components/layout/ClientLayout.tsx`

Behavior:

- Session strategy is JWT; `session.user.id` is the canonical app user id.
- Credentials login is email/password. Passwords are currently compared/stored as plain values in `passwordHash`; this is existing behavior and a security debt, not a pattern to extend.
- OAuth providers are Google and LINE. LINE remains available at `/line-auth-test`; it is not shown on the main sign-in/sign-up pages.
- New OAuth users receive an empty legacy `fullName`, a UUID-like username, `ACTIVE` status, and `isVerified = false`.
- Credentials registration also creates an `OAuthAccount` row with provider `credentials` and leaves users unverified.
- `src/proxy.ts` redirects unauthenticated protected routes to `/signin`, protects `/admin/*`, restricts suspended users to `/feed`, and sends users with an empty/UUID-like username to `/profile/edit`.
- The client shell can return `null` while session/profile data loads and can show `VerifyPrompt` for unverified users. Keep proxy and client behavior in sync when changing navigation.
- Verification is admin-controlled. LINE OA scanning does not set `User.isVerified`; only admin verify/unverify APIs do.
- Admin APIs must use `requireAdmin()` and return `401`/`403`, not redirects.

Public/auth routes:

- Public: `/`, `/auth/error`, `/line-auth-test`.
- Auth: `/signin`, `/signup`.
- Protected user routes: `/feed`, `/profile`, `/inbox`, `/create`.
- Admin routes: `/admin/*`.

## Localization

Localization lives in:

- `src/i18n/messages.ts`
- `src/i18n/LocaleProvider.tsx`
- `src/components/element/LocaleSwitcher.tsx`

Rules:

- Thai (`th`) is the default locale.
- English (`en`) remains supported for the existing implementation.
- `LocaleProvider` is mounted in `src/app/layout.tsx`, updates `document.documentElement.lang`, and persists the selected locale in `localStorage`.
- The locale switcher component exists but its visible controls are currently hidden. Do not remove the provider or message dictionaries; the switcher may be re-enabled later.
- New user-facing text should use a translation key, especially in shared UI and profile/auth flows. Avoid adding new hardcoded English labels.

## LINE verification click tracking

- `src/components/layout/VerifyPrompt.tsx` sends a best-effort Mixpanel event before opening LINE.
- `src/lib/mixpanel.ts` exposes generic `trackEvent()` and lazily initializes `mixpanel-browser` using `NEXT_PUBLIC_MIXPANEL_TOKEN`.
- `VerifyPrompt` calls `identifyUser(session.user.id, profileProperties)` before tracking so LINE verification events are associated with the authenticated app user and Mixpanel profile fields are refreshed.
- Mixpanel tracking uses the SDK's batched queue (`batch_requests`) with periodic and page-hide/page-exit flushing; do not replace it with a raw fetch per event or access internal request batchers.
- Event name is `Line Verification Click`.
- Stable event properties are `line_type` (`single_men` or `couples_single_women`) and `link_type` (`primary` or `alternative`).
- Tracking must never block or prevent the LINE deep link/web fallback from opening.
- If there is no authenticated `session.user.id`, skip Mixpanel identify/profile updates and LINE click tracking; the LINE link must still open normally.
- When changing LINE URLs or button categories, update the client constants, API allowlist, and tracking docs together.

## Feature map

### Feed

- Page: `src/app/feed/page.tsx`
- Service: `src/services/supabase/posts.ts`
- Hooks: `src/hooks/usePosts.ts`, `src/hooks/useInfiniteQuery.tsx`
- Loads public posts ordered by creation time, resolves profile image URLs, and supports admin post deletion.
- Feed service uses cache and pending-request deduplication. Always clear pending entries in `finally`, including timeout/rejection paths, or navigation can reuse a stuck promise and show an endless loader.

### Profile

- Current profile: `src/app/profile/page.tsx`
- Public profile: `src/app/profile/[userId]/page.tsx`
- Edit profile: `src/app/profile/edit/page.tsx`
- Services: `src/services/profile/get.ts`, `update.ts`, `images.ts`

Profile edit behavior:

- Required: username, birthday, weight, height, gender, relationship status, email.
- Username uniqueness is checked through `/api/users/check-username`.
- First/last name controls and display have been removed. The legacy `fullName` database column is preserved for compatibility but is not written by the current form.
- `Bio` is localized as `แนะนำตัว` in Thai.
- Password is optional; a blank password keeps the current value.
- Profile images are compressed client-side and stored in the `dating` bucket under user-specific paths.
- Call `notifyUserProfileUpdated()` after successful profile or profile-image changes before navigating, so `ClientLayout`, `/profile`, and `/feed` do not retain stale profile data.
- Age is derived from birthday in `updateUserProfile()`.

### Chat / inbox

- Inbox: `src/app/inbox/page.tsx`
- Chat detail: `src/app/inbox/[chatId]/page.tsx`
- Service: `src/services/supabase/messages.ts`
- Components: `src/components/chat/*`
- Uses `Chat`, `ChatParticipant`, and `Message`; supports realtime broadcasts, unread state, media, group invites/removals, and group renaming.

### Admin

- Dashboard: `src/app/admin/page.tsx`
- Pages: `src/app/admin/users/page.tsx`, `posts/page.tsx`, `chats/page.tsx`
- Authorization helper: `src/lib/admin.ts`
- Service wrapper: `src/services/admin.ts`
- Admin can search users, change account status, verify/unverify users, inspect chats, manage members, and delete posts.

## Services, hooks, storage, and performance

Prefer existing services and hooks before adding raw queries to pages:

- Supabase services: `src/services/supabase/users.ts`, `posts.ts`, `messages.ts`, `media.ts`, `storage.ts`, `ads.ts`.
- Profile services: `src/services/profile/*`.
- API wrappers: `src/services/admin.ts`, `src/services/user.ts`, `src/services/post.ts`.
- Generic hooks: `useApiQuery`, `useApiMutation`, `useInfiniteQuery`, `useLazyApiRequest`.
- Domain hooks: `useUserProfile`, `useChatMessages`, `useUnreadCount`, `useAdmin*`, `usePosts`.

Performance rules:

- Batch user lookups with existing `getUsersByIds()` patterns; avoid query-in-loop assembly.
- Keep Supabase selections narrow where practical.
- Supabase query builders are `PromiseLike`, not always concrete `Promise`; shared timeout helpers must accept `PromiseLike<T>`.
- Review `N+1_DETECTION_CHECKLIST.md`, `QUICK_REFERENCE.md`, `IMPLEMENTATION_GUIDE.md`, `OPTIMIZATION_SUMMARY.md`, and `SUPABASE_OPTIMIZATION_GUIDE.md` when changing query-heavy code, but verify docs against current code.

Storage:

- Main bucket constant is `BUCKET_NAME = "dating"` in `src/client/supabase.ts`.
- Profile images use `dating/users/{userId}/profile-images/...` and avatar paths under the same user scope.
- Some generic media helpers default to `chat-media`; check callers before changing bucket behavior.

## UI conventions

- Use Mantine 8 and match the existing dark theme.
- Preserve mobile-first sizing and safe-area insets for fixed headers/footers.
- Reuse `TOP_NAVBAR_HEIGHT_PX` and `BOTTOM_NAVBAR_HEIGHT_PX` instead of duplicating offsets.
- Shared shell: `src/app/layout.tsx` → `MantineAppProvider` → `LocaleProvider` → `ClientLayout`.
- Navigation: `src/components/element/TopNavbar.tsx` and `BottomNavbar.tsx`.

## Commands

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

There is no configured automated test script. `pnpm build` may need network access because `next/font/google` downloads Inter during the build.

## Safe and unsafe assumptions

Safe:

- `session.user.id` is the app user key.
- Supabase table names are capitalized to match Prisma models.
- Admin access is role-based through `User.role`.
- Suspension and verification affect navigation/rendering, not only badges.

Unsafe:

- Do not assume Prisma handles runtime writes.
- Do not assume passwords are hashed.
- Do not assume generated Supabase types are current; some code uses casts or `as never`.
- Do not normalize legacy field names (`name`, `fullName`, `lastname`) without checking all callers.
- Do not treat stale optimization docs as proof of current behavior.

## Before editing

- Auth/navigation: read `src/auth.ts`, `src/proxy.ts`, `src/@types/next-auth.d.ts`, and relevant auth/layout components.
- Profile: read `src/app/profile/*`, `src/services/profile/*`, `src/hooks/useUserProfile.tsx`, and `src/i18n/*`.
- Chat: read `src/services/supabase/messages.ts`, inbox pages, and chat components.
- Admin: read `src/lib/admin.ts`, `src/services/admin.ts`, admin API routes, and admin pages.
- Schema: read `prisma/schema.prisma`, migrations, selected Supabase fields, and generated types if present.

Preserve existing business behavior before refactoring. Make small, local changes unless architectural work is explicitly requested. Update this file and `CLAUDE.md` together when the project map changes.
