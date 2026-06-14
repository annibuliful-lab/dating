# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 8080 (Turbopack)
npm run build        # Production build
npm run lint         # ESLint

npm run prisma:migrate      # Run Prisma migrations
npm run prisma:db-push      # Push schema without migration history
npm run prisma:studio       # Open Prisma Studio GUI

npm run supabase:generate:types  # Regenerate TypeScript types from Supabase schema
```

There are no test scripts configured in this project.

## Architecture

**Stack:** Next.js 16 App Router + React 19 + TypeScript, Mantine 8 UI, Prisma 6 ORM, PostgreSQL via Supabase, NextAuth v5 (beta).

**Dual data access pattern — this is the most important architectural fact:**
- **Prisma** owns the schema and migrations (`prisma/schema.prisma`). Run migrations/pushes through Prisma CLI.
- **Supabase client** (`src/client/supabase.ts`) is used at runtime for all queries, mutations, and storage. API routes and services call Supabase directly, not Prisma.
- When a column is added, update `prisma/schema.prisma`, run `prisma:db-push`, then run `supabase:generate:types` to keep TS types in sync.

## Routing

App Router under `src/app/`. Key areas:
- `/feed`, `/create`, `/profile`, `/inbox` — authenticated user pages
- `/profile/[userId]` — public profile view
- `/inbox/[chatId]` — real-time chat
- `/admin/*` — admin dashboard (users, posts, chats)
- `/api/*` — Next.js API routes (auth, chat operations, user actions)

## Authentication (`src/auth.ts`)

NextAuth v5 with three providers: Credentials (email + passwordHash), Google, LINE.

Session flow: `signIn` callback → `upsertUserAccount()` creates User + OAuthAccount if new → `jwt` callback stores provider info → `session` callback resolves `userId` from OAuthAccount by `providerAccountId` and appends it to the session.

Suspension is enforced at every stage (signIn, JWT, session). Suspended users are blocked regardless of provider.

Session shape is extended in `src/@types/next-auth.d.ts` — `session.user.id` is the primary user identifier throughout the app.

## Service Layer (`src/services/`)

All data access goes through services — never call Supabase directly from page/component files.

- `services/profile/` — get, update, images for user profiles
- `services/supabase/` — query helpers for users, posts, messages, media
- `services/post.ts`, `services/user.ts` — feed and batch user fetching

The batch user fetch pattern in `services/user.ts` (getUsersByIds) exists specifically to prevent N+1 queries on the feed. Use it whenever fetching author data for a list of posts/messages.

## Hooks (`src/hooks/`)

Custom hooks wrap all data fetching:
- `useApiQuery` / `useApiMutation` / `useInfiniteQuery` — generic fetch wrappers with retry logic and `enabled` flag for conditional fetching
- Domain hooks (`usePosts`, `useChatMessages`, `useUnreadCount`, etc.) build on these generics

Prefer domain hooks in components over calling services or fetch directly.

## UI Conventions

- **Mantine 8** for all UI. Dark theme by default; theme config is in `src/styles/theme`.
- Safe-area insets (`env(safe-area-inset-top)`) are used throughout for mobile PWA compatibility — maintain this pattern when adding fixed headers/footers.
- Profile edit page uses `TOP_NAVBAR_HEIGHT_PX` from `src/components/element/TopNavbar` to offset fixed header — import and reuse this constant.
- Images are uploaded to Supabase Storage bucket `dating` under `users/{userId}/` paths, compressed first via `src/lib/image-compression.ts`.

## Environment Variables

```
DATABASE_URL          # Supabase connection pool (Prisma)
DIRECT_URL            # Direct connection (migrations only)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
AUTH_SECRET
AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
AUTH_LINE_ID / AUTH_LINE_SECRET
```
