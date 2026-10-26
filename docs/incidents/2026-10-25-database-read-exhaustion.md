# Database read exhaustion — 2026-10-25

Status: integrated release candidate prepared on October 26; publication and CI monitor verification pending. The live database is readable again and revision `14f4dda9a` already carries the newer holdings optimization and per-request read budgets.

## What failed

Clicking Stock on the live website returned `Authentication dependency unavailable`.
A direct read-only D1 request returned provider error 7500: the Cloudflare account
had exhausted the free daily row-read allowance. The user lookup failed before
inventory could load. This was not evidence of invalid credentials.

Cloudflare account analytics at 14:34 UTC reported 5,538,658 reads against the
5,000,000 daily allowance (110.8%), and 6,256 writes against 100,000 (6.3%).
The account total includes all databases; almost all reads were Teajia's.

`wrangler d1 insights teajia-db --time-period 1d --sort-by reads --limit 10 --json`
identified the dominant query: `readCurateHoldings`' recursive family plus correlated
product SUM, with 13,603,465 reads across 145 executions (93,817 average). This is a
rolling 24-hour window spanning two UTC allowance days, not today's total.
The next query accounted for 228,620 reads. Ordinary prelaunch use was enough;
traffic volume alone was not the diagnosis.

## Repair and regression protection

- The initial repair used three account-wide reads. Before publication, main
  gained a stronger paginated implementation with indexed merge traversal, two
  queries per page and per-request row/statement budgets. This release preserves
  that newer implementation and its UI cursor support, rather than replacing it.
- Integration tests exposed a missing bind for the second product-link arm.
  The release supplies the missing account ID, preserving stock linked only via
  a draft product, and tests both source/draft deduplication and tenancy.
- The SQLite execution-budget regression now tests the paginated implementation
  with migration 0050's index. Query count and execution growth are checked with
  realistic data sizes. These local VM measurements are not billed D1 row reads.
- The database boundary detects explicit quota errors even when old route handlers
  catch them, returns a structured 503 with a plain temporary-unavailability message, and pauses
  further D1 calls on that isolate for 60 seconds. Preflight, media and the release
  endpoint remain independent. A successful mutation is not turned into a failure
  because a later best-effort query failed. No authorization bypass is introduced.
- Browser requests pause for at most 60 seconds after a structured capacity error.
  Query retries do not amplify quota/rate-limit failures or repeat an already
  exhausted transport retry sequence. Pending durable edits remain pending.
  Capacity incidents are not written back into the database that is unavailable.
- Requests returning at least 10,000 measured D1 rows read emit a warning with
  the route template and aggregate counts, without SQL, bindings or user IDs.
  Only operations returning D1 metadata are measured; this is diagnostic, not
  an account-wide quota counter or a pre-execution query cancellation mechanism.
- The independent [D1 budget monitor](../../scripts/check-d1-budget.md) uses account
  analytics, not application D1 queries. It fails visibly at 70% warning, 90%
  critical, and when telemetry is unavailable; artifacts survive failures.
  Its live local run correctly reported critical while D1 was blocked.

## Release and operational acceptance

- Publish the exact reviewed revision using the existing verified background
  release runner; do not deploy unrelated local work or change billing silently.
- Activate the workflow on the default branch, run it with CI's credentials, and
  confirm the failed-run notification reaches the owner. Local OAuth verification
  does not establish that CI's token has Account Analytics Read permission.
- After publication, verify authenticated Stock and Samples, record D1 query
  insights for the new query shape, and confirm the old expensive query disappears.
- The consumed allowance cannot be undone by a code release. It resets at midnight
  UTC (05:45 Nepal time), or the owner can explicitly approve a paid-plan change.

## Limits and the wider reliability rule

Passing correctness tests is insufficient for queries that aggregate collections:
add a realistic data-size execution budget whenever a query nests scans or runs
once per item. Use shared retry layers; never retry a known exhausted quota in a
loop or send outage reporting to the same failed dependency. Usage alerts must
read independent provider telemetry and fail visibly when their own access breaks.

These are containment and regression controls, not a guarantee against all outages.
The quota cooldown is per isolate/browser, and hourly analytics may lag or miss a
rapid burst. General public-read rate limiting and selective edge caching remain
separate reviewed follow-ups; neither was needed to identify the measured cause.
No stale private stock is served as live, no write is replayed by this guard, and
no new paid infrastructure or account-wide hard quota allocator is introduced.
