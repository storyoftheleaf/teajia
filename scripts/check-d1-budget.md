# D1 account budget monitor

`node scripts/check-d1-budget.mjs` reads Cloudflare GraphQL analytics, never the
application database. It totals **all databases in the Cloudflare account** for
the current UTC day. This matters because the free allowance is shared.

The hourly `D1 account budget` workflow also runs when its files land on main.
It runs on GitHub, independently of the API
and D1. It writes JSON plus a readable job summary and uploads both on success
or failure. It performs no writes to Cloudflare, sends no external messages,
and does not upgrade a plan or change a spending limit.

## Configuration

Required GitHub secrets (already named by the deploy workflow):

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`, with access to account analytics (`Account Analytics:
  Read`). Deployment permissions alone do not prove analytics access. Test a
  manual run before considering the monitor operational.

Default budgets are Workers Free: 5,000,000 rows read and 100,000 rows written
per UTC day. Repository variables `D1_DAILY_READ_BUDGET` and
`D1_DAILY_WRITE_BUDGET` override these operational budgets. A paid plan has
monthly included quantities; do not substitute those monthly figures into a
daily budget. Pick an explicit daily operational budget instead.

The CLI also accepts `D1_WARNING_FRACTION` (default 0.7),
`D1_CRITICAL_FRACTION` (default 0.9), and `D1_BUDGET_OUTPUT_DIR`.

Exit states: 0 healthy, 1 warning, 2 critical, 3 unknown. Warning is deliberately
nonzero so the job does not appear green after crossing the early threshold.
Missing credentials, permission errors, missing metrics, timeout and malformed
responses all fail as **unknown**, never as zero usage. Reports exclude tokens
and provider error bodies.

## Response and limitations

At warning, inspect Cloudflare D1 Metrics and query Insights to find the source
of growth. At critical, contain avoidable scanning, polling or background jobs
before quota exhaustion; review capacity separately. At unknown, repair access
to telemetry. GitHub's own notification preferences determine whether a failed
run reaches the owner; this workflow does not configure or guarantee alerts.

The schedule starts only after the workflow lands on the default branch.
Scheduled jobs can be delayed and analytics can lag. A rapid burst can exhaust
the remaining quota between hourly checks. Empty data early in a UTC day is
unknown rather than an invented zero. This monitor detects risk; it is not a
hard admission controller or a guarantee against outages. Validate a live run,
its artifact, and the owner's GitHub failure notification settings before
calling monitoring active.

Sources:
- https://developers.cloudflare.com/d1/observability/metrics-analytics/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/
