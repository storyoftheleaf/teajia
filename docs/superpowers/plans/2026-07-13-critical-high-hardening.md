# Critical and High Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every Critical and High finding accepted in the 2026-07-13 whole-system security design, remove all Critical/High dependency advisories, and preserve verified Teajia workflows.

**Architecture:** One Worker integration stream owns all shared `worker/src/index.ts` changes so authorization fixes cannot conflict. MCP live authorization is isolated in `worker/src/mcp.ts`. Frontend parsing, dependencies, and workflows are isolated from both Worker streams. Additive D1 migrations extend the existing ledger and every behavior is introduced through a failing regression test.

**Tech Stack:** Cloudflare Workers, D1, R2, TypeScript, React 19, Vite, Vitest, Playwright, ExcelJS, GitHub Actions.

---

### Task 1: Identity, ownership, tenancy, capability, provider, and retention boundaries

**Files:**
- Modify: `worker/src/index.ts`
- Modify: `worker/schema.sql`
- Modify: `worker/wrangler.toml`
- Create: `worker/migrations/118_email_verification_and_provider_jobs.sql`
- Modify/Create tests under: `worker/tests/`
- Modify: `worker/tests/fixtures/schema-through-098.sql` only if the rehearsal fixture requires an explicit compatibility column

- [ ] **Step 1: Write failing platform-owner recovery tests**

Add route tests proving a `platform_admin` receives `403` with `code: 'target_tier_denied'` when requesting a reset token or resend invite for a `platform_owner`, while a platform owner can target an ordinary user.

- [ ] **Step 2: Run the focused test and verify RED**

Run `npx vitest run worker/tests/auth-boundaries.test.ts`. Expected: owner-target reset/invite requests currently succeed.

- [ ] **Step 3: Implement target-tier comparison**

Load the caller's fresh platform role and target platform role. Reject equal-or-higher protected targets unless the caller is the platform owner. Return the canonical REST error envelope.

- [ ] **Step 4: Write failing email-verification/invitation tests**

Cover: signup creates an unverified identity without a general JWT; verification issues the usable JWT; Google requires a verified-email claim; an existing unverified email cannot receive an active owner membership; a verified user still can.

- [ ] **Step 5: Run the focused tests and verify RED**

Run the new identity test file. Expected: signup currently returns a JWT and provisioning activates email-matched users.

- [ ] **Step 6: Add migration 118 and implement verified identity state**

Add `users.email_verified_at`, purpose-bound verification state, and a durable provider-job table. Reuse the established verification delivery primitive, bind codes to the signup-email purpose, and issue the normal session only after verification. Mark Google users verified only from Google's verified claim. Keep invitation membership pending until verified acceptance.

- [ ] **Step 7: Write failing account-owner invariant tests**

Cover Members-bundle attempts to assign `owner`, replace an existing membership via invitation, delete an owner, and delete the last owner. Cover the valid owner-tier counterparts.

- [ ] **Step 8: Run owner tests and verify RED**

Expected: delegated Members callers currently promote or remove owners.

- [ ] **Step 9: Enforce owner-tier and owner-floor rules**

Reject owner assignment/removal without owner-tier authorization; reject invitation replacement; count active owners before removal and preserve at least one. Add MCP-token revocation statements to the same D1 batches for user deletion, membership removal, account suspension, and role/tier reduction; Task 2 supplies live request-time defense in depth.

- [ ] **Step 10: Write failing cross-tenant synchronization tests**

Use colliding client IDs for `/api/notes/sync` and `/api/note-sessions/sync`. Assert another account/author remains unchanged and the response reports the collision; assert same-owner replay remains idempotent.

- [ ] **Step 11: Run synchronization tests and verify RED**

Expected: current `ON CONFLICT(id) DO UPDATE` overwrites the foreign row.

- [ ] **Step 12: Scope conflict updates**

Use account/author predicates or preflight ownership checks before upsert. Return stable `tenant_collision` details without exposing foreign content.

- [ ] **Step 13: Write failing product capability tests**

For single and bulk create, prove Catalog-only can create descriptive drafts but cannot set stock/opening ledger values, commercial fields, publication flags, `shown_in_shop`, or `owner_user_id`. Prove callers with the corresponding bundles can set their permitted domains and bulk `batch_id` must belong to the active account.

- [ ] **Step 14: Run product tests and verify RED**

Expected: Catalog currently admits fields from every domain.

- [ ] **Step 15: Partition creation fields by capability**

Validate each supplied field against the existing domain sets. Require Stock, Sell, Publish, or owner tier as implicated; force secure draft defaults otherwise. Validate bulk batch ownership and route opening balances through the stock authorization boundary.

- [ ] **Step 16: Write failing provider spend and job-lock tests**

Assert image enhancement uses `PROVIDER_LIMITER` with an account/user/operation key. Assert whole-catalog AI migration requires owner/platform tier, consumes its own durable key, and a concurrent job receives `409 provider_job_in_progress` before provider calls.

- [ ] **Step 17: Run provider tests and verify RED**

Expected: both provider paths currently bypass the durable limiter and job lock.

- [ ] **Step 18: Add provider limiting and durable job locking**

Acquire the D1 job row atomically with an expiry/owner; release or complete it in a `finally` path; never log provider bodies or credentials.

- [ ] **Step 19: Write failing retention backlog tests**

Create 250 expired recording rows and assert one scheduled execution deletes all objects/rows in three pages. Inject one R2 deletion failure and assert only that ledger row remains. Assert no raw keys or provider content enter logs.

- [ ] **Step 20: Run retention tests and verify RED**

Expected: only the first 100 rows are removed.

- [ ] **Step 21: Implement hourly paged cleanup**

Change the cron to hourly. Drain ten pages of 100 oldest expired rows, deleting R2 before D1, and emit aggregate counts only.

- [ ] **Step 22: Run focused Worker tests and commit**

Run all touched Worker test files, `npm run lint`, `npm run lint:colors`, and `git diff --check`. Commit the bounded Worker integration change.

### Task 2: Live MCP authorization and transactional revocation

**Files:**
- Modify: `worker/src/mcp.ts`
- Modify/Create: `worker/tests/mcp-*.test.ts`

- [ ] **Step 1: Write failing MCP stale-authorization tests**

Mint a valid MCP token, then simulate deleted user, suspended account, removed/inactive membership, demotion, and scope no longer allowed. Each request must fail closed before tool execution.

- [ ] **Step 2: Run tests and verify RED**

Expected: `authenticateMcp` currently trusts only the token row.

- [ ] **Step 3: Revalidate current authorization**

Join token, user, account, and active membership state on every MCP request. Recompute the effective tier/scopes and reject stale authority with a stable unauthorized response.

- [ ] **Step 4: Add revocation defense-in-depth coverage**

Add tests asserting that already-revoked token rows fail immediately while deleted, removed, suspended, or demoted principals also fail through live revalidation. Transactional mutation-route revocation is owned exclusively by Task 1.

- [ ] **Step 5: Run MCP and auth tests and commit**

Run focused MCP tests plus `worker/tests/auth-boundaries.test.ts`, TypeScript, color lint, and diff check. Commit the bounded MCP change.

### Task 3: Secure workbook parser and dependency/workflow supply chain

**Files:**
- Modify: `src/admin/views/IntakeWorkspace.tsx`
- Create: `src/admin/lib/xlsxIntake.ts`
- Create: `src/admin/lib/xlsxIntake.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/*.yml`
- Modify: `.env.example` and `src/vite-env.d.ts` to remove obsolete browser Gemini declarations
- Modify: `scripts/platform-hardening.test.mjs`

- [ ] **Step 1: Write failing parser contract tests**

Test a valid `.xlsx`, worksheet/row/column/file ceilings, empty workbook handling, and explicit `.xls` rejection. The parser returns normalized row records without formulas or executable content.

- [ ] **Step 2: Run parser tests and verify RED**

Expected: no ExcelJS parser exists and Intake still accepts `.xls` through SheetJS.

- [ ] **Step 3: Replace SheetJS with ExcelJS**

Create a focused parser module, preserve `.xlsx`/CSV intake, remove `.xls` from detection and input accept strings, and show a supported-format error for legacy files.

- [ ] **Step 4: Write failing supply-chain guards**

Extend the hardening guard to assert `xlsx` is absent, `exceljs` is present, Vite is above the vulnerable range, and every external GitHub Action `uses:` value contains a full 40-character SHA plus a version comment.

- [ ] **Step 5: Run guards and verify RED**

Expected: SheetJS exists, Vite is vulnerable, and workflows use mutable tags.

- [ ] **Step 6: Upgrade dependencies and pin Actions**

Install ExcelJS, remove SheetJS, upgrade direct dependencies and lockfile transitives until `npm audit` reports zero Critical/High vulnerabilities. Resolve each workflow action tag to its publisher's current immutable commit SHA and retain comments such as `# v4`/`# v3`.

- [ ] **Step 7: Run frontend/supply-chain verification and commit**

Run parser tests, hardening guards, `npm audit --audit-level=high`, TypeScript, color lint, build, and diff check. Commit the bounded parser/supply-chain change.

### Task 4: Migration, documentation, integration review, and shipping

**Files:**
- Modify: `worker/tests/migration-017-rehearsal.test.ts`
- Modify: `worker/tests/fixtures/pre-017-production.sql` when necessary
- Modify: `worker/MIGRATIONS.md`
- Modify: `docs/CHANGELOG.md`
- Modify: `docs/tracks/08-platform-hardening.md`
- Modify: `docs/STATE_OF_THE_SITE.md`

- [ ] **Step 1: Extend migration rehearsals through the new latest migration**

Run clean canonical, pre-017 legacy, and real ledger repeat paths through migration 118 or the final migration number. Assert verification and provider-job schema exists and the second pass applies no migrations.

- [ ] **Step 2: Reconcile documentation**

Record only proven behavior, exact residual Medium findings, `.xls` removal, and fresh verification counts. Do not mark the approval-gated navigation item complete.

- [ ] **Step 3: Run full verification**

Run `npm run lint`, `npm run lint:colors`, `npm run build`, `npm run test:worker`, `npm run test:china-scan`, `npm run audit:china`, all new focused tests, relevant desktop/mobile Playwright, `npm run test:mobile` from a clean dependency checkout, migration rehearsals, `npm audit --audit-level=high`, static security searches, and `git diff --check`.

- [ ] **Step 4: Independent integrated security review**

Review every accepted Critical/High finding against the final diff. Fix all substantive findings and rerun affected and full verification.

- [ ] **Step 5: Push the branch**

Confirm the pre-existing `launch-to-real-use` worktree remains untouched, push `codex/platform-hardening`, verify local/remote HEAD equality, and report exact commits, counts, migration evidence, and any Medium-only residual risks.
