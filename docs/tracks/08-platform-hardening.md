# Track 8: Platform Hardening

> Keep authorization, migrations, test infrastructure, and failure handling dependable enough for a second store and a second developer.

Status: the autonomous hardening queue shipped on `codex/platform-hardening`. One navigation change remains gated by Adrian's explicit approval. Manual environment checks live in [Launch Validation](../LAUNCH_VALIDATION.md).

## Active queue

- [ ] **Apply the approved Sources/Personal navigation cleanup.** Proposed exact change: make `/admin/sources` open `PeopleView` on its real Sources tab with the existing capability access, and remove the redundant `/admin/personal` navigation child because it has no distinct supported route. Do not change either route/navigation item until Adrian explicitly approves.

## Shipped hardening

The changelog and Git retain the implementation evidence. The completed queue includes reproducible Playwright, blocking action-button lint, dead reference deletion, taxonomy-aware customer capabilities, removal of generic product mutation, stable REST error codes, canonical migration `017` rehearsals through `118`, dedicated durable abuse limits, frontend `strictNullChecks`, private lossless transcription with retry/discard and server expiry, dynamic-SQL identifier allowlists for updates and creates, join-code identity proof, browser and live MCP authorization invalidation, verified-email signup and invitation activation, protected owner invariants, tenant-safe note synchronization, capability-partitioned product intake, bounded and locked provider work, paged recording cleanup, bounded `.xlsx` parsing, immutable GitHub Action pins, exact CORS origins, and fixable production dependency upgrades.

Production migration evidence was read-only: `d1_migrations` contained both historical `017` filenames as rows 18 and 19 with the same timestamp; the inspection reported zero writes. Repository history plus the convergent `018` migration establishes `017_multi_account_patched.sql` as the single retained artifact.

## Future only when evidence demands it

Worker modularization, further admin code splitting or idle prefetch, a general IndexedDB mutation queue, and server-side unified search are not active obligations. Open a focused plan only when measured bundle/runtime cost, recurring change risk, offline field use, or search behavior supplies concrete acceptance criteria.

The vulnerable SheetJS dependency is removed. Intake retains CSV and `.xlsx`,
drops legacy `.xls`, and preflights workbook size, structure, worksheet bounds,
entry count, compression ratio, and actual streamed expansion before ExcelJS
parses the same private byte copy.

`npm audit` reports no Critical or High findings. Its two remaining Moderate
entries are one advisory counted against both ExcelJS and its transitive
`uuid@8.3.2`: the affected UUID v3/v5/v6 caller-supplied-buffer path is not the
UUID v4 path ExcelJS uses for conditional-format identifiers.

## Validation

Fresh local clean-install evidence for the Critical/High follow-up: Worker
439/439; focused security/parser/frontend 50/50; platform guards 6/6; China
scanner 11/11 with zero runtime violations; AccountPanel mobile 27/27; and the
Inventory Desktop/Mobile matrix 11 passed with one intentionally desktop-only
case skipped on mobile. TypeScript, color lint, production build, migration
rehearsals, and the zero-Critical/High npm audit gate passed.

Physical-device, mainland-network, deployed-environment, and production checks are tracked in [Launch Validation](../LAUNCH_VALIDATION.md).
