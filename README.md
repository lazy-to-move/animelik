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
SCRAPER_EXECUTION_MODE=inline
SCRAPER_WORKER_POLL_MS=5000
```

## Scripts

```powershell
npm run dev
npm run build
npm start
npm run start:worker
npm run lint
npm run test
npm run db:push
npm run db:generate
npm run db:migrate
```

`npm start` serves the built production app through `start-prod.mjs` and works on Windows.
`npm run start:worker` runs the background scraper worker against the same database queue.

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
- Dockerfile-based deploys
- a persistent disk for runtime-downloaded posters
- DB-backed queue processing without tying imports to the user-facing web process

The repository includes [render.yaml](</C:/Users/Expert Gaming/Downloads/projects/Kimi_Agent_Full-Stack Anime Streaming Site/app/render.yaml>) with:

- a Docker web service
- a dedicated Docker worker service for scraper jobs
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

- `starter` for the public web service
- `standard` for the Puppeteer-heavy scraper worker
- `basic-256mb` for durable Postgres

That split keeps the public site lean while giving the worker enough headroom for browser automation.

### Paid worker mode

This branch supports two scraper execution modes:

- `inline`: local development and one-process setups
- `queue`: admin actions create DB jobs, and `npm run start:worker` drains them

In production on this branch, `queue` is the default. The admin dashboard shows recent scraper jobs so you can see whether the worker is pending, running, completed, or failed.

Because the worker and web service do not share a writable filesystem, queued imports keep remote cover/banner image URLs by default. If you later move media to object storage, the worker can safely upload covers there instead.

The current Blueprint uses paid services because:

- free web services can sleep, which is bad for the scraper scheduler
- free Postgres expires after 30 days
- persistent disks are for paid services
- the scraper worker needs more memory than a 512 MB instance

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
