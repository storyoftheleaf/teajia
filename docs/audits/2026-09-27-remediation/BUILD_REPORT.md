# Teajia audit remediation build report

Status: all 22 code findings implemented and verified, including final acceptance corrections. Release manager owns integration, push and deployment. No deployment or production write has been performed by this build chat.

## Branch and scope

- Checkout: `/Users/adrianrasmussen/.codex/worktrees/teajia-audit-fixes/teajia`
- Branch: `codex/audit-remediation`
- Audit baseline: `2a09630333a9fe1fb449c205b73e51d4af7f7f19`
- Implementation base: `02d698128bc46343d63215e7515c610e746c276e`, verified current main including PR 314's website/email ordering behavior.
- Implementation commits: `ed7b8228` privacy/tenancy, `ac40bd55` cache/value semantics, `07f2d713` transaction/contract recovery, `5f7794cd` publishing/public recovery. Acceptance follow-up: `0c8c6942ea2cab55a8696f944f2c185ab85ad3df`. This is the final verified production-code SHA; a following documentation commit records this report.
- Itemized 22-finding mapping: [BUILD_STATUS.md](BUILD_STATUS.md).

All original audit files and unrelated changes in the original checkout were preserved. No migration, historical row cleanup, navigation relabeling, pricing policy change, new backend architecture or speculative advisory upgrade was included.

## Verified results and exact limits

The full runs occurred before structural test corrections. Passing results were retained; corrected and subsequently changed cases were rerun specifically. This report does not describe a later all-green full run that did not happen.

| Verification | Result |
|---|---|
| Frontend TypeScript, `npm run lint` | Passed again after the final production edits |
| Styling, `npm run lint:colors` | Passed before every commit; existing nonblocking legacy notices remain |
| Production, `npm run build` | Passed again after final production edits (31.65 seconds); existing large-chunk notices remain |
| Worker type ratchet | 37 known diagnostics, no new errors; four source-line positions updated after code insertion |
| Full Worker suite | 1,732 passed, 5 failed expectations in four files; all five corrected and focused runs passed |
| Worker failure follow-up | Public cache/RSVP/privacy: 11 passed; moved freight adapter: 17 passed; intake refusal guard plus intake behavior: 11 passed |
| Full frontend unit suite | 1,957 passed, 10 skipped, two obsolete persistence source guards failed |
| Frontend failure follow-up | Both guards now test the actual allowlist plus app wiring: 43 passed across three files |
| Transaction browser behavior | 22 passed across invoice, order, receipt, listing and intake components on desktop/mobile; includes actual PDF-to-Blob generation |
| Intake acceptance follow-up | Same focused 11-case run includes clearing staged rows before retry, with one inventory create |
| Private data isolation in mounted app | 2 passed: store A, failed B read, late A completion, logout, durable cache check, desktop/mobile |
| Story and vendor raw contracts | 4 passed through real routes with desktop/mobile viewport cases |
| Publishing/event recovery | 6 passed, three each desktop/mobile |
| Public failure/recovery | 6 passed, three each desktop/mobile |
| Inventory label screens | Passed at 390, 768 and 1440; Personal visible and viewport overflow guarded |
| Integrated existing browser matrix | 161 passed, one intentional skip, two mobile failures; details and corrected cases below |
| Final receipt/order/listing behavior | 20 passed desktop/mobile after quantity validation, definitive rejection recovery and account-generation fencing |
| Delayed listing save and latest-value retry | 2 real mounted-component cases passed |
| Restored vendor economics | 7 focused unit cases plus 2 real-route desktop/mobile cases passed |
| Worker runtime | Booted local Miniflare runtime on 8789; actual request returned expected 404 JSON |

The integrated matrix covered contact creation, shop navigation, inquiry delivery, order detail, inventory scrolling and incoming receipts, account/mobile money surfaces, email sign-in, multiple stores, personal tea journeys, contributor publishing and event article drafts. It includes the two files run by `npm run test:mobile` on Mobile Chrome, plus desktop coverage.

Two integrated failures reached previously unexercised or newly shifted layouts:

1. Clear in the mobile inventory selection rail was covered by the bottom navigation. The rail now uses the mandatory `bottom-nav` utility, with its existing scroll/portal behavior intact. The lifecycle case passes on desktop and mobile after the correction.
2. Wrapping the Personal label moved the Product header below a two-row suggestion list, so the overlap guard no longer exercised an overlap. The case now supplies three realistic matching sources (Chen Family, Mountain Source, Northern Source). The original geometric overlap and hit-testing assertions remain; both desktop/mobile cases pass.

The formerly excluded lifecycle title was removed from the CI known-failure regex only after it passed. The other exclusions were preserved.

## Acceptance corrections

Receipt input now rejects nonfinite, nonpositive, over-remaining and fractional per-piece quantities before persisting an intent. The Worker receive path was checked: structured 400 validation and 409 conflicts do not commit a stock movement, so those responses release the rejected intent for correction. Lost responses and other ambiguous failures retain the key. Account epoch and load-generation checks fence late responses, including A→B→A and responses arriving during refresh.

Partner listing fields are disabled individually while their saves are in flight. Failed-save Retry reads the latest rendered value, avoiding both dropped edits and stale retry closures. The two focused browser cases exercise delayed first-save/next-edit and failed-note/latest-note retry.

Vendor Total cost, Avg cost/g and Stock value retain their existing places. They use the existing account-scoped product pricing endpoint and shared rate table; unverified provenance, absent rates or incomplete economics display a dash. Teaware is excluded from the per-gram average and valued by units. A recorded purchase-order total of zero remains $0.00. Synthetic CNY browser evidence verifies 88 CNY / 8 = $11, $0.130/g, $65 stock value and the zero order total; no real currency data was changed.

## Dependency correction

The original `@react-pdf/renderer` 3.4.5 peer range excluded React 19 and its reconciler crashed on missing React internals. The isolated checkout now uses 4.9.0 and its required PDF dependency tree. [Official React-PDF compatibility](https://react-pdf.org/docs/v4/compatibility) identifies React 19 support from 4.1.0. This was verified with a real generated PDF Blob, a failed native-share attempt and retry that did not create another invoice. The checkout owns its installed root dependencies; the original node_modules was not modified.

## Evidence and preview

- Fixture preview: http://localhost:7804, isolated Vite checkout, HMR disabled for deterministic tests. This preview is for intercepted synthetic browser fixtures; it is not a configured admin sandbox and has no live API proxy.
- Disposable local Worker: http://localhost:8789, storage `/private/tmp/teajia-audit-runtime`; boot verified, not seeded with production data.
- Neither port 7777 nor another chat's server was changed.
- Main logs: `/private/tmp/teajia-audit-{worker-full,src-full,types,worker-types,colors,build,final-types,final-colors,final-build,integrated-browser,recovery-final,cache-tests,public-ui,contact-public,inventory-final,suggestion-final,vendor-final}.log`.
- Inventory screen evidence: `/private/tmp/teajia-audit-public-ui/inventory-personal-layout--51670-e-tablet-and-desktop-widths-Desktop-Chrome/inventory-purpose-{390,768,1440}.png`.
- Recovery screens: `test-results/invoice-share-failed-mobile.png`, `test-results/order-load-failed-mobile.png`, `test-results/receipt-refresh-failed-mobile.png` in this checkout. Invoice and label screenshots were visually inspected.
- Event failure/recovery: `/private/tmp/teajia-privacy-playwright-mobile/article-event-recovery-fai-64cf4-recovers-on-the-same-screen-Mobile-Chrome/{event-failed,event-recovered}.png`.
- Contact success screen: `/private/tmp/teajia-audit-integrated-browser/contact-create-recovery-a--670cf-elationship-save-would-fail-Mobile-Chrome/contact-created-once.png`.

## Remaining operational decisions and boundaries

LIVE-01 is not a code-release blocker. The top manager's read-only D1 investigation found Bali active/public and a published recipient, but no order email, WhatsApp or eligible published payment method. Adrian's intended ordering contact/payment details are still required; the gate and configuration remain unchanged.

The intake correction preserves and retries purchase records in the mounted intake workspace. Reload-safe import orchestration and unknown-outcome purchase-order deduplication were not added. The invoice fix addresses confirmed invoice creation followed by PDF/share failure; a lost invoice-create response is a separate idempotency concern. Explicit recipient-shared collection links retain their existing policy; the audited public shop-discovery leak is closed. No unconfirmed SEC-05/CONTENT-04 concern is claimed fixed. Existing worker typing debt, bundle-size notices, missing editorial photography and unverified dependency-advisory reachability remain outside this bounded remediation.
