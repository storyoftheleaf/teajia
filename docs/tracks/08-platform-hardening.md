# Track 8: Platform Hardening

> Keep authorization, migrations, test infrastructure, and failure handling dependable enough for a second store and a second developer.

Status: the autonomous hardening queue shipped on `codex/platform-hardening`. One navigation change remains gated by Adrian's explicit approval. Manual environment checks live in [Launch Validation](../LAUNCH_VALIDATION.md).

## Active queue

- [ ] **Apply the approved Sources/Personal navigation cleanup.** Proposed exact change: make `/admin/sources` open `PeopleView` on its real Sources tab with the existing capability access, and remove the redundant `/admin/personal` navigation child because it has no distinct supported route. Do not change either route/navigation item until Adrian explicitly approves.

## Shipped hardening

The changelog and Git retain the implementation evidence. The completed queue includes reproducible Playwright, blocking action-button lint, dead reference deletion, taxonomy-aware customer capabilities, removal of generic product mutation, stable REST error codes, canonical migration `017` rehearsals through `117`, dedicated durable abuse limits, frontend `strictNullChecks`, private lossless transcription with retry/discard and server expiry, dynamic-SQL identifier allowlists for updates and creates, join-code identity proof, browser/MCP session invalidation, generic duplicate-RSVP handling, bounded provider uploads, OAuth write limiting/validation, exact CORS origins, and fixable production dependency upgrades.

Production migration evidence was read-only: `d1_migrations` contained both historical `017` filenames as rows 18 and 19 with the same timestamp; the inspection reported zero writes. Repository history plus the convergent `018` migration establishes `017_multi_account_patched.sql` as the single retained artifact.

## Future only when evidence demands it

Worker modularization, further admin code splitting or idle prefetch, a general IndexedDB mutation queue, and server-side unified search are not active obligations. Open a focused plan only when measured bundle/runtime cost, recurring change risk, offline field use, or search behavior supplies concrete acceptance criteria.

`xlsx@0.18.5` remains an operator-triggered dependency risk: npm reports prototype-pollution and ReDoS advisories with no registry fix. Intake is an authenticated admin workflow, not a remotely parsed server upload, so replacement is a focused parser/product decision rather than a hidden launch claim. Do not broaden workbook intake to untrusted public files before replacing or isolating this parser.

## Validation

Physical-device, mainland-network, deployed-environment, and production checks are tracked in [Launch Validation](../LAUNCH_VALIDATION.md).
