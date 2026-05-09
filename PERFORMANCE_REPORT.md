# Performance Report

Audit date: 2026-05-08

## Summary

Overall performance status: **good enough to launch, with clear optimization headroom**

Biggest verified wins from this audit:

- WITAnime source scraping speed improved dramatically
- production startup no longer blocks on an immediate scheduler sync
- public routes no longer waste time on unauthorized `auth.me` error noise

## Verified Measurements

### Scraper performance

WITAnime episode source scrape:

- before fix: about `44s` on a live test episode
- after fix: about `4.3s`

Five-episode source scrape pass:

- about `10s` total in direct verification

### Production build output

From the latest successful production build:

- `dist/public/assets/index-*.js`: about `209 kB`
- `dist/public/assets/motion-*.js`: about `122 kB`
- `dist/public/assets/trpc-*.js`: about `95 kB`
- `dist/public/assets/index-*.css`: about `128 kB`

## Runtime Observations

### Improved

- startup no longer runs a synchronous scheduler scrape before the server becomes usable
- unknown routes now return `404` instead of `200`
- health and crawl endpoints respond correctly in production

### Remaining cost centers

1. `framer-motion` remains a large chunk for the current UI.
2. The global stylesheet is still heavier than ideal.
3. Third-party video hosts can still load noisy remote assets on watch pages.

## Responsive / UX Performance Notes

Verified in Chromium:

- no horizontal overflow on core routes at mobile, tablet, or desktop widths
- mobile menu opens and renders navigation items correctly
- no first-party console or network errors remained on core routes after fixes

## Lighthouse-Style Proxy

This was not a real Lighthouse CLI run.

Manual/proxy estimate:

- Performance: `78`
- Accessibility: `82`
- Best Practices: `88`
- SEO: `80`

## Recommended Performance Follow-Up

1. Reduce motion payload where possible.
2. Audit global CSS for dead styles or over-broad utility composition.
3. Consider more route-level code splitting around admin-only surfaces.
4. Run a real Lighthouse capture on the production deployment URL.
5. Add image and API timing telemetry after launch.
