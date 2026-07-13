# Teajia Incident Ledger and AI Repair Queue

**Date:** 2026-07-13  
**Status:** Approved design, awaiting implementation planning

## Purpose

Teajia must preserve useful evidence whenever an application flow fails, expose unresolved failure classes in a compact queue that Codex Desktop or Codex Cloud can process, and close incidents only after a permanent repair is verified.

The system is deliberately small. It is not a general analytics platform, it does not send every occurrence to an AI model, and it does not autonomously change permissions or production configuration.

## Design principles

1. Record precise observations before inferring causes.
2. Treat login methods as credentials for one internal user identity; permissions belong to `user.id`.
3. Deduplicate repeated failures by a stable signature.
4. Keep raw operational facts in D1 and compact sanitized evidence beside the code.
5. Invoke AI only when an incident is intentionally investigated or a new critical signature requires attention.
6. A retry is temporary recovery. An incident closes only after the underlying failure class is repaired and verified.
7. Never record secrets, authorization headers, tokens, passwords, verification codes, request bodies, or unnecessary personal data.

## Scope

The first release covers failures that prevent or materially distort a user flow:

- network, proxy, deployment-configuration, and server failures;
- authentication and session failures;
- authorization and account-context contradictions;
- navigation or workflow states that cannot progress;
- unexpected client exceptions and failed API operations.

Ordinary form validation, expected permission denials, cancelled actions, successful requests, performance analytics, and product usage telemetry are out of scope.

## Identity invariant

Email/password and Google OAuth are login methods, not independent permission identities. Both must resolve to the same internal `users.id` when they use the same verified email or have been explicitly linked. Platform role, account memberships, and bundles are read from that internal user.

A platform owner or platform admin is not required to have an `account_members` row to pass the frontend membership gate. Platform-tier login must select a valid active account before account-scoped operations begin. Different email addresses are never merged automatically; linking them requires an explicit authenticated action.

## Canonical incident ledger

D1 is the canonical runtime record. One row represents one failure signature rather than one occurrence.

Minimum fields:

| Field | Purpose |
|---|---|
| `id` | Stable public-safe incident identifier |
| `signature` | Stable deduplication key such as `api:503:upstream_not_configured` |
| `category` | `network`, `configuration`, `server`, `auth`, `authorization`, `workflow`, or `client` |
| `severity` | `critical`, `high`, `medium`, or `low` |
| `status` | `open`, `acknowledged`, `repairing`, `observing`, or `resolved` |
| `first_seen` / `last_seen` | Failure window |
| `occurrence_count` | Deduplicated recurrence count |
| `route` / `method` / `http_status` | Failing operation when applicable |
| `error_code` / `safe_message` | Normalized machine code and short safe evidence |
| `deployment` | Frontend/Worker revision when available |
| `account_id` / `user_id` | Internal correlation identifiers when relevant |
| `sample` | One size-limited, sanitized representative context object |
| `resolved_at` / `resolution_ref` | Verified closure metadata |

Occurrence updates increment `occurrence_count`, update `last_seen`, and replace the representative sample only when the new sample adds a previously absent diagnostic field. Repeated events do not create additional rows.

## Failure capture and correlation

Every API response receives or preserves a correlation ID. The browser records only what it directly observes: operation, status, normalized code, connectivity state, active account, deployment, and correlation ID. The Worker records server-side category and safe diagnostic context under the same correlation ID.

The client must not convert all failures into “Connection issue.” User-facing messages reflect the known category:

- offline or transport failure: connection problem;
- HTTP 5xx: service problem;
- missing binding or invalid configuration: service configuration problem;
- expired session: sign-in required;
- authorization contradiction: access state problem.

The interface shows a short incident ID when a failure prevents progress. It does not speculate about downstream effects.

## Repository repair queue

Agents consume a sanitized projection of the D1 ledger:

```text
ops/incidents/
├── OPEN.md
├── evidence/
│   └── <signature-slug>.json
└── resolved/
    └── YYYY-MM/<signature-slug>.md
```

`OPEN.md` is a short generated index. Each item contains the signature, severity, occurrence count, first and last seen times, deployment, one-sentence observation, and a relative evidence link. Evidence JSON is size-limited and contains only the minimum ledger fields needed to start investigation.

The queue is synchronized only when:

- a new signature appears;
- severity increases;
- materially new diagnostic evidence appears;
- status changes to or from resolved;
- a resolved signature recurs.

It is not updated for counter-only repetition. This prevents noisy commits and unnecessary Cloud processing.

The synchronizer must be deterministic: the same ledger state produces byte-identical files. It must never include secrets or raw request bodies. Queue publication failures remain visible in D1 and retry later; they never block the user-facing operation that originally failed.

## i64 OS notification

i64 OS remains the front door, but receives only a compact capture when the repository queue materially changes:

```markdown
# Teajia incidents ready

2 new or changed incident signatures are available in
`ops/incidents/OPEN.md` at deployment `dc846603`.

Critical: 1 · High: 1
```

Critical security-boundary or full-outage signatures notify immediately. Other changes are batched into at most one notification per day. Repetition without new evidence sends nothing.

## AI investigation and repair contract

Codex Desktop or Codex Cloud is instructed to:

1. Read `ops/incidents/OPEN.md` and the referenced evidence.
2. Group only incidents supported by shared evidence; temporal coincidence alone is insufficient.
3. Reproduce or verify the failure where safely possible.
4. Trace the root cause through client, proxy, Worker, database, and deployment boundaries.
5. Implement the smallest permanent repair.
6. Add a regression test or deployment invariant for the failure class.
7. Run focused verification and the relevant full verification suite.
8. Mark an incident `observing`; do not resolve it merely because code was changed.
9. Resolve only after production or equivalent end-to-end verification succeeds.

AI analysis is created on demand. Runtime incident capture itself makes no model call.

## Lifecycle

```text
observed -> open -> acknowledged -> repairing -> observing -> resolved
                                                        -> open (recurrence)
```

Temporary retries may restore the current flow at any stage. They do not alter incident status. A resolved signature that reappears is automatically reopened with its prior resolution reference preserved.

Resolved queue entries move out of `OPEN.md` into a compact monthly archive containing the signature, cause, repair reference, verification, and recurrence count. Detailed runtime history remains subject to the retention policy below.

## Cost and retention controls

- No model call during capture, deduplication, synchronization, or notification.
- One ledger row and one representative sample per signature.
- Evidence JSON target: under 2 KB; hard limit: 8 KB.
- i64 OS notification target: under 100 tokens.
- Open queue target: one short paragraph per signature.
- Raw occurrence metadata retained for no more than 30 days if a later implementation adds a separate occurrence table.
- Resolved incident summaries retained; redundant occurrence details expire.
- Rate limits protect public incident intake from abuse.

## Platform Owner experience

The Platform Owner receives a compact System Health view backed by the same ledger. It lists open incidents by severity and recurrence, opens the sanitized evidence, links to the repository repair reference, and supports acknowledge and verified-resolution transitions.

This is an operational view, not a live stream. It must remain usable during partial API failure by showing the last successfully cached incident index and clearly labeling its freshness.

## Initial incidents and acceptance tests

The initial implementation must capture and permanently repair these known signatures:

1. `auth:platform_owner_membership_gate`
   - A platform owner with zero literal memberships must not see the invitation gate.
   - Login must establish or request a valid account context.
   - Email/password and Google login for the same internal user must yield the same platform role and permissions.

2. `api:503:upstream_not_configured`
   - A missing `WORKER_ORIGIN` must fail deployment preflight rather than reach production.
   - If encountered at runtime, it is classified as configuration failure, not connectivity failure.
   - The incident contains the deployment and failing proxy boundary.

System acceptance requires:

- twenty identical occurrences produce one incident with count twenty;
- a materially different status or normalized code creates a different signature;
- no stored or exported evidence contains credentials or secret values;
- repository output is deterministic and size-bounded;
- counter-only repetition creates no repository or i64 OS update;
- an agent can diagnose the two initial incidents using only the queue, evidence file, repository, and authorized production checks;
- resolved incidents reopen automatically when their signature recurs.

## Delivery boundary

This design authorizes an implementation plan, not production mutation. Deployment configuration, database migrations, code changes, and i64 OS integration require the subsequent implementation plan and normal verification before release.
