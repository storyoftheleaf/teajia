# Database read exhaustion — 2026-10-25

Status: initial repair `feb6ccab63064a3e933acd68c3fe485fa7e63509` independently proven live by release run 308 (build `mvom89fo`). The October 26 follow-up `01f1499c` is independently proven live as build `mvopslrr`; later releases retain it.

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

**Receiver availability is not execution readiness.** The first service-user
probe failed: Tailscale needed reauthentication and the service had no outbound
SSH identity/alias. The configured executor was Innerstellar, with dry-run off.
The monitor was held explicitly unready while these dependencies were repaired.
The workflow defaults `I64OS_REPAIR_READY` to false: in that state it persists
intent but sends no job and exits 4, even at healthy usage. Current readiness is
**true**, after the restoration and checks below. Receiver acceptance remains
distinct from completed repair or publication.

### Executor restoration after owner sign-in

The owner completed Tailscale sign-in during this task. The VPS then reported
`Running` with its existing private address, and the established root-to-studio
path reached Innerstellar. This resolves the network blocker above.

A dedicated Ed25519 service identity was installed in the actual `i64os` Unix
home, `/opt/i64os-core/.ssh`, with mode-0600 key/config/known-hosts files. The
initial `/home/i64os` assumption was corrected; temporary duplicate setup files
there were removed without changing the pre-existing `authorized_keys`.
The root private key was not copied. The studio's authorized-key entry restricts
this new key to source `100.126.166.59`, disables forwarding and PTY access, and
forces `C:/ProgramData/i64os-repair/i64os-repair-ssh.ps1`. Existing authorized-key
entries were preserved and backed up before adding the dedicated entry.

The reviewed source is [i64os-repair-ssh.ps1](../../scripts/i64os-repair-ssh.ps1),
with [offline parser tests](../../scripts/i64os-repair-ssh.test.ps1). The wrapper
translates the receiver's existing POSIX-shaped command grammar for the Windows
studio, passing prompt text only over stdin. It accepts the exact presence
probe, fixed existing Claude tool lists with at most 150 turns, and the existing
PR checks/owner-triggered merge grammar for the two already allowed repositories.
It does not evaluate arbitrary SSH command text. Its installed source matches
the reviewed repository file by SHA-256 comparison.

Read-only operational proof as the actual `i64os` service user:

- The exact receiver presence command returned **exit 0**: Claude Code **2.1.259**
  logged in, Git **2.54.0.windows.1**, `GIT_BASH_OK`, and `GH_OK`.
- The active GitHub credential has push access to both existing repair repos.
  An unrelated expired saved account made `gh auth status` fail, so readiness
  checks the active credential's exact repository access instead. No GitHub
  credential was copied and no account permission was expanded.
- Arbitrary `hostname` and the legitimate probe suffixed with `; whoami` were
  both refused with **exit 126** by the forced command.
- The offline PowerShell validator passed **4 accepted / 16 refused** fixtures,
  including newline/semicolon injection, excessive turns, widened tools,
  unapproved repositories and malformed merge commands. No agent was launched.

Only after those checks, `I64OS_REPAIR_READY` was set and read back as **true**,
superseding the temporary false state above. The default remains false for an
unconfigured deployment. This verifies receiver routing/authentication and
executor availability; it does not claim that a real repair has completed or
published. No fabricated incident consumed a repair attempt or AI credits.

The dedicated key and parser are not a repository/filesystem sandbox. The
existing Claude git/GitHub/Node/npm authority remains broad on the trusted
studio host. Owner approval for merging is enforced by the existing receiver
upstream; neither this wrapper nor the monitor originates a merge. Normal i64os
deployment does not remove the service SSH directory or the loopback drop-in.

### 2026-10-26 real repair acceptance and result retention

A controlled, explicitly labeled acceptance incident (`acceptance_loopback_20261026`) went through the production `deliverRepair` transport, authenticated receiver and dedicated studio executor. It found a genuine bootstrap regression and opened i64os PR #210 (`e138936e3543e0e2b8fc135f6f7080f3aa130ebc`): rerunning the tunnel bootstrap would restore the private-network origin after the core moved to loopback. This was not a fabricated quota alert or live outage. No inventory data was changed.

The actual executor completed successfully but omitted its required result footer while CI was pending. The original attempt `01M5V4SQ7NRZVK104Z7VYCVQAY` remains recorded as stopped; its history is not rewritten. Combined i64os PR #211 (`a12a8a6c7a97ed697cedccd0e81c4df57bc66730`, including the operational brief from PR #209) fixes the resulting tracking gap: a unique correct-repository PR is only a candidate, independent GitHub checks must include an actual passing check, and pending/unavailable results are retained as restricted local artifacts. The existing daily morning job reconciles them without another model invocation. Reconciliation creates an idempotent owner-review entry, preserves stopped history, quarantines malformed artifacts, and never reopens a merged result. Failed checks remain stopped; future repairs still require the owner's merge action.

Both runtime module mirrors were updated with backups under `/opt/i64os-core/store/repair-acceptance-backups/result-20261026` and matching SHA proofs. The core was restarted once after the original executor had finished. Verified: local health 200; authenticated invalid-schema request 400; unauthenticated repair request 401; private repair listing 404. The acceptance output is stored under `/opt/i64os-core/store/repair-results/` as mode 0600, owned by `i64os`. No readiness claim substitutes for the eventual PR checks and queue evidence.

The persistent service overrides are `/etc/systemd/system/i64os-core.service.d/95-loopback-tunnel.conf` (`BIND_ADDRESS=127.0.0.1:5570`) and `/etc/systemd/system/i64os-core-outage-report.service.d/95-loopback.conf` (`OUTAGE_CORE_ADDR=http://127.0.0.1:5570`). Both existing cron database consumers now invoke the `i64os` service user; the installer source and an offline regression test preserve that choice across installation. Schedules and credentials were not changed. This avoids root-owned WAL files making the receiver unwritable again.

Durable acceptance evidence lives in `outputs/repair-acceptance/`: receipt and captured-output provenance; both-mirror runtime hashes; endpoint health; `result-source-integration.json` for exact-revision source CI/merge; and `repair-ci-completion.json` for PR #210 CI followed by service-user reconciliation. The latter runs the reconciliation function directly and does not send a morning message. These state files distinguish waiting, failed and completed work; consult them before claiming the full chain has finished.

Acceptance completion: PR #210's CI passed and the saved result was independently reconciled to pending review item `01M5V601CGRCVEHPBD2HCEN6W8`. With the owner's explicit publish authorization, the existing `mergeRepair` path rechecked CI and merged it as `0461c42f119911d705a604cc06130b954034c862`; the local incident is resolved. The installed bootstrap script matches that merged commit (SHA-256 `1cb8e455b533440a764aa16ed7387e593107811d76a633f6295b1c2ddcb051d1`); it was installed but not executed, because the live tunnel was already correct. Five focused regression tests also passed independently against the exact repair PR head.

PR #211 source integration uses a persistent macOS LaunchAgent (`com.i64os.repair-source-integration-211`), not a model waiting for CI. `outputs/repair-acceptance/result-source-runner.json` records its exact revision, CI run, script, status file and resume command. If that integration fails, the reviewed modules remain live, but a normal deployment from a main revision lacking the fix could overwrite them; do not claim source integration complete until its recorded state is `merged`.

PR #211 publication completed as `747e5af3` after successful CI. All 16 relevant runtime/installer files match the merged revision, the acceptance repair is merged and resolved, and its publication runner exited successfully. The next bounded read reductions are documented in [secondary admin reads](2026-10-26-secondary-read-reduction.md).
