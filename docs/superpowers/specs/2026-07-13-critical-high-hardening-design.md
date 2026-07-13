# Critical and High Security Hardening Design

**Status:** Approved in conversation on 2026-07-13

## Objective

Close every evidence-backed Critical or High finding from the whole-system security audit without implementing the Medium findings or changing public navigation. Preserve Teajia's multi-account, inquiry-led operating model and existing user-facing routes wherever a secure compatibility path exists.

## Scope

This round covers:

1. Platform-owner protection on administrative reset and invitation-token routes.
2. Verified-email ownership before an identity can inherit an invitation or privileged membership.
3. Owner-tier enforcement for account-owner assignment and removal.
4. Tenant- and author-scoped conflict handling for note and note-session synchronization.
5. Live MCP token revalidation after user deletion, membership removal, role changes, or account suspension.
6. Capability-aware product creation and import for Catalog, Stock, Sell, Publish, visibility, and ownership fields.
7. Durable spending limits and concurrency/idempotency protection around expensive AI provider operations.
8. Enforceable private-audio expiry when more than 100 recordings expire between scheduled runs.
9. Replacement of vulnerable SheetJS parsing while retaining CSV and `.xlsx` intake and intentionally removing `.xls` support.
10. Upgrade of every fixable High development dependency and immutable pinning of third-party GitHub Actions.

Medium findings—public/private media namespace separation, general media lifecycle cleanup, invoice foreign-reference validation, email-change reauthentication, join-code administration, raw authentication PII logs, reset-token hashing, CSP/local-storage redesign, and password-policy modernization—remain outside this implementation unless required to make an in-scope High fix correct.

## Security architecture

### Identity and invitation proof

Add an `email_verified_at` field to users and a purpose-bound, expiring email-verification record. Signup may create a pending identity but must not grant a generally usable authenticated session until the email address is verified. Existing Google identities count as verified only when Google's verified-email claim is present. Invitation provisioning may match an existing user by email only when that user's email is verified; otherwise the membership remains pending and requires explicit acceptance after verification.

Platform administrators remain able to help ordinary users, but reset-token and resend-invite routes must compare caller and target platform tiers. Only the platform owner may target a platform owner. The same rule applies to any administrative route returning a bearer recovery link.

### Account ownership controls

The Members capability continues to manage ordinary invitations and memberships. Assigning `owner`, replacing an existing membership through invitation, removing an owner, or leaving an account without an active owner requires owner-tier authorization and explicit validation. Invitations never act as an implicit role-update endpoint.

### Tenant-safe synchronization

Note and note-session synchronization retains client-generated identifiers for offline compatibility. Conflict updates must succeed only when the existing row belongs to the active account and, for personal notes, the authenticated author. A colliding identifier owned by another tenant or author is returned as a conflict rather than updated. Tests must cover same-owner idempotency and hostile cross-account collisions.

### MCP live authorization

MCP token rows remain hashed bearer credentials, but stored scopes are not sufficient authorization by themselves. Every MCP request must fail closed unless the user still exists, the target account is active, the membership is active, and the caller's current role/tier still authorizes the stored scopes. Membership removal, user deletion, account suspension, and tier reduction therefore take effect immediately. Routes that remove a membership, delete a user, suspend an account, or reduce a role/tier must also revoke the affected MCP tokens in the same D1 batch.

### Product creation capabilities

Product creation keeps a single input contract but partitions fields by the existing Catalog, Stock, Sell, Publish, visibility, and ownership capability domains. Catalog-only callers can create descriptive draft records. Any stock opening balance or ledger write requires Stock; commercial values require Sell; public/featured/catalog visibility requires Publish; `shown_in_shop` and ownership assignment retain their owner-tier rules. Bulk intake must validate its batch belongs to the active account and route opening balances through the stock authorization boundary.

### Provider spending and private-audio retention

Image enhancement receives a distinct durable provider-limit namespace keyed by account, user, and operation. Whole-catalog AI migration becomes owner/platform-only, uses a durable limiter, and obtains an idempotent job lock before provider calls so concurrent requests cannot duplicate a migration run.

Private-recording cleanup runs hourly and drains up to ten pages of 100 expired rows per execution, resuming from the oldest expiry on the next tick when a backlog exceeds 1,000. R2 deletion precedes ledger deletion so failures remain retryable. The scheduled handler logs only aggregate backlog/failure counts and tests prove that a 250-row backlog is fully drained in one execution.

## Supply-chain design

Replace the single dynamic SheetJS import in Intake Workspace with `exceljs`. Parse only `.xlsx`; keep the existing CSV path; remove `.xls` from file detection, input acceptance, and copy. Apply explicit workbook size, worksheet, row, and column ceilings before mapping rows.

Upgrade Vite and every other fixable High advisory to patched compatible releases, preferring lockfile-only transitive resolution when safe. `npm audit` must contain no Critical or High finding after SheetJS removal. Pin GitHub-maintained and Cloudflare workflow actions to full immutable commit SHAs, retaining version comments for maintainability.

## Error handling and compatibility

All new API denials use the existing REST envelope `{ error, code, details? }` and preserve fail-closed behavior. New stable codes distinguish unverified email, target-tier denial, tenant collision, owner-floor violation, stale MCP authorization, missing capability, provider rate limiting, and migration-job conflict.

Existing verified users and valid active memberships continue working. Unverified legacy users must verify before privileged invitation acceptance. CSV and `.xlsx` intake remain available; legacy `.xls` is deliberately rejected with clear copy explaining the supported formats.

## Data changes

Use additive D1 migrations after `117` for email verification and any durable provider-job lock required by the implementation. Migrations must be replay-safe through the repository ledger and included in clean, legacy, and repeat rehearsals. No production mutation occurs during development.

## Testing and completion gates

Every behavioral change follows red-green TDD. Required regression coverage includes:

- platform admin denied owner reset/invite; platform owner allowed;
- unverified pre-registration cannot inherit a privileged invitation;
- Members capability cannot assign/remove owner or replace membership;
- note/session ID collision cannot cross account or author boundaries;
- MCP token rejection after each relevant authorization-state change;
- product fields and opening balances require their domain capabilities;
- provider limit exhaustion, operation isolation, and migration-job concurrency;
- scheduled cleanup drains more than 100 expired recordings and retains failed deletions;
- `.xlsx` parsing ceilings and explicit `.xls` rejection;
- dependency audit and immutable workflow-action guards.

Final verification includes TypeScript, color rules, build, full Worker tests, China scanner/audit, focused frontend tests, relevant desktop/mobile Playwright, clean-install mobile audit, full migration rehearsals, dependency audit, static security searches, `git diff --check`, and an independent integrated security review. The branch is pushed only after all substantive review findings are fixed.
