# Track 2: The First Operator & Trusted Users

> The network is built (multi-store, stock spine, Launch Center, wholesale engine); nobody but Adrian has ever lived in it. This track closes the gap between "code that works" and "a second human using it."

Status: technical operator infrastructure is built; first real-operator use and production-state decisions remain. Human/environment evidence is tracked in [Launch Validation](../LAUNCH_VALIDATION.md).

Part of [Consolidated Direction](../CONSOLIDATED_DIRECTION.md).

## Build queue

### Core build

- [ ] **Re-verify and resolve Teajia Australia's public storefront state.** The 2026-07-11 production snapshot found `acc_teajia_australia` publicly enabled and active but with no products, members, contact channel, logo, or description. Because production state is time-sensitive, query it again before acting. If it is still empty and public, either disable `public_enabled` until Launch Center completes or deliberately accept the exposure and finish the checklist immediately. (mins)
- [ ] **Verify the wholesale loop end to end with a self-test order.** The full state machine is already built: `handleTransitionWholesaleOrder` (`worker/src/index.ts:17587`) implements `draft → submitted → replied/confirmed → shipped → received → cancelled` with party checks at each step, and `processReceiveSideEffects` (`worker/src/index.ts:17723`) decrements the supplier's listing stock, creates or increments the buyer's listing, and generates bilateral invoices on receive; `wholesale_margin_defaults` is seeded for all four trust tiers (basic 50%, verified 45%, partner 40%, tea_master 48%, migration `048_tea_profiles.sql`), and 68 network-visible published tea profiles exist to order against. The UI (`src/admin/views/WholesaleOrderDraft.tsx`, `WholesaleOrderTimeline.tsx`, `WholesaleOrdersList.tsx`) is routed (`src/admin/AdminApp.tsx:763-769`) and reachable from the Wholesale tab in `src/admin/views/NetworkLanding.tsx:44,130`. But `SELECT COUNT(*) FROM wholesale_orders` returns 0 in prod (verified 2026-07-11), so this code path has never once been exercised. No second human is required to test it: Adrian is `platform_owner` and can switch into any two of his own accounts and place a real order between them. (hours)
  - This replaces the Consolidated Direction's framing of this item as "finish or fold": the build is done, what's missing is proof it actually works. Run one order through the whole lifecycle, fix whatever breaks, then this item closes without a bigger decision needed.
- [ ] **Render the readiness-based first door.** `buildFirstDoorReadiness` (`src/components/AccountPanel/workflows.ts:157-176`) and the six-step `FIRST_DOOR_WORKFLOW` it walks (`workflows.ts:58-112`: table settings, carry from network, prepare inventory, first wholesale order, first session, invite the team) are fully implemented and computed in `AccountPanel/index.tsx:715-748`, alongside `isFirstDoorCandidate` (`index.tsx:697-711`) which detects a fresh Australia-shaped account. Neither value is referenced anywhere else in the file; both are dead computations, never rendered. `OPERATOR_SUPPORT_LINKS` (`workflows.ts:114-136`: launch playbook, members & access, storefront preview) is equally unused. (hours)
  - Add a first-door readiness card to the Owner/Tea Master section of Your Table (`LaunchpadView.tsx`) gated on `isFirstDoorCandidate`, showing `completeCount`/`totalCount`, the next incomplete step with its description, and the support links. This is the concrete deliverable behind "new operators get no guided first step."
- [ ] **Make the browser-test runner reproducible, then rerun stock/network mobile coverage.** Release checkpoints record successful Playwright runs, but `@playwright/test` is absent from `package.json` and the top-level installed dependency tree in this worktree. Commit the intended test dependency or document the supported runner, then run `npm run test:mobile`. (hours)
  - Migrations 092-094 were confirmed applied to production on 2026-07-11. Recheck only if production migration state is material to the operator run.

## Real-use gate and later expansion

The authoritative checklist for the Australia operator run, trusted-user feedback, real inquiry/fulfillment evidence, and other human-only launch work is [Launch Validation](../LAUNCH_VALIDATION.md). The in-app Launch Center at `/admin/account-settings` remains the operational source of truth while running it.

**When (not before) a second operator exists**, four unbuilt NETWORK_UI_BRIEF surfaces plus supporting infra:
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

- Verification-code delivery and cross-account denial coverage are implemented and locally verified; deployed receipt and real-operator evidence live in [Launch Validation](../LAUNCH_VALIDATION.md).
- Track 8's tenancy-isolation prerequisite is complete, so it no longer blocks beginning the operator run.
- Shares its "second operator exists" trigger with Track 9 item 6 (admin nav regrouped by product jobs); keep both lists in sync if the trigger condition changes.
