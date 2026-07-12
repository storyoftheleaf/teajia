# Operational Notes & Tradeoffs

> Watch-list of intentional tradeoffs, residual risks, and items worth
> revisiting under specific future conditions. **Not** bugs (those go in
> `_audit/FINDINGS.md`) and **not** roadmap items (those go in the relevant file under `tracks/`).
>
> Each note has a **Revisit if** trigger. When that trigger fires, return here
> first. When a note is no longer relevant, move it to "Resolved" with a
> one-line stamp explaining why.

**Last updated:** 2026-04-27

---

## Active

### Auth re-verifies platform_role and membership from D1 on every request

**Recorded:** 2026-04-27 (commit `3d6507c`)
**Context:** `getActiveAccount`, `requirePlatformOwner`, and `requirePlatformAdmin` no longer trust the JWT's embedded `platform_role` / `memberships` claims. Each authenticated request now reads `users.platform_role` and `account_members` from D1. This was the right tradeoff for security — demoted users lose powers immediately rather than at token expiry — but it adds 1–2 D1 queries per authenticated request.
**Revisit if:** worker request latency degrades, D1 row-read spend climbs unexpectedly, or you onboard partners with high request volume. Mitigation if needed: cache the platform_role lookup per-request via a Worker-scoped Map keyed on `claims.sub`, or move it into a session table refreshed on a 60-second TTL.

### JWT_SECRET rotation invalidates all live sessions

**Recorded:** 2026-04-27
**Context:** Tokens have no `kid` (key id) field. Rotating `JWT_SECRET` immediately invalidates every signed token — every signed-in user gets logged out. For a small operator base this is acceptable; for many concurrent users it would be disruptive.
**Revisit if:** you need to rotate the secret without a session flush, or you onboard partners whose staff cannot tolerate forced logout. Fix path: add a `kid` field to the JWT header; maintain `JWT_SECRETS` as `{ kid: secret }`; verify against the matching kid; rotate by adding a new entry, signing with it for new tokens, and removing the old entry only after the longest TTL has elapsed.

### DB read failures during auth fail closed (503) instead of permitting through

**Recorded:** 2026-04-27 (commit `3d6507c`)
**Context:** Previously, if the D1 query for membership or account suspension failed, the code silently fell through (membership defaulted to embedded token claims; suspension check was skipped). Now any D1 outage during auth returns `503 Auth check failed`. This is the right security posture but means a transient D1 hiccup takes down auth instead of being permissive.
**Revisit if:** you see spurious 503s from auth in production logs and the underlying D1 errors are transient/retriable. Mitigation: add a one-shot retry inside the helper, or wrap in a circuit breaker that briefly tolerates failures with explicit logging.

### Compass entries intentionally NOT gated by the catalog bundle

**Recorded:** 2026-04-27 (commit `da98cd6`)
**Context:** During wave-2A auth consolidation, all `/api/compass/*` CRUD endpoints stayed on `requireAccount` rather than `requireBundle('catalog')`. Compass entries are user-scoped within an account (per `useCompassSync` comment); gating them behind catalog would lock staff/viewers out of their own private sourcing notes. This is correct but it means a member with no bundles still gets full read/write on their own compass data.
**Revisit if:** the compass model changes to be account-scoped or shared, or staff need to view each other's compass entries through admin tooling.

### Audit findings #11, #16, and #23 were rewritten during execution

**Recorded:** 2026-04-27
**Context:** Three findings from the original April 2026 audit had stale or wrong premises:
- **#11** ("Personal Collection & Compass sync incomplete") — the sync hooks were already wired in `App.tsx:160-164` before the audit ran. Marked verified shipped.
- **#16** ("Tasting journal sync only on auth ready") — same story; `useTastingJournalSync` already mirrored `useFavoritesSync`. Marked verified shipped.
- **#23** ("If JWT forged or token payload tampered, bundle checks fail silently") — original premise was wrong (HMAC signature is verified on every request). Rewrote to capture the real residual risks (B/C/D) and shipped the fixes.
**Revisit if:** you commission another audit. Brief the auditor that this codebase moves fast and findings should be re-verified against current code before write-up, not relied on as a static snapshot.

### Frontend localStorage stories are searchable but device-only

**Recorded:** 2026-04-27 (commit `da98cd6`)
**Context:** `GlobalSearch` indexes products + DB articles + public events from React Query, but legacy "Stories" still live in localStorage. They appear under a "Journal (saved on this device)" group heading so users understand they don't sync across devices.
**Revisit if:** the magazine/journal model migrates fully to D1 (per `ARTICLE_UNIFICATION_PLAN.md`). Then this group can be removed and stories can join the main Articles result group.

---

## Resolved

*(none yet — entries move here with a one-line stamp when the trigger no longer applies)*
