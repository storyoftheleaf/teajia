# Curate → Stock → completed sale: repair results

28 October 2026. Implemented and verified locally. **Not deployed.**

The recommended repair order is complete: first money, saving and physical stock integrity; then receiving and customer connections; then the smaller workflow reductions. The existing checkout was preserved. Its pre-existing work was snapshotted before changes, and the repairs were integrated into that work without resetting the checkout or creating a combined commit that would absorb unrelated changes.

## What now works together

| Handoff | Repair | Practical result |
|---|---|---|
| Imported evidence → Library | Quote amount stays paired with currency, quantity basis and unit; roundtrips preserve supported capture fields. | A price quoted per pack, per 100g or for a whole line no longer becomes an unrelated per-gram figure. |
| Capture → durable save | Save acknowledges the exact revision sent; later typing remains pending. | A slow save cannot mark newer unsaved edits clean. |
| Library → Buy → Ledger | Capture is saved before receipt creation; receipt identity survives close/reopen; drafts are account scoped and grouped by vendor and currency. | One purchase can be resumed instead of recreated. |
| Ledger → purchase order | Negotiated totals take precedence over indicative quotes; USD totals use the shared exchange rates; confirmation follows server acknowledgement. | Failed confirmation remains visible and retries the same identified purchase. |
| Intake → Stock and purchasing | Full draft recovery, revision conflicts, refused-row retention, stable row identities and durable purchase follow-ups. | A partial import does not discard unresolved work or create purchase lines for skipped products. |
| Purchase order → physical receipt | Canonical receipt lines, explicit matching for ambiguous legacy lines, references to already-recorded opening movements. | Received status follows actual receiving; retrying cannot add the same stock again. |
| Source record → Stock | Rich identity, images, quote basis and appropriate descriptive facts carry forward. Later source propagation respects independently edited Stock fields and tasting categories. | Personal notes do not silently become public copy, and unrelated saves do not overwrite curated tasting content. |
| Network → ordinary inventory | Carry converts currency and per-100g pricing correctly and creates a linked private Stock holding. Wholesale receiving maintains supplier/buyer product-listing connections and repeat protection. | A carried or received network tea becomes usable by ordinary Stock and sales paths. |
| Stock → visible shop | Unknown cost remains unknown; freight follows the account setting; publication labels account for Active status and both publication gates. Empty data stays empty. | Missing data does not become a cheap tea, and an empty shop does not show demonstration products. |
| Sale → stock | Tea uses grams and teaware uses pieces, including linked manual invoice lines. New invoice lines retain their physical unit. | Selling a cup reduces pieces and does not change its acquisition denominator or leave the sold cup on the shelf. |
| Payment → shipment | Payment consumes stock once; adding shipping or retrying shipment does not consume it again. | Payment, stock and dispatch remain distinct but connected facts. |
| Cancellation → refund | Unshipped cancellation restores the original movement and reverses settlements once. Refunds are separately recorded with durable request identity and a visible remaining amount. | Payments remain in the history; a lost refund response can be safely retried. |
| Website request → customer history | Authenticated buyers are linked deliberately; personal order history follows ownership across shops, independent of seller membership. Guests can claim through their private tracking link. | A buyer can find their purchase without needing access to the seller's admin. |
| Agreement → tracking | Saved confirmation uses the server quote. Tracking shows agreed invoice lines, keeps the original request in a disclosure, and offers the available email/WhatsApp contact. | The receipt and conversation refer to the same quantities and money. |
| Shipment → buyer's Library | Identified buyers receive a repeat-safe private purchased-tea record in their validated Library account. | A completed sale connects back to the buyer's tea records. |

## Smaller friction removed

- Receipt and pricing changes refresh dependent Stock, readiness, purchase, sales, customer and shop queries. Public catalogue cache entries are refreshed in the location handling the mutation.
- Intake recovery retains shipping allocation and pending follow-ups. Conflicting server revisions preserve local work and require review instead of overwriting another device.
- Stock movement retries retain a frozen request after the panel closes. History remains available while an uncertain movement is unresolved.
- Editor arrow keys stay inside text fields. Failed field saves remain editable and retryable; photo saves await persistence. Enhancement reads the recorded image object.
- Search respects existing filters. Teaware alerts and totals use pieces. Stock history failures show an error instead of an empty-history claim.
- Duplicate Save/Want controls were reduced. A resolved tracking link keeps its lookup form collapsed. Cancelled shipping shows a compact summary, with the refund action visible nearby.

## Verification

The decisive integration test uses the real Worker handlers and SQLite. It runs against both the declared schema and a database rebuilt from the migration ledger:

**Capture and save → propose and accept receipt → repeat receipt → verify private holding and acquisition cost → deliberately publish → request an order as a buyer outside the seller's account → inspect Draft history → accept with shipping → record and repeat payment → ship and repeat shipment → inspect customer history and private tracking.**

It checks quantity, quote basis, missing freight inheritance, public visibility, server pricing, buyer ownership, one physical deduction, final shipment state and foreign-key integrity. The final fixture uses the shop's exchange-rate storage convention: currency units per USD.

| Check | Result |
|---|---|
| Full Worker suite, final revision | **134 files, 1,919 tests passed** |
| Full frontend/functions suite, followed by focused checks on later changes | **186 files, 2,152 passed, 11 skipped** |
| Curate Desktop/Mobile repair scenarios | **6 passed**; the existing free-sample retry also passed in an isolated warm run |
| Intake/editor, partner currency, Stock retry and purchase receiving browser checks | **10 passed** |
| Orders screen save, account isolation and refund recovery | **11 passed** |
| Manual teaware invoice unit/browser checks | **20 passed**, including **11 browser cases** |
| Public checkout suite | 32 initially passed; all six affected failures were resolved or rerun after cold-build/HMR interruption. The targeted checkout/tracking recheck passed **10/10**. Final confirmation/conversation recheck passed **4/4**. |
| Final tracking screens, Desktop/Mobile | **2 passed**, screenshots inspected |
| Frontend TypeScript | Passed |
| Styling rules | Passed; existing nonblocking notices remain |
| Production frontend build | Passed; existing chunk-size/import warnings remain |
| Worker packaging | Dry-run passed, approximately **438 KiB compressed** |
| Worker TypeScript debt check | **37 pre-existing diagnostics, no new diagnostic accepted**. Locations were updated only after matching unchanged original source lines. This is a passing debt check, not a clean Worker TypeScript compilation. |
| Diff whitespace | Passed |

The final linked-teaware manual invoice checks and their screenshot are recorded alongside the Stock evidence. Browser tests used local/intercepted APIs. Test failures were investigated: obsolete tea-only assumptions were replaced with counted-stock assertions while the event tasting menu remains tea-only; malformed harness responses and cold module/HMR interruptions were corrected separately from product defects. No real payment, customer message, stock receipt or sale was created in production.

Evidence is in `outputs/flow-repair-2026-10-28/`: `worker-final.log`, `frontend-suite.log`, `orders-browser-final.log`, `public-browser-recheck.log`, `confirmation-final.log`, `tracking-final.log`, `build.log`, `worker-build.log`, `worker-type-baseline-proof.json`, and the Curate/Stock/backend checklists. Regression sources include `worker/tests/curate-to-sale.test.ts`, `worker/tests/flow-repair-economic-boundaries.test.ts`, `tests/curate-flow-repair.spec.ts`, `tests/inventory-purchase-receipts.spec.ts`, and `tests/sale-flow-repair.spec.ts`.

## Limits and release boundary

1. **Production is unchanged.** Migration `0031_flow_continuity.sql` is additive and required with these application changes. Packaging was checked, but migration and release were not run. No ship request was given.
2. **Historical records were not guessed at.** Previously corrupted quotes, Carry prices, purchase totals or unmatched holdings need evidence-based reconciliation. The code prevents recurrence and offers explicit legacy matching; it does not infer the intended money from damaged rows.
3. **Shipped returns remain a separate operation.** Cancelling a shipped order is refused. This repair does not invent stock restoration before a physical return has been received.
4. **Older invoice lines may lack a unit snapshot.** New lines persist it. Historical NULL units retain a compatibility fallback; cancelled paid stock restoration uses the original physical ledger movement.
5. **Cross-device conflicts remain visible.** Conflicting intake work requires review. If an interrupted image extraction loses its local file, that image must be added again; completed extracted rows and uploaded image URLs remain recoverable.
6. **Remote cache locations retain their short TTL.** The mutation location refreshes immediately; the repair does not claim a global cache purge or push updates into every customer's open browser.

The remaining operational step is to release the verified application and additive migration together, then verify an authorized production example. That release is deliberately separate from this local repair.


## Release candidate integration, 2026-10-28

The authorized release was isolated from the original dirty checkout and integrated onto current main `c0343b97`, preserving its newer Library, Stock, tasting, immutable intake and coordinated publication features. The patch carries `0031_flow_continuity.sql` by its full filename; the previously deployed `0031_agent_suggestions_and_todos.sql` is a separate migration and remains unchanged. Applying the new migration to the current schema succeeds with no foreign-key errors.

Actual purchase cost now requires a reviewed order or an explicit actual purchase total and quantity; a quote alone stays unknown. Legacy saved intake plans replay their original request, retain review follow-ups, and link their original physical movement instead of receiving stock twice. Receipt-list filtering retains the current sourcing authorization and purchase-history response.

Release-candidate validation: frontend suite 262 files, 2,940 passing and 11 skipped before removal of an unused helper; full Worker suite 204 files, 2,656 passing with five integration failures subsequently repaired and all affected checks rerun (41/41 passed). Additional Curate, Intake, Purchases, Stock and invoice checks passed; public checkout/tracking 20/20 passed. Frontend types, production build, Worker dry-run and styling checks pass. All 37 Worker diagnostics match unchanged lines in a clean snapshot of current main; only their locations were updated.

Live verification uses an isolated, explicitly marked shop and customer, with outgoing order notifications suppressed only by a platform-controlled flag on that isolated account. It records test cash, never transfers funds, and archives the exact fixture accounts while retaining receipt/payment/stock audit evidence. Exact release revision, migration application and live verification evidence are recorded separately after publication.
