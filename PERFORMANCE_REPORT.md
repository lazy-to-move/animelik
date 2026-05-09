# Performance Report

Audit date: 2026-05-09  
Branch: `codex/render-worker-architecture`

Performance score: **84/100**

## Summary

This branch is materially healthier than its pre-audit state because the paid worker architecture now behaves like a real split-process deployment:

- the web process no longer starts heavy sync work by default in queue mode
- the worker can now actually claim and complete queued jobs
- browser smoke passed without first-party console errors, page errors, or failed same-origin requests
- the home route now uses a lightweight local reveal helper instead of `framer-motion`
- shared artwork loading now defaults to lazy/async behavior with explicit eager overrides only where above-the-fold

## Verified Results

### Build and bundle status

- `npm run build` passes
- approximate frontend output:
  - main chunk: `~213.1 kB`
  - home route chunk: `~17.0 kB`
  - motion chunk: `~122.0 kB`
  - tRPC/react-query chunk: `~95.5 kB`
  - shared CSS: `~135.6 kB`
- approximate server output:
  - `dist/boot.js`: `~15.0 MB`
  - `dist/worker.js`: `~14.1 MB`

### UI/runtime smoke status

From `test-artifacts/e2e-smoke/summary.json`:

- `success: true`
- `consoleErrors: []`
- `pageErrors: []`
- `failedRequests: []`

Completed checks:

- `home`
- `privacy`
- `terms`
- `signup-validation`
- `signup-success`
- `settings-authenticated`
- `watchlist-add`
- `responsive-widths`
- `admin-login`

### Worker verification

Verified locally:
- a queued `refresh_anime_metadata` job moved from pending to completed
- attempts incremented correctly
- persisted result payload confirmed successful completion

### Migration ergonomics verification

Verified locally:
- `npm run db:reconcile:legacy` successfully seeded a legacy Drizzle journal
- `npm run db:migrate:deploy` then completed successfully on the same database

## Bottlenecks Fixed

### 1. Wrong process doing scraper work

Before:
- the web service still started the automatic episode sync scheduler in the worker branch

After:
- queue mode disables that path by default
- the public web process is lighter and more predictable

### 2. Queue starvation bug

Before:
- the worker could sit idle even when claimable jobs existed

After:
- the queue claim path uses `now()` at the database level
- real jobs are processed reliably

### 3. Broken direct-route asset behavior

Before:
- direct route requests and favicon behavior added unnecessary runtime noise

After:
- known frontend routes resolve correctly
- favicon requests no longer create avoidable browser error chatter

### 4. Shell accessibility hardening did not introduce runtime regressions

After:
- browser smoke still passed
- settings, privacy, and terms routes continued to load without first-party errors

### 5. Home route no longer pays for heavyweight motion on first paint

Before:
- the landing page used animation-library primitives for simple reveal behavior
- that was unnecessary overhead for the first route users hit most often

After:
- `Home` now ships a lightweight local `Reveal` helper
- the built home chunk stays small at about `17.0 kB`
- the `motion` chunk remains separate and is now deferred to the routes that still need it

### 6. Shared artwork loading is more intentional

Before:
- shared poster/banner art did not clearly distinguish above-the-fold priority images from lazy images

After:
- `AnimeArtwork` defaults to `loading="lazy"` and `decoding="async"`
- hero/detail artwork can opt into `loading="eager"` and `fetchPriority="high"`
- lower home sections also use `content-visibility: auto` to reduce below-the-fold rendering work

## Remaining Performance Risks

### P2. Frontend bundles still have optimization headroom

- `motion` is no longer on the home-route critical path, but the async chunk is still large
- admin and watch/detail routes could still be split more aggressively or simplified further

### P2. Server bundles are large

- both `boot.js` and `worker.js` are materially sized bundles
- further tree-shaking or scraper isolation could reduce cold-start and memory pressure

### P2. Shared CSS is still heavy

- the generated CSS bundle is still about `135.6 kB`
- the design system is visually strong, but there is still room to cut unused utility output and repeated effect styling

### P2. Puppeteer and scraper workloads remain costly by nature

- queue mode solves placement, not the intrinsic expense of browser automation
- small/free cloud instances are still a bad fit for heavy scraping

## Recommended Follow-Up

1. Keep shrinking the remaining `motion` usage on Browse/Admin/AnimeDetail/Watchlist/Login where animation is nice-to-have rather than essential.
2. Revisit shared CSS weight and repeated glow/blur utility combinations.
3. Isolate scraper-only dependencies further if deployment memory remains tight.
4. Run a real Lighthouse capture against the deployed paid-worker environment.
