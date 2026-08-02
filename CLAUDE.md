# CLAUDE.md

Guidance for AI coding agents working in this repository. `AGENTS.md` contains the full project map; keep both files aligned when behavior changes.

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

There is no test script. Production builds may need network access because `next/font/google` fetches Inter.

## Stack and architecture

- Next.js 16 App Router, React 19, TypeScript.
- Mantine 8, dark/mobile-first UI.
- NextAuth v5 beta with Credentials, Google, and LINE.
- Prisma 6 owns schema/migrations; Supabase client owns runtime queries, mutations, and storage.
- Use pnpm, not npm.

When changing schema, update `prisma/schema.prisma`, run the appropriate Prisma command, regenerate Supabase types when needed, and update queries/casts/service payloads.

## Auth and routing

- Canonical user id: `session.user.id`.
- JWT sessions are configured in `src/auth.ts`.
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

## UI conventions

- Reuse `TOP_NAVBAR_HEIGHT_PX` and `BOTTOM_NAVBAR_HEIGHT_PX`.
- Preserve safe-area insets on fixed mobile navigation.
- Shared runtime shell is `MantineAppProvider` → `LocaleProvider` → `ClientLayout`.
- Admin authorization is role-based through `User.role`; admin APIs return `401`/`403`, not redirects.

Before editing auth, profile, chat, admin, or schema code, read the corresponding source files and verify current behavior rather than relying only on documentation. Preserve business behavior and update `AGENTS.md` when the map changes.
