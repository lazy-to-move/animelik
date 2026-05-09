# Synx Anime

Production-ready anime streaming and discovery platform with:

- React 19 + Vite frontend
- Hono + tRPC backend
- PostgreSQL + Drizzle ORM
- Email/password auth and optional Google sign-in
- Admin dashboard for anime, episodes, categories, and source imports
- Multi-source scraping support for:
  - `witanime`
  - `okanime`
  - `anime4up`
  - `animelek`
  - `ristoanime`
  - `stardima`

## Stack

- Frontend: React, React Router, TanStack Query, tRPC, Tailwind CSS, Framer Motion
- Backend: Hono, tRPC, Node.js
- Database: PostgreSQL, Drizzle ORM
- Scraping: provider-based source registry with per-site implementations/fallbacks

## Local Setup

1. Install dependencies:

```powershell
npm install
```

2. Create your env file:

```powershell
Copy-Item .env.example .env
```

3. Fill in the required values in `.env`.

4. Apply database schema/migrations.

Recommended:

```powershell
npm run db:push
```

If you are committing migrations for deployment, keep the SQL files in `db/migrations/`.

5. Start the dev server:

```powershell
npm run dev
```

## Required Environment Variables

Minimum production-safe setup:

```env
APP_ID=your-app-id
APP_SECRET=your-app-secret
DATABASE_URL=postgres://...
SITE_URL=https://your-domain.example
```

Optional:

```env
GOOGLE_CLIENT_ID=...
VITE_GOOGLE_CLIENT_ID=...
KIMI_AUTH_URL=...
KIMI_OPEN_URL=...
OWNER_UNION_ID=...
PORT=3000
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
MEDIA_STORAGE_MODE=local
MEDIA_PUBLIC_BASE_URL=https://cdn.example.com
S3_MEDIA_BUCKET=...
S3_MEDIA_REGION=auto
S3_MEDIA_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_MEDIA_ACCESS_KEY_ID=...
S3_MEDIA_SECRET_ACCESS_KEY=...
S3_MEDIA_FORCE_PATH_STYLE=false
SCRAPER_EXECUTION_MODE=inline
SCRAPER_QUEUE_BACKEND=db
REDIS_URL=redis://127.0.0.1:6379
SCRAPER_QUEUE_NAME=synx-scrape-jobs # BullMQ queue names must not contain :
SCRAPER_WORKER_POLL_MS=5000
LEGACY_API_INTERNAL_ORIGIN=http://127.0.0.1:3000
LEGACY_API_INTERNAL_HOSTPORT=synx-app:10000
NEXT_PUBLIC_LEGACY_API_BASE_URL=https://legacy-public.example
NEXT_PUBLIC_SITE_URL=https://public.example
PUBLIC_WEB_URL=https://public.example
```

## Scripts

```powershell
npm run dev
npm run build
npm start
npm run start:worker
npm run queue:smoke
npm run lint
npm run test
npm run db:push
npm run db:generate
npm run db:migrate
npm run db:backfill:media
```

`npm start` serves the built production app through `start-prod.mjs` and works on Windows.
`npm run start:worker` runs the background scraper worker against the same database queue.
`npm run queue:smoke` runs an end-to-end BullMQ probe against Redis, the worker, and the `scrapeJobs` table.

## Next.js Public Migration

This branch also carries the in-repo migration frontend at [apps/public-web](</C:/Users/Expert Gaming/Downloads/projects/Kimi_Agent_Full-Stack Anime Streaming Site/app/apps/public-web/README.md>).

Current migrated public routes:

- `/`
- `/browse`
- `/anime/[slug]`
- `/watch/[slug]/[episode]`
- `/schedule`
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

The Next app now owns:

- crawler-friendly public catalog pages
- same-origin auth routes under `/api/auth/*`
- same-origin review routes under `/api/reviews*`
- same-origin broken-episode routes under `/api/episodes/*`
- same-origin personal-library routes under `/api/watchlist*`
- the first shared-data admin overview route at `/admin`
- a direct Next admin anime catalog at `/admin/anime`
- direct Next episode management at `/admin/episodes`
- direct Next admin category management at `/admin/categories`
- direct Next broken-report review at `/admin/reports`
- a dedicated Next source-import page at `/admin/scraper`
- interactive watchlist management and anime-detail watchlist controls
- interactive anime reviews on the Next detail page
- watch-page progress tracking and automatic progress sync on later episodes
- watch-page broken-episode reporting with the same 24-hour cooldown rules
- authenticated settings and policy routes in the migration surface

For local split-stack testing, run the legacy app on one port and the Next app on another, and set both:

```powershell
$env:LEGACY_API_INTERNAL_ORIGIN='http://127.0.0.1:3100'
$env:LEGACY_API_BASE_URL='http://127.0.0.1:3100'
$env:NEXT_PUBLIC_LEGACY_API_BASE_URL='http://127.0.0.1:3100'
$env:NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3101'
npm run next:check
npm run next:build
npm run next:smoke
npm run next:admin:smoke
npm run next:cutover:smoke
```

## Docker Deployment

Build the image:

```powershell
docker build -t synx-app .
```

Run it with your production env file:

```powershell
docker run --env-file .env -p 3000:3000 synx-app
```

If your database is running on the host machine instead of inside the same Docker network, use a host-reachable connection string such as `host.docker.internal` for `DATABASE_URL`.

The Docker image now includes the Linux libraries Puppeteer needs for scraping, bundles the runtime-downloaded `public/anime-covers` assets, and keeps the Puppeteer browser cache inside the app image.

## Render Deployment

Render is a strong fit for this project because it supports:

- long-running Node web service
- a dedicated background worker for scraper jobs
- PostgreSQL in the same Blueprint
- a managed Render Key Value instance for BullMQ / Redis queue transport
- Dockerfile-based deploys
- a persistent disk for runtime-downloaded posters
- DB-backed queue processing without tying imports to the user-facing web process

The repository includes [render.yaml](</C:/Users/Expert Gaming/Downloads/projects/Kimi_Agent_Full-Stack Anime Streaming Site/app/render.yaml>) with:

- a Docker backend/admin web service
- a dedicated Next.js public-web service
- a dedicated Docker worker service for scraper jobs
- a managed Key Value service for Redis/BullMQ
- `npm run db:migrate:deploy` as a pre-deploy step
- `/healthz` healthcheck
- a 5 GB persistent disk mounted for imported poster storage
- a managed Render Postgres database

To deploy from the Render Dashboard:

1. Connect your GitHub account to Render.
2. Open [https://dashboard.render.com/blueprints](https://dashboard.render.com/blueprints).
3. Create a new Blueprint from this repo.
4. Fill in any prompted secrets, especially:
   - `SITE_URL`
   - `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` if using Google sign-in
   - `OWNER_UNION_ID` if you want to auto-promote a first owner
5. Deploy the Blueprint.

The current Blueprint uses:

- `starter` for the backend/admin web service
- `starter` for the Next public-web service
- `standard` for the Puppeteer-heavy scraper worker
- `basic-256mb` for durable Postgres

That split keeps the crawler-friendly public site separate from the heavier
legacy admin/backend service while giving the worker enough headroom for browser
automation.

When `PUBLIC_WEB_URL` is configured on `synx-app`, the legacy web service stops
pretending to be the public site. Consumer-facing HTML routes like `/`,
`/browse`, `/anime/:slug`, `/watch/:slug/:episode`, `/login`, `/signup`,
`/watchlist`, and `/settings` return a `307` redirect to the Next frontend
instead, while backend-only routes such as `/admin`, `/api/*`, `/healthz`,
`/robots.txt`, `/sitemap.xml`, and `/anime-covers/*` remain on the legacy
service.

The Next public-web service now also receives `DATABASE_URL`, so its read-only
catalog routes can bypass the legacy HTTP bridge and call shared catalog/schedule
services directly. When `APP_ID` and a shared `APP_SECRET` are also present, the
Next app can serve `/api/auth/*`, `/api/public/session`, `/api/watchlist*`,
`/api/reviews*`, and `/api/episodes/*` directly against the shared
database/session layer.

### Paid worker mode

This branch supports two scraper execution modes:

- `inline`: local development and one-process setups
- `queue`: admin actions create DB jobs, and `npm run start:worker` drains them

And now two queue transports:

- `db`: worker polls the `scrapeJobs` table directly
- `bullmq`: web app writes the DB audit row, then dispatches execution through Redis/BullMQ

In production on this branch, `queue` is the default. The admin dashboard shows recent scraper jobs so you can see whether the worker is pending, running, completed, or failed, and whether the queue is using the DB or BullMQ transport.
The scraper queue panel also includes a `Run Queue Probe` action so you can verify the queue path from the dashboard without launching a real import.

Because the worker and web service do not share a writable filesystem, queued imports keep remote cover/banner image URLs by default. If you later move media to object storage, the worker can safely upload covers there instead.

For the ideal-stack migration path, the preferred paid setup is:

- `SCRAPER_EXECUTION_MODE=queue`
- `SCRAPER_QUEUE_BACKEND=bullmq`
- `REDIS_URL=redis://...`
- object storage enabled through `MEDIA_STORAGE_MODE=s3`

When the app is configured for BullMQ or S3 object storage, `/healthz` now validates those runtime dependencies. A missing `REDIS_URL` or incomplete `S3_MEDIA_*` configuration will make the service fail fast instead of waiting for the first import or media upload to break.

To prove the full BullMQ path locally or in a staging environment, run:

```powershell
$env:SCRAPER_EXECUTION_MODE='queue'
$env:SCRAPER_QUEUE_BACKEND='bullmq'
$env:REDIS_URL='redis://127.0.0.1:6379'
npm run queue:smoke
```

That command builds the app, starts a temporary worker, inserts a dedicated `queue_probe` job, dispatches it through BullMQ, waits for DB completion, and then cleans the probe row back out of `scrapeJobs`.

The current Blueprint uses paid services because:

- free web services can sleep, which is bad for the scraper scheduler
- free Postgres expires after 30 days
- persistent disks are for paid services
- the scraper worker needs more memory than a 512 MB instance

### Split-host Next deployment

When `apps/public-web` is deployed as its own Render service, prefer this env
shape:

- `DATABASE_URL` from the shared Postgres instance
- `APP_ID` set for the public-web service
- `APP_SECRET` shared with the backend/admin service
- `LEGACY_API_INTERNAL_HOSTPORT` from the backend service's private-network
  `hostport`
- `NEXT_PUBLIC_LEGACY_API_BASE_URL` set to the backend service's public URL
- `NEXT_PUBLIC_SITE_URL` set to the public-web service's public URL
- `PUBLIC_WEB_URL` on the backend set to that same public-web URL

That lets Next fetch catalog/auth bridge data over the private network while
still generating browser-facing media and canonical URLs against public origins.
With `DATABASE_URL` present, the public catalog pages now prefer direct shared
catalog access instead of HTTPing back through the legacy app, and with the
shared session secret it can also serve auth/session/watchlist routes without
proxying them first.

For cutover verification after both services are running, use:

```powershell
npm run next:cutover:smoke
```

### Deploy to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/jraya106/animelik)

If you keep the GitHub repo private, Render's GitHub app must have access to it.

## Railway Deployment

Railway remains a good alternative if you prefer it. The repository also includes [railway.toml](</C:/Users/Expert Gaming/Downloads/projects/Kimi_Agent_Full-Stack Anime Streaming Site/app/railway.toml>) with Dockerfile builds, a healthcheck, and the safer runtime migration step.

## Admin Workflow

Use `/admin` as an admin user to:

- manage anime records
- manage episodes
- manage categories
- import anime from supported source sites
- queue full episode source sync jobs
- queue anime metadata refresh jobs

On the migration branch, the Next admin surface now already covers:

- `/admin` for overview, queue health, broken-report pressure, and scraper quick actions
- `/admin/anime` for searchable anime catalog management, sync/refresh actions, and direct delete
- `/admin/episodes` for direct episode create/edit/delete and watch-route links
- `/admin/categories` for direct category create/edit/delete
- `/admin/reports` for broken-episode pressure and recent report activity
- `/admin/scraper` for the dedicated source import and queue tools page

### Create or update an admin user

```powershell
$env:ADMIN_EMAIL='admin@synx.local'
$env:ADMIN_PASSWORD='ChangeMe!123456'
$env:ADMIN_NAME='Site Admin'
node add-user.mjs
```

## Scraper Notes

- Each imported anime stores its `sourceSite` and `externalSlug`.
- Episode sync uses that stored provider automatically.
- WITAnime sync and YonaPlay extraction were hardened for large imports and faster source scraping.
- Anime4up pagination is supported for long-running shows with `/page/n/` episode listings.
- Generic-source imports now prefer a lightweight Cheerio-based HTML path for `okanime`, `anime4up`, `animelek`, and `ristoanime`, with browser fallback only when needed.
- Imported covers can stay on local disk or move to S3/R2-compatible object storage through the `MEDIA_STORAGE_MODE` variables above.
- `npm run db:backfill:media` migrates existing `/anime-covers/...` DB references into object storage once your S3/R2 variables are configured.

### Media backfill

When you are ready to move old locally stored posters into object storage:

1. Configure the `S3_MEDIA_*` and `MEDIA_PUBLIC_BASE_URL` variables.
2. Run a safe preview first:

```powershell
$env:MEDIA_BACKFILL_DRY_RUN='true'
npm run db:backfill:media
```

3. Optionally limit the first run:

```powershell
$env:MEDIA_BACKFILL_LIMIT='25'
npm run db:backfill:media
```

4. Run the real migration:

```powershell
Remove-Item Env:MEDIA_BACKFILL_DRY_RUN -ErrorAction Ignore
Remove-Item Env:MEDIA_BACKFILL_LIMIT -ErrorAction Ignore
npm run db:backfill:media
```

The script updates `coverImage`, `bannerImage`, and their provenance columns while preserving the existing anime rows.

## Public Content API

This branch exposes a thin read-only API layer so a separate Next.js public frontend can consume the existing catalog safely during migration:

- `/api/public/home`
- `/api/public/browse`
- `/api/public/anime/:slug`
- `/api/public/schedule`

Those endpoints intentionally reuse the current database and content logic while we peel the public site away from the Vite SPA.

## Next.js Migration Surface

This branch now carries its Next.js public migration app inside the tracked repo at `apps/public-web/`.

Its current responsibilities are:

- SSR public routes for `/`, `/browse`, `/anime/[slug]`, `/watch/[slug]/[episode]`, and `/schedule`
- direct admin routes for `/admin`, `/admin/anime`, `/admin/episodes`, `/admin/categories`, `/admin/reports`, and `/admin/scraper`
- canonical-friendly route structure
- `robots.txt` and `sitemap.xml`
- runtime consumption of the legacy app's public content API
- correct split-host media resolution for legacy `/anime-covers/...` assets when the Next app and legacy API run on different origins

The Next app is configured for runtime SSR in this phase, so it does not need the legacy API to be available during `next build`. It only needs the legacy API at request time.

Run it from the tracked repo with:

```powershell
npm run next:install
npm run next:dev
```

Or verify both the legacy app and the Next migration slice together with:

```powershell
npm run migration:verify
```

## Quality Checks

Before shipping, run:

```powershell
npm run lint
npm run test
npm run build
```

Current automated coverage includes:

- cookie/session behavior
- rate limiting
- trusted origin validation
- backend utility regression tests

## Production Notes

- Set `SITE_URL` in production so trusted-origin checks and canonical URLs match your real domain.
- Apply pending migrations before deploying.
- Ensure your Postgres instance already contains the latest schema updates for:
  - `anime.sourceSite`
  - `anime.score` precision
  - unique constraints on `users.email`, `watchlist(userId, animeId)`, and `reviews(userId, animeId)`
- Health and crawler endpoints are available at:
  - `/healthz`
  - `/robots.txt`
  - `/sitemap.xml`

## Known Operational Caveats

- Some third-party video hosts can return remote asset errors outside your control.
- Source sites may change markup over time, so scraper selectors may occasionally need maintenance.
- `drizzle-kit` still carries moderate dev-only audit advisories through its toolchain.
