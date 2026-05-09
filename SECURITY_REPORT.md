# Security Report

Audit date: 2026-05-08

## Scope

- authentication flows
- cookie/session handling
- admin access control
- database integrity constraints
- dependency advisories
- public API exposure

## Fixed Security Findings

### 1. Cookie CSRF exposure reduced

Previous state:

- non-local environments used `SameSite=None`
- that was broader than needed for this app’s same-site cookie model

Fix:

- session cookies now use `SameSite=Lax`
- `Secure` remains enabled for non-local hosts

Impact:

- materially lowers cross-site request forgery exposure for cookie-authenticated mutations

### 2. Auth rate limiting added

Previous state:

- `signIn`, `signUp`, and `googleSignIn` had no brute-force throttling

Fix:

- added request fingerprinting from forwarded IP headers
- added in-memory request windows for:
  - sign in
  - sign up
  - Google sign in

Impact:

- improves resistance to credential stuffing and rapid account-creation abuse

### 3. User email uniqueness enforced

Previous state:

- `users.email` was not unique at the DB layer
- the app code expected email identity semantics anyway
- `add-user.mjs` crashed because it assumed an email conflict target existed

Fix:

- added schema uniqueness
- applied live DB uniqueness
- updated admin bootstrap script to update existing users safely

Impact:

- closes identity ambiguity and bootstrap instability

### 4. Duplicate watchlist/review records blocked

Previous state:

- DB allowed duplicate watchlist rows for the same user and anime
- DB allowed duplicate review rows for the same user and anime

Fix:

- unique index on `watchlist(userId, animeId)`
- unique index on `reviews(userId, animeId)`
- router-level dedupe/update behavior

Impact:

- prevents data integrity abuse and race-created duplicate rows

### 5. Public session introspection no longer throws auth errors

Previous state:

- anonymous users calling `auth.me` got `401`
- every public page with auth-aware UI emitted unauthorized noise

Fix:

- `auth.me` now returns `null` when logged out

Impact:

- reduces misleading error noise and makes monitoring cleaner

## Dependency Audit

Result after `npm audit fix`:

- `4` moderate advisories remain
- all are in the `drizzle-kit` toolchain:
  - `drizzle-kit`
  - `@esbuild-kit/esm-loader`
  - `@esbuild-kit/core-utils`
  - nested `esbuild`

Assessment:

- this is a **development tooling** risk, not a production runtime bundle risk
- the audit tool suggests a breaking downgrade-style fix path that is not safe to auto-apply blindly

## Access Control Review

Verified:

- non-admins are blocked from the admin dashboard
- authenticated user-only flows require a valid session
- admin login works after password reset/bootstrap

## Sensitive Data / Secrets Review

Verified:

- `.env` is ignored by git
- `.env.example` exists and documents the expected variables

Notes:

- local secrets still exist in the working environment and should not be copied into deployment logs or screenshots

## Remaining Security Risks

1. Rate limiting is memory-local only.
2. There is no dedicated CSRF token layer beyond cookie policy.
3. External scraper targets remain untrusted inputs and should continue to be isolated from any privileged filesystem actions.
4. The app does not yet include centralized security logging, alerting, or account lockout flows.

## Security Recommendation

Release recommendation: **acceptable for launch with monitoring**, provided the team accepts:

- the remaining dev-only `drizzle-kit` advisory chain
- the lack of distributed rate limiting
- the absence of explicit CSRF tokens

## Post-Audit Follow-Up

Additional security hardening completed after the initial report draft:

- added trusted-origin enforcement for cookie-authenticated mutations
- verified live behavior with real HTTP probes:
  - same-origin logout succeeds with HTTP `200`
  - cross-origin logout from `https://evil.example.com` is blocked with HTTP `403`
- fixed the middleware response path so blocked requests return a clear forbidden response instead of surfacing as a generic `500`
