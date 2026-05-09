# Known Limitations

Audit date: 2026-05-09  
Branch: `codex/ideal-stack-migration`

## 1. Legacy local databases need a one-time reconcile step when the schema exists but the Drizzle journal does not

Applies to:
- older local databases that already contain app tables/types
- but do not contain the `drizzle.__drizzle_migrations` journal

Impact:
- `npm run db:migrate:deploy` should be preceded by `npm run db:reconcile:legacy` once in that specific legacy state

Status:
- mitigated with the new reconcile script
- clean deploy targets are unaffected

## 2. This branch assumes a separate worker service

Impact:
- the paid worker architecture is the correct production topology here
- a web-only deploy is not equivalent and can reintroduce scraper stability problems

Status:
- web and worker processes both work locally
- production must deploy both roles for the branch to match audited behavior

## 3. Scraper reliability still depends on third-party sites

Impact:
- source-site markup, anti-bot behavior, or player/embed changes can break imports or syncs without any code changes in this repo

Status:
- architecture is improved
- external dependency fragility is inherent and remains a monitoring concern

## 4. Full `npm audit` is not yet completely clean

Impact:
- `npm audit` still reports `4` moderate dev-only advisories in the `drizzle-kit` toolchain

Status:
- `npm audit --omit=dev` is clean
- no production runtime vulnerability was identified from that chain in this audit

## 5. SEO is still bounded by partial migration coverage, not the old SPA alone

Impact:
- this branch already includes a Next.js public-web surface for home, browse, anime detail, watch, schedule, login, signup, watchlist, settings, privacy, terms, admin overview, anime catalog management, episode management, category management, and broken-report review
- however, the old React SPA is still the primary deployed app in many environments, so SEO gains depend on actually promoting the Next frontend into deployment

Status:
- materially improved on this migration branch
- full benefit still requires deployment cutover work and broader route migration

## 6. Cross-browser verification is still deepest in Chromium

Impact:
- Firefox and Safari specific regressions are less covered than Chromium in this audit pass

Status:
- recommended follow-up, not a release blocker based on current evidence

## 7. Generic-source imports are now HTML-first, but episode source resolution still depends on third-party player pages

Impact:
- `okanime`, `anime4up`, `animelek`, and `ristoanime` now import through the lightweight HTML parser for search/info/episodes, which reduces browser pressure materially
- importing catalog structure is much lighter than before, but playable source extraction can still require browser-level fallback depending on the host/player page

Status:
- mitigated for generic catalog imports
- still worth monitoring because third-party player embeds remain the most volatile part of the scraping pipeline

## 8. The admin migration is now meaningful, but still not complete

Impact:
- the Next admin surface now covers the overview, the dedicated source-import page, anime catalog management, episode CRUD, category CRUD, and broken-episode report review
- the heaviest remaining legacy-only pieces are mostly the old bulk-first workflows and any admin affordances we intentionally leave behind because the new routes already cover the day-to-day operations

Status:
- substantially improved on this migration branch
- not fully complete until the remaining legacy admin tabs are either migrated or intentionally retired
