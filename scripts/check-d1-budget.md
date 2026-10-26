# D1 account budget monitor

`node scripts/check-d1-budget.mjs` reads Cloudflare GraphQL analytics, never the
application database. It totals **all databases in the Cloudflare account** for
the current UTC day. This matters because the free allowance is shared.

The hourly `D1 account budget` workflow also runs when its files land on main.
It runs on GitHub, independently of the API
and D1. It writes JSON plus a readable job summary and uploads both on success
or failure. Actionable changes are handed directly to the existing i64os repair
receiver, independently of Teajia D1. It sends no messages to the owner, performs
no writes to Cloudflare, and does not upgrade a plan or change a spending limit.

## Configuration

Required GitHub secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`, with access to account analytics (`Account Analytics:
  Read`). Deployment permissions alone do not prove analytics access. Test a
  manual run before considering the monitor operational.
- `I64OS_REPAIR_SECRET`, the existing shared repair secret used by
  `worker/src/problemAlerts.ts` and the i64os receiver. Do not create a new
  incompatible value. This is the one additional secret beyond the monitor
  credentials.

The repository variable `I64OS_REPAIR_READY` must be exactly `true` before
handoff is enabled. It defaults to `false`: an available receiver alone does
not prove that its repair executor can connect to the studio machine. While
false, every workflow records an explicit repair-readiness failure (exit 4),
preserves incident intent, and sends no repair job. Set it true only after the
service-user SSH presence probe confirms both Claude and authenticated GitHub
on the configured repair host. On October 26 it was deliberately set false:
Tailscale needs login and the service user lacks an outbound SSH identity.

Default budgets are Workers Free: 5,000,000 rows read and 100,000 rows written
per UTC day. Repository variables `D1_DAILY_READ_BUDGET` and
`D1_DAILY_WRITE_BUDGET` override these operational budgets. A paid plan has
monthly included quantities; do not substitute those monthly figures into a
daily budget. Pick an explicit daily operational budget instead.

The CLI also accepts `D1_WARNING_FRACTION` (default 0.7),
`D1_CRITICAL_FRACTION` (default 0.9), and `D1_BUDGET_OUTPUT_DIR`.

Exit states: 0 healthy, 1 warning, 2 critical, 3 unknown, 4 repair delivery or
state failure. Warning is deliberately
nonzero so the job does not appear green after crossing the early threshold.
Missing credentials, permission errors, missing metrics, timeout and malformed
responses all fail as **unknown**, never as zero usage. Reports exclude tokens
and provider error bodies.

## Independent repair handoff

The production workflow always sets `D1_REPAIR_STATE_FILE` to enable handoff.
A CLI run without that variable is deliberately read-only and cannot dispatch
a repair. The script posts the same authenticated payload as
`worker/src/problemAlerts.ts` to `https://app.i64os.com/api/v1/repairs/incident`,
with `source: teajia`, `repo: storyoftheleaf/teajia`, and the
`x-i64os-repair-secret` header. No Teajia API or D1 row is needed. The incident
contains sanitized counts and the workflow run URL, and explicitly identifies
its ledger as the GitHub artifact rather than a nonexistent D1 incident row.

New warning, critical, or unknown states trigger a handoff. Accepted repeats
stay quiet. Warning-to-critical escalation triggers once. A known reading
clears a telemetry incident; only a healthy below-warning reading clears a
quota incident. Unknown telemetry never proves quota recovery. Recovery is
recorded locally and rearms a later recurrence; there is no invented receiver
clear endpoint. Signatures are stable by account, failure type and severity,
including across recovery, so i64os's seven-day signature safety gate and its
two-attempts-per-day gate still apply. Rearming is not permission to bypass them.

All production triggers share one GitHub concurrency lock. Each run restores
the newest unexpired main-branch state artifact and persists a new artifact even
when usage or delivery fails. State is retained for 90 days and carries no
credentials. Artifact retrieval or malformed state fails closed. With no
retained state, the receiver's stable-signature gate remains the final duplicate
protection. A longer inactive period can lose local episode history.

Intent is written before delivery; a response lost in transit is retried with
the same identity. There are at most three attempts per run, each with a
five-second timeout; authentication rejection is not retried. Acceptance is
recorded only for the receiver's `202` response with
`{ok:true,data:{accepted:true}}`. Missing secret, failed delivery, invalid
receipt, or state persistence failure leaves an explicit failing workflow,
never a claim that a repair started. Failed delivery stays eligible next run.

**Accepted is not fixed.** The receiver acknowledges before processing. Its
existing host-availability, attempt-budget, tests, PR and owner-merge rules
remain in force; this monitor does not auto-merge or publish. The receiver's
best-effort Teajia status PATCH may fail for an external incident ID; repair
attempts remain visible in i64os and the GitHub artifact retains the evidence.

## Response and limitations

At warning, the repair brief contains account-wide usage so the builder can
inspect D1 Metrics and query Insights to find the source. At critical, it should
contain avoidable scanning, polling or background jobs before quota exhaustion;
capacity changes remain separate. Unknown telemetry requests repair of the
monitor itself. GitHub's own notification preferences determine whether a
failed run reaches the owner; this workflow sends no owner messages.

The schedule starts only after the workflow lands on the default branch.
Scheduled jobs can be delayed and analytics can lag. A rapid burst can exhaust
the remaining quota between hourly checks. Empty data early in a UTC day is
unknown rather than an invented zero. This monitor detects risk; it is not a
hard admission controller or a guarantee against outages. Validate a live run,
its usage and state artifacts, and a genuine receiver acknowledgement before
calling repair delivery operational. Do not send a fake live incident solely
to test the repair pipeline: it spends a bounded repair attempt.

Sources:
- https://developers.cloudflare.com/d1/observability/metrics-analytics/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/
