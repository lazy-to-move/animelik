# TODO Before Launch

## Must Do

- Commit the generated migration files:
  - `db/migrations/0002_typical_valeria_richards.sql`
  - `db/migrations/meta/0002_snapshot.json`
  - updated `db/migrations/meta/_journal.json`
- Ensure the older migration SQL files are committed too now that `.gitignore` no longer hides them.
- Apply the migration in every environment, not only the local DB already patched during this audit.
- Deploy with the new cross-platform start flow and verify `npm start` on the real target host.
- Set `SITE_URL` correctly in every deployed environment so canonical URLs and trusted-origin protection match the real domain.

## Strongly Recommended

- Run a real Lighthouse report against the deployed production URL.
- Run manual browser checks in Firefox, Edge, and Safari.
- Monitor scheduler logs after deployment for third-party scraper breakage.
- Decide how to handle the remaining dev-only `drizzle-kit` audit advisories.

## Nice To Do Soon After Launch

- Add distributed rate limiting if the app will run on multiple instances.
- Add stronger security logging and alerting around auth/admin actions.
- Improve server-rendered or pre-rendered SEO for dynamic anime pages.
- Revisit bundle size, especially `framer-motion` and global CSS.
