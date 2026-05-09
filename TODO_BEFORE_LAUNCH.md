# TODO Before Launch

Audit date: 2026-05-09  
Target branch: `codex/render-worker-architecture`

## Must Do Before Production Release

- Apply the queue worker migration set in every target environment, including `0004_serious_northstar.sql` if it is not already present there.
- Deploy both services, not just the web app:
  - Render web service
  - Render worker service
- Set production environment variables explicitly:
  - `SITE_URL`
  - `DATABASE_URL`
  - `APP_SECRET`
  - any auth provider variables you actually use
- Confirm the worker service is processing jobs in production before enabling admin scraping for real content operations.
- Verify the production domain serves:
  - `/`
  - `/privacy`
  - `/terms`
  - `/settings` after login
  - `/favicon.ico`
  - `/healthz`

## Strongly Recommended

- Run a real Lighthouse capture on the deployed production URL.
- Do one manual browser pass in Firefox and Safari.
- Add monitoring for:
  - worker crashes
  - queue backlog growth
  - scraper job failures by provider
- Rotate any credentials that were exposed during manual deployment/debug sessions.
- If you are promoting an older local or staging database, run `npm run db:reconcile:legacy` once before `npm run db:migrate:deploy` when the schema already exists but the Drizzle journal does not.

## Operational Follow-Up Soon After Launch

- Decide whether to keep or replace the current `drizzle-kit` dev-tooling chain that still carries dev-only advisories.
- Add queue/admin observability dashboards or alerts.
- Consider additional code splitting for admin and animation-heavy routes.
- Decide whether the project needs SSR/prerender for stronger SEO on anime detail pages.
