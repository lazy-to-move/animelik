# Security Report

Audit date: 2026-05-09  
Branch: `codex/render-worker-architecture`

Security score: **91/100**

## Scope

- authentication UX and validation behavior
- session-backed route protection
- admin access exposure
- queue-mode production process behavior
- package vulnerability surface
- deployment/runtime misconfiguration risk

## Security Findings Fixed

### 1. Web process was doing scraper work it should not own in queue mode

Severity: **High**

Risk:
- the public web process was starting legacy scheduler work in the worker branch
- this increased exposure to memory exhaustion and operational instability under admin-triggered scraping scenarios

Fix:
- added `shouldStartEpisodeScheduler()`
- disabled the automatic scheduler in queue mode by default
- retained an explicit override for intentional use

Files:
- `api/lib/scraper-execution.ts`
- `api/boot.ts`
- `api/lib/scraper-execution.spec.ts`

### 2. Validation failures in auth forms were not user-safe enough

Severity: **Medium**

Risk:
- malformed auth submissions could surface as runtime-level client failures instead of staying inside expected validation UX

Fix:
- added client-side auth validation for email, password, and signup name
- caught async mutation failures cleanly

Files:
- `src/pages/Login.tsx`

### 3. Broken direct-route handling increased misrouting and observability noise

Severity: **Medium**

Risk:
- known frontend routes were not fully recognized in the production server path map
- missing favicon handling caused unnecessary browser noise

Fix:
- added missing frontend route recognition
- redirected `/favicon.ico` to `/favicon.svg`

Files:
- `api/lib/vite.ts`
- `api/boot.ts`

### 4. Baseline response hardening was still light

Severity: **Medium**

Risk:
- production responses lacked several low-risk browser hardening headers

Fix:
- added:
  - `Content-Security-Policy`
  - `Cross-Origin-Opener-Policy`
  - `Cross-Origin-Resource-Policy`
  - `Origin-Agent-Cluster`
  - conditional `Strict-Transport-Security` for HTTPS requests

Files:
- `api/boot.ts`

### 5. Queue worker claim logic could silently fail

Severity: **Medium**

Risk:
- pending jobs could sit indefinitely even though they were eligible to run
- operators might retry or duplicate work manually

Fix:
- replaced the Drizzle timestamp comparison with `sql\`now()\``
- verified real claim -> run -> complete behavior locally

Files:
- `api/services/scraper/job-queue.ts`

## Package Audit

### Production dependency surface

Command:
- `npm audit --omit=dev`

Result:
- `0 vulnerabilities`

Assessment:
- no known current vulnerabilities in the production/runtime dependency set used by the shipped application

### Full repository audit

Command:
- `npm audit`

Result:
- `4 moderate vulnerabilities`

Affected chain:
- `drizzle-kit`
- `@esbuild-kit/esm-loader`
- `@esbuild-kit/core-utils`
- nested `esbuild`

Assessment:
- dev-tooling only
- the suggested fix requires a breaking `npm audit fix --force`
- not a safe automated production change during this audit pass

## Access Control Review

Verified:
- authenticated settings route protection works
- admin login flow works in browser smoke
- admin-only access path remains enforced

## Sensitive Data and Secrets

Verified:
- environment variables are not committed in source
- example environment scaffolding exists

Operational note:
- if real credentials were ever pasted into terminals or chat during deploy/debug, rotate them after setup

## Remaining Risks

### P2. No distributed rate limiting or centralized security telemetry

Impact:
- if the app scales horizontally, process-local protections will not be enough on their own

### P2. Scraper targets remain untrusted third-party HTML

Impact:
- markup shifts and remote content behavior remain a reliability risk
- keep scraper execution isolated from privileged filesystem or shell behavior

### P3. Dev-only advisories remain open

Impact:
- no production runtime exposure identified
- repository health is still not a full `npm audit` clean slate

## Recommendation

Release recommendation: **acceptable for launch on this branch**

Reason:
- no critical unresolved application-layer security defect was reproduced during this audit
- the remaining risks are operational hardening and dev-tooling follow-ups rather than release blockers
