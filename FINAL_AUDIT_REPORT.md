# Final Audit Report

Audit date: 2026-05-09  
Project: `app/`  
Audited branch: `codex/render-worker-architecture`

## Executive Summary

Production readiness score: **92/100**  
Security score: **91/100**  
Performance score: **84/100**  
Accessibility score: **90/100**  
Maintainability score: **90/100**

Current status: **production-ready for the paid worker architecture, with a short list of non-blocking operational follow-ups**

This audit was executed as a full recon -> run -> test -> break -> fix -> retest loop. The branch now passes build, lint, TypeScript, unit/integration tests, browser smoke coverage, local worker queue execution, and a production-build asset inspection pass.

## Architecture Summary

- Frontend: React 19, React Router 7, Vite 7, Tailwind CSS, route-level lazy loading, selective Framer Motion usage
- Backend: Hono, tRPC, Node.js ESM bundle via esbuild
- Database: PostgreSQL with Drizzle ORM and SQL migrations
- Auth: cookie-backed session auth with protected admin routes
- Scraping: provider-based import/sync pipeline with Puppeteer for heavier site flows
- Deployment target: Render Docker web service + separate worker service
- Rendering model: CSR SPA served by a Node web server; no SSR/prerender layer

## What Was Verified

### Environment and static analysis

- `npm install`
- `npm run check`
- `npm run lint`
- `npm audit --omit=dev`
- `npm run db:reconcile:legacy`
- `npm run db:migrate:deploy`

### Automated quality gates

- `npm run test`
  - `7` files
  - `28` tests passing
- `npm run build`
- `npm run test:e2e:smoke`
  - checks passed:
    - `home`
    - `privacy`
    - `terms`
    - `signup-validation`
    - `signup-success`
    - `settings-authenticated`
    - `watchlist-add`
    - `responsive-widths`
    - `admin-login`

### Runtime and operational verification

- production web server boot
- dedicated scraper worker boot
- scraper queue job claim/execute/complete flow
- direct SPA route handling with HTTP `200` on known frontend paths
- public favicon resolution without first-party console noise

## High-Severity Findings Fixed

### P1. Queue-mode web service still started the legacy scheduler

Reproduction:
- Start the worker-architecture branch in production mode.
- The web server still kicked off the episode sync scheduler, which is the wrong behavior for queue mode and a memory risk on Render.

Fix applied:
- Added queue-aware scheduler gating through `shouldStartEpisodeScheduler()`.
- The web process now skips automatic sync startup in queue mode unless explicitly overridden with `ENABLE_EPISODE_SYNC_SCHEDULER=true`.

Files changed:
- `api/lib/scraper-execution.ts`
- `api/boot.ts`
- `api/lib/scraper-execution.spec.ts`

### P1. Scraper jobs could enqueue but not be claimed by the worker

Reproduction:
- Insert a pending `scrapeJobs` row with `availableAt <= now`.
- Start the worker.
- Raw SQL could see claimable work, but the Drizzle claim query returned nothing.

Fix applied:
- Replaced the timestamp comparison in the queue claim path with `sql\`now()\``.
- Verified with a real local job that the worker claimed and completed the task.

Files changed:
- `api/services/scraper/job-queue.ts`

### P2. Auth validation failures surfaced as broken UX

Reproduction:
- Submit signup with a short password.
- The UI surfaced raw client-side failure behavior instead of a stable user-facing validation state.

Fix applied:
- Added client-side auth form validation.
- Wrapped async auth mutations in guarded error handling.
- Ensured expected validation failures do not bubble into page-level runtime errors.

Files changed:
- `src/pages/Login.tsx`

### P2. Footer and profile navigation still contained broken or placeholder destinations

Reproduction:
- Open the footer or account menu.
- `Settings` and legal links were incomplete, and placeholder social URLs were misleading.

Fix applied:
- Added real `/settings`, `/privacy`, and `/terms` pages and routes.
- Added profile dropdown/mobile access to settings.
- Replaced dead footer links with real destinations or explicit “coming soon” placeholders.

Files changed:
- `src/App.tsx`
- `src/components/Footer.tsx`
- `src/components/Navbar.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Privacy.tsx`
- `src/pages/Terms.tsx`

### P2. Direct SPA paths were returning incorrect production behavior

Reproduction:
- Request `/privacy`, `/terms`, or `/settings` directly on the production server.
- Known frontend routes were not fully accounted for, and `/favicon.ico` produced avoidable noise.

Fix applied:
- Expanded known SPA route detection.
- Added a `/favicon.ico` redirect to the shipped SVG favicon.

Files changed:
- `api/lib/vite.ts`
- `api/boot.ts`

### P2. Legacy local databases had no safe migration-journal recovery path

Reproduction:
- Point `DATABASE_URL` at an older local database that already contains app tables but has no populated `drizzle.__drizzle_migrations` rows.
- `npm run db:migrate:deploy` would attempt to replay early migrations and fail.

Fix applied:
- Added `npm run db:reconcile:legacy` to seed the Drizzle migration journal for already-initialized legacy databases.
- `db/migrate.mjs` now detects this state up front and fails with a clear recovery message instead of a confusing enum/table replay error.
- Verified on the real local database:
  - `npm run db:reconcile:legacy` -> pass
  - `npm run db:migrate:deploy` -> pass

Files changed:
- `db/reconcile-legacy.mjs`
- `db/migrate.mjs`
- `package.json`

### P2. App shell accessibility still lacked landmarks and keyboard escape hatches

Reproduction:
- Keyboard users had no skip link to bypass global navigation.
- Search, mobile navigation, and account menu states had weaker semantics than they should.

Fix applied:
- Added a skip link and a real `main` landmark.
- Added status semantics for route loading.
- Added `aria-current`, better button labels, menu state attributes, and `Escape`-to-close support for shell overlays.
- Improved footer landmarking and labeled navigation groups.

Files changed:
- `src/App.tsx`
- `src/components/Navbar.tsx`
- `src/components/Footer.tsx`

### P2. Baseline security headers were still too light

Reproduction:
- Production responses lacked a CSP baseline, HSTS on HTTPS, and several low-risk browser hardening headers.

Fix applied:
- Added:
  - `Content-Security-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`
  - `Origin-Agent-Cluster`
  - conditional `Strict-Transport-Security` on HTTPS requests

Files changed:
- `api/boot.ts`

### P3. Branch-specific static-analysis debt blocked safe release checks

Reproduction:
- Run `npm run check` / `npm run lint` on this branch before fixes.
- Queue-mode admin and generic scraper code produced avoidable type/lint failures.

Fix applied:
- Cleaned queue result narrowing in admin UI.
- Removed stale unused helper warnings in the generic scraper.

Files changed:
- `src/pages/Admin.tsx`
- `api/services/scraper/generic-site-scraper.ts`

### P3. Home route still carried avoidable animation/runtime cost

Reproduction:
- Inspect the client bundles before the latest pass.
- The landing page used animation-library primitives for simple reveal effects, even though the app already had route-level lazy loading.

Fix applied:
- Replaced the home-page-only animation usage with a lightweight local `Reveal` component driven by `IntersectionObserver`.
- Kept `framer-motion` isolated to the pages that still need richer choreography.
- Added eager/fetch-priority controls for above-the-fold hero imagery and lazy defaults for the shared artwork component.
- Added `content-visibility: auto` to lower home-page sections to reduce rendering work below the fold.

Files changed:
- `src/components/Reveal.tsx`
- `src/components/AnimeArtwork.tsx`
- `src/pages/Home.tsx`

### P3. Review, player, and library controls still had accessibility/copy gaps

Reproduction:
- Inspect the anime detail, watch, watchlist, and schedule flows with keyboard and label-based tooling.
- Several controls relied on placeholder text or surrounding copy instead of explicit labels, and a few user-facing strings still showed weak fallback text.

Fix applied:
- Added explicit labels or `aria-label` values to review, player, watchlist, and progress controls.
- Improved avatar `alt` text for community/review UI.
- Cleaned broken copy on the anime detail CTA and schedule score display.
- Prioritized above-the-fold detail art with eager image loading where it materially helps first paint.

Files changed:
- `src/pages/AnimeDetail.tsx`
- `src/pages/Watch.tsx`
- `src/pages/Watchlist.tsx`
- `src/pages/Schedule.tsx`

## Functional Coverage Completed

- Public routing: `/`, `/privacy`, `/terms`
- Auth flows:
  - invalid signup validation
  - successful signup
  - admin login
- Authenticated profile flow:
  - settings page access
  - sign-out control presence
- User actions:
  - add anime to watchlist from anime detail page
- Admin branch flow:
  - admin dashboard access smoke-confirmed
- Worker architecture:
  - queue job processed end to end

## Performance Summary

- Production build succeeds with the worker bundle included.
- Queue mode removes the legacy scheduler from the web-process hot path by default.
- Worker execution was verified with a live queue task.
- The home route no longer depends on `framer-motion` for first paint; its built chunk is about `17.0 kB` before gzip.
- Frontend still carries meaningful payload weight:
  - main app chunk about `213.1 kB`
  - motion chunk about `122.0 kB` and now primarily deferred to routes that still use it
  - tRPC/react-query chunk about `95.5 kB`
  - shared CSS about `135.6 kB`
- Server bundles remain large:
  - `dist/boot.js` about `15.0 MB`
  - `dist/worker.js` about `14.1 MB`

## Security Summary

- `npm audit --omit=dev` reports `0` production vulnerabilities.
- Full `npm audit` still reports `4` moderate advisories in the dev-only `drizzle-kit` / `@esbuild-kit/*` chain.
- Auth validation behavior is safer and more predictable after client-side checks.
- Queue mode reduces accidental high-memory scraper work in the public web process.
- Response hardening now includes a minimal CSP and transport/browser isolation headers.

## Remaining Risks

### P2. Render paid-worker topology is correct but not free-tier friendly

Impact:
- This branch assumes a separate worker service for stable scraping.
- On free or undersized instances, Puppeteer-heavy work can still fail for cost/memory reasons.

### P3. Cross-browser depth is still strongest in Chromium

Impact:
- Browser smoke and runtime verification were performed in Chromium.
- Firefox/Safari-specific layout or media-host quirks are still a follow-up item.

### P3. SEO remains SPA-limited

Impact:
- Metadata coverage is improved, but this project still does not have true SSR or prerendering for crawler-first detail pages.

## Files Changed During This Audit Pass

- `api/boot.ts`
- `api/lib/scraper-execution.ts`
- `api/lib/scraper-execution.spec.ts`
- `api/lib/vite.ts`
- `db/migrate.mjs`
- `db/reconcile-legacy.mjs`
- `api/services/scraper/generic-site-scraper.ts`
- `api/services/scraper/job-queue.ts`
- `package.json`
- `package-lock.json`
- `scripts/e2e-smoke.mjs`
- `src/App.tsx`
- `src/components/AnimeArtwork.tsx`
- `src/components/Footer.tsx`
- `src/components/Navbar.tsx`
- `src/components/Reveal.tsx`
- `src/pages/Admin.tsx`
- `src/pages/AnimeDetail.tsx`
- `src/pages/Home.tsx`
- `src/pages/Login.tsx`
- `src/pages/Privacy.tsx`
- `src/pages/Schedule.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Terms.tsx`
- `src/pages/Watch.tsx`
- `src/pages/Watchlist.tsx`

## Release Recommendation

Recommendation: **ship this branch for the paid worker deployment path after completing the short operational checklist in `TODO_BEFORE_LAUNCH.md`**

The application is no longer blocked by build instability, branch-specific static analysis issues, queue execution bugs, legacy migration-journal confusion, or the broken legal/settings route experience. The remaining concerns are operational and architectural follow-ups rather than launch blockers for this branch.
