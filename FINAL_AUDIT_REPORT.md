# Final Audit Report

Audit date: 2026-05-08
Project: `app/`
Scope: full pre-launch review across runtime, QA, security, performance, UX, SEO, and production deployment behavior

## Executive Summary

Production readiness score: **88/100**

Current status: **launchable with caution after committing the generated migration files, setting `SITE_URL`, and monitoring scraper reliability**

Major blockers found during the audit were fixed:

- public pages were emitting `401` errors because `auth.me` was protected
- WITAnime episode source syncing was slow enough to appear frozen
- `npm start` was broken on Windows
- the database did not enforce unique user emails
- watchlist and review rows could be duplicated at the database level
- session cookies were configured too loosely for production
- trusted-origin protection returned a generic `500` instead of a clear `403`
- the scheduler blocked startup and still used the old single-source scraper path
- the admin latest-source browser used a brittle hand-built tRPC URL and failed with `400`
- the app had no favicon, weak metadata, no health check, no sitemap, and no correct `404` status behavior
- new SQL migrations were being ignored by `.gitignore`
- the README was still the default Vite template and did not document real deployment setup

## What Was Verified

### Install / build / tests

- `npm install` completed
- `npm run lint` passes
- `npm run test` passes: `5` files, `20` tests
- `npm run build` passes
- `npm start` now works on Windows after the script fix

### Functional QA completed

- Public browsing works for `/`, `/browse`, `/schedule`, `/anime/:slug`, `/watch/:slug/:episode`
- Auth forms:
  - sign up works
  - sign in works
  - invalid password shows a user-facing error
  - duplicate email sign-up shows a user-facing error
- Watchlist:
  - add works
  - progress save works
  - status change works
  - remove works
- Reviews:
  - create works
  - duplicate review submissions now update the existing review instead of creating duplicates
- Admin:
  - non-admin users are denied
  - admin login works
  - admin dashboard loads
  - scraper/import tab opens
  - “Fetch Latest” from the admin import surface was exercised
- Production server endpoints:
  - `/healthz`
  - `/robots.txt`
  - `/sitemap.xml`
  - unknown routes now return an actual `404`

### Responsive QA completed

Verified in headless Chromium at:

- mobile: `390x844`
- tablet: `768x1024`
- desktop: `1440x900`

Findings:

- no horizontal overflow was detected on audited core routes
- mobile menu opens correctly
- no browser console errors remained on core first-party routes after fixes

## Issues Found And Fixed

### P0 / P1 issues fixed

1. `auth.me` returned `401` on logged-out pages
   - Impact: noisy public-page console/network errors on almost every route
   - Fix: changed `auth.me` to return `user | null` as a public query

2. WITAnime sync looked infinite
   - Impact: episode source sync felt hung and made bulk sync unreliable
   - Fix: narrowed server selectors and replaced fixed `2.5s` waits with iframe-change detection
   - Result: a verified live source scrape dropped from about `44s` to about `4.3s`

3. Windows production start was broken
   - Impact: `npm start` failed with `'NODE_ENV' is not recognized`
   - Fix: replaced shell-specific env assignment with `start-prod.mjs`

4. Missing DB uniqueness on user email
   - Impact: account identity could drift; admin bootstrap script crashed
   - Fix: added schema + DB uniqueness for `users.email`

5. Duplicate watchlist and review records were possible
   - Impact: duplicated user data and race-condition corruption risk
   - Fix:
     - unique index on `watchlist(userId, animeId)`
     - unique index on `reviews(userId, animeId)`
     - router-level dedupe/update logic

6. Session cookies were too permissive in production
   - Impact: unnecessary CSRF exposure because non-local environments used `SameSite=None`
   - Fix: standardized on `SameSite=Lax`; kept `Secure` for non-local hosts

7. No auth rate limiting
   - Impact: login and signup were easy to brute-force
   - Fix: added in-memory rate limiting for sign-in, sign-up, and Google sign-in

8. Scheduler blocked startup and ignored the multi-source provider system
   - Impact: production boot immediately started scraping, produced noisy logs, and bypassed source-site routing
   - Fix:
     - startup is now non-blocking
     - overlap protection added
     - scheduler now uses provider registry
     - per-operation timeouts added

9. Missing crawl/ops endpoints
   - Impact: poor operational readiness and weak SEO baseline
   - Fix:
     - `/healthz`
     - `/robots.txt`
     - `/sitemap.xml`
     - dynamic route titles, descriptions, canonicals, and robots meta

10. Incorrect `404` semantics in production
    - Impact: unknown routes returned `200`, which is bad for SEO and monitoring
    - Fix: SPA fallback now returns `404` for unknown non-matching frontend routes

11. New migrations could not be committed
    - Impact: DB fixes could stay local and never ship
    - Fix: removed the migration SQL ignore rule from `.gitignore`

### P2 issues improved

- missing favicon and manifest added
- generic scraper lint blockers cleaned up
- admin bootstrap script made resilient even before DB uniqueness exists
- tests expanded around cookie security and auth rate limiting

## Database / Migration Status

Generated migration:

- `db/migrations/0002_typical_valeria_richards.sql`

This migration contains:

- `anime.score` precision update
- unique `users.email`
- unique `watchlist(userId, animeId)`
- unique `reviews(userId, animeId)`

The same constraints were also applied directly to the local database during the audit so the runtime matches the code.

## Security Summary

### Fixed

- reduced CSRF exposure by tightening session cookie policy
- added auth rate limiting
- enforced account identity uniqueness at DB level
- enforced watchlist/review uniqueness at DB level
- removed noisy unauthorized public requests

### Dependency audit

After `npm audit fix`, remaining advisories are:

- `4` moderate
- all trace back to `drizzle-kit` and its `@esbuild-kit/*` chain
- this is a **dev-tooling** surface, not the production runtime bundle
- `npm audit` recommends a breaking `drizzle-kit@0.18.1` change, which does not look like a safe automated production fix path

### Remaining security risks

- rate limiting is in-memory only and not distributed
- no dedicated CSRF token mechanism exists for state-changing requests
- admin and auth monitoring/audit logging is still minimal

## Performance Summary

### Verified improvements

- WITAnime episode source scraping is materially faster
- scheduler no longer blocks startup
- production server now starts cleanly on Windows

### Current build snapshot

- main app chunk: about `209 kB`
- motion chunk: about `122 kB`
- tRPC/react-query chunk: about `95 kB`
- CSS: about `128 kB`

### Assessment

- acceptable for launch
- still worth optimizing because the motion bundle and global CSS are larger than ideal

## Lighthouse-Style Summary

This is a manual proxy summary, not a real Chrome Lighthouse run.

- Performance: **78/100**
- Accessibility: **82/100**
- Best Practices: **88/100**
- SEO: **80/100**

Main reasons this is not higher:

- no real Lighthouse trace was captured
- large motion/global style payloads remain
- dynamic metadata is client-side in a SPA, so social/SEO crawlers without JS are still not ideal
- full cross-browser manual verification was not completed in Firefox/Safari/Edge

## Remaining Risks

1. Scraper sources remain operationally brittle because third-party anime sites change markup often.
2. `drizzle-kit` still has moderate dev-only audit findings with no clean non-breaking automated upgrade path.
3. SEO for dynamic anime detail/watch pages is better in-browser now, but still not true SSR/prerender SEO.
4. Cross-browser coverage is strongest in Chromium; Firefox/Safari/Edge still need manual spot checks before a public launch.
5. Scheduler activity should be monitored closely after deployment because external source failures will still happen.

## Recommended Next Steps

1. Commit the generated migration SQL and meta files alongside the code changes.
2. Apply the generated migration in every environment, not just the local database that was patched during this audit.
3. Run one real Lighthouse pass against the production build.
4. Run manual acceptance in Firefox and Safari.
5. Decide whether to keep `drizzle-kit` or replace/upgrade the migration tooling path.
6. Consider long-term SSR or prerendering if SEO/social previews are important for anime detail pages.

## Post-Audit Follow-Up

Additional fixes completed after the initial report draft:

- the admin source browser now uses the typed tRPC client instead of a brittle hand-built fetch URL
- live verification confirms the admin "Fetch Latest" flow returns populated source cards without first-party HTTP errors
- trusted-origin protection now returns HTTP `403` for blocked cross-origin cookie-authenticated mutations instead of surfacing a misleading `500`
- the project README now documents real environment setup, migrations, admin bootstrap, supported scrapers, and production launch steps
