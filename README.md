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
```

## Scripts

```powershell
npm run dev
npm run build
npm start
npm run lint
npm run test
npm run db:push
npm run db:generate
npm run db:migrate
```

`npm start` serves the built production app through `start-prod.mjs` and works on Windows.

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

## Railway Deployment

Railway is the recommended host for this project because it fits the current architecture well:

- long-running Node web service
- PostgreSQL service in the same project
- Dockerfile-based deploy
- background scraper scheduler support

The repository includes [railway.toml](</C:/Users/Expert Gaming/Downloads/projects/Kimi_Agent_Full-Stack Anime Streaming Site/app/railway.toml>) with:

- Dockerfile builds
- `npm run db:migrate` as a pre-deploy step
- `/healthz` healthcheck

After authenticating the Railway CLI, the typical flow is:

```powershell
npx @railway/cli init
npx @railway/cli deploy -t postgres
npx @railway/cli up
```

## Admin Workflow

Use `/admin` as an admin user to:

- manage anime records
- manage episodes
- manage categories
- import anime from supported source sites
- sync episode video sources
- refresh stored anime metadata

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
