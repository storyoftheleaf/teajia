# Checkout integration readiness · 18 November 2026

The local checkout candidate is `efeb102a26eeb85315b76dd3980dc4fa7ee4d691` on `codex/teajia-checkout-readiness-20261118`, in `/private/tmp/teajia-checkout-readiness-20261118`. Its base is fetched main `297048f8e9f77bcfdea06d527880ba324d3908b8`. The candidate is a linear cherry-pick of the approved checkout chain. Every pick applied cleanly. It contains no new runtime design or split-child relationship.

## Infrastructure absent on main

Main already has inquiries, Draft/Pending invoices, bank method privacy, customer payment reports, operator confirmation, ledger deduction, shipment, cancellation/refund and stock reservation helpers. The candidate adds the missing checkout-specific work.

| Original revision | Candidate revision | Included behavior |
|---|---|---|
| 76899724 | 31be85c3 | Synthetic overlapping inquiry and access fixture |
| 8a74c2be | 297c2c05 | Synthetic paid shipment and refund fixture |
| 3249168e | 81cd1b1b | Website acceptance holds for 24 hours, UTC expiry comparisons and reservation guard |
| 01ed0bae | d0dd80a3 | Private delivery address captured for operator use |
| 07f07da4 | 99d416c9 | Known-stock Bali pickup to private bank instructions without operator reply |
| f9453183 | 7d88a0e8 | Configurable US USD/kg rate and packing profile, persisted quote and delivered total |
| 5a951457 | 26a60e30 | Concurrent share-link creation and buyer payment expiry |
| dee27e2e | ae1445f9 | Same-invoice edits preserve the original deadline |
| 86d35bd5 | efeb102a | Split operation preserves original deadline and refuses expired coverage |

The checkout methods preserve partial payment, full payment, one sale movement, cancellation compensation and refund replay. US rate configuration stays absent. Bali pickup is opted in for `acc_teajia_bali` but still requires a published receiving bank method and known stock.

## Additive migration dependencies

Apply these after main's existing migration ledger, before the revised Worker or frontend.

| File | Change | Dependency |
|---|---|---|
| `0062_restore_stock_hold_guard.sql` | Creates the missing nonnegative stock hold trigger | Existing stock_holds table and reservation helper |
| `0063_private_checkout_address.sql` | Adds invoices.delivery_address | Existing invoices table |
| `0064_checkout_us_shipping_weight.sql` | Adds invoices.checkout_shipping_grams | Existing invoices table |

All three contain additive DDL. There is no data UPDATE, INSERT or DELETE. The address and packed-weight columns are also in the reference schema. Migration-backed lifecycle fixtures replay the ledger and exercise all three. Magazine and Sessions migrations are outside this candidate. Main already contains its own receipt/photo/sample migrations, which were not separately imported.

## Fresh verification on the candidate

- 108 tests passed across the selected lifecycle, payment, privacy, buyer ownership, invoice creation, fulfillment, US calculation and checkout source fixtures.
- 85 tests passed across manual Sales routes and buyer payment/journey domain fixtures.
- 10 Playwright cases passed on Desktop Chrome and Mobile Chrome. These use the candidate's real frontend with mocked API payloads and cover pickup review, immediate pickup transfer, private address submission, the rated US delivered total and refund status.
- Frontend TypeScript, Worker type ratchet with 32 baseline errors, color lint and diff whitespace checks passed.
- Wrangler deploy dry-run passed. Bundle 3,072.30 KiB, gzip 646.81 KiB. No deployment occurred.
- Production frontend build passed. Vite reported circular chunk and mixed static/dynamic import warnings.

The actual Worker/D1/browser rehearsal on exact `efeb102a26eeb85315b76dd3980dc4fa7ee4d691` passed on 18 November 2026. Disposable D1 replayed 69 migrations, with local R2 bindings and a synthetic receiving bank method. Chromium at 390 × 844 opened the exact public product, added 50 g through Add to order and placed pickup without seeded browser cart or mocked API responses. Eight simultaneous first tracking reads returned HTTP 200 and the same private pay link. The buyer opened private synthetic bank details and reported USD 5, then USD 7. Operator API confirmation of the first payment left USD 7 due and zero stock movements. Full confirmation and replay produced one −50 g movement from 100 g to 50 g. Dispatch and replay preserved one deduction and the original timestamp. The buyer's actual order page displayed the tracking. Replaying intake returned the same invoice.

A separate synthetic tea/invoice exercised USD 14 cancellation and refund. Repeated cancellation restored 50 g once, and repeated refund returned the same refund ID and zero due. Two 75 g review requests left 100 g available as Drafts. Acceptance held 75 g for 24 hours and refused the second order. Updating only the synthetic first hold's timestamp to the past released the stock. The actual buyer page then showed Stock hold expired with no pay link. The previous share link returned HTTP 409 with invoice_hold_expired. Transfer reports remained available for money already sent. The second order could then reserve 75 g. US checkout with its rate unset captured the address as Draft and offered no immediate transfer action.

The reused browser harness needed its old Add button label changed to the current Add to order label and its expired-message expectation changed to Stock hold expired. Product code stayed at the pinned revision throughout. Screenshots were inspected. All temporary services, D1/R2 state, generated signing secret and harness configuration were removed. The candidate worktree stayed clean. Proof artifacts are [candidate identity](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-efeb102a/candidate.json), [pickup log](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-efeb102a/pickup.log), [expiry/refund log](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-efeb102a/expiry-refund.log), [synthetic state](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-efeb102a/synthetic-state.json), [transfer screen](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-efeb102a/private-transfer.png), [dispatch screen](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-efeb102a/dispatched-tracking.png), and [expired screen](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-efeb102a/expired-hold.png).

## Unresolved gates

1. Split child identity still needs a product decision. A child has no website-order lineage, so later child edits and payment access do not inherit the original website expiry gate. Original split deadline protection is included. Do not treat split-child access as closed.
2. Ordinary real Worker/browser acceptance is complete on this exact candidate. The operator confirmations and dispatch/refund writes used the real authenticated API. The buyer checkout, private instructions, transfer reports and tracking used the real browser. A rated US real-browser rerun was outside this ordinary checkout pass.
3. Verify the production store's published receiving bank method through authorized access and run a separately authorized real transfer. The previous public readiness check was false. No receiving details or production settings were changed here.
4. US USD/kg, dispatch postal code and measured parcel packing profile remain in TODO. Missing configuration keeps US checkout on review.
5. Coordinate the final base with recording release `dc5a9271`, prepared on `297048f8`. The checkout branch does not absorb the audio release. Any later integrated revision requires its own checks.
6. Build Manager owns integration and release authorization. No push, migration execution against production, deployment or publication was performed.


## Release candidate on updated production · 18 November 2026

Exact candidate `c824f63376e07e7e6859744380e5236230419da9` on `codex/teajia-checkout-release-20261118` uses production base `feb30b698a3977d25e3b7f6b347537a7af04739a`. It preserves the independently released recording changes and Sessions completion timestamp repair. The checkout chain was reapplied with one import conflict resolved by retaining both the recording and US shipping imports.

The final configuration commit removes the default immediate pickup activation. Pickup self-service and US self-service both stay inactive in the production configuration. A read-only production secret-name check confirmed none of the five pickup/US activation or rate names exists as a secret. No payment method values were read or written. With an actual local synthetic receiving method present but pickup activation unset, a pickup request saved Draft and exposed no payment offer. This is the production-default behavior.

Using a local-only pickup activation override, the actual browser/Worker/D1 rehearsal then passed on this same candidate. It began at the public product, added 50 g through Add to order, reserved pickup, read the private synthetic bank method and reported partial then remaining money. Eight simultaneous first reads returned one stable private offer. Partial confirmation left stock intact; full confirmation and replay left one −50 g debit. Dispatch/replay kept the original timestamp and showed tracking. A separate cancellation/refund restored 50 g once and refunded once. Reviewed 75 g orders against 100 g preserved the 24-hour deadline, released stock on synthetic expiry, refused the old payment share link and let the second buyer reserve. The actual expired buyer page kept the report-transfer action available for reconciliation. US with an unset rate saved Draft with no immediate payment offer.

Evidence is retained in [release-candidate artifacts](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-release-c824f633/state.json), [rehearsal log](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-release-c824f633/rehearsal.log), [disabled default proof](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-release-c824f633/default-disabled.json), and [activation readiness](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-release-c824f633/activation-readiness.json). Temporary loopback services, synthetic D1/R2, secret and harness configuration were removed. The worktree is clean. Phone 10002 and production were not changed.

Only DDL migrations 0062–0064 are added over this base. No Magazine, RSVP/member or new Sessions schema is included. Split-original deadline protection is retained. Split-child relationship, tracking and payment inheritance remain the separate held product decision. Real bank checkout activation and US rate/packing activation are separate follow-ups.

Build Manager owns the serialized Worker-first handoff of this exact candidate after its final required checks. Sessions observer status was read once and was live. No release tag, remote branch/main push, workflow dispatch or deployment was started by this chat.


Final candidate checks passed 3,054 Worker tests across 239 files, frontend TypeScript, Worker type ratchet with 32 unchanged baseline errors, color lint, production frontend build and Worker dry-run. The exact real browser proof above passed with no runtime edits. [Full Worker result](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-release-c824f633/worker-tests.log) · [Dry-run bindings](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-release-c824f633/worker-dry-run.log). This candidate is prepared for the ordinary checkout repair release with immediate pickup and US activation held. The previously verified `efeb102a` remains historical evidence rather than the release revision.


## Stock-integrated acceptance · 18 November 2026

Build Manager's runtime candidate `226728cef93850938d9ab5be1d195131f4318fcc` passed the actual local browser/Worker/D1 proof using 69 migrations and synthetic bank, seller, buyer and products. The Stock card and listing review both showed 100 g available and USD 12 buyer total for 50 g. A signed-out browser opened that same public tea, added 50 g through the normal amount control and completed pickup through private transfer instructions and reporting. Eight concurrent first reads agreed. Partial confirmation kept stock intact, full confirmation deducted once, and dispatch/replay preserved the movement and showed tracking. Separate cancellation/refund and reviewed 24-hour hold/expiry/release passed. US unset-rate checkout remained Draft. Operator writes were authenticated API calls. The buyer and Stock interactions used actual browser routes without API mocks. Default activation was checked before the local-only override and saved Draft without exposing payment, despite a synthetic receiving bank method being present.

106 focused Worker tests passed. Both type checks, color lint, production frontend build and Worker dry-run passed. Initial browser selection passed nine cases and found one invalid mobile expectation for the desktop-only table header. The authorized test-only correction is commit `c314ba827daea3741d2e3c3d266a8f09029edcad`, directly on `226728ce`. It checks Table pressed state, mobile record visibility or desktop header as applicable, and persistence after reload. All four Stock grid cases then passed on Desktop and Mobile Chrome. Runtime code is identical between those two revisions, so the real browser and build proof apply to the final test-only revision. No full Worker suite was repeated locally. CI owns that release gate.

[Sanitized acceptance](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-stock-226728ce/acceptance.json) · [Real browser log](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-stock-226728ce/real-browser.log) · [Synthetic state](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-stock-226728ce/state.json) · [Corrected Stock tests](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-stock-226728ce/stock-corrected.log) · [Disabled default](/Users/adrianrasmussen/.codex/visualizations/2026/11/18/checkout-stock-226728ce/default-disabled.json). The listing screenshot captured a modal animation transition and is retained as a record of the price assertions, not a settled visual acceptance image. Temporary proof services, synthetic D1/R2, signing secret and harness configuration were removed. The worktree is clean. Split-child identity, real bank activation and US pricing remain held. Publication belongs to Build Manager; this chat dispatched nothing.

## Actual integrated publication

Build Manager replayed the checkout patch unchanged onto live Stockfcfc3c95, runtime226728ce. Integration acceptance passed. Test-onlyc314ba82 corrects mobile Stock table persistence expectations. Exactc314ba827daea3741d2e3c3d266a8f09029edcad is publishing through [guarded run44221199792](https://github.com/storyoftheleaf/teajia/actions/runs/44221199792), with durable observer/config/state/lease under ~/.codex/releases/teajia/checkout-stock-c314ba82. This replaces recommendation-only handoff. Pickup/US activation and split-child relationship remain held as recorded above.
