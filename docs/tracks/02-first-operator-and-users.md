# Track 2: The First Operator & Trusted Users

> The network is built (multi-store, stock spine, Launch Center, wholesale engine); nobody but Adrian has ever lived in it. This track closes the gap between "code that works" and "a second human using it."

Status: pre-launch, in development.

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [ ] **Teajia Australia's storefront is already publicly live and empty.** Verified against prod D1 today (2026-07-11): `acc_teajia_australia` has `public_enabled=1`, `status='active'`, but 0 rows in `products`, 0 rows in `account_members`, and no `whatsapp_number`/`contact_email`. It has a tagline ("Lineage tea in Australia.") but no description or logo. This account already satisfies `GET /api/network/stores` (`worker/src/index.ts:12737-12744`, filters only on `public_enabled=1 AND status='active'`) and resolves at `GET /api/s/teajia-australia` (`worker/src/index.ts:12748-12756`) and `/store/teajia-australia`, so it is discoverable right now with nothing to sell and no way to contact anyone. (mins)
  - Decide: flip `public_enabled` back to 0 on this account until the Launch Center checklist actually completes, or accept the exposure and prioritize finishing the checklist. Either way this corrects the Australia-checklist's "flip public_enabled" step, which the source docs describe as the last step but is in fact already done, prematurely, with no other step behind it.
- [ ] **Verify the wholesale loop end to end with a self-test order.** The full state machine is already built: `handleTransitionWholesaleOrder` (`worker/src/index.ts:17587`) implements `draft → submitted → replied/confirmed → shipped → received → cancelled` with party checks at each step, and `processReceiveSideEffects` (`worker/src/index.ts:17723`) decrements the supplier's listing stock, creates or increments the buyer's listing, and generates bilateral invoices on receive; `wholesale_margin_defaults` is seeded for all four trust tiers (basic 50%, verified 45%, partner 40%, tea_master 48%, migration `048_tea_profiles.sql`), and 68 network-visible published tea profiles exist to order against. The UI (`src/admin/views/WholesaleOrderDraft.tsx`, `WholesaleOrderTimeline.tsx`, `WholesaleOrdersList.tsx`) is routed (`src/admin/AdminApp.tsx:763-769`) and reachable from the Wholesale tab in `src/admin/views/NetworkLanding.tsx:44,130`. But `SELECT COUNT(*) FROM wholesale_orders` returns 0 in prod (verified 2026-07-11), so this code path has never once been exercised. No second human is required to test it: Adrian is `platform_owner` and can switch into any two of his own accounts and place a real order between them. (hours)
  - This replaces the Consolidated Direction's framing of this item as "finish or fold": the build is done, what's missing is proof it actually works. Run one order through the whole lifecycle, fix whatever breaks, then this item closes without a bigger decision needed.
- [ ] **Render the readiness-based first door.** `buildFirstDoorReadiness` (`src/components/AccountPanel/workflows.ts:157-176`) and the six-step `FIRST_DOOR_WORKFLOW` it walks (`workflows.ts:58-112`: table settings, carry from network, prepare inventory, first wholesale order, first session, invite the team) are fully implemented and computed in `AccountPanel/index.tsx:715-748`, alongside `isFirstDoorCandidate` (`index.tsx:697-711`) which detects a fresh Australia-shaped account. Neither value is referenced anywhere else in the file; both are dead computations, never rendered. `OPERATOR_SUPPORT_LINKS` (`workflows.ts:114-136`: launch playbook, members & access, storefront preview) is equally unused. (hours)
  - Add a first-door readiness card to the Owner/Tea Master section of Your Table (`LaunchpadView.tsx`) gated on `isFirstDoorCandidate`, showing `completeCount`/`totalCount`, the next incomplete step with its description, and the support links. This is the concrete deliverable behind "new operators get no guided first step."
- [ ] **Run `npm run test:mobile` against the stock spine and network surfaces.** Blocked today in this worktree: `npx playwright test` fails with `Cannot find package '@playwright/test'` (playwright is not in `node_modules`, not listed in `package.json` devDependencies, `npx` is not resolving it). Needs a local install fix before this can run at all. (mins to fix install, then mins to run)
  - Migrations 092-094 (`shown_in_shop` curation gate, `personal_cellar_items`, `users.shelf_*` columns) are already confirmed applied to prod D1, verified directly via `wrangler d1 execute` today (2026-07-11), so that half of the original checklist item is closed; only the test run remains open.

## Gated on launch decision

- **Run the Australia launch checklist with a real owner (Jesse), end to end** (`docs/AUSTRALIA_LAUNCH_PLAYBOOK.md`): invite the owner, set profile (logo, WhatsApp, tagline, description), import opening stock CSV, invite staff, create the first event, verify the storefront on desktop and mobile, run the first-sale rehearsal, fulfill a first real WhatsApp order, confirm `public_enabled` end-state. Needs a real second human in the loop; the in-app Launch Center at `/admin/account-settings` is the source of truth while running it.
- **Phase 0.6 (open since April): Curate access for trusted tea friends, events with real guests, collect feedback.** Validates Curate before anything network-shaped matters. Needs real trusted users, not test accounts.
- **When (not before) a second operator exists**, four unbuilt NETWORK_UI_BRIEF surfaces plus supporting infra:
  - Trust-tier display in account settings (NETWORK_UI_BRIEF Surface 3: single line, "Verified · Adrian's wholesale to you defaults to 45% of his retail," placed above Currency/Timezone in `AccountSettingsView.tsx`). No upgrade button, no application form; the tier is given, not earned through the UI.
  - Pricing-discipline warning on the listing edit page (NETWORK_UI_BRIEF Surface 4: soft italic prose when a partner's retail sits >5% below canonical after FX; confirmed unbuilt, no `warnings`/`canonical_retail` handling in `src/admin/views/PartnerListingEdit.tsx`).
  - Tea Master storefront variant (NETWORK_UI_BRIEF Surface 10).
  - Mobile Playwright coverage for `/admin/network/*` (confirmed: no network-related spec exists in `tests/`).
  - A "Network" bench tile in Your Table (confirmed: none of the 12 current tile ids in `src/components/AccountPanel/LaunchpadView.tsx:174-268` reference network/wholesale destinations).

## Already shipped

- Multi-store Phase 1A; all 6 network rollout steps (profiles, listings, catalog browse, suggestions, wholesale schema, adoption queue).
- Launch Center with 6 staged audits at `/admin/account-settings`.
- Australia account seeded (`acc_teajia_australia`, slug `teajia-australia`, currency AUD, verified today) and `/store/:slug` routing.
- Stock spine steps 1-5: owner-per-row (migration `090_stock_owner.sql`), shown-in-shop curation gate (`092_stock_shown.sql`, confirmed applied to prod), master view, personal cellar (`093_personal_cellar.sql`, `personal_cellar_items` table confirmed live), public shelf (`094_personal_shelf.sql`, `users.shelf_*` columns confirmed live).
- Role-adaptive Your Table (Reader/Launchpad/Staff) and `NoMembershipGate`.
- Wholesale order engine, full lifecycle in code: draft, submit, confirm, ship, receive with stock movement on both sides and bilateral invoice generation (`worker/src/index.ts:17351-17820`), tier-seeded margin defaults, UI wired end to end. Never yet run with a real order (see build queue above).

## Not building (killed)

- Discovery fallback empty state (NETWORK_UI_BRIEF Surface 11): premature.
- Network directory / lineage map: premature.
- Guest portability: premature.
- Verification badges: premature.

All four: correct instinct, wrong decade; revisit at 2+ stores with 50+ teas each. Not deleted from the vision, just off the list.

## Sources

- `docs/MULTI_STORE_PLAN.md` (live)
- `docs/NETWORK_UI_BRIEF.md` (live)
- `docs/AUSTRALIA_LAUNCH_PLAYBOOK.md` (live)
- `docs/_archive/consolidated-2026-07/NETWORK_ROLLOUT_PLAN.md` (archived, shipped)
- `docs/_archive/consolidated-2026-07/your-table-completion-plan.md` (archived, merged)
- `docs/_archive/consolidated-2026-07/ROADMAP.md` (archived, Phases 1-5)

## Cross-track dependencies

- Blocked by Track 1 item 4 (verification-code delivery, WhatsApp/email): production sign-in and event verification are off by design until this ships, which blocks safely onboarding real Curate friends and event guests (this track's Phase 0.6 item).
- Blocks Track 8 item 1's stated precondition in reverse: Track 8 calls tenancy-isolation testing "the precondition for Track 2 going public"; that work should land before or alongside the Australia checklist, not after.
- Shares its "second operator exists" trigger with Track 9 item 6 (admin nav regrouped by product jobs); keep both lists in sync if the trigger condition changes.
