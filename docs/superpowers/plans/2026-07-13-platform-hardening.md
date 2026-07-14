# Teajia Platform Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Every behavioral change follows red-green-refactor and every failure follows systematic debugging.

**Goal:** Close Track 8 and the confirmed adjacent P0/P1 security gaps without changing unrelated product behavior or the existing Inventory height contract.

**Architecture:** One Worker integration owner controls `worker/src/index.ts`, `worker/src/mcp.ts`, `src/lib/api.ts`, Wrangler bindings, migrations, and their contract tests. Independent frontend/tooling work avoids those files. Durable transcription stores private, account-scoped recording objects before provider calls and exposes retry/discard through a shared client controller. REST errors use a single canonical envelope while OAuth and JSON-RPC retain their protocol envelopes.

**Tech Stack:** React 19, TypeScript 5.8, Vitest, Playwright, Cloudflare Workers rate-limit bindings, D1, private R2 objects, Vite.

---

### Task 1: Reproducible test tooling and action-button lint gate

**Files:** `package.json`, `package-lock.json`, `playwright.config.ts`, `.github/workflows/`, `docs/`, `src/admin/views/PlatformAdminView.tsx`, `src/components/shared/Button.tsx`, `scripts/lint-colors.sh`, focused tests.

- [ ] Add a failing dependency/config guard proving Playwright is declared, scripts do not rely on an unpinned `npx` download, and test startup does not require Infisical.
- [ ] Pin `@playwright/test`, add a CI-safe Vite test server command, document `npx playwright install chromium`, and add clean-install browser verification.
- [ ] Add failing Platform Admin interaction/lint checks, migrate Save/Suspend/Reactivate to shared `Button` primary/danger variants, and make Rule 9 blocking.
- [ ] Run focused tests plus `npm run lint:colors`; commit only after the blocking scan reports no action-pill matches.

### Task 2: Delete confirmed dead reference code

**Files:** delete `src/components/advise/ServiceContent.tsx` and `src/data/tea-database/**`; update only direct documentation references proven stale.

- [ ] Record a zero-consumer `rg` guard before deletion.
- [ ] Delete the orphaned files with `apply_patch` and prove `npm run lint` and `npm run build` still succeed.

### Task 3: Close dynamic-SQL identifier injection

**Files:** `worker/src/index.ts`, `worker/tests/` security/route tests.

- [ ] Write adversarial tests for account, venue-space, teaware item/photo, sample, and sample-set updates using property names containing SQL punctuation and tenant-predicate replacement text; verify they fail against current behavior.
- [ ] Replace every request-derived SQL identifier list with immutable per-handler allowlists; reject unknown keys with `400` and `code: "validation_failed"` before preparing SQL.
- [ ] Prove valid updates remain scoped and malicious keys cannot modify either the same account broadly or another account.

### Task 4: Customer capability policy and generic product-route removal

**Files:** `worker/src/index.ts`, `src/lib/api.ts`, `worker/tests/auth-boundaries.test.ts`, `worker/tests/stock-movements.test.ts`, frontend API tests/guards.

- [ ] Add failing customer tests for no-bundle denial, taxonomy-based read/write access, mixed relationships, owner/platform exceptions, order privacy, missing records, and cross-account non-disclosure.
- [ ] Enforce relationship-aware read/write capabilities (`buyer→sell`, `vendor→catalog`, `event_guest→gather`, `collection_recipient/contributor→publish`, `personal_connection→owner`) and owner/platform-only destructive deletion; never embed invoices for callers lacking `sell`.
- [ ] Add failing tests for the generic product route and unknown domain fields; align stock-domain fields, remove the legacy bucket, `api.products.update`, `handleUpdateProduct`, and `PUT /api/products/:id`.

### Task 5: Canonical REST error contracts

**Files:** `worker/src/index.ts`, REST helpers if extracted, `src/lib/api.ts`, `src/lib/incidents.test.ts`, Worker contract tests, static guard script/test.

- [ ] Add contract tests covering authentication, account mismatch, capability denial, validation, not-found, conflict, dependency/provider failure, and malformed upstream responses.
- [ ] Introduce the canonical `{ error: string, code?: string, details?: object }` helper and migrate the affected REST domains completely while preserving statuses and fail-closed behavior.
- [ ] Dispatch account mismatch by stable `code`, not prose; add a guard rejecting new frontend equality checks against API error messages.
- [ ] Keep OAuth and JSON-RPC responses protocol-compliant and document that exception.

### Task 6: Dedicated durable abuse limits and bounded provider uploads

**Files:** `worker/wrangler.toml`, Worker `Env`, `worker/src/index.ts`, limiter/upload tests.

- [ ] Add fake-binding tests for allowed requests, exhaustion, recovery, user/operation isolation, binding exceptions, and missing local bindings.
- [ ] Add distinct `VERIFY_LIMITER` and `JOIN_CODE_LIMITER` namespaces, remove production dependence on per-isolate maps for those routes, and preserve the verification D1 cooldown.
- [ ] Add dedicated durable limits plus capability/account gates to transcription, image extraction/upload, flyer upload, and Chinese-name generation.
- [ ] Enforce pre-read and post-read byte limits, explicit MIME/signature allowlists, fixed safe extensions, and stable provider/validation error codes; never log payload contents or provider secrets.

### Task 7: Public RSVP token and session lifecycle hardening

**Files:** `worker/src/index.ts`, one forward D1 migration and `worker/schema.sql`, auth/RSVP tests.

- [ ] Add a failing duplicate-RSVP test proving an unauthenticated matching phone/email can currently receive a bearer token; change duplicate responses to generic success and require out-of-band recovery, with a durable public rate limit.
- [ ] Add failing refresh tests for deleted users, DB failure, stale platform claims, and password-reset/change token reuse.
- [ ] Add a DB-backed token-validity/session version folded into canonical schema; rotate it on password change/reset and reject stale JWTs in every auth helper. Missing users return `401`; auth-dependency failures return fail-closed `503`.

### Task 8: Resolve duplicate migration 017 from evidence

**Files:** `worker/migrations/017_*`, migration rehearsal tests/scripts, `worker/MIGRATIONS.md`, schema/reference documentation.

- [ ] Preserve the production evidence: both 017 names are ledger rows 18/19 with the same timestamp and the read-only query wrote zero rows.
- [ ] Add executable clean-schema, pre-017 legacy, production-like double-ledger, and repeated-apply rehearsals.
- [ ] Use repository history plus the shipped `018_missing_tables.sql` convergence to retain one canonical 017 artifact without changing production data; update stale runner documentation and references.

### Task 9: Lossless private transcription

**Files:** `worker/src/index.ts`, private-R2 helpers/routes, `src/lib/api.ts`, shared recording controller/storage, Compass/product/note recorder consumers, focused Worker/client/Playwright tests.

- [ ] Write failing tests for provider failure persistence, retry success, cross-account denial, discard/expiry, overlapping requests, navigation/unmount, and reload.
- [ ] Persist recordings under private account/user-scoped R2 keys before Groq, return a stable recording reference, and add retry/discard routes that can never be served by the public media route.
- [ ] Consolidate recorder state around durable pending recordings; show “saved, transcription pending” with Retry and Discard, reuse the same recording on retry, and prevent late responses from overwriting a newer request/event.

### Task 10: Enable frontend strict null checking

**Files:** `tsconfig.json` and the 17 currently failing frontend files; do not change `worker/tsconfig.json`.

- [ ] Turn on only `strictNullChecks`, run `tsc` to preserve the 47-error red baseline, then fix in bounded batches: inferred arrays/refs, customer/order optionals, event/tasting data, storefront/Compass leftovers.
- [ ] Use defaults, guards, and accurate nullable types rather than broad `any`, blanket assertions, `@ts-ignore`, or unrelated strict flags.
- [ ] Run focused tests per batch, then `npm run lint` and `npm run build` with zero TypeScript errors.

### Task 11: Navigation, documentation, and deferred findings

**Files:** navigation only after explicit approval; `docs/CHANGELOG.md`, Track 8 and documentation indexes/state/direction.

- [ ] If approved, route `/admin/sources` to `PeopleView`’s Sources tab with its capability access and remove the redundant `/admin/personal` nav child; otherwise leave exactly this blocker open.
- [ ] Record lower-priority findings (MCP OAuth write-volume abuse, maintained workbook parser replacement, exact CORS preview pinning) without claiming they shipped; include only small independently verified fixes in this branch.
- [ ] Move completed history to the changelog and remove/reduce Track 8 according to the exact remaining blockers.

### Task 12: Full verification, review, and shipping

- [ ] Run all required lint, build, Worker, China, focused unit/integration, Playwright mobile/desktop, Inventory scroll, clean-install, and migration rehearsal commands; record exact counts and `git diff --check`.
- [ ] Run the required repository searches for pills, undeclared Playwright, generic product PUT, exact error prose matching, duplicate 017, broad TS suppressions, and stale docs.
- [ ] Dispatch one independent whole-branch code/security review; fix every substantive finding and re-run affected verification.
- [ ] Commit bounded changes after `npm run lint:colors`, push `codex/platform-hardening`, and verify the original `launch-to-real-use` worktree status was not touched.
