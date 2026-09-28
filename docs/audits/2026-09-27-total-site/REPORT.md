# Teajia total-site audit — 27 September 2026

**The most urgent problems are a live checkout block, admin money fields losing their meaning, and failure paths that can duplicate or misattribute records.** Public privacy gates also differ across endpoint families. The ordinary journeys have substantial passing coverage; the highest-risk defects appear when requests fail, overlap, or cross account boundaries.

Audited checkout: `2a09630333a9fe1fb449c205b73e51d4af7f7f19` (unchanged at finish). Existing dirty files were `CLAUDE.md`, `INDEX.md`, `docs/CAPABILITIES.md`, plus untracked `.artifacts/`, `docs/label-mockups/`, and `outputs/`; preserved. Audit deliverables are confined to this report/evidence folder and temporary local fixtures; normal ignored build and development-cache outputs were regenerated during verification. No product code was fixed, production data changed, order submitted, message sent to customers, commit made, or deployment performed. The live deployment SHA was not verified; live observations and checkout reproductions are labelled separately. Production inspected at `teajia.com`/`www.teajia.com`, never the abandoned Pages project.

## Read first

- **LIVE-01:** the live Bali cart rejects order requests, and the public profile says `can_be_paid:false`. Owner configuration needs checking; no assumption was made that this closure is accidental.
- **BIZ-01:** the actual admin hook converts inherited freight NULL to zero, zero retail override to NULL, and zero stock threshold to 100. Display is wrong immediately; duplication can carry the false zero into a new row.
- **BIZ-02 / BIZ-03 / OPS-03:** real component fixtures demonstrate wrong-order save payloads, repeat invoice creation after PDF failure, and fresh receive keys after a failed refresh. Separate bundled-Worker/in-memory-D1 probes confirm duplicate invoices and 5g+5g stock receipt persistence.
- **SEC-01–03:** unauthenticated local probes retrieve closed-store data, a private event’s synthetic address, and hidden products through shop collections. No live private records were queried.
- **BIZ-04 / CONTENT-01:** account-switch cache failure retains another store’s pending customer data; an older article autosave can undo publication while the editor says Published.

Severity: P1 = urgent business/privacy integrity; P2 = actionable functional correctness; P3 = small usability defect. No P0 was established. “Confirmed source” is a deterministic traced failure path, not a claim of a production incident. “Browser fixture” means the real component with controlled synthetic APIs. SQL probes run the real bundled Worker with an in-memory SQLite D1 adapter, not Cloudflare production.

## Prioritized findings

### LIVE-01 · P1 · Live Bali cart currently refuses all order requests

**Evidence:** live desktop/mobile browser and public GET. **Confidence:** high.

**Impact:** Customers can browse and add tea but the cart says the store cannot take orders; order-request submission is disabled. This blocks the intended inquiry-led journey before WhatsApp/email handoff.

**Reproduce / trace:** Open https://teajia.com/shop, search Y562, open it, add 50g, open the order. Both widths showed the refusal. Public GET /api/s/teajia-bali returned can_be_paid:false. No customer details or orders were submitted.

**Smallest remedy:** Owner: inspect the linked published Tea Master/payment destination and restore a published payment method if the store should accept orders. Do not remove the guard without a product decision. **Size:** small operational check; exact missing configuration not available through public data. **Dependencies / limits:** Public API does not distinguish missing recipient, unpublished profile, or missing payment method. Private admin configuration and intended closure state were not read. This is a verified operational state, not a proved recent regression.

**Source:** `src/App.tsx:1437`, `src/components/shared/PublicCart.tsx:286`, `src/components/shared/PublicCart.tsx:380`, `worker/src/index.ts:18035`, `worker/src/index.ts:20112`.

**Evidence files:** [live-cart-390.png](evidence/live-cart-390.png), [live-cart-1440.png](evidence/live-cart-1440.png), [public-focused.json](evidence/public-focused.json), [live-store-readiness.json](evidence/live-store-readiness.json).


### BIZ-01 · P1 · Admin product adapter collapses inherited freight and explicit zero values

**Evidence:** actual React product hook + synthetic raw Worker row. **Confidence:** high.

**Impact:** NULL freight becomes a pinned free rate in admin; zero retail override becomes unset and zero stock threshold becomes 100. This immediately corrupts display/preview. Duplication then treats that zero as an explicit rate and can persist free freight in the new product. Existing server prices are not proved to have changed just by reading.

**Reproduce / trace:** Feed useProducts a Worker row with shipping_rate_per_kg null, fixed_retail_price_usd 0, low_stock_threshold 0.

**Smallest remedy:** Preserve null versus zero in the product adapter and add focused adapter cases. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/hooks/useAdminData.ts:49`, `src/admin/hooks/useAdminData.ts:65-66`, `src/admin/components/inventory/InventoryRow.tsx:273-289`, `src/admin/components/ProductEditPanel.tsx:1156-1166`, `src/admin/components/InventoryView.tsx:1252-1255`, `worker/src/index.ts:2520-2554`, `src/admin/components/AddProductModal.tsx:413`.

**Evidence files:** [adapter-repro.json](evidence/adapter-repro.json), [adapter-fixture.tsx](evidence/adapter-fixture.tsx).

**Detailed inspection:** [business.md](business.md).

### SEC-01 · P1 · Closed stores still serve public products and events

**Evidence:** in-memory D1; independently rerun. **Confidence:** high.

**Impact:** Private or suspended account catalog and event schedule remain available to unauthenticated callers who know the slug.

**Reproduce / trace:** In local D1, seed an account with public_enabled=0 or status=suspended plus one public product and active event. GET /api/s/:slug returns 404; GET /api/s/:slug/products and /events both return 200 with content.

**Smallest remedy:** Use getPublicAccountIdBySlug for both public child routes and add closure regression cases. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `worker/src/index.ts:591`, `worker/src/index.ts:20103`, `worker/src/index.ts:20187`, `worker/src/index.ts:20195`.

**Evidence files:** [manager-security-store.log](evidence/manager-security-store.log), [security-store-visibility.mjs](evidence/security-store-visibility.mjs).

**Detailed inspection:** [security.md](security.md).

### SEC-02 · P1 · Private events are discoverable and reveal their address

**Evidence:** in-memory D1; independently rerun. **Confidence:** high.

**Impact:** Unauthenticated discovery includes events explicitly marked private, and the public detail route returns address_text and venue context.

**Reproduce / trace:** In local D1, seed a future active event with public_visibility=private, network_discovery=0, and address_text. GET /api/events and /api/s/:slug/events include it; GET /api/events/:slug/public returns its address.

**Smallest remedy:** Define and apply shared public event visibility predicates for discovery, direct detail, and RSVP, including an active/public host account gate. **Size:** medium. **Dependencies / limits:** Apply discovery versus direct-link policy deliberately: private must not be publicly discoverable; unlisted may permit direct links. Schema enum at worker/schema.sql:1572 and existing public-event predicate at worker/src/index.ts:10742 establish the distinction. No real private address was queried.

**Source:** `worker/src/index.ts:10676`, `worker/src/index.ts:10686`, `worker/src/index.ts:10827`, `worker/src/index.ts:10854`, `worker/src/index.ts:20217`.

**Evidence files:** [manager-security-event.log](evidence/manager-security-event.log), [security-private-event.mjs](evidence/security-private-event.mjs).

**Detailed inspection:** [security.md](security.md).

### SEC-03 · P1 · Shop collections disclose hidden products and closed stores

**Evidence:** in-memory D1; independently rerun. **Confidence:** high.

**Impact:** Public shop collection discovery can reveal active products whose is_public and shown_in_shop flags are both zero, including after the host store closes. The explicit publication explains initial inclusion but should not bypass subsequent public-discovery privacy flags. Whether a deliberately shared recipient link may retain hidden items is a separate policy question; the confirmed remediation target is /api/collections/shop.

**Reproduce / trace:** In local D1, seed private store, hidden active product (is_public=0, shown_in_shop=0), active collection and shop publication. GET /api/collections/shop and /api/public/c/:slug both return the product.

**Smallest remedy:** Gate shop publications by open accounts and public, shown products; separately define whether recipient links may include private products. **Size:** medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `worker/src/index.ts:23392`, `worker/src/index.ts:23424`, `worker/src/index.ts:23750`, `worker/src/index.ts:23792`.

**Evidence files:** [manager-security-collections.log](evidence/manager-security-collections.log), [security-public-collections.mjs](evidence/security-public-collections.mjs).

**Detailed inspection:** [security.md](security.md).

### BIZ-02 · P1 · Stale order lines can overwrite a different pending order

**Evidence:** actual React editor + mocked load failure and captured save payload. **Confidence:** high.

**Impact:** A pending order can have its lines, prices, and stock reservations replaced by another order’s lines.

**Reproduce / trace:** Open A and let its item request finish; close; open B in the same mounted EditOrderModal; reject B’s item request. It changes customer fields to B, retains A’s lines, clears fetching, and enables Save. Captured updateItems payload targets B with tea-a. This sequence needs no artificial race; a normal failed request is sufficient. The alternate late-A-response race is source-only.

**Smallest remedy:** Clear lines before loading, ignore stale responses, and block save after load error. **Size:** small-medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/components/EditOrderModal.tsx:53-77`, `src/admin/components/EditOrderModal.tsx:107-127`, `src/admin/components/OrdersView.tsx:1167-1172`, `worker/src/index.ts:6259-6309`.

**Evidence files:** [stale-order-editor.json](evidence/stale-order-editor.json), [stale-order-editor.png](evidence/stale-order-editor.png), [editor-fixture.tsx](evidence/editor-fixture.tsx).

**Detailed inspection:** [business.md](business.md).

### BIZ-03 · P1 · Save plus Share can create duplicate invoices after PDF/share failure

**Evidence:** actual React invoice modal/PDF failure + mocked creates; separate real Worker/in-memory D1 persistence proof. **Confidence:** high.

**Impact:** The invoice exists before PDF/share work. PDF failure leaves the creation form open with a failure toast; retry creates another invoice. The browser fixture hit a real PDF renderer hasOwnProperty error before navigator.share; cancellation was not browser-observed. The share promise is awaited inside the same try with no AbortError exception, so cancellation follows the same source path.

**Reproduce / trace:** Click Save + Share in the supplied fixture twice. Observed: two mocked create calls, two renderer-failure toasts, no success/close. Independently submit the same synthetic Draft invoice twice to the real bundled Worker with in-memory D1: 201/201, distinct UUIDs and invoice numbers 00001/00002. No request-level idempotency key is consumed by this endpoint. The saving flag prevents simultaneous clicks only, and resets after the PDF error.

**Smallest remedy:** Commit UI success after invoice create; retry sharing separately without another create. **Size:** small-medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/components/QuickInvoiceModal.tsx:419-457`, `worker/src/index.ts:5199-5275`.

**Evidence files:** [invoice-share-failure.json](evidence/invoice-share-failure.json), [invoice-repro.log](evidence/invoice-repro.log), [invoice-persistence.log](evidence/invoice-persistence.log), [invoice-persistence.mjs](evidence/invoice-persistence.mjs).

**Detailed inspection:** [business.md](business.md).

### BIZ-04 · P1 · Unscoped persisted query keys can show prior-store financial and event data

**Evidence:** actual PendingView + account switch/invalidation and injected fetch error. **Confidence:** high.

**Impact:** PendingView retains account A’s customer/order data when account B’s refetch fails; its unscoped key survives account-switch invalidation. Sensitive disk-persistence exposure is established by the persister allow rules, not a separate observed logout incident. This is client-cache isolation, not a demonstrated server authorization bypass.

**Reproduce / trace:** Load pending data in A, switch to B, delay or fail B request, open Pending tab.

**Smallest remedy:** Key private queries by account and user, gate display by token scope, and exclude or purge sensitive persisted data. **Size:** medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/components/ActivityView.tsx:29-36`, `src/admin/components/PendingView.tsx:25-34`, `src/admin/hooks/useEventData.ts:155-161`, `src/admin/views/VendorProfileView.tsx:95-100`, `src/admin/components/AccountSwitcher.tsx:75-80`, `src/index.tsx:24-27`, `src/index.tsx:43-68`.

**Evidence files:** [cache-repro.json](evidence/cache-repro.json), [cache-repro.png](evidence/cache-repro.png), [cache-fixture.tsx](evidence/cache-fixture.tsx).

**Detailed inspection:** [business.md](business.md).

### CONTENT-01 · P1 · Article save can undo a successful publish

**Evidence:** actual React editor; delayed mocked update commits after mocked publish. **Confidence:** high.

**Impact:** The editor displays Published and an Article published toast while a delayed pre-publish content update writes status=draft. The fixture reproduces request ordering and UI contradiction; ordinary Worker updates accept the status field, so that order can persist draft.

**Reproduce / trace:** Edit an existing draft; let auto-save start; publish before save settles; allow publish to commit before the older update. The toast says published while the row ends as draft.

**Smallest remedy:** Serialize save and publish; flush pending content before publish and remove publication status from ordinary autosaves. **Size:** medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/components/ArticleEditorModal.tsx:545`, `src/admin/components/ArticleEditorModal.tsx:567`, `src/admin/components/ArticleEditorModal.tsx:606`, `src/admin/components/ArticleEditorModal.tsx:763`, `worker/src/index.ts:21991`, `worker/src/index.ts:22012`.

**Evidence files:** [article-publish-race.json](evidence/article-publish-race.json), [article-publish-race.png](evidence/article-publish-race.png), [article-fixture.tsx](evidence/article-fixture.tsx).

**Detailed inspection:** [content-gap.md](content-gap.md).

### OPS-03 · P1 · Manual retry can double-receive a partial stock delivery

**Evidence:** actual receipt panel + API retry-key capture; separate Worker/in-memory D1 stock proof. **Confidence:** high.

**Impact:** The second click uses a new key and can add another 5 to stock and the receipt ledger.

**Reproduce / trace:** Receive 5g of an expected 20g; let write succeed and fail list refresh. The panel still shows 0 received/20 remaining and keeps the typed 5. Click Receive again: actual API creates a different key. Separate real Worker D1 probe accepts the two 5g intents and records 10g on hand. A repeated same-key request is correctly deduplicated; the problem is manual retry identity.

**Smallest remedy:** Keep the intent's idempotency key until a confirmed result and block new receives on stale data pending reconciliation. **Size:** small-medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/components/inventory/IncomingReceiptsPanel.tsx:12-28`, `src/admin/components/inventory/IncomingReceiptsPanel.tsx:49-54`, `src/lib/api.ts:1565`, `worker/src/index.ts:14928-14944`.

**Evidence files:** [receipt-retry.json](evidence/receipt-retry.json), [receipt-retry.png](evidence/receipt-retry.png), [receipt-persistence.log](evidence/receipt-persistence.log), [receipt-persistence.mjs](evidence/receipt-persistence.mjs).

**Detailed inspection:** [operations-gap.md](operations-gap.md).

### SEC-04 · P2 · Incident intake trusts unverified tenant header

**Evidence:** in-memory D1 worker reproduction. **Confidence:** high.

**Impact:** Any signed-in user can attribute an incident to another account; global signature dedupe can alter count, severity, and resolved state of an existing incident.

**Reproduce / trace:** In local D1, user A belongs only to account A. POST /api/incidents with user A's JWT and X-Teajia-Account: account-b returned 201; the saved incident has account_id=account-b.

**Smallest remedy:** Resolve account through live membership or store null for an untrusted global client report; review dedupe key tenancy. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `worker/src/index.ts:26234`, `worker/src/index.ts:26244`, `worker/src/incidents.ts:128`.

**Evidence files:** [security-incident-tenant.log](evidence/security-incident-tenant.log), [security-incident-tenant.mjs](evidence/security-incident-tenant.mjs).

**Detailed inspection:** [security.md](security.md).

### BIZ-05 · P2 · Product story route casts raw Worker rows to camelCase Product and crashes

**Evidence:** authenticated local sandbox browser using raw products API. **Confidence:** high.

**Impact:** Opening a product story fails when pricePerGramUSD.toFixed is called on undefined.

**Reproduce / trace:** Open /admin/products/:id/story for any product returned by GET /api/products.

**Smallest remedy:** Reuse the shared admin product adapter and route-test a raw Worker response. **Size:** small-medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/views/ProductStoryView.tsx:244-250`, `src/admin/views/ProductStoryView.tsx:613`, `src/lib/api.ts:1742-1745`, `worker/src/index.ts:2520-2554`.

**Evidence files:** [admin-final-check.json](evidence/admin-final-check.json), [product-story-crash.png](evidence/product-story-crash.png).

**Detailed inspection:** [business.md](business.md).

### BIZ-06 · P2 · Vendor profile displays zero economics and matches sales as purchases

**Evidence:** source trace. **Confidence:** high.

**Impact:** Vendor names, stock value, cost totals, and purchase history are false or missing.

**Reproduce / trace:** Open an existing vendor with products and a purchase order; compare raw endpoint fields and profile.

**Smallest remedy:** Define a vendor product DTO/adapter and read purchase orders or receipts by vendor identity. **Size:** medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `worker/src/index.ts:9027-9040`, `src/admin/views/VendorProfileView.tsx:88-127`, `src/admin/views/VendorProfileView.tsx:293-330`, `worker/src/index.ts:20235-20262`.

**Detailed inspection:** [business.md](business.md).

### BIZ-07 · P2 · Failed partner listing writes cannot be retried unchanged

**Evidence:** source trace. **Confidence:** high.

**Impact:** Stock, price, sample, or note edits that fail remain locally marked saved and are skipped on retry.

**Reproduce / trace:** Reject updateListing; blur the same unchanged field again.

**Smallest remedy:** Advance lastSaved only after success and keep a retryable dirty state on failure. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/views/PartnerListingEdit.tsx:425-467`, `worker/src/index.ts:24715-24725`.

**Detailed inspection:** [business.md](business.md).

### BIZ-08 · P2 · Admin uploads and MCP tokens page ignore sessionStorage token fallback

**Evidence:** source trace. **Confidence:** high.

**Impact:** A fallback authenticated session cannot upload event flyers or venue photos or manage MCP tokens.

**Reproduce / trace:** Block localStorage writes, sign in so token is stored in sessionStorage, then invoke those actions.

**Smallest remedy:** Use the shared authenticated request/header path. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/lib/api.ts:596-618`, `src/lib/api.ts:2454-2465`, `src/lib/api.ts:2488-2497`, `src/admin/views/MCPTokensView.tsx:52-58`, `worker/src/index.ts:12697-12700`, `worker/src/index.ts:12911-12914`.

**Detailed inspection:** [business.md](business.md).

### PUB-01 · P2 · Product links turn inventory outages into Not Found

**Evidence:** local browser, injected catalogue 503. **Confidence:** high.

**Impact:** Valid shared product links appear removed during inventory API failures and have no retry action.

**Reproduce / trace:** See the precise source trace and workstream appendix.

**Smallest remedy:** Branch on inventory query error and expose refetch; reserve Not Found for a successful query without the item. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/pages/ProductPage.tsx:90`, `src/pages/ProductPage.tsx:179`, `src/components/Shop.tsx:537`.

**Evidence files:** [public-focused.json](evidence/public-focused.json), [product-outage.png](evidence/product-outage.png).

**Detailed inspection:** [public-contracts.md](public-contracts.md).

### PUB-02 · P2 · Storefront product failures are presented as a store with no stock

**Evidence:** local browser, injected store catalogue 503. **Confidence:** high.

**Impact:** A failed store catalog request tells customers the merchant has not published inventory and offers no retry.

**Reproduce / trace:** See the precise source trace and workstream appendix.

**Smallest remedy:** Pass the products query failure and refetch through, separating failure from successful empty inventory. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/components/storefront/Storefront.tsx:56`, `src/components/storefront/Storefront.tsx:191`, `src/components/storefront/Storefront.tsx:256`.

**Evidence files:** [public-focused.json](evidence/public-focused.json), [store-outage.png](evidence/store-outage.png).

**Detailed inspection:** [public-contracts.md](public-contracts.md).

### PUB-03 · P2 · Find-a-table review badge always falls back to Verified

**Evidence:** live desktop/mobile 400 response + source contract. **Confidence:** high.

**Impact:** The review query is rejected and directory rows display an unsupported status; the count cannot represent distinct teas per store.

**Reproduce / trace:** See the precise source trace and workstream appendix.

**Smallest remedy:** Use a directory-level aggregate endpoint or remove the unsupported badge; distinct tea counting needs a defined aggregate contract. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/components/storefront/FindATable.tsx:28`, `src/components/storefront/FindATable.tsx:30`, `worker/src/index.ts:16780`, `src/components/storefront/FindATable.tsx:37`, `src/components/storefront/FindATable.tsx:42`, `src/components/storefront/FindATable.tsx:219`.

**Evidence files:** [browser-scan.json](evidence/browser-scan.json).

**Detailed inspection:** [public-contracts.md](public-contracts.md).

### CONTENT-02 · P2 · Overlapping saves can create duplicate new articles

**Evidence:** source trace. **Confidence:** high.

**Impact:** Overlapping saves can create duplicate new articles

**Reproduce / trace:** Type a new title, click Save as the auto-save timer fires, and keep both create responses pending. Both calls can submit with a null article ID.

**Smallest remedy:** Share one in-flight create promise, cancel a pending debounce before manual save, then update the returned ID. **Size:** small-medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/components/ArticleEditorModal.tsx:567`, `src/admin/components/ArticleEditorModal.tsx:594`, `src/admin/components/ArticleEditorModal.tsx:778`, `worker/src/index.ts:21918`.

**Detailed inspection:** [content-gap.md](content-gap.md).

### CONTENT-03 · P2 · Failed event detail request leaves a permanent loading spinner

**Evidence:** source trace. **Confidence:** high.

**Impact:** Failed event detail request leaves a permanent loading spinner

**Reproduce / trace:** Open an event detail URL while its GET returns an error; after the query settles the spinner remains, with no retry action.

**Smallest remedy:** Branch on query error and missing event, with retry; show spinner only while loading. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/hooks/useEventData.ts:92`, `src/admin/components/EventDetail.tsx:289`, `src/admin/components/EventDetail.tsx:384`.

**Detailed inspection:** [content-gap.md](content-gap.md).

### OPS-01 · P2 · Intake can silently lose the purchase record

**Evidence:** source trace. **Confidence:** High from source inspection; runtime reproduction pending.

**Impact:** Products are created and success is shown, but the requested purchase record is absent; local staging is cleared and server draft closure is attempted.

**Reproduce / trace:** Enable Save purchase record; let /api/products/bulk succeed and /api/purchase-orders fail for a staged vendor with cost/order data.

**Smallest remedy:** Preserve and expose partial success, retain purchase data for retry, and defer draft closure until requested records finish. **Size:** small-medium. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/views/IntakeWorkspace.tsx:354-357`, `src/admin/views/IntakeWorkspace.tsx:381-406`.

**Detailed inspection:** [operations-gap.md](operations-gap.md).

### OPS-02 · P2 · Retrying a failed contact save can create a duplicate

**Evidence:** source trace. **Confidence:** High from source inspection; runtime reproduction pending.

**Impact:** The UI reports save failure after a persisted create; retry posts a second contact with a new ID.

**Reproduce / trace:** Let POST /api/customers succeed, fail the subsequent relationships PUT, then click Save again.

**Smallest remedy:** Use the create payload's existing relationship write and remove the redundant follow-up PUT; retain the created ID if later work needs retry. **Size:** small. **Dependencies / limits:** No architecture change required; targeted regression coverage.

**Source:** `src/admin/components/CustomersView.tsx:1454-1469`, `worker/src/index.ts:8702-8738`, `worker/schema.sql:170-189`.

**Detailed inspection:** [operations-gap.md](operations-gap.md).

### UI-01 · P3 · Mobile inventory Personal label is clipped

**Evidence:** local 390px browser screenshot and element measurement. **Confidence:** high.

**Impact:** The final letters of Personal are cut off in the packed lifecycle tabs beside Flagged, making navigation harder to read. No page-level horizontal overflow was seen.

**Reproduce / trace:** At 390px width open local /admin/stock; Personal has clientWidth 50 and scrollWidth 52 and is visibly truncated.

**Smallest remedy:** Give lifecycle labels enough flex space or wrap/compact their surrounding controls while preserving the existing labels. **Size:** small. **Dependencies / limits:** Visual fix should be checked at 390px and tablet width; do not change approved navigation labels.

**Source:** `src/admin/components/InventoryView.tsx`.

**Evidence files:** [verified-390-stock.png](evidence/verified-390-stock.png), [admin-final-check.json](evidence/admin-final-check.json).


## Small UI defects and observations

UI-01 is the confirmed small layout defect. Anonymous `/shop` also makes two unnecessary protected `/api/products` calls, returning 401 while its proper public catalogue loads; `useAdminOverlay.ts:21` omits the computed `enabled` gate. This is request noise, not a broken catalogue. On the inspected mobile product page the order dock ended at y=836 and navigation began at y=836, so it cleared the bottom navigation. Inventory remained scrollable and document width matched the viewport at 390, 768 and 1440 pixels. The inventory ledger itself is horizontally scrollable by existing design/tests; that is not reported as a new defect. Missing product photography is excluded.

## Unconfirmed concerns and known debt

CONTENT-04 needs a normal user navigation reproduction before prioritization; the component state trace alone is not proof that users reach it in that mounted state. SEC-05 concerns OAuth defaults potentially minting a token the live bundle check immediately rejects; no privilege escalation was demonstrated. Collection publication after response loss, simultaneous Wisdom review, multi-chunk intake interruption, and two-operator receipt conflicts remain untested, not defects asserted here.

The documented reading-memory/saved-story discrepancy and incomplete real-world launch validation remain known debt. Older architecture claims about missing ownership/bundle audit and weak suspended-account enforcement were not repeated as findings without current evidence. The initial local sandbox missed the freight columns: that was fixture staleness, not a live outage. A separate temporary database copy received migration 0009 only for browser inspection; its catalogue and rates remain historical fixtures, not today's shop values.

## Coverage matrix

There are 160 route declarations (including aliases and dynamic patterns) and 362 matched literal REST registrations. These are inventories, not a completeness score. The sweep captured 48 live public and 100 local admin navigations; initial admin reads hit a stale-schema 500, so those samples are explicitly limited. Seven high-value admin routes were subsequently inspected against the repaired isolated fixture at desktop, tablet, and mobile widths. Parameterized routes and workflows are covered separately by the listed fixture journeys.

| Functional family | Evidence actually obtained | Highest-risk untested journey / limit |
|---|---|---|

| Storefront/search/filter/product/cart | Live desktop/mobile search, product, add, cart; shop fixtures; source | Actual final inquiry submission/WhatsApp delivery blocked by LIVE-01 and audit no-send boundary. |

| Store directories/Tea Masters/payments | Live directory/person shells; mobile identity/favorites/payment fixtures; source | Real linked recipient configuration and successful payment not read or exercised. |

| Auth/session/account/permissions | Local signed-in owner; email-code/account-panel fixtures; JWT/MCP source + worker tests | Real Google OAuth, email delivery, all roles in every admin module, concurrent session revocation. |

| Inventory/add/edit/stock/receiving | Real local catalogue at 1440/768/390; scroll measurements; movement/import/receipt fixtures; adapter failure repro | Real warehouse reconciliation; multi-operator receive/cancel conflicts; production shelf correction. |

| Currency/freight/markup | Shared arithmetic source/worker tests; local currency/settings; actual adapter repro | Real daily feed failure and production currency-provenance backlog. |

| Invoices/orders/customer money | Desktop/mobile order/payment fixtures; stale-edit and PDF failure fixtures; real Worker local invoice persistence | Real payment claims/fulfillment/delivery; native OS share cancellation not invoked. |

| Contacts/vendors/customer profiles | Source save/relationship/vendor contract review; local people shell | Mixed partial failure on a full real customer profile; live customer data deliberately not accessed. |

| Multi-store/network/access/wholesale | Operator multi-store fixtures; local network/access; authority source; pending cache repro | Full bilateral wholesale fulfillment with two real operators, ownership transfer end-to-end. |

| Curate/import/intake | Import/receipt-possession fixtures; source idempotency/finalization and partial-save traces | Interrupted multi-chunk intake and live provider/OCR/transcription behavior. |

| Events/venues/sessions/RSVP | Live public shells; local admin shells; event-to-article fixtures; public privacy D1 probes | Live RSVP/email/join-code delivery; every event control; ordinary briefing route-reuse concern. |

| Editorial/contributors/read | Live read pages; contributor publishing/event essay fixtures; actual article race fixture | Editorial quality and long-content pagination matrix; two-user editing conflicts. |

| Collections/sharing/inbound | Collection public/inbound fixtures; create/edit/publish source; hidden-item D1 probes | Lost-response person publication and actual cross-store acceptance delivery. |

| Wisdom/reference/catalog | Live taxonomy indexes; local admin shell; proposal/review/override source | Two-operator taxonomy review conflicts; preview-only Tea Reference revision mode not exercised. |

| Personal Journal/Favorites/Cellar/samples | Personal journey/account fixtures and direct-link shells | Complete authenticated production personal history, device/offline sync conflicts. |

| MCP/OAuth/API/security | 362 literal REST route declarations inventoried; family-based auth/tenancy source; 1410 worker tests; targeted D1 probes | Not every endpoint/tool executed; no live mutation or exploit probes, exhaustive fuzzing, or penetration-test claim. |

| Platform/admin/tools/settings | Local route sweep including platform/audit/token/settings shells; selected source security checks | Actual privilege/ownership/token changes, provider credentials and production audit contents. |

| Responsive/accessibility/performance | Live 1440/390; admin 1440/768/390; focused keyboard/focus restoration tests; build output | Screen-reader audit, real touch hardware, network-throttled performance and all overlay combinations. |


Machine-readable maps: [coverage.json](coverage.json), [route-inventory.json](route-inventory.json), [api-inventory.json](api-inventory.json). Raw browser navigation states are in [browser-scan.json](evidence/browser-scan.json); corrected admin measurements in [focused-browser.json](evidence/focused-browser.json). A 200 HTML response or absence of a console exception does not prove a feature works.

## Checks and exact failures

- `npm run lint`: passed; `npm run lint:colors`: passed with non-blocking legacy styling notices; `npm run build`: passed in 37.18s. The build warns about large chunks: AdminApp 2,071.87 kB / 512.14 kB gzip, PDF renderer 1,297.72 / 424.92, another index chunk 1,087.11 / 304.23. No measured performance SLO failure is claimed.
- `npm run test:worker`: **93 files, 1,410 tests passed**. These include important SQL/unit/source guards, but do not cover the reproduced frontend failure sequences. Focused workstream checks were additional existing tests, not new tests.
- Initial selected browser run: **123 passed, 7 failed, 1 intentionally skipped, 17 did not run**. It used the isolated fixture server at port 7802, Desktop Chrome + Mobile Chrome, three workers. [Exact log](evidence/browser-tests.log).
- Focused follow-up: the 17 previously blocked mobile tests plus the navigation failure **all 18 passed**; no successful initial tests were repeated. [Log](evidence/browser-followup.log).
- Additional previously uncovered content/operator journeys: **71 passed, 1 desktop-inapplicable mobile-input test skipped**. Contributor publishing, event essays, public/inbound collections, inventory import, Curate import/receipt possession, and stock movement/focus. [Log](evidence/gap-tests.log).

| Initial failure | Exact result | Adjudication |
|---|---|---|
| Desktop inventory lifecycle, line 226 | Record tasting button not found after clicking whole row | Error snapshot shows Source: Chen Family panel: row-center click hit the embedded source control. Source/UI still expose tasting after explicit row selection; not proof tasting is absent. Replace ambiguous row-center targeting in test. |
| Mobile inventory lifecycle, line 236 | Continue tasting button not found after next whole-row click | Same broad click-target problem; do not count as a confirmed removed action. Existing movement tests for explicit controls passed. |
| Desktop inventory currency, line 299 | Empty select instead of USD | Fixture does not mock `/api/rates` and now cannot rely on deleted invented-rate fallbacks. This is a missing-fixture-data failure, not proof live currencies are blank. |
| Mobile inventory currency, line 299 | Empty select instead of USD | Same fixture gap. Corrected local currency route and real rate response were inspected separately. |
| Desktop product detail, line 131 | Expected `$10` inside amount button; actual `50g0.19/g` | Total is now a sibling in the order dock. Rate is arithmetically correct; selector/expectation is stale. Live product and cart show the same total. |
| Mobile product detail, line 131 | Same mismatch | Same stale assertion; no pricing defect established by this failure. |
| Mobile Shop health, line 143 helper | Execution context destroyed during page.evaluate | Follow-up passed. Treat as navigation timing/test instability, not an observed persistent product crash. This serial-group failure prevented the later 17 checks; all were recovered. |

Every original failure is retained; the report does not turn a red run into an all-green claim. Commands and source fixture scripts remain alongside the logs. Fixtures write only mocked data or in-memory D1.

## Dependency and runtime evidence

`npm audit --omit=dev --json` reports five affected dependency entries (3 high, 2 moderate), not five exploitable application vulnerabilities. The React Router advisory applies only to unstable RSC APIs; this checkout uses a Vite client and BrowserRouter, so that exploit path was not found. See the [maintainer advisory](https://github.com/remix-run/react-router/security/advisories/GHSA-qwww-vcr4-c8h2). Brace-expansion denial-of-service entries and uuid buffer bounds advisory need call-path reachability analysis before claiming exposure; none was demonstrated here. Sources: [brace-expansion advisory](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [follow-up advisory](https://github.com/advisories/GHSA-rgw5-rvv9-x895), [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Preserve normal dependency maintenance as a separate small task; do not blindly accept npm's suggested ExcelJS downgrade. [Raw audit](evidence/dependency-audit.json).

The PDF renderer threw a real `hasOwnProperty` error in the mounted current-version invoice fixture; BIZ-03 records the observed result without guessing its underlying dependency cause. No secret values or real customer/order records were collected.

## Ordered remediation batches

1. **Operational availability:** owner checks LIVE-01 and restores the intended published recipient/payment configuration if ordering should be open. Verify cart readiness and an approved end-to-end inquiry; no automatic configuration change is proposed.
2. **Public privacy — first urgent engineering lane, alongside money/record integrity:** SEC-01/02/03, then SEC-04. Use shared public-account and visibility predicates with explicit private/unlisted policy. Verify no public projection expands to cost/vendor/customer fields. Local closure/private fixtures should be regression tests.
3. **Money and record integrity — equally urgent engineering lane:** BIZ-01/02/03/04 and OPS-03. Preserve absence/zero at the adapter; distinguish commit from presentation/refetch; retain mutation identity; scope private caches. Add failure-injection cases matching the evidence. Each is a bounded change; no migration is inherently required.
4. **Publishing/intake save integrity:** CONTENT-01/02, OPS-01/02, BIZ-07. Serialize save/publish and surface partial success. Reconcile existing duplicate/missing records only with a separate preview and owner approval.
5. **Broken detail/failure UX:** BIZ-05/06/08, PUB-01/02/03, CONTENT-03, UI-01. Shared DTOs, honest failure states, shared auth headers, and one small mobile layout correction.
6. **Verification maintenance:** repair the six deterministic stale/underspecified browser assertions, investigate intermittent navigation timing, and evaluate dependency fixes with reachability and focused tests. Leave the uncertain concerns separate until reproduced.

Sizes are relative: small = roughly half a day or less, medium = around one to two days including regression verification; estimates are not commitments and exclude production data cleanup. No speculative architecture redesign is recommended.

## Supporting reports

[Security](security.md) · [Business and admin](business.md) · [Public contracts](public-contracts.md) · [Content follow-up](content-gap.md) · [Operator follow-up](operations-gap.md) · [All findings JSON](findings.json) · [Exact verification commands](VERIFICATION.md).

The findings/coverage in this synthesis supersede workstream severity and confidence labels where explicitly adjudicated. The workstream reports preserve original inspection notes. This audit is a broad, evidence-based inspection with named gaps, not an exhaustive penetration test or proof of every business workflow.
