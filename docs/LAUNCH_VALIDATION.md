# Launch Validation

> **This is the only canonical checklist for Adrian/manual work, operator validation, editorial work, deployed-environment checks, and external decisions.** Implementation tracks and reference docs may explain procedures, but they must not maintain duplicate completion status.

**Created:** 2026-07-13  
**Launch status:** Incomplete

## Technical closure precondition

Before the technical program can honestly be called closed, the reading-memory/saved-story system must be **wired into a real durable user flow or removed completely**, with focused route/state coverage. This is implementation work owned by Track 1, not a manual validation checkbox.

## A. Launch-required validation

These checks are required before claiming a real-world launch. Fixtures, local mocks, and code inspection cannot complete them.

- [ ] **Deploy and verify the production boundary.** Publish the implementation branch through the normal `teajiafinal` path. On the deployed site, verify same-origin browser API access, CSP behavior, service-worker registration/update behavior, and absence of retired stock-media or prohibited hardcoded-origin requests.
- [ ] **Receive a real Resend OTP.** Request a sign-in code in the deployed environment, receive it in a real inbox, complete verification, and confirm failures/retries remain explicit without exposing the code in logs. Check the guest/event verification path through the same delivery abstraction.
- [ ] **Decide the production invoice repair.** Run the read-only repair preview against production business data, review every proposed invoice/line change, and record Adrian's explicit decision to apply or decline. If approved, apply through the confirmation-protected endpoint and verify the reported changes and resulting totals. Never mutate first and inspect afterward.
- [ ] **Run the Australia/Jesse operator flow.** Jesse claims the real owner access, confirms the active Australia account, completes the account/contact profile, loads and checks opening stock, verifies staff access, and reviews the storefront on desktop and mobile.
- [ ] **Make the public-empty storefront decision.** Before enabling or sharing the Australia storefront, Adrian and Jesse explicitly choose whether an empty or minimally stocked storefront stays private, receives a deliberate quiet state, or is ready to be public. Record the decision; do not let `public_enabled` drift by accident.
- [ ] **Rehearse the two-account wholesale lifecycle.** Using two controlled accounts, create and submit a wholesale order, reply or confirm it, ship it, receive it, and verify supplier stock decrement, buyer stock creation or increment, bilateral invoices, account isolation, and the visible timeline at every transition.
- [ ] **Complete one real inquiry → order → fulfillment loop.** A real customer starts through WhatsApp or email; Jesse confirms quantities, prices, and delivery/pickup; the order is recorded and fulfilled; stock movement and customer-visible detail are checked; customer and operator feedback is captured.
- [ ] **Test from actual mainland China.** On a mainland network, test public pages, Read, Shop/contact fallback, sign-in OTP, Curate capture/sync, uploads, and service-worker behavior. Include real voice capture/transcription through the configured Groq path; a non-mainland VPN simulation does not close this item. Afterward, read recent `incident_ledger` rows to correlate any transport, timeout, server, or chunk-recovery failures with the observed flow.
- [ ] **Approve Barry's real material.** Adrian supplies or approves Barry's contributor profile, article attribution, pull quotes, and personal voice. Exercise the real contributor → article → public profile path without inventing or silently rewriting Barry's words.
- [ ] **Perform the manual editorial-boundary and smoke walkthrough.** On the deployed build, walk commerce, authentication, account switching, Read, Curate, events, Journal/Favorites/Cellar, contributor publishing, public bylines, and contact fallback. Confirm drafts do not leak, legacy author fallback remains readable, account boundaries hold in visible behavior, mobile bottom navigation does not cover actions, and the inquiry model has not become automated checkout.

## Curate inventory data review

- [ ] **Verify the live Curate owner and backfill preview.** Confirm the MCP user/account matches Adrian's app; run the [read-only review](CURATE_INVENTORY_REVIEW.md) and approve missing shelf samples, including the three handoff XWT received assertions, before confirming writes. Review empty unnamed sets and repeated portions separately; do not delete them automatically.
- [ ] **Decide freight allocation.** Choose weight or purchase-value allocation, how air/sea costs apply, and whether a proposed per-tea rate replaces the shop freight setting. Recorded shipment costs do not change shelf pricing until this decision is implemented and reviewed.

## Curate release and integration evidence — 2026-10-09

The owned Curate release is independently proven live at `629a2327fb8acaa734eb0ceb3061fb8965b4b7ca`, build `mv05870o`. [Release run 37856972396](https://github.com/storyoftheleaf/teajia/actions/runs/37856972396) recorded Pages deployment `a4d9ef7f-7db5-404d-a096-9e072efac76f` and Worker version `9686a82e-73b6-4b96-84da-0ded9daefd9d`, with live-byte proof completed at 2026-10-09 07:05:39 Asia/Shanghai. The durable local receipt is `$CODEX_HOME/releases/teajia/workspace-629a2327/observer-state.json`. A subsequent read of the public API release endpoint returned the same revision with runtime version `2bf372f6-cfea-43b3-bf00-5be6238d584e`; that reading is distinct from the original recorded deployment proof.

This release includes vendor dependency warnings, selected history undo, direct private product promotion, and explicit Drive trash/restore. Verification included 2,241 Worker tests, eight desktop/mobile browser workflows, frontend checks/build, color lint and Worker bundling. Drive lifecycle tests used controlled Google responses; verification did not trash a production Drive file. The [consumer contract](CURATE_CONSUMER_CONTRACT.md) records IDs, permissions and private/public boundaries.

Integration snapshot, not a combined release:

| Consumer | Exact inspected state | Boundary |
| --- | --- | --- |
| Remote `main` | `629a2327fb8acaa734eb0ceb3061fb8965b4b7ca` | Owned live candidate |
| Claude `curate-section-optimizations-1d5a77` | HEAD `bcd3f5ce597862e707f86f102d4b7453e3cc7dde`, with uncommitted CurateV2 order/UI and test changes | Server-backed v2 Orders; working changes are not part of the release |
| [Samples PR #381](https://github.com/storyoftheleaf/teajia/pull/381) | Open, head `5afc8fc111436291687fe9681d4efdaa592eb9e6`, branch `claude/samples-phone-look` | Phone Samples/Stock UI; not merged |
| Invoice recovery | `e99e0bc85cb287b1a0cadeafb9373fb0323c1230` | Adds `0038_invoice_create_idempotency.sql` and `0039_intake_commit_recovery.sql`; separate candidate |
| Claude `determined-spence-8d898f` | HEAD `629a2327fb8acaa734eb0ceb3061fb8965b4b7ca`, with uncommitted `0040_purchase_order_total_can_be_unknown.sql`, API/schema and test changes | Nullable purchase-order totals; no immutable final candidate yet |

The exact Drive `0038_curate_drive_photo_operations.sql` and invoice recovery migrations were rehearsed against the migration ledger through 0037 in both orders: Drive → invoice → intake, and invoice → intake → Drive. Both passed with zero foreign-key violations. A three-way merge with invoice recovery was clean in all four shared files (`docs/CHANGELOG.md`, `src/lib/api.ts`, `worker/schema.sql`, `worker/src/index.ts`); the merged schema also loaded with all required new columns. Preserve both distinct 0038 filenames and the already-applied Drive migration. This is schema and text-merge evidence, not a full combined API test or deployment. The uncommitted 0040 change was inspected but not included in that rehearsal.

## B. Editorial decisions and work

These are real launch-quality inputs, not engineering substitutions.

- [ ] **Choose editorial references and keeper templates.** Adrian selects 1–3 reference magazines, curates roughly 20 keeper templates, and approves the final editorial layout language before broad publication.
- [ ] **Prepare and publish the interview archive.** Review the existing interviews and imagery, preserve quoted voice, assign contributors/subjects, select pull quotes deliberately, and publish only material that meets the approved editorial standard.
- [ ] **Supply Advise photography.** Select or create approved, owned photographs for the Advise work/portfolio surfaces; do not reintroduce stock-media runtime dependencies or invent documentary imagery.

## C. Optional decisions

These do not block launch unless Adrian explicitly promotes one into section A.

- [ ] **Homepage CTA:** decide whether the homepage needs a persistent explore-the-shop action above the fold while preserving the grounding lines' editorial voice.
- [ ] **Route grammar and `/start`:** decide whether account-route nouns and orphaned `/start` entry points need one explicit linking/renaming pass. Any navigation-label or route change requires confirmation before implementation.
- [ ] **iPhone MCP OAuth:** verify the connected-app OAuth flow on a real iPhone if mobile MCP operation matters for the first operator cohort.
- [ ] **Maps key:** provide and configure a maps API key only if the event map preview is worth activating now.

## Recording evidence

When an item closes, append a short indented evidence note beneath it containing the date, environment/person, and observable result. Link a deployment, screenshot, log, or business record when appropriate, but never paste secrets, OTP values, private customer details, or personal contributor material into this file.

If a check fails, leave it unchecked and record the failure in the owning active track. Do not create another launch checklist.
