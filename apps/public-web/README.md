# Synx Public Web

This is the first migration surface for the ideal architecture:

- `Next.js` App Router for the public site
- existing Hono app as the read-only content API during transition
- future path to shared auth, queues, and storage without a big-bang rewrite

## Env

Copy `.env.example` to `.env.local` and set:

- `DATABASE_URL` if you want the Next app to read catalog data directly from the shared database
- `APP_ID`
- `APP_SECRET` if you want the Next app to read sessions, sign users in, and manage watchlists directly. This must match the backend `APP_SECRET`.
- `LEGACY_API_INTERNAL_ORIGIN`
- `LEGACY_API_BASE_URL`
- `NEXT_PUBLIC_LEGACY_API_BASE_URL`
- `NEXT_PUBLIC_SITE_URL`

On the legacy backend service, also set:

- `PUBLIC_WEB_URL` to this Next app's public origin

`LEGACY_API_BASE_URL` remains as a backward-compatible shared fallback, but the
preferred split-host shape is:

- `LEGACY_API_INTERNAL_ORIGIN` for server-to-server requests from Next to the
  legacy backend
- `LEGACY_API_INTERNAL_HOSTPORT` as the private-network Render equivalent when
  you want Next to reach the backend without a public round-trip
- `NEXT_PUBLIC_LEGACY_API_BASE_URL` for browser-visible media URLs and proxy
  targets
- `NEXT_PUBLIC_SITE_URL` for canonical metadata

## Commands

```powershell
npm --prefix apps/public-web install
npm --prefix apps/public-web run check
npm --prefix apps/public-web run build
```

From the repo root you can also run the migration smoke after both the legacy
app and the Next app are already running:

```powershell
npm run next:smoke
npm run next:admin:smoke
npm run next:cutover:smoke
```

From inside this package:

```powershell
npm install
npm run dev
npm run build
```

`next build` succeeds even when the legacy API is not running because the current route set is configured for runtime SSR instead of build-time prerendering.

The public route loaders now prefer shared server-side catalog services when
`DATABASE_URL` is available. If it is not set, they automatically fall back to
the legacy HTTP bridge so local split-stack work is still easy.

The auth/session/watchlist layer now has the same shape:

- if `DATABASE_URL`, `APP_ID`, and `APP_SECRET` are present, `/api/auth/*` and
  `/api/watchlist*` execute directly in the Next app against the shared DB
- otherwise they fall back to the legacy HTTP bridge automatically

Review submission/deletion and broken-episode reporting now follow that same
pattern too, so the current public user flows can run directly in Next when the
shared DB and session secret are available.

## Current routes

- `/`
- `/browse`
- `/anime/[slug]`
- `/schedule`
- `/watch/[slug]/[episode]`
- `/login`
- `/signup`
- `/watchlist`
- `/admin`
- `/admin/anime`
- `/admin/episodes`
- `/admin/categories`
- `/admin/reports`
- `/admin/scraper`
- `/settings`
- `/privacy`
- `/terms`

These pages intentionally consume the legacy app's new public endpoints:

- `/api/public/home`
- `/api/public/browse`
- `/api/public/anime/:slug`
- `/api/public/schedule`
- `/api/public/session`
- `/api/public/auth/*`
- `/api/public/watchlist`

The migration app also normalizes legacy relative media paths like `/anime-covers/...` back to the legacy API origin, so posters continue working even when the Next site and the old Hono app are split across different hosts or ports. The same-origin Next route handlers under `/api/auth/*`, `/api/watchlist*`, `/api/reviews*`, and `/api/episodes/*` now prefer direct shared auth/database access when the required env is available, with the legacy proxy retained as a fallback.

`/healthz` is available for deployment checks and reports whether the internal
legacy origin, public legacy origin, public site URL, catalog access mode, and
account access mode are configured.

The migration smoke script covers:

- account signup through the Next bridge
- authenticated settings access
- anime review posting through the Next bridge
- watch-page progress tracking
- broken-episode reporting through the Next bridge
- automatic watchlist progress sync on a later episode

The admin smoke covers:

- administrator login through the Next auth route
- rendering the new `/admin` overview
- rendering the new `/admin/anime` catalog
- creating and deleting an episode through `/admin/episodes`
- creating and deleting a category through `/admin/categories`
- rendering the new `/admin/reports` page
- rendering the dedicated `/admin/scraper` page

## Why this shape

This is a strangler migration, not a rewrite. The goal of this folder is to prove:

- a crawler-friendly public site can move to Next.js first
- the existing Hono app can temporarily act as the internal content API
- queue, storage, and auth can be migrated in later slices without blocking the public-site move

This folder is now the canonical tracked location for the migration frontend. The older sibling `next-public/` folder outside the repo root can be treated as a disposable scratch copy.

For local split-stack testing, use:

```powershell
$env:LEGACY_API_INTERNAL_ORIGIN='http://127.0.0.1:3100'
$env:LEGACY_API_BASE_URL='http://127.0.0.1:3100'
$env:NEXT_PUBLIC_LEGACY_API_BASE_URL='http://127.0.0.1:3100'
$env:NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3101'
$env:APP_ID='synx-public-web'
$env:APP_SECRET='use-the-same-secret-as-the-backend'
npm run check
npm run build
```
