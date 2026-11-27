# Checkout release handoff · 19 November 2026

Prepared candidate: `174f25a17eaf2b06e2e3035320999f11caacf533`, branch `codex/teajia-split-order-20261119`, clean worktree `/tmp/teajia-split-order-20261119`, based on `b2c2190a4b2d177d9ca3855f7f7fe0e0641dd9f1`.

This is a tested local candidate, not a release. Build Manager owns serialized integration after the Sessions repair; do not publish this older base over newer main. Integrate the exact change, resolve against the completed Sessions revision, and verify the resulting immutable revision before release.

## Working behavior

Bali-only pickup supports confirmed stock and configured bank-transfer instructions. Merchant credentials and activation remain held. The operator confirms deposits. Orders needing review receive 24 hours after acceptance. Split invoices stay under one private website order, retain the original deadline and have separate payment ledgers; splitting or reopening does not renew the hold.

US delivery supports an optional flat USD-per-kilogram rate, packaging allowance and maximum packed weight. Without a complete configured preset, checkout records a quote request and withholds payment until the shipping quote is confirmed. No carrier account, physical parcel, production rate or payment credential was created. Adrian will supply an approximate rate later; TODO.md records this without requiring a physical parcel.

## Evidence

120 tests passed across six focused Worker suites; eight desktop/mobile browser checks passed. Real local Worker/D1 browser proof covered the grouped order, selected child transfer reports, partial/full confirmation and replay, one stock deduction, dispatch replay, original expiry, US quote refusal and acceptance after an explicit synthetic quote. Frontend types, Worker type ratchet (32 known, no drift), colors, production build and Worker dry-run passed.

Proof directory: `/Users/adrianrasmussen/.codex/visualizations/2026/11/19/split-order/` contains candidate.json, evidence.json, child-paid.png, original-expired.png and retained logs. All payments and bank details in proof were synthetic.

## Migration and integration limits

`0066_checkout_fulfillment.sql` is DDL only: nullable invoice fulfillment_method, shipping_quote_status and order_payment_deadline. Existing source_inquiry_id groups split invoices; no relationship backfill is guessed. Existing migration bytes remain unchanged; 0065 and 0067 belong to Sessions. Migration hash is recorded in candidate.json. Fresh local migration replay succeeded; the final combined Sessions/checkout ledger must be checked on integration. Required full checks and mobile checks still apply to that integrated release revision.

No deployment, external customer message or competing publisher was started by this checkout packet.

## Integrated Sessions candidate · 19 November 2026

The approved checkout patch was replayed onto final corrected Sessions revision `dcb1365e04210d1a51db4a8732daeec7355ca2c0`. Prepared candidate: `7f985e1195c11095adbf91f3cf1c4945f1b76315`, branch `codex/checkout-sessions-integrated-20261119`, clean worktree `/tmp/teajia-checkout-sessions-integrated`. The only extra change is a source-test regex correction so a JSX greater-than comparison does not truncate the PayOrderAction tag before its trackingToken prop; its 36 focused tests pass.

Full Worker qualification passed: 241 files, 3,070 tests. Fresh 73-migration schema equals the existing 72-migration Sessions schema upgraded with 0066; 0061/0065/0067 bytes are preserved. Frontend types, Worker ratchet (32 known/no drift), colors, production build and correct Worker dry-run pass. A real local Wrangler Worker/D1/browser fixture passed split selection, original deadline, child payment reporting, unknown-invoice refusal, absent-US-rate quote fallback, rejection before quote and acceptance after an explicit synthetic quote. Phone screenshot was visually checked. No production credentials or payment activation were changed.

Proof: `/Users/adrianrasmussen/.codex/visualizations/2026/11/19/checkout-sessions-integrated/` (candidate.json includes exact migration hashes and identity). Final frontend and browser run summaries will be appended after completion. Build Manager retains serialized publication ownership; no main push, tag or deployment was started here.

Final frontend qualification: 328 files, 3,450 passed and 11 intentional skips. The initial full run found only the source regex issue; the final full rerun is green. The first broad browser run used a real local API with fake auth tokens (66 passed, two account-panel auth failures, 56 not run); that run is not acceptance evidence. Checkout and required mobile suites are being rerun against the proper isolated mock API server. Real Worker/D1 proof remains separate and green.

Final browser qualification is green on the correct isolated mock server: all 44 desktop/mobile checkout tests and all 40 required mobile account/money tests passed. Candidate `7f985e1195c11095adbf91f3cf1c4945f1b76315` is clean and ready for Build Manager’s serialized release after Sessions live proof. No publisher was started. Synthetic Worker state and temporary services were removed.

## Serialized publication started

Sessionsdcb1365e is provenlivebuild2e0hk7m3vl. Integratedapprovedcandidate7f985e1195c11095adbf91f3cf1c4945f1b76315 is publishing through [guardedrun44515507675](https://github.com/storyoftheleaf/teajia/actions/runs/44515507675), with durablestate/config/resume/lease under ~/.codex/releases/teajia/split-order-7f985e11. This supersedes the older174f25a1 prepared-base handoff. Paymentsremainpaused andUSshippingquote-onlyuntilconfigured.


## Closure reconciliation · 23 November 2026

This dated receipt supersedes the earlier “publishing” and “waiting for Meta approval” reports above. It does not authorize a deployment, settings change, live order or customer message. Only this handoff was updated during reconciliation.

- **Original stock decision: shipped and closed as implementation.** The approved policy is a 24-hour hold from confirmation, with unreviewed requests leaving stock available; confirmed full payment consumes the hold and deducts stock once, and dispatch does not deduct it again. Commit `2f9b6249a2923f2d376a04b3ae9c304b0824bbd3` is included in the independently verified checkout release `c314ba827daea3741d2e3c3d266a8f09029edcad`, build **241537zyr2**, live 18 November. Split/replay protection subsequently shipped at `7f985e1195c11095adbf91f3cf1c4945f1b76315`, build **1dq9fmqsox**. These are release receipts plus synthetic lifecycle/replay proof, not a claim that a genuine customer order was exercised during this reconciliation. A real buyer fulfillment remains the separate M3 operating acceptance, not an unshipped stock-deduction fix.
- **Email shipping-payment notifications: shipped and enabled.** Release `4b65dfb68370f6411549cb84f68407dd82bd3ee6` was independently proven live on build **tdw5lkv3k**, run [44663481012](https://github.com/storyoftheleaf/teajia/actions/runs/44663481012). The current live API reports revision `2b909cdb6f66e94f1d338366c83810bc3ae5c9c0`, which includes that release, and [shipping readiness](https://www.teajia.com/api/public/shipping-notifications) still reports `email_enabled: true`. This proves enabled configuration and the released implementation; no new delivery or recipient-inbox test was performed.
- **Meta review: complete.** A fresh authenticated read at **23 November, 22:59 Bali** returned HTTP 200 for `teajia_shipping_payment_v1`: **APPROVED**, **UTILITY**, **en_US**, one BODY with five positional values. The earlier PENDING report is obsolete. A second authenticated read at **23:01 Bali** confirms the configured number is **CONNECTED** with Coexistence enabled. Meta owns the approval decision and has supplied it; Adrian has no demonstrated remaining approval or new-account step. No template or provider setting was changed in this reconciliation.
- **Automatic WhatsApp activation: engineering remains open.** The live readiness endpoint reports `whatsapp_state: unavailable`. A read-only production query confirms the approval cache is still `state=unavailable`, `code=whatsapp_template_verification_unavailable`, checked **23 November, 13:00:46 Bali**, with no `last_approved_at`. Do not label WhatsApp live or move it back to “waiting for Meta.”
- **Monitor ownership:** the existing local launchd job `com.teajia.shipping-approval-20261120` is registered. Its refreshed monitor now records the owning PID in its lock and can reclaim a dead process’s lock; the previous abandoned lock is retained separately. The latest activation state was refreshed on 23 November at 22:54 Bali and retains the older generic `waiting_whatsapp_approval` label. That label does not reflect the newly verified Meta decision and is not evidence that approval is still pending. The monitor is read-only and can notify about readiness; it cannot repair or refresh the deployed Worker’s approval cache.

### One outstanding engineering action

**Owner: this Shop to Sales / shipping-payment builder chat**, coordinated by Teajia Build Manager for any authorized integration and publication. Reconcile why the deployed approval-refresh path fails or is not advancing despite an approved provider response. Inspect the hourly scheduled execution and allowance/runtime/provider failure evidence, then verify fresh approval through the existing server-controlled path. Do not manually mark the cache approved or drain/send customer notices merely to close the item. Acceptance is a fresh matching approved cache and `whatsapp_state: approved`, plus bounded local pending→approved/replay coverage; real delivery is a separate explicitly authorized customer-message test. If a code or settings change is required, prepare the exact repair and obtain/retain the relevant publication authorization. **No further action was authorized or performed by this read-only closure request.**

Receipt and resumption sources:

- `~/.codex/releases/teajia/checkout-stock-c314ba82/observer-state.json`
- `~/.codex/releases/teajia/split-order-7f985e11/observer-state.json`
- `~/.codex/releases/teajia/shipping-payment-notifications-20261120/observer-state.json`, `activation-state.json`, `activation-monitor.mjs`, and `config.json`
- `~/Library/LaunchAgents/com.teajia.shipping-approval-20261120.plist`

The older isolated `/tmp` checkouts in this handoff have been removed. Use current project evidence and the recorded immutable revisions; do not restart an obsolete candidate or its publisher.


## WhatsApp approval recovery · local candidate · 23 November 2026

Prepared `26d60b7c41078d8289f59478096e035de7bdbab5` on `codex/shipping-approval-recovery` in `/tmp/teajia-shipping-approval-recovery`, based on `2b909cdb6f66e94f1d338366c83810bc3ae5c9c0`. The clean candidate retries the provider metadata read once for a transport failure or HTTP 5xx, using two five-second attempt windows within the former ten-second budget. The hourly check, 15-minute cache, template matching and existing send controls retain their behavior.

On main, a synthetic 503 followed by available approved metadata left the cache unavailable on the first refresh. The new regression test fails on main and passes on the candidate. The route test exercises an unavailable provider, a still-fresh cached failure, expiry, pending approval and later approval. The existing dispatcher sends one synthetic WhatsApp message. A repeat tick and unchanged quote save send zero additional messages. All 54 tests across the approval, notification and route suites passed. Color lint and the Worker type ratchet passed with 31 existing diagnostics and no drift.

The retry addresses a reproduced transient failure. The older production row does not identify the original provider or Worker failure precisely. The last live read still returned email enabled and WhatsApp unavailable with `checked_at=2026-11-23T05:00:46.256Z`. The candidate is local and ready for review.

After a separately authorized release, verify the deployed revision, then observe the first scheduled approval check. Within its 15-minute cache window, [live shipping readiness](https://www.teajia.com/api/public/shipping-notifications) must report `email_enabled: true`, `whatsapp_state: approved` and a `checked_at` timestamp after deployment for the configured template. If the timestamp does not advance, inspect the scheduled Worker invocation and shared allowance admission. If it advances with unavailable status, inspect the Worker-to-provider request failure. The readiness check is read-only. An outbound delivery test requires separate authorization.


## Hourly approval gap · 23 November 2026

Combined local candidate `bbc84690835d3d42ce00c632ab4c2d2bb037d963` includes the earlier transient metadata retry `26d60b7c41078d8289f59478096e035de7bdbab5`. The metadata retry can recover a provider failure inside one check. A provider failure that reaches the cache write still advances `checked_at` with an unavailable result, so the ten-hour timestamp gap requires separate evidence.

The live Worker revision `2b909cdb6f66e94f1d338366c83810bc3ae5c9c0` had the `0 * * * *` Cloudflare schedule and shared allowance binding. At 23:06 Bali the direct production readiness read still showed email enabled, WhatsApp unavailable and the 13:00:46 Bali check. Cloudflare's read-only `workersInvocationsScheduled` query for this script from 05:00 UTC onward returned an empty result. There was no per-invocation evidence to establish whether the missing ticks dispatched or whether an invoked Worker was stopped by allowance admission, D1 cooldown, an earlier job, or the approval cache write. An empty history result alone does not distinguish those outcomes.

The real scheduled entry point shares one lazy background allowance across jobs. Before this repair, archive cleanup and the legacy customer outbox ran before approval. Both reproductions left the seeded unavailable row stale and made no provider call. One had a two-statement grant. The other injected a failure in the first archive UPDATE, which charged the remaining grant's rows and writes. Catching the cleanup error let control continue but could not replenish the shared allowance. The candidate runs the configured approval check first, still under the same background allowance and D1 guard, before cleanup or either outbox. A denied admission or binding-wide D1 cooldown can still defer the check.

Both regressions failed against the old ordering and passed on the candidate. All 56 tests across approval, notification, route and scheduled Worker suites passed. Color lint and the Worker type ratchet passed with 31 existing diagnostics and no drift. No production writes, release or test messages were performed.

**Production acceptance after an authorized release:** Verify the deployed revision and attach a short read-only Worker log tail around the next hourly tick if historical logs are unavailable. Match the invocation to its scheduled timestamp. Expect `Scheduled shipping approval` with `state=approved` and a new `checkedAt`, then confirm [shipping readiness](https://www.teajia.com/api/public/shipping-notifications) shows email enabled and WhatsApp approved within the normal 15-minute window. A `check_failed` event paired with the scheduled allowance refusal reason distinguishes shared admission or budget failure. An unavailable event with a fresh timestamp confirms the cache write and directs investigation to the provider decision or transport. A D1 cooldown is logged before the handler. If no invocation appears, record the scheduled time and Cloudflare observability evidence before diagnosing dispatch. Delivery verification remains separate.


## Approval recovery publication · 23 November 2026

The guarded Worker-first release is publishing in background for `bbc84690835d3d42ce00c632ab4c2d2bb037d963` on [run 45202264860](https://github.com/storyoftheleaf/teajia/actions/runs/45202264860). Current main at dispatch was `2b909cdb6f66e94f1d338366c83810bc3ae5c9c0`. The candidate adds only the shipping approval repairs and tests. The run has persisted its initial release artifact. The local publisher holds the production lease for the same revision.

The existing release observer wakes the read-only approval proof on verified publication. A local calendar job also checks at minutes 3, 9, and 14 after the hourly tick through two eligible hours. A passing receipt brackets readiness with the same deployed Worker revision and version, verifies email is enabled and WhatsApp is approved, and records a fresh `checked_at` at or after the first hourly boundary following Worker verification. This proves the fresh server state. Attribution to a particular cron invocation still requires correlated Worker logs. The observer reuses the existing WhatsApp desktop notification marker. It stops on approval, actionable failure, or a superseding Worker.

Release and resumption state are in `~/.codex/releases/teajia/shipping-approval-recovery-bbc84690/`: `observer-state.json` and `approval-proof.json` contain their respective commands. At handoff publication was in progress. Neither a fresh approval refresh nor customer delivery had been observed.
