# Incident Ledger and AI Repair Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the current platform-owner and API-proxy failures, capture future material failures as deduplicated safe incidents, and export a compact repository queue that Codex Desktop or Cloud can process.

**Architecture:** D1 stores one row per normalized failure signature. The Worker exposes authenticated incident ingestion/list/status routes, while the browser reports only classified, sanitized failures and displays truthful messages with an incident ID. A deterministic Node exporter reads the ledger through an owner-only endpoint and writes `ops/incidents/OPEN.md` plus bounded evidence JSON; a scheduled/manual GitHub workflow commits only material queue changes and optionally notifies i64 OS once.

**Tech Stack:** Cloudflare Workers, D1, React 19, TypeScript, React Query, Node.js, GitHub Actions, Vitest/Node test runner, Playwright.

---

### Task 1: Repair platform-owner login bootstrap

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `src/admin/AdminApp.tsx`
- Test: `worker/tests/auth-boundaries.test.ts`
- Test: `tests/admin-header-switcher.spec.ts`

- [ ] Add a failing Worker test proving Google/password token bootstrap selects the platform account when a database-backed platform owner has no active membership rows.
- [ ] Run `npm --prefix worker test -- auth-boundaries.test.ts` and confirm the new assertion fails with a null active account.
- [ ] Add one `resolveInitialAccountId(env, platformRole, memberships)` helper that returns the first membership, otherwise the active platform account for platform tier, otherwise null; use it in password login, Google callback, refresh, and `/api/accounts/me`.
- [ ] Add a failing browser assertion that a platform owner with `memberships: []` does not render `Waiting for an invite`.
- [ ] Change `needsMembershipGate` to exempt `platform_owner` and `platform_admin` while preserving the gate for ordinary users.
- [ ] Run the two focused test files and confirm they pass.

### Task 2: Make the same-origin API proxy fail deployment preflight

**Files:**
- Create: `scripts/check-required-deployment-config.mjs`
- Create: `scripts/check-required-deployment-config.test.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/deploy.yml` if present, otherwise the active Pages verification workflow

- [ ] Write tests for a pure validator that accepts an HTTPS `WORKER_ORIGIN` and rejects missing, malformed, or HTTP values.
- [ ] Run `node --test scripts/check-required-deployment-config.test.mjs` and confirm failure before implementation.
- [ ] Implement the validator and a CLI that reads only presence/shape, never prints secret values.
- [ ] Add `check:deploy-config` and run it in the production verification path before deployment.
- [ ] Configure `WORKER_ORIGIN=https://teajia-api.lightcodes.workers.dev` on the active `teajiafinal` Pages project and trigger a deployment only after code verification.

### Task 3: Add the minimal D1 incident ledger

**Files:**
- Create: `worker/migrations/115_incident_ledger.sql`
- Modify: `worker/schema.sql`
- Create: `worker/src/incidents.ts`
- Create: `worker/tests/incidents.test.ts`
- Modify: `worker/src/index.ts`

- [ ] Write domain tests for signature normalization, severity/category allowlists, recursive redaction, representative-sample limits, and deduplication updates.
- [ ] Run `npm --prefix worker test -- incidents.test.ts` and confirm the module/test target fails before implementation.
- [ ] Create `incident_ledger` with the spec fields, unique `signature`, timestamps, count, bounded sample JSON, status, and resolution reference.
- [ ] Implement focused helpers in `incidents.ts`: `normalizeIncidentInput`, `sanitizeIncidentSample`, `upsertIncident`, and `incidentToApi`.
- [ ] Add `POST /api/incidents` for authenticated sanitized intake, `GET /api/platform/incidents` for platform tier, and `PATCH /api/platform/incidents/:id` for allowed lifecycle transitions.
- [ ] Rate-limit intake by user/IP with the existing safe limiter pattern; reject payloads over 8 KB.
- [ ] Run the focused domain and route tests.

### Task 4: Classify and report client failures truthfully

**Files:**
- Create: `src/lib/incidents.ts`
- Create: `src/lib/incidents.test.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/App.tsx`
- Modify: `src/index.tsx`

- [ ] Write tests mapping offline/transport, timeout, HTTP 5xx, explicit configuration error, session expiry, authorization contradiction, and unknown client failure into stable signatures and user-safe messages.
- [ ] Run the focused test and confirm failure before implementation.
- [ ] Implement a small client reporter that deduplicates in memory, rate-limits repeat sends, excludes bodies/tokens/headers, and posts only authenticated material failures to `/api/incidents`.
- [ ] Preserve or generate `X-Correlation-ID` in authenticated requests and read an incident/correlation ID returned by the server.
- [ ] Replace the inventory-wide generic toast with classified messaging; HTTP 503 `upstream_not_configured` must say service configuration failure, not connection failure.
- [ ] Add a global query-cache error hook that reports material unhandled query failures without reporting expected validation or permission denials.
- [ ] Run focused unit tests and the existing public/mobile smoke coverage.

### Task 5: Export the compact AI repair queue

**Files:**
- Create: `scripts/export-incident-queue.mjs`
- Create: `scripts/export-incident-queue.test.mjs`
- Create: `ops/incidents/OPEN.md`
- Create: `ops/incidents/evidence/.gitkeep`
- Create: `ops/incidents/resolved/.gitkeep`
- Modify: `package.json`

- [ ] Write fixture-based tests proving deterministic ordering/output, under-8-KB evidence, no counter-only content churn, redaction, and resolved-item removal from `OPEN.md`.
- [ ] Run `node --test scripts/export-incident-queue.test.mjs` and confirm failure before implementation.
- [ ] Implement an exporter that accepts platform incident JSON from stdin or an authorized URL, writes one concise index entry per open signature, and removes stale generated evidence files.
- [ ] Ensure evidence contains no user email, token, authorization header, body, cookie, or stack trace.
- [ ] Add `incidents:export` and verify two identical inputs produce byte-identical output and a clean second git diff.

### Task 6: Automate queue synchronization and minimal i64 OS notification

**Files:**
- Create: `.github/workflows/incident-queue.yml`
- Create: `scripts/notify-i64os-incidents.mjs`
- Create: `scripts/notify-i64os-incidents.test.mjs`

- [ ] Test that notification text contains only changed counts, severity totals, deployment, and the repository path and remains under 100 tokens.
- [ ] Implement a notifier that is a no-op without configured endpoint/token and never logs credential values.
- [ ] Add a workflow with manual dispatch and a conservative daily schedule: fetch owner-authorized incident JSON, export, commit only when files materially change, then send one notification only when a commit was created.
- [ ] Use repository secrets for credentials and least-privilege workflow permissions (`contents: write` only).
- [ ] Run workflow/static tests locally where possible and validate YAML syntax.

### Task 7: Verification, migration, and production release

**Files:**
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/OPERATIONAL_NOTES.md`

- [ ] Run all new focused tests and repair failures.
- [ ] Run `npm run lint:colors`, `npm run lint`, and `npm run build`.
- [ ] Start the port-7777 dev server and run the relevant Playwright tests, including `npm run test:mobile` because admin auth/routing changed.
- [ ] Apply migration 115 to remote D1 after local/fixture tests pass.
- [ ] Configure the active Pages project binding, deploy through the normal `main` push, and verify `https://www.teajia.com/api/products/public` returns 200.
- [ ] Verify Google/password platform-owner bootstrap, incident deduplication, sanitized platform list, deterministic queue export, and recurrence reopening.
- [ ] Record verified behavior and operational commands in the changelog/notes.
- [ ] Commit coherent changes, push `main`, and confirm Cloudflare Pages production deployment succeeds.
