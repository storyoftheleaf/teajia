# Database read exhaustion — 2026-10-25

Status: initial repair `feb6ccab63064a3e933acd68c3fe485fa7e63509` independently proven live by release run 308 (build `mvom89fo`). The October 26 follow-up below is prepared for verified background publication; its live proof belongs to its own release artifacts.

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

## October 26 follow-up

- Every native metadata-bearing execution is metered, including `first()` and
  session reads. Sessions share one request ledger and quota cooldown. The unused
  `raw()`/`exec()` methods are refused before execution under an active budget
  because they discard billing metadata. The explicit operational off-switch remains.
- Completed writes/batches return their committed outcome even when their own
  measured cost exceeds the budget. A later refused operation, including one
  hidden by an older handler's catch, produces nonretryable reconciliation when
  earlier writes committed. Already-started concurrent operations settle before
  that decision. REST and MCP preserve their respective error contracts. Browser
  query and durable-edit retry classifiers honor the explicit nonretryable flag.
- Unrelated admin pages no longer request the full inventory. Command palette
  and Add Product share the account/user-scoped cache. Confirmed single-product
  changes refresh only affected rows through an authenticated, tenant-scoped
  endpoint; deletion removes its row. Manual refresh, imports and bulk changes
  retain full refresh. Partial refresh never makes untouched rows look newer,
  creates a partial full-list cache, or restores data after logout/account switch.
- The independent usage workflow hands warning, critical and unknown telemetry
  states directly to i64os without writing into Teajia D1. Serialized runs restore
  and persist deduplication state in GitHub artifacts. Stable signatures retain
  the receiver's seven-day and daily repair limits. Missing credentials, failed
  delivery, and invalid acceptance receipts fail visibly. A 202 receipt proves
  acceptance only; repair completion and owner-approved publication are separate.

## Release and operational acceptance

- Initial release: [run 308](https://github.com/storyoftheleaf/teajia/actions/runs/40257168272),
  build `mvom89fo`, Pages deployment `d5f42c33.teajiafinal.pages.dev`, with byte proof.
- Initial CI monitor: [run 40257421045](https://github.com/storyoftheleaf/teajia/actions/runs/40257421045)
  succeeded using CI credentials, measuring 13,111 reads and 238 writes on October 26.
- Follow-up tests include real SQLite authorization, tenant isolation, product
  detail/list parity and committed-write outcomes; browser tests count one initial
  full list followed only by affected product reads for transfers/receipts/recounts.
- Legacy test doubles now answer singleton SQL through `all()` as real D1 does;
  no production fallback or disabled budget is used to accommodate them.
- Publish the exact reviewed follow-up revision using the existing durable runner.
  Final acceptance requires its recorded Worker revision and frontend byte proof.
  Automatic repair additionally requires an available authenticated i64os receiver;
  a configured secret or passing mocked delivery test alone is not operational proof.
- No billing plan, quota limit, inventory visibility or owner merge policy changed.

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

## October 26 repair receiver restoration

The independent monitor's receiver was unavailable for reasons outside Teajia:
`i64os-core.service` runs as `i64os`, but its runtime store directory was owned
by root, preventing SQLite WAL creation. `/opt/i64os-core/store` and its
`.secrets-cache.env` were restored to `i64os:i64os` ownership, without recursive
permission changes to other runtime secrets. The database file itself already
had the correct owner.

A second startup failure was the core's dependency on Tailscale's private
address. The VPS's Tailscale backend requires login and has no assigned private
IPv4, so binding `100.126.166.59:5570` failed. The public webhook tunnel runs on
that same VPS; it does not need the private network. The durable systemd drop-in
`/etc/systemd/system/i64os-core.service.d/95-loopback-tunnel.conf` now binds core
to `127.0.0.1:5570`. The existing i64os deployment script installs named drop-ins
and does not delete or override this file. No public listener was added.

Cloudflare tunnel `7026f83c-1114-45eb-97e0-6b7c1ee73e0a` (`i64os-core`),
configuration version 3, changes only the origin address for the two already
exposed exact routes: `/api/v1/meters/alert` and `/api/v1/repairs/incident`.
They now reach `http://127.0.0.1:5570`. Authentication, hostname/path matching,
other configuration fields and catchall 404 remain unchanged. The prior config
was saved locally with mode 0600 at `/tmp/teajia-i64os-tunnel-before.json` for
rollback. This is an operational backup, not a repository secret or permanent
backup service. The separate i64os tunnel-bootstrap script still contains the
old private origin; do not rerun that bootstrap unchanged. Normal app deployment
does not invoke it.

External proof, using the monitor's explicit `teajia-d1-budget/1.0` user agent:

- Authenticated POST to `/api/v1/repairs/incident` with intentionally invalid
  schema returned **400**, `BAD_REQUEST: unknown source`, proving authentication
  and routing without dispatching a repair or consuming its attempt budget.
- The same POST without the shared secret returned **401**.
- GET `/api/v1/repairs` and GET `/api/v1/health` both remained **404**.
- The source value copied to GitHub and the running receiver's environment
  matched by an in-memory fingerprint comparison; no values or fingerprints
  were printed. GitHub does not allow reading a secret back. A real workflow
  delivery is still the end-to-end check of the stored GitHub copy.

The earlier **403 / Cloudflare 1010** came from the Python probe's default user
agent, before the origin. The monitor now sends its explicit truthful user agent.

**Receiver availability is not execution readiness.** The receiver's configured
repair host is `innerstellar`, with dry-run disabled. Its presence check, run as
the actual `i64os` service user, currently fails SSH with hostname resolution
failure. Tailscale requires reauthentication. In addition, `/home/i64os/.ssh`
contains only `authorized_keys`, with no outbound identity or host alias; the
existing root-only studio alias/key is not available to the service. The
innerstellar access skill documents only that root/Tailscale route, not a reverse
tunnel, and no reverse SSH listener was present. No root private key was copied
into the application. A deliberate least-privilege service SSH setup and restored
private connectivity are still required before automatic repair execution can
be declared operational. The monitor retains failure artifacts and receiver
acceptance remains distinct from completed repair or publication.

To prevent an acknowledged webhook from concealing that known executor gap,
GitHub repository variable `I64OS_REPAIR_READY` is explicitly **false** (set and
read back). The workflow defaults it to false. Until it is explicitly true, the
monitor persists incident intent but sends no repair job and exits 4 with the
network sign-in/service SSH credential blocker. This remains visible even if
usage is below threshold. Enable it only after the exact service-user presence
probe confirms the configured repair host, Claude availability and GitHub login.
The Tailscale authentication URL was returned privately in the task handoff;
it is not stored in this permanent incident record.
