# Test Results

Audit date: 2026-05-09  
Branch: `codex/render-worker-architecture`

## Command Results

### Static and build checks

- `npm run check` -> pass
- `npm run lint` -> pass
- `npm run build` -> pass
- `npm run db:reconcile:legacy` -> pass
- `npm run db:migrate:deploy` -> pass

### Unit and integration tests

- `npm run test` -> pass
- Result: `7` files, `28` tests passed

### Security/dependency checks

- `npm audit --omit=dev` -> pass, `0 vulnerabilities`
- `npm audit` -> fail on purpose for visibility, `4 moderate` dev-only advisories in `drizzle-kit` tooling

### Build artifact inspection

Verified from the latest production build:

- home route chunk about `17.0 kB`
- main chunk about `213.1 kB`
- motion chunk about `122.0 kB`
- shared CSS about `135.6 kB`
- `dist/boot.js` about `15.0 MB`
- `dist/worker.js` about `14.1 MB`

## Browser Smoke Test

Command:
- `npm run test:e2e:smoke`

Result:
- pass

Evidence:
- summary file: `test-artifacts/e2e-smoke/summary.json`

Smoke assertions completed:

- public home page loaded
- privacy page loaded
- terms page loaded
- signup short-password validation stayed user-facing
- signup success path worked
- authenticated settings page loaded
- watchlist add flow worked
- responsive width checks passed at mobile and tablet sizes
- admin login path worked

Captured summary payload:

```json
{
  "success": true,
  "consoleErrors": [],
  "pageErrors": [],
  "failedRequests": [],
  "completedChecks": [
    "home",
    "privacy",
    "terms",
    "signup-validation",
    "signup-success",
    "settings-authenticated",
    "watchlist-add",
    "responsive-widths",
    "admin-login"
  ]
}
```

## Manual / Targeted Runtime Validation

Verified locally:

- production web process starts
- worker process starts
- real queue job can be claimed and completed
- direct known frontend routes return expected production responses
- legacy local migration journal reconciliation works and allows normal Drizzle migration execution afterward

## Notes

- The strongest automated browser coverage in this pass is Chromium-based.
- Cross-browser parity beyond Chromium remains a follow-up launch recommendation, not a failed gate in this audit pass.
