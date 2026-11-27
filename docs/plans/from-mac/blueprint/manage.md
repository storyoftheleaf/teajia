# Manage and platform blueprint

Current implementation traced from local checkout `4f884507`, published acceptance evidence and the [November 16 decisions](../../todo/plans/manage-rebuild-decisions.md). Each wireframe in the [atlas](wireframes.html) shows reading order. Routes with `:id` or other placeholders need a valid scoped record. These are source-based wireframes with cited fixtures and earlier acceptance evidence. **Current** means implemented in the inspected checkout, **Partial** means implementation with a specified delivery gap, **Proposed** means a future interaction, and **Reference** means retained for comparison.

## Work across rooms

| Operator task | Route sequence and shared record | What to prove |
| --- | --- | --- |
| Buy tea on a trip | [Source](#ops-source) → [Library](#ops-library) → [Buy](#ops-source-buy) / [Orders](#ops-curate-orders) → [Purchases](#ops-purchases) → [Arrival](#ops-receipt) → [Stock holding](#ops-stock-record) | One supplier and tea hold the quote, evidence, ordered and outstanding amounts. The same draft gets the received stock once. |
| Buy from paperwork | [Intake](#ops-intake) → [Tracking](#ops-logistics) → [Match](#ops-match-purchase) → [Confirm](#ops-receipt) | An interrupted commit resumes. Old intake links its original movement. Collection-warehouse arrival does not alter owned stock. |
| Sell tea | [Stock readiness](#ops-stocks-publish) → Shop → [Waiting](#ops-sales-waiting) → [Invoice](#ops-sales-invoice) → buyer order status | Public availability and checkout depend on the correct stock, shop and ownership. Take one verified order through payment, movement and shipment. |
| Host tea | [Sessions](#ops-sessions) → [Host record](#ops-event) → optional [structured tasting](#ops-group-tasting) or post-session notes → [Guest notes](#ops-guest-notes) | Guest participation stays attached to its own session. Publication gets a separate editorial action. |
| Keep tea evidence and publish | [Source evidence](#ops-source-evidence) → [Library](#ops-library) → [Stock story](#ops-stock-story) → [Wisdom](#ops-wisdom) or [Publish](#ops-publish) | Confirm canonical identity and approved attribution before public reuse. See the [editorial blueprint](editorial.md) for the Magazine flow. |
| Run another shop | [Your Table](#ops-table) → [Settings](#ops-settings) / [Members](#ops-members) → [Network](#ops-network) → [Wholesale](#ops-sales-wholesale) → [Timeline](#ops-wholesale-timeline) | Both operators see correct funds, invoices and owned stock. Denied links do not leak data from the other shop. |

## Routes, aliases and access

The current first-level Manage doors are Curate, Stock, Sales, People, Sessions, Publish and Settings. Today opens from Manage for owners. Desktop and phone use the same [room definitions](../../src/components/manageNav.ts). Account/location switching is in Your Table. Route gates are based on active membership, bundles and privileged roles, with legacy admin fallback in [AdminApp](../../src/admin/AdminApp.tsx). The page and Worker may narrow permissions for individual actions. The Stock route owns its scrolling height chain. Keep one site bottom bar and inspect long mobile labels without horizontal overflow.

| Inbound address or parameter | Owning screen |
| --- | --- |
| `/admin/home`, unmatched `/admin/*` | [Curate](#ops-source). The signed-in bare admin path is handled by shell navigation. |
| `/admin/compass-current`, `/admin/compass-playbook` | Both render the current [TeaCompass](#ops-source) component with query handling. |
| `/admin/compass?form=classic` | [Classic Source](#ops-curate-classic). |
| `/admin/curate/v2` | Redirects to the retained [Curate v2](#ops-curate-v2). |
| Curate `tab=capture`, `tab=samples`, `tab=sourcing` | [Source](#ops-source), with sample management separately controlled by `sampleOrder`. |
| Curate `tab=tasting`, `tab=browse`, `tab=library`, or `entry=:entryId` | [Library](#ops-library) tabs or focused tea. Personal tasting history uses `/account/journal`. |
| Curate `tab=buying`, `tab=ledger`, `tab=orders` | [Curate Orders](#ops-curate-orders). |
| `/admin/samples` | [Curate Samples](#ops-samples) via `sampleOrder=manage`. |
| `/admin/inventory`, `/admin/teaware`, `/admin/personal` | [Stock](#ops-stock), with incoming query preserved. |
| `/admin/catalog` | [Tea Glossary / Catalog](#ops-glossary) for non-platform accounts or [Stock](#ops-stock) for platform accounts. |
| Stock `incoming=1` without a receipt | [Purchases Coming](#ops-purchases) through `view=coming`. `receipt` opens the receipt panel. |
| `/admin/customers`, `/admin/sources`, `/admin/contact-tags` | [People](#ops-people). Tags sets `tab=tags`; /sources does not set `tab=sources`. Direct Supplier tab uses `/admin/people?tab=sources`. |
| `/admin/people?tab=team`, `tab=audit`, `tab=purchase-orders` | People forwards to [Members](#ops-members), [Audit](#ops-audit) and [Purchases](#ops-purchases). |
| `/admin/orders` | [Sales Orders](#ops-sales-orders) via `tab=orders`. |
| `/admin/records`, `/admin/activity-logs` | [Sales Ledger](#ops-sales-ledger) via `tab=log`. Pending and inquiries tab aliases land on [Waiting](#ops-sales-waiting). |
| `/admin/network/catalog`, `/admin/network/suggestions`, `/admin/network/adoptions` | [Network Catalog](#ops-network), [Suggestions](#ops-network-suggestions), [Adoptions](#ops-network-adoptions) tab query. |
| `/admin/network/wholesale` | [Sales Wholesale](#ops-sales-wholesale) through the Network tab alias; existing draft and timeline URLs still render in Network space. |
| `/admin/team`, `/admin/members` | [Members](#ops-members). |
| `/admin/settings`, `/admin/launch-playbook` | [Shop Settings](#ops-settings). |

## Order of delivery and consolidation candidates

1. **Finish the first operator’s two journeys.** The [working plan](../../WORKING_PLAN.md#delivery-queue) records production `94dc1a5e` for the receipt regression and recording recovery. The local 390 × 844 scenario used a 250 g order, a committed 100 g receipt behind an injected 502, 150 g due and the same private draft. Repeat the fresh sequence with actual phone audio and provider, then perform the first complete paid sale. Verify buyer and shop states after retries, partial payment, fulfillment, cancellation and refund.
2. **Use the existing holding as the destination.** M7 drafts triage already uses Stock, while Manage’s Drafts link leads to the separate `/admin/capture` writing desk. Compare parity, including import and review, before proposing a navigation change. Preserve M8’s two-name behavior. Complete browser, API and MCP parity for M9/M10. Keep historical sold-out addresses alive. Dense Stock browsing, supplier grouping and scroll re-entry need phone verification.
3. **Make records independently addressable.** M5 requires links that survive refresh and correct denial. Concrete gaps in the [route-reader guard](../../src/admin/guards/adminLinkReaders.test.ts) are Sales → Sessions without event ID, Sold Items → non-platform Catalog search, and Samples → Curate with unread `fromSample`. Existing invoice detail is local dialog state. Also compare deep links from People and Sessions, venue selection, audit findings and the Today rate link for a non-platform owner.
4. **Keep one supplier acquisition across its three readings.** Preserve Curate Orders as buying work, Purchases as shipment and confirmation, and Stock as physical movements. Validate matching legacy invoice rows, explicit historical movements, supplier-to-warehouse and warehouse-to-studio steps, and M13 freight proposal. Map each transitional word to the approved Request → Order → Sent terms. Move repeated actions into their owning record where all alternatives are verified.
5. **Tie structured tasting to the event that owns it.** The two host screens and Share/Live panes exist. Implement or prove M11’s explicit session attachment and opt-in ratings and results. Retain post-session notes and the T1–T8 tasting choices documented by Adrian. Keep existing page, guest and private journal transitions intact.
6. **Validate the second operator after the first.** Verify deliberate visibility, membership scope, person-first Tea Master onboarding and a real bilateral order. Keep per-shop Settings, Platform and the personal Your Table destinations distinct. Consider one clear doorway for global Members/Accounts only after comparing role, suspension and audit capabilities.

Any appearance change uses the [Manage review agreement](../../todo/plans/manage-rebuild.md), including 390 × 844 comparison for Source. Preserve current Library cards, one-tap actions and supplier context. Existing views with quiet or breakdown disclosures are current UI evidence; consolidation uses ordinary navigation for history. Shared [Tea UI patterns](../../docs/DESIGN_SYSTEM.md#tea-cards-detail-panels-and-tasting) apply where they preserve the approved baseline.

## Evidence for verification

| Theme | Focused checked-in guards and fixtures |
| --- | --- |
| Curate Source, Library and acquisition | [Source form](../../tests/curate-flow-form.spec.ts), [Source recovery](../../tests/curate-flow-repair.spec.ts), [Library](../../tests/compass-library.spec.ts), [Private files](../../tests/curate-private-files.spec.ts), [Order money](../../tests/curate-v1-order-money.spec.ts) |
| Stock and purchase | [Receipts and retry](../../tests/inventory-purchase-receipts.spec.ts), [Supplier purchase form](../../tests/supplier-purchase-form.spec.ts), [Draft names](../../tests/stock-draft-names.spec.ts), [Supplier sheet](../../tests/stock-supplier-sheet.spec.ts), [Inventory scroll](../../tests/inventory-scroll.spec.ts), [Sold-out restock](../../tests/sold-out-restock.spec.ts) |
| Sales and accounts | [Inquiry conversion](../../src/admin/components/ActivityView.convert.test.tsx), [Orders behavior](../../src/admin/components/OrdersView.behavior.test.ts), [Order detail](../../tests/order-detail.spec.ts), [Settings](../../tests/account-settings-ui.spec.ts), [Account switching](../../tests/account-switcher-multi-location.spec.ts) |
| Sessions and scoping | [Session tasting save](../../tests/session-tasting-save.spec.ts), [Event read failure](../../src/admin/components/EventDetail.failure.test.tsx), [Navigation and links](../../src/admin/guards/adminLinkReaders.test.ts), [Launch validation](../../docs/LAUNCH_VALIDATION.md) |

Use the [sandbox testing protocol](../../docs/claude/testing.md) for account workflows. Use production only for the already-authorized read or release acceptance path. A prototype or unit fixture proves its own boundary.

## Evidence by screen
<a id="ops-shell"></a>

### Manage shell and access gate

**Current** · `/admin` · Signed-in member with account access

[Open desktop and phone wireframes](wireframes.html#ops-shell)

- **Signed out** · Sign-in uses a validated admin return destination. Account mismatch rehydrates account state. Expiry clears it.
- **Denied** · A known gated route renders Access Restricted with a signed-in session lacking its grant. The account membership gate is distinct from that per-route state.
- **Capability navigation** · Settings lands on Members for an access manager. Today is an owner route. The active-table grant used for table doors can differ from legacy privileged rail visibility.

Sources · [src/admin/AdminApp.tsx](../../src/admin/AdminApp.tsx), [src/components/manageNav.ts](../../src/components/manageNav.ts), [src/components/navigationConnections.ts](../../src/components/navigationConnections.ts)

Related · [Today](#ops-today), [Curate · Source](#ops-source), [Stock · Shelf and saved views](#ops-stock), [Sales · Waiting](#ops-sales-waiting), [People · Directory and tags](#ops-people), [Sessions · Calendar and queue](#ops-sessions), [Settings · Shop and launch readiness](#ops-settings), [Settings · Members and access](#ops-members)

<a id="ops-today"></a>

### Today

**Current** · `/admin/dashboard` · Owner tier

[Open desktop and phone wireframes](wireframes.html#ops-today)

- **Quiet or failed** · Separate fetch states for attention, revenue and people. No requests and no sales have specific empty states; failed reads can be retried.
- **Missing rates** · Cost exposure excludes unsupported currencies. Today offers a Rates link though Rates requires a platform role. Confirm the door for a non-platform shop owner.
- **Definition** · Fulfilled sales group by invoice creation week over 26 weeks. They are sales value. Stock rows open the existing Stock record.

Sources · [src/admin/components/DashboardView.tsx](../../src/admin/components/DashboardView.tsx)

Related · [Sales · Waiting](#ops-sales-waiting), [Sales · Order list and filters](#ops-sales-orders), [Stock · Shelf and saved views](#ops-stock), [Stock · Holding and movements](#ops-stock-record), [People · Directory and tags](#ops-people), [Settings · Exchange rates](#ops-rates)

<a id="ops-source"></a>

### Curate · Source

**Current** · `/admin/compass?tab=sourcing&capture=tea` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-source)

- **Tea or teaware** · Capture a seller quote, source context, photographs and notes while in the shop. Teaware uses its own type fields and units. Entry and product-development queries can focus the record.
- **Notes microphone** · Keep saved note history beneath the decision. After a failed transcript, retry the same private recording. A local synthetic-audio test passed after a reload; actual phone and provider remain open.
- **Capture decision** · Sample seeds a 50 g acquisition and opens Buy. Taste opens a separate tasting flow. Blank cost and a typed 0 have different meanings. Upload and sync errors must preserve the record and prior evidence.
- **Visual baseline** · Current flow is the approved base. The phone checks cover decision position after tasting and the site bar behind the photo viewer. Compare any visible change with current screens at 390 × 844.

Sources · [src/components/TeaCompass/index.tsx](../../src/components/TeaCompass/index.tsx), [src/components/TeaCompass/CaptureCard.tsx](../../src/components/TeaCompass/CaptureCard.tsx), [src/components/curate/CaptureFlowLayout.tsx](../../src/components/curate/CaptureFlowLayout.tsx)

Related · [Curate · Buy or acquire a sample](#ops-source-buy), [Curate · Capture evidence and corrections](#ops-source-evidence), [Curate · Library](#ops-library), [Curate · Orders](#ops-curate-orders), [Curate · Samples workspace](#ops-samples)

<a id="ops-source-evidence"></a>

### Curate · Capture evidence and corrections

**Current** · `/admin/compass?entry=:entryId` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-source-evidence)

- **Privacy** · Notes, files, audio, raw transcripts and working material stay private; only explicitly reviewed content can be reapplied or reused. A recording retry retains the original audio and makes one note.
- **Recovery** · Duplicate hints, merge, field-level sync, decision undo and local recovery are working cases. Compare older browser snapshots and current scoped data before destructive edits.
- **Photo** · Library shows first photograph with count inside the thumbnail. The viewer can add another photo and owns the phone overlay.

Sources · [src/components/TeaCompass/CaptureCard.tsx](../../src/components/TeaCompass/CaptureCard.tsx), [src/components/TeaCompass/WorkingMaterialReview.tsx](../../src/components/TeaCompass/WorkingMaterialReview.tsx), [src/components/TeaCompass/ArTranscriptHandoff.tsx](../../src/components/TeaCompass/ArTranscriptHandoff.tsx), [src/components/curate/CurateRecordTools.tsx](../../src/components/curate/CurateRecordTools.tsx)

Related · [Curate · Source](#ops-source), [Curate · Library](#ops-library), [Intake workspace](#ops-intake), [Stock · Product story and evidence](#ops-stock-story)

<a id="ops-source-buy"></a>

### Curate · Buy or acquire a sample

**Current** · `/admin/compass?entry=:entryId` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-source-buy)

- **Intent** · A sample acquisition and a group tasting create different records. Keep Consideration, acquisition choice and supplier quote distinct.
- **Quote** · Distinguish per-quantity or conditional quotes from the display conversion. Keep the currency and quantity unit through order creation. Existing incomplete quotes need review.
- **Order handoff** · A placed supplier order is expected to create or link a private Stock draft and record ordered quantity. A purchase confirmation adds available stock through the receipt.

Sources · [src/components/TeaCompass/CaptureActionFooter.tsx](../../src/components/TeaCompass/CaptureActionFooter.tsx), [src/components/TeaCompass/OrderBar.tsx](../../src/components/TeaCompass/OrderBar.tsx), [src/components/TeaCompass/SampleOrderAction.tsx](../../src/components/TeaCompass/SampleOrderAction.tsx), [src/components/TeaCompass/acquisitionPricing.ts](../../src/components/TeaCompass/acquisitionPricing.ts)

Related · [Curate · Source](#ops-source), [Curate · Library](#ops-library), [Curate · Orders](#ops-curate-orders), [Purchases · Supplier tracking](#ops-purchases), [Purchases · Confirm arrival](#ops-receipt), [Stock · Holding and movements](#ops-stock-record), [Curate · Samples workspace](#ops-samples)

<a id="ops-library"></a>

### Curate · Library

**Current** · `/admin/compass?tab=library&entry=:entryId` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-library)

- **Preserved baseline** · Keep supplier sections, the colored type band, visible year and the card’s direct name, disposition, photo, Taste and pricing actions. Photo count sits inside the thumbnail.
- **Find and review** · Read the same saved tea by supplier, name, type or decision; the record link carries entry identity. Preserve supplier context and scroll on return.
- **Intake and outstanding arrival** · Imported records and manual tea can share review paths. The local partial-arrival exercise recorded the balance in Library. Supplier name, typed note and photo must survive the handoff.
- **Vocabulary** · M6 approved Considering, Chosen and Rejected and Supplier. Check visible copy across Source, Library and legacy flows.

Sources · [src/components/TeaCompass/BrowseView.tsx](../../src/components/TeaCompass/BrowseView.tsx), [src/components/TeaCompass/BrowseCard.tsx](../../src/components/TeaCompass/BrowseCard.tsx), [src/components/TeaCompass/LibraryFilterSheet.tsx](../../src/components/TeaCompass/LibraryFilterSheet.tsx), [src/components/TeaCompass/librarySupplierGroups.ts](../../src/components/TeaCompass/librarySupplierGroups.ts)

Related · [Curate · Source](#ops-source), [Curate · Capture evidence and corrections](#ops-source-evidence), [Curate · Buy or acquire a sample](#ops-source-buy), [Curate · Orders](#ops-curate-orders), [Purchases · Supplier tracking](#ops-purchases), [Stock · Holding and movements](#ops-stock-record), [Curate · Samples workspace](#ops-samples), [Intake workspace](#ops-intake)

<a id="ops-curate-orders"></a>

### Curate · Orders

**Current** · `/admin/compass?tab=orders` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-curate-orders)

- **Aliases** · tab=buying and tab=ledger open this tab. Orders is the approved label for supplier-buying work inside Curate.
- **Handoff** · Compare scope and status against Purchases. Preserve historical order amount, currency and quantity. The management view is Purchases and the retail operator queue is Sales.
- **Preview** · PDF and sharing depend on the documented Curate routes and permissions; private supplier evidence stays scoped.

Sources · [src/components/TeaCompass/LedgerView.tsx](../../src/components/TeaCompass/LedgerView.tsx), [src/components/TeaCompass/LedgerOverviewPanel.tsx](../../src/components/TeaCompass/LedgerOverviewPanel.tsx), [src/components/TeaCompass/LedgerPdf.tsx](../../src/components/TeaCompass/LedgerPdf.tsx)

Related · [Curate · Library](#ops-library), [Curate · Buy or acquire a sample](#ops-source-buy), [Purchases · Supplier tracking](#ops-purchases), [Purchases · Tracking task](#ops-purchase-record)

<a id="ops-samples"></a>

### Curate · Samples workspace

**Current** · `/admin/compass?sampleOrder=manage&set=:setId` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-samples)

- **Entry** · /admin/samples redirects to Curate with sampleOrder=manage. sampleOrder=open enters the non-management form. Closing clears the sampleOrder and set query keys.
- **Physical portion** · Stock’s Samples view and Curate sample sets cover connected records. Preserve each received portion’s grams without assuming a default for unknown weights.
- **Open link gap** · adminLinkReaders allowlists fromSample as unread. A sample return may reach Curate without selecting the tea; verify a link using entry identity.

Sources · [src/components/TeaCompass/index.tsx](../../src/components/TeaCompass/index.tsx), [src/components/TeaCompass/SampleOrderAction.tsx](../../src/components/TeaCompass/SampleOrderAction.tsx), [src/admin/components/CurateSamplesView.tsx](../../src/admin/components/CurateSamplesView.tsx)

Related · [Curate · Source](#ops-source), [Curate · Buy or acquire a sample](#ops-source-buy), [Curate · Library](#ops-library), [Stock · Sample portions](#ops-stock-samples)

<a id="ops-purchases"></a>

### Purchases · Supplier tracking

**Current** · `/admin/purchase-orders` · Owner tier or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-purchases)

- **Current implementation** · PurchaseOrdersPage delegates to PurchaseTrackingView. The purchaseId link preserves the selected tracking task. A missing or foreign purchase reports Purchase unavailable in this shop. LegacyPurchaseOrdersPage is a retained implementation, with manual forms available as fallbacks.
- **Older records** · Supplier invoices lacking matched lines offer Match purchase items. Legacy intake whose stock was already added uses Link recorded stock and the original movement.
- **Attention** · Coming, partial and completed views need the same outstanding balances as Curate. Stock incoming without a receipt redirects to Coming.

Sources · [src/admin/views/PurchaseOrdersPage.tsx](../../src/admin/views/PurchaseOrdersPage.tsx), [src/admin/components/inventory/PurchaseTrackingView.tsx](../../src/admin/components/inventory/PurchaseTrackingView.tsx), [src/admin/components/inventory/purchaseJourneyGroups.ts](../../src/admin/components/inventory/purchaseJourneyGroups.ts)

Related · [Curate · Orders](#ops-curate-orders), [Purchases · Tracking task](#ops-purchase-record), [Purchases · Match items or link recorded stock](#ops-match-purchase), [Purchases · Place a supplier order](#ops-purchase-new), [Purchases · Warehouse and shipment tracking](#ops-logistics), [Purchases · Confirm arrival](#ops-receipt), [Intake workspace](#ops-intake), [Stock · Shelf and saved views](#ops-stock)

<a id="ops-logistics"></a>

### Purchases · Warehouse and shipment tracking

**Current** · `/admin/purchase-orders (Tracking)` · Owner tier or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-logistics)

- **Distinct arrivals** · Arrived at the collection warehouse updates logistics. Confirm physical arrival into owned Stock at the receipt step. Keep those events, dates and amounts distinct.
- **Fallbacks** · Logistics and purchase reads have separate retry actions. Tracking marked unavailable stays distinguishable from a locally recorded arrival.
- **Next action** · Link individual parcel contents to the underlying purchase. Keep physical quantities, missing tracking and shipment manifest attached to the correct forwarder.

Sources · [src/admin/components/inventory/PurchaseTrackingView.tsx](../../src/admin/components/inventory/PurchaseTrackingView.tsx), [src/admin/components/inventory/purchaseJourneyGroups.ts](../../src/admin/components/inventory/purchaseJourneyGroups.ts)

Related · [Purchases · Supplier tracking](#ops-purchases), [Purchases · Tracking task](#ops-purchase-record), [Purchases · Confirm arrival](#ops-receipt), [Proposed · Freight bill and rate approval](#ops-freight), [Settings · Shop and launch readiness](#ops-settings)

<a id="ops-purchase-record"></a>

### Purchases · Tracking task

**Current** · `/admin/purchase-orders?purchaseId=:purchaseId` · Owner tier or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-purchase-record)

- **Partial** · Local exercise followed 250 g ordered, 100 g confirmed and 150 g remaining in the same purchase. Stock opened the same private draft.
- **Historical** · Use an original movement to link old intake and avoid a second addition. Missing lines need matching before there is anything to receive.
- **Access and retry** · Keep account and purchase identity when a request fails. Refresh Purchases, Library and Stock after successful receipt.

Sources · [src/admin/components/inventory/PurchaseTrackingView.tsx](../../src/admin/components/inventory/PurchaseTrackingView.tsx), [src/admin/views/PurchaseOrdersPage.tsx](../../src/admin/views/PurchaseOrdersPage.tsx)

Related · [Purchases · Supplier tracking](#ops-purchases), [Purchases · Match items or link recorded stock](#ops-match-purchase), [Purchases · Confirm arrival](#ops-receipt), [Stock · Holding and movements](#ops-stock-record), [People · Supplier profile](#ops-supplier)

<a id="ops-purchase-new"></a>

### Purchases · Place a supplier order

**Current** · `/admin/purchase-orders (Add purchase)` · Owner tier or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-purchase-new)

- **Physical stock boundary** · New lines can link a current holding or create a private draft. Order quantity goes into the order record and only received quantity is available after receipt confirmation.
- **Older evidence** · Imported supplier invoice may require its own match or existing-movement link, through Purchases attention rather than a repeated new order.

Sources · [src/admin/views/PurchaseOrdersPage.tsx](../../src/admin/views/PurchaseOrdersPage.tsx), [tests/supplier-purchase-form.spec.ts](../../tests/supplier-purchase-form.spec.ts)

Related · [Purchases · Supplier tracking](#ops-purchases), [Purchases · Tracking task](#ops-purchase-record), [Purchases · Confirm arrival](#ops-receipt), [Stock · Holding and movements](#ops-stock-record), [Intake workspace](#ops-intake)

<a id="ops-match-purchase"></a>

### Purchases · Match items or link recorded stock

**Current** · `/admin/purchase-orders?purchaseId=:purchaseId` · Owner tier or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-match-purchase)

- **Matching** · Require a valid holding and ordered quantity for each line. Matching prepares records, distinct from confirming a new receipt.
- **Already recorded** · Select the original matching movement in legacy intake. A duplicate submission or unmatched source should surface as a recoverable error.

Sources · [src/admin/views/PurchaseOrdersPage.tsx](../../src/admin/views/PurchaseOrdersPage.tsx)

Related · [Purchases · Tracking task](#ops-purchase-record), [Purchases · Confirm arrival](#ops-receipt), [Stock · Holding and movements](#ops-stock-record), [Intake workspace](#ops-intake)

<a id="ops-receipt"></a>

### Purchases · Confirm arrival

**Partial** · `/admin/stock?receipt=:receiptId` · Catalog or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-receipt)

- **Partial and full** · Receive the amount physically confirmed. A partial receipt leaves the unreceived amount open. Cancel remaining is under Stock and corrections. Pending arrivals may be rejected; an accepted receipt is corrected through a stock removal movement.
- **Lost response** · The local Worker committed 100 g, the browser saw an injected 502 and retry reused the receipt request key and movement. Device and intended candidate check remain open.
- **Old and scoped** · Old invoices may require line matching. Receiving must stay inside the active account; keep the linked private draft and unit through a retry.

Sources · [src/admin/components/inventory/IncomingReceiptsPanel.tsx](../../src/admin/components/inventory/IncomingReceiptsPanel.tsx), [src/admin/views/PurchaseOrdersPage.tsx](../../src/admin/views/PurchaseOrdersPage.tsx), [tests/inventory-purchase-receipts.spec.ts](../../tests/inventory-purchase-receipts.spec.ts)

Related · [Purchases · Tracking task](#ops-purchase-record), [Purchases · Match items or link recorded stock](#ops-match-purchase), [Curate · Library](#ops-library), [Stock · Holding and movements](#ops-stock-record), [Stock · Shelf and saved views](#ops-stock), [Intake workspace](#ops-intake)

<a id="ops-intake"></a>

### Intake workspace

**Current** · `/admin/intake?importId=:importId` · Catalog or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-intake)

- **Plan and resume** · importId addresses persisted intake and commit plans. Keep staged snapshot/revision, partial success and per-row result. A retry should resume rather than insert duplicates.
- **Guardrails** · Missing cost requires review. Cakes, cans and pieces require grams-per-pack where applicable. Samples have no guessed default. Incoming confirmation adds stock explicitly.
- **Historic freight** · Supplier leg and shop rate represent separate legs. For historic bills retain the assignment evidence; shop-wide rate approval is the distinct future flow.

Sources · [src/admin/views/IntakeWorkspace.tsx](../../src/admin/views/IntakeWorkspace.tsx), [src/admin/lib/intakeCommit.ts](../../src/admin/lib/intakeCommit.ts), [src/admin/lib/xlsxIntake.ts](../../src/admin/lib/xlsxIntake.ts)

Related · [Stock · Shelf and saved views](#ops-stock), [Stock · Create or change physical stock](#ops-stock-add), [Purchases · Supplier tracking](#ops-purchases), [Purchases · Match items or link recorded stock](#ops-match-purchase), [Purchases · Confirm arrival](#ops-receipt), [Curate · Source](#ops-source), [Curate · Library](#ops-library), [Proposed · Freight bill and rate approval](#ops-freight)

<a id="ops-stock"></a>

### Stock · Shelf and saved views

**Current** · `/admin/stock` · Catalog or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-stock)

- **Filters** · URL facets include vendor, teaType, tasting, batch, panel, incoming/receipt and wisdom. Clearing a facet preserves the others. Search seed comes from AdminApp.
- **Behavior** · Desktop retains the height chain and a virtualized scroll region. Mobile current variants include joined and legacy layouts; verify long names and list return on the intended phone variant.
- **Work item** · Supplier-first phone grouping and durable scroll re-entry are next. Keep order/receipt context and permissions. Row count, item purpose and public eligibility are separate.

Sources · [src/admin/components/InventoryView.tsx](../../src/admin/components/InventoryView.tsx), [src/admin/components/inventory/stock/StockBrowseBar.tsx](../../src/admin/components/inventory/stock/StockBrowseBar.tsx), [src/admin/components/inventory/InventoryRow.tsx](../../src/admin/components/inventory/InventoryRow.tsx)

Related · [Stock · Holding and movements](#ops-stock-record), [Stock · Draft readiness](#ops-stock-drafts), [Stock · Sample portions](#ops-stock-samples), [Stock · Create or change physical stock](#ops-stock-add), [Intake workspace](#ops-intake), [Purchases · Supplier tracking](#ops-purchases), [People · Supplier profile](#ops-supplier), [Stock · Tea Glossary / catalog](#ops-glossary)

<a id="ops-stock-record"></a>

### Stock · Holding and movements

**Current** · `/admin/stock?panel=:productId` · Catalog or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-stock-record)

- **M8 name priority** · Given name first, supplier tea name underneath, supplier tea name primary until renamed. Check table, panel and deep-link round trip.
- **M9/M10 publication** · UI requirement helper checks real name, type, selling price and counted stock. Full browser/API/MCP parity is open. A legitimate sold-out public URL stays reachable, buying is disabled and default browse excludes it.
- **Temporary overlays** · Pricing, freight and photo tools keep parent product identity. Pending receipts show ordered quantity separately from physical product count. Panel from foreign/missing ID may fall back to list; verify explicit denial.

Sources · [src/admin/components/InventoryView.tsx](../../src/admin/components/InventoryView.tsx), [src/admin/components/inventory/stock/StockMobileRecord.tsx](../../src/admin/components/inventory/stock/StockMobileRecord.tsx), [src/lib/productPublication.ts](../../src/lib/productPublication.ts)

Related · [Stock · Shelf and saved views](#ops-stock), [Stock · First publication and sold-out lifecycle](#ops-stocks-publish), [Purchases · Tracking task](#ops-purchase-record), [Purchases · Confirm arrival](#ops-receipt), [Stock · Product story and evidence](#ops-stock-story), [People · Supplier profile](#ops-supplier), [Stock · Tea Glossary / catalog](#ops-glossary)

<a id="ops-stock-drafts"></a>

### Stock · Draft readiness

**Partial** · `/admin/stock?view=drafts&triage=ready` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-stock-drafts)

- **M7** · Stock reads view=drafts and triage=ready or review. Catalog is required for draft review even where a Stock-grant holder can browse the main shelf.
- **Navigation gap** · The room’s Drafts child still points to /admin/capture, the separate writing desk. Keep both entry points visible in documentation until an approved navigation change.
- **Receipt handoff** · Incoming order drafts keep quantities due separate from counted stock. Old blank fields should be actionable. Preserve zero entries without substituting for uncounted stock.

Sources · [src/admin/components/InventoryView.tsx](../../src/admin/components/InventoryView.tsx), [src/lib/productPublication.ts](../../src/lib/productPublication.ts), [tests/stock-draft-names.spec.ts](../../tests/stock-draft-names.spec.ts)

Related · [Stock · Shelf and saved views](#ops-stock), [Stock · Holding and movements](#ops-stock-record), [Drafts · Writing desk](#ops-old-drafts), [Stock · First publication and sold-out lifecycle](#ops-stocks-publish), [Purchases · Tracking task](#ops-purchase-record)

<a id="ops-stocks-publish"></a>

### Stock · First publication and sold-out lifecycle

**Partial** · `/admin/stock?panel=:productId` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-stocks-publish)

- **Approved labels** · Private, Ready, In the shop, Held and Sold out. Compare legacy labels and batch result copy against the approved list.
- **Known gap** · Scope test covers UI readiness and Worker visibility rules separately. Compare first publication across browser, API and MCP, including incoming-only, counted zero, inherited listings and batch mixed outcomes.
- **Sold-out page** · Keep the URL and label, remove purchase action, exclude from default browse and compose a restock message for the owning shop.

Sources · [src/lib/productPublication.ts](../../src/lib/productPublication.ts), [worker/src/index.ts](../../worker/src/index.ts), [src/pages/ProductPage.tsx](../../src/pages/ProductPage.tsx), [tests/sold-out-restock.spec.ts](../../tests/sold-out-restock.spec.ts)

Related · [Stock · Holding and movements](#ops-stock-record), [Stock · Draft readiness](#ops-stock-drafts), [Sales · Waiting](#ops-sales-waiting)

<a id="ops-stock-samples"></a>

### Stock · Sample portions

**Current** · `/admin/stock (Samples view)` · Catalog or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-stock-samples)

- **Material** · Curate-only teas can appear alongside inventory sample rows. When a holding is linked to a Stock record, avoid duplicate rows. Missing weights remain unknown.
- **Return gap** · Confirm Samples can return to the specific Curate entry from each row; the fromSample query alone is allowlisted as unread.

Sources · [src/admin/components/InventoryView.tsx](../../src/admin/components/InventoryView.tsx), [src/admin/components/CurateSamplesView.tsx](../../src/admin/components/CurateSamplesView.tsx), [tests/curate-samples-only.spec.ts](../../tests/curate-samples-only.spec.ts)

Related · [Stock · Shelf and saved views](#ops-stock), [Curate · Samples workspace](#ops-samples), [Curate · Library](#ops-library), [Stock · Holding and movements](#ops-stock-record)

<a id="ops-old-drafts"></a>

### Drafts · Writing desk

**Current** · `/admin/capture` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-old-drafts)

- **Separate current entry** · Manage’s Drafts child leads here, while Stock’s own Drafts triage opens the shared inventory view. Check what each supports before consolidating doors.
- **Loading and recovery** · Preserve active tenant, persisted draft and unsaved-state handling through import and edits.

Sources · [src/admin/components/DraftsView.tsx](../../src/admin/components/DraftsView.tsx)

Related · [Stock · Shelf and saved views](#ops-stock), [Stock · Draft readiness](#ops-stock-drafts), [Stock · Create or change physical stock](#ops-stock-add), [Intake workspace](#ops-intake), [Stock · Product story and evidence](#ops-stock-story)

<a id="ops-stock-add"></a>

### Stock · Create or change physical stock

**Current** · `/admin/stock (Add / row actions)` · Catalog or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-stock-add)

- **Money** · Cost is required at creation unless an explicitly unknown-cost path handles it. Preserve typed zero and canonical currency. Pack quantities need a real grams-per-pack when required.
- **Movement** · Use an arrival receipt for an ordered line. On-hand adjustment is its own recorded action. Confirm correction or rejection on the relevant movement.

Sources · [src/admin/AdminApp.tsx](../../src/admin/AdminApp.tsx), [src/admin/components/InventoryView.tsx](../../src/admin/components/InventoryView.tsx), [src/admin/components/inventory/InventoryConfirmations.tsx](../../src/admin/components/inventory/InventoryConfirmations.tsx)

Related · [Stock · Shelf and saved views](#ops-stock), [Stock · Holding and movements](#ops-stock-record), [Intake workspace](#ops-intake), [Purchases · Confirm arrival](#ops-receipt), [People · Supplier profile](#ops-supplier)

<a id="ops-stock-story"></a>

### Stock · Product story and evidence

**Current** · `/admin/products/:id/story` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-stock-story)

- **Evidence** · Working copy and notes stay separate from public copy. Check the evidence now linked to the tea against its Catalog/Wisdom identity before reusing it.
- **Loading** · Product/source fetch states and old product records retain their own recovery paths. A story update should preserve the same holding link.

Sources · [src/admin/views/ProductStoryView.tsx](../../src/admin/views/ProductStoryView.tsx)

Related · [Stock · Holding and movements](#ops-stock-record), [Curate · Capture evidence and corrections](#ops-source-evidence), [Stock · Tea Glossary / catalog](#ops-glossary), [Publish · Wisdom and integrity review](#ops-wisdom)

<a id="ops-glossary"></a>

### Stock · Tea Glossary / catalog

**Current** · `/admin/catalog` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-glossary)

- **Split route** · A platform-account membership redirects /admin/catalog to Stock with query preserved. Other accounts render CatalogView with a Catalog bundle. Manage labels this door Tea Glossary.
- **Search discrepancy** · CatalogView does not consume the Sold Items query search for non-platform accounts. Choose the correct record destination before changing the door.

Sources · [src/admin/views/CatalogView.tsx](../../src/admin/views/CatalogView.tsx), [src/admin/AdminApp.tsx](../../src/admin/AdminApp.tsx)

Related · [Stock · Shelf and saved views](#ops-stock), [Stock · Holding and movements](#ops-stock-record), [Network · Shared sourcing catalog](#ops-network), [Sales · Ledger and activity log](#ops-sales-ledger)

<a id="ops-sales-waiting"></a>

### Sales · Waiting

**Current** · `/admin/activity?tab=waiting` · Sell bundle

[Open desktop and phone wireframes](wireframes.html#ops-sales-waiting)

- **Inputs** · Website inquiry creates a shop-scoped request and draft invoice before optional WhatsApp. Separate tracked orders from generic inquiries and event requests.
- **Partial reads** · Inquiry error gets an unavailable count rather than zero. Await active account scope before reading. Legacy pending and inquiries tab aliases resolve here.
- **First-operator rehearsal** · Ensure inquiry, price, payment report and shipping attention go to the same correct shop and buyer.

Sources · [src/admin/components/ActivityView.tsx](../../src/admin/components/ActivityView.tsx), [src/admin/components/PendingView.tsx](../../src/admin/components/PendingView.tsx)

Related · [Today](#ops-today), [Sales · Order list and filters](#ops-sales-orders), [Sales · Invoice, payment and shipment](#ops-sales-invoice), [People · Directory and tags](#ops-people), [Sessions · Calendar and queue](#ops-sessions), [Sales · Wholesale orders](#ops-sales-wholesale), [Sales · Ledger and activity log](#ops-sales-ledger)

<a id="ops-sales-orders"></a>

### Sales · Order list and filters

**Current** · `/admin/activity?tab=orders` · Sell bundle

[Open desktop and phone wireframes](wireframes.html#ops-sales-orders)

- **Deep-link contract** · Orders consumes search and the Quick Invoice flags qi=1 and draft. Details open as local state; independently verify ability to share a link to an existing invoice under M5.
- **State controls** · Draft and pending may edit. Pending unpaid and undeducted may split. Shipping, no-charge fulfillment and historical destructive actions have eligibility gates.
- **Unfinished links** · Event IDs open specific Sessions. Legacy event-title fallback sends an unread search parameter. Sold item links to non-platform Tea Glossary also send unread search.

Sources · [src/admin/components/OrdersView.tsx](../../src/admin/components/OrdersView.tsx), [src/admin/components/SoldItemsView.tsx](../../src/admin/components/SoldItemsView.tsx)

Related · [Sales · Waiting](#ops-sales-waiting), [Sales · Invoice, payment and shipment](#ops-sales-invoice), [Sales · Quick Invoice composer](#ops-quick-invoice), [Sales · Ledger and activity log](#ops-sales-ledger), [People · Customer profile](#ops-customer), [Sessions · Host workspace](#ops-event), [Stock · Tea Glossary / catalog](#ops-glossary)

<a id="ops-quick-invoice"></a>

### Sales · Quick Invoice composer

**Current** · `/admin/activity?tab=orders&qi=1` · Sell bundle

[Open desktop and phone wireframes](wireframes.html#ops-quick-invoice)

- **Entry** · qi=1 opens the composer. draft holds encoded form prefill, and both flags are removed after reading. An invalid encoded link shows an error.
- **Validation** · A linked item uses its physical unit and eligibility. Confirm account-scoped retry and independent unmatched-line handling before actual paid use.

Sources · [src/admin/components/QuickInvoiceModal.tsx](../../src/admin/components/QuickInvoiceModal.tsx), [src/admin/components/OrdersView.tsx](../../src/admin/components/OrdersView.tsx)

Related · [Sales · Order list and filters](#ops-sales-orders), [Sales · Invoice, payment and shipment](#ops-sales-invoice), [Stock · Holding and movements](#ops-stock-record), [People · Customer profile](#ops-customer)

<a id="ops-sales-invoice"></a>

### Sales · Invoice, payment and shipment

**Partial** · `/admin/activity?tab=orders (View details)` · Sell bundle

[Open desktop and phone wireframes](wireframes.html#ops-sales-invoice)

- **First sale gate** · M3 asks to prove Source → Stock → Shop → inquiry → Sales → invoice → payment → fulfillment → buyer view. Real paid order evidence is open.
- **Money and movement** · Exercise partial payment, cancellation and refund in a controlled fixture. A retry must keep payment, movement, currency and remaining quantity correct.
- **Link gap** · Quick Invoice draft carries encoded form data. View Details opens an in-memory dialog. Persisted invoice detail should meet M5 with an explicit working link. Buyer order views remain their own scoped surfaces.

Sources · [src/admin/components/OrdersView.tsx](../../src/admin/components/OrdersView.tsx), [src/admin/components/ActivityView.tsx](../../src/admin/components/ActivityView.tsx), [docs/LAUNCH_VALIDATION.md](../../docs/LAUNCH_VALIDATION.md)

Related · [Sales · Order list and filters](#ops-sales-orders), [Sales · Waiting](#ops-sales-waiting), [Stock · Holding and movements](#ops-stock-record), [People · Customer profile](#ops-customer), [Sessions · Host workspace](#ops-event)

<a id="ops-sales-wholesale"></a>

### Sales · Wholesale orders

**Current** · `/admin/activity?tab=wholesale` · Sell bundle

[Open desktop and phone wireframes](wireframes.html#ops-sales-wholesale)

- **Compatibility** · /admin/network/wholesale routes through Network’s wholesale query to Sales. The wholesale draft and timeline paths remain in the Network URL space.
- **Account boundary** · Orders represent buyer and supplier sides. Validate each side’s access, currency, price and fulfillment state against N1.

Sources · [src/admin/views/WholesaleOrdersList.tsx](../../src/admin/views/WholesaleOrdersList.tsx), [src/admin/components/ActivityView.tsx](../../src/admin/components/ActivityView.tsx)

Related · [Network · Shared sourcing catalog](#ops-network), [Wholesale · Draft and submission](#ops-wholesale-draft), [Wholesale · Timeline and receiving](#ops-wholesale-timeline), [Sales · Ledger and activity log](#ops-sales-ledger)

<a id="ops-wholesale-draft"></a>

### Wholesale · Draft and submission

**Current** · `/admin/network/wholesale/new or /admin/network/wholesale/:orderId` · Sell bundle

[Open desktop and phone wireframes](wireframes.html#ops-wholesale-draft)

- **Draft or existing** · Both addresses use WholesaleOrderDraft. Preserve item identity, per-account fulfillment and sizing/quantity inputs when reopening.
- **Open gate** · Rehearse one real two-account order after the first operator sale is proven. Test denied cross-account access and duplicate submission.

Sources · [src/admin/views/WholesaleOrderDraft.tsx](../../src/admin/views/WholesaleOrderDraft.tsx)

Related · [Sales · Wholesale orders](#ops-sales-wholesale), [Wholesale · Timeline and receiving](#ops-wholesale-timeline), [Network · Shared sourcing catalog](#ops-network), [Network · Partner listing](#ops-network-listing)

<a id="ops-wholesale-timeline"></a>

### Wholesale · Timeline and receiving

**Partial** · `/admin/network/wholesale/:orderId/timeline` · Sell bundle

[Open desktop and phone wireframes](wireframes.html#ops-wholesale-timeline)

- **Side-specific view** · Compare buyer and supplier separately, including bilateral invoice access, shipment, received quantity, owned stock and return/cancel rules.
- **Open evidence** · Working code exists. N1 requires two real accounts, a complete arrival, retry and denial test against the other tenant.

Sources · [src/admin/views/WholesaleOrderTimeline.tsx](../../src/admin/views/WholesaleOrderTimeline.tsx), [docs/MULTI_STORE_PLAN.md](../../docs/MULTI_STORE_PLAN.md)

Related · [Sales · Wholesale orders](#ops-sales-wholesale), [Wholesale · Draft and submission](#ops-wholesale-draft), [Stock · Holding and movements](#ops-stock-record), [Network · Shared sourcing catalog](#ops-network)

<a id="ops-sales-ledger"></a>

### Sales · Ledger and activity log

**Current** · `/admin/activity?tab=ledger` · Sell bundle

[Open desktop and phone wireframes](wireframes.html#ops-sales-ledger)

- **Aliases** · tab=log selects the activity-log part of Ledger; /admin/activity-logs and /admin/records seed that address.
- **Known gap** · Sold Items → view in catalog sends search to /admin/catalog, which has a different renderer on non-platform accounts and does not read that query.

Sources · [src/admin/components/ActivityView.tsx](../../src/admin/components/ActivityView.tsx), [src/admin/components/SoldItemsView.tsx](../../src/admin/components/SoldItemsView.tsx)

Related · [Sales · Order list and filters](#ops-sales-orders), [Sales · Invoice, payment and shipment](#ops-sales-invoice), [Stock · Holding and movements](#ops-stock-record), [Stock · Tea Glossary / catalog](#ops-glossary)

<a id="ops-people"></a>

### People · Directory and tags

**Current** · `/admin/people?tab=customers` · Sell, Gather, Members, Stock or Publish bundle

[Open desktop and phone wireframes](wireframes.html#ops-people)

- **Visibility** · Suppliers tab depends on the operator’s stock/management access; broad People access can still show Customers and Tags. Validate each capability against direct record actions.
- **Redirects** · /admin/customers and /admin/sources land on People; /admin/contact-tags seeds Tags. customerId opens in the Customers renderer while /admin/people/:customerId opens a full Profile.

Sources · [src/admin/components/PeopleView.tsx](../../src/admin/components/PeopleView.tsx), [src/admin/components/CustomersView.tsx](../../src/admin/components/CustomersView.tsx), [src/admin/views/ContactTagsView.tsx](../../src/admin/views/ContactTagsView.tsx)

Related · [People · Customer profile](#ops-customer), [People · Supplier profile](#ops-supplier), [Settings · Relationship audit](#ops-audit), [Sales · Order list and filters](#ops-sales-orders), [Sessions · Calendar and queue](#ops-sessions)

<a id="ops-customer"></a>

### People · Customer profile

**Current** · `/admin/people/:customerId` · Sell, Gather, Members, Stock or Publish bundle

[Open desktop and phone wireframes](wireframes.html#ops-customer)

- **Privacy** · The profile is scoped to the active shop and intended grant. A foreign or removed person cannot be mistaken for a valid record after switching accounts.
- **Handoff** · Sales can open buyer identity and customer history. People can use attendance and relationship records without a Sell grant; check which invoice operations appear.

Sources · [src/admin/components/CustomerProfilePage.tsx](../../src/admin/components/CustomerProfilePage.tsx), [src/admin/components/CustomersView.tsx](../../src/admin/components/CustomersView.tsx)

Related · [People · Directory and tags](#ops-people), [Sales · Order list and filters](#ops-sales-orders), [Sales · Invoice, payment and shipment](#ops-sales-invoice), [Sessions · Calendar and queue](#ops-sessions)

<a id="ops-supplier"></a>

### People · Supplier profile

**Current** · `/admin/vendors/:vendorId` · Catalog or Stock bundle

[Open desktop and phone wireframes](wireframes.html#ops-supplier)

- **Vocabulary** · Visible error copy still says Vendor not found. M6 approved Supplier throughout. Leave URL/data identifiers stable unless a compatibility plan requires a move.
- **Linked work** · The supplier is the join across Source, Library, holding and Purchases. Missing currency must not default to parity, and old records may need relationship repair.

Sources · [src/admin/views/VendorProfileView.tsx](../../src/admin/views/VendorProfileView.tsx), [src/admin/components/SourcesView.tsx](../../src/admin/components/SourcesView.tsx)

Related · [People · Directory and tags](#ops-people), [Curate · Source](#ops-source), [Curate · Library](#ops-library), [Stock · Holding and movements](#ops-stock-record), [Purchases · Tracking task](#ops-purchase-record), [Settings · Relationship audit](#ops-audit)

<a id="ops-sessions"></a>

### Sessions · Calendar and queue

**Current** · `/admin/events` · Gather bundle

[Open desktop and phone wireframes](wireframes.html#ops-sessions)

- **States** · Upcoming, Past and Drafts are distinct views. Validate an empty calendar and a saved event in its intended account.
- **Known gap** · /admin/events?search for legacy sales attribution lands unfiltered. /admin/events/:id is a real record link. M11 retains ordinary sessions and adds optional structured tasting behavior.

Sources · [src/admin/components/EventsManager.tsx](../../src/admin/components/EventsManager.tsx)

Related · [Sessions · Host workspace](#ops-event), [Sessions · Create or edit session](#ops-event-edit), [Sessions · Structured tastings list and setup](#ops-tastings), [Sessions · Venues](#ops-venues), [Sales · Order list and filters](#ops-sales-orders)

<a id="ops-event-edit"></a>

### Sessions · Create or edit session

**Current** · `/admin/events (New) or /admin/events/:id (Edit)` · Gather bundle

[Open desktop and phone wireframes](wireframes.html#ops-event-edit)

- **Lifecycle** · Preserve draft and session ID when editing. The public event and RSVP/request state should reflect the host’s visibility and availability choices.
- **Tasting boundary** · A normal session can collect guests’ notes afterward. Structured per-tea ratings and live results are optional per M11. Verify any bridge from an existing event to those controls.

Sources · [src/admin/components/EventsManager.tsx](../../src/admin/components/EventsManager.tsx), [src/admin/components/EventDetail.tsx](../../src/admin/components/EventDetail.tsx)

Related · [Sessions · Calendar and queue](#ops-sessions), [Sessions · Host workspace](#ops-event), [Sessions · Venues](#ops-venues), [Sessions · Structured tastings list and setup](#ops-tastings)

<a id="ops-event"></a>

### Sessions · Host workspace

**Current** · `/admin/events/:id?tab=requests` · Gather bundle

[Open desktop and phone wireframes](wireframes.html#ops-event)

- **Sections** · Overflow reads Interest, Venue, Tea Menu, Reminders, Notifications and Post-Session. Interest sign-ups and accepted attendees are distinct.
- **Errors and closure** · Event could not be loaded is separate from no requests. Close RSVPs has confirmation and must preserve existing attendees and guest note eligibility.
- **Editorial handoff** · Guest reviews or a photo essay are reviewable drafts. Publishing requires the proper Publish surface and access.

Sources · [src/admin/components/EventDetail.tsx](../../src/admin/components/EventDetail.tsx), [src/admin/components/EventDetail.failure.test.tsx](../../src/admin/components/EventDetail.failure.test.tsx)

Related · [Sessions · Calendar and queue](#ops-sessions), [Sessions · Create or edit session](#ops-event-edit), [People · Customer profile](#ops-customer), [Sessions · Venues](#ops-venues), [Sessions · Structured tastings list and setup](#ops-tastings), [Sessions · Structured tasting host controls](#ops-group-tasting), [Publish · Guest notes review](#ops-guest-notes)

<a id="ops-venues"></a>

### Sessions · Venues

**Current** · `/admin/venues` · Gather bundle

[Open desktop and phone wireframes](wireframes.html#ops-venues)

- **Venue lifecycle** · Add and edit venue details, preserve public visibility controls and reference from Sessions. Verify whether every venue subrecord has a shareable address for M5.
- **Loading and access** · A venue failure should preserve the existing session and selected venue relationship.

Sources · [src/admin/components/VenueManager.tsx](../../src/admin/components/VenueManager.tsx)

Related · [Sessions · Calendar and queue](#ops-sessions), [Sessions · Host workspace](#ops-event), [Sessions · Create or edit session](#ops-event-edit)

<a id="ops-tastings"></a>

### Sessions · Structured tastings list and setup

**Current** · `/admin/tasting-events or /admin/tasting-events/new` · Gather bundle

[Open desktop and phone wireframes](wireframes.html#ops-tastings)

- **Content** · Setup has a tea picker and relies on the separate tasting record. Preserve the tasting identity, tea list and host link after creation.
- **Decision pending implementation proof** · M11 requires a group tasting attached to its ordinary session plus opt-in per-tea ratings and live results. Verify the configured session link and ordinary post-session notes end to end.

Sources · [src/admin/components/tasting/TastingEventsList.tsx](../../src/admin/components/tasting/TastingEventsList.tsx), [src/admin/components/tasting/TastingEventForm.tsx](../../src/admin/components/tasting/TastingEventForm.tsx)

Related · [Sessions · Calendar and queue](#ops-sessions), [Sessions · Host workspace](#ops-event), [Sessions · Structured tasting host controls](#ops-group-tasting)

<a id="ops-group-tasting"></a>

### Sessions · Structured tasting host controls

**Partial** · `/admin/tasting-events/:sessionId or /admin/tasting-events/:sessionId/live` · Gather bundle

[Open desktop and phone wireframes](wireframes.html#ops-group-tasting)

- **Share and Live** · These are distinct route-addressable panes of one host room. Confirm completing and revisiting a session preserves guest entries and scopes results to the right tasting.
- **M11** · Check opt-in behavior and attachment to the associated ordinary session. Ordinary sessions can collect later notes. The approved group banner is “This tasting will be saved separately for this session.”

Sources · [src/admin/components/tasting/TastingControlRoom.tsx](../../src/admin/components/tasting/TastingControlRoom.tsx), [src/admin/components/tasting/ShareScreen.tsx](../../src/admin/components/tasting/ShareScreen.tsx), [src/admin/components/tasting/LiveMatrix.tsx](../../src/admin/components/tasting/LiveMatrix.tsx)

Related · [Sessions · Structured tastings list and setup](#ops-tastings), [Sessions · Host workspace](#ops-event), [Publish · Guest notes review](#ops-guest-notes)

<a id="ops-publish"></a>

### Publish · Magazine entry

**Current** · `/admin/magazine` · Publish bundle

[Open desktop and phone wireframes](wireframes.html#ops-publish)

- **Scope** · Manage places Magazine as the room landing for the Publish grant. Editorial flow, approval and publication are in the companion blueprint.
- **Role differences** · Tea Masters is owner-gated; Collections, Guest notes and Wisdom use the Publish gate.

Sources · [src/admin/views/MagazineView.tsx](../../src/admin/views/MagazineView.tsx), [src/components/manageNav.ts](../../src/components/manageNav.ts)

Related · [Publish · Collections lists](#ops-collections), [Publish · Guest notes review](#ops-guest-notes), [Publish · Wisdom and integrity review](#ops-wisdom), [Publish · Tea Masters roster](#ops-tea-masters)

<a id="ops-collections"></a>

### Publish · Collections lists

**Current** · `/admin/collections` · Publish bundle

[Open desktop and phone wireframes](wireframes.html#ops-collections)

- **Entry** · new=1 opens creation. Inbound links use the publication ID. The collection-creator flag seen at shell level can also open a distinct personal workspace; verify the route-specific Manage grant.
- **States** · Draft, active and archived are collection states. An inbound publication carries an adoption/review context and separate ownership.

Sources · [src/admin/views/CollectionsView.tsx](../../src/admin/views/CollectionsView.tsx)

Related · [Publish · Magazine entry](#ops-publish), [Publish · Collection editor and send](#ops-collection-edit), [Publish · Received collection](#ops-collection-inbound), [Stock · Shelf and saved views](#ops-stock)

<a id="ops-collection-edit"></a>

### Publish · Collection editor and send

**Current** · `/admin/collections/:id?item=:itemId` · Publish bundle

[Open desktop and phone wireframes](wireframes.html#ops-collection-edit)

- **Direct item link** · item focuses the selected content within a saved collection. Validate a removed item and return to list.
- **Send** · The outgoing form has a sent confirmation. Preserve collection state, recipient scope and public/share eligibility for each audience.

Sources · [src/admin/views/CollectionEditView.tsx](../../src/admin/views/CollectionEditView.tsx)

Related · [Publish · Collections lists](#ops-collections), [Publish · Received collection](#ops-collection-inbound), [Stock · Holding and movements](#ops-stock-record), [Publish · Magazine entry](#ops-publish)

<a id="ops-collection-inbound"></a>

### Publish · Received collection

**Current** · `/admin/collections/inbound/:pubId` · Publish bundle

[Open desktop and phone wireframes](wireframes.html#ops-collection-inbound)

- **Scope** · Received publication uses pubId, distinct from an owned collection ID. Handle missing, revoked, and wrong-account access.
- **Handoff** · Review adoption or carry behavior with the receiving shop’s Network and Stock journey.

Sources · [src/admin/views/InboundCollectionView.tsx](../../src/admin/views/InboundCollectionView.tsx)

Related · [Publish · Collections lists](#ops-collections), [Publish · Collection editor and send](#ops-collection-edit), [Network · Shared sourcing catalog](#ops-network), [Stock · Shelf and saved views](#ops-stock)

<a id="ops-guest-notes"></a>

### Publish · Guest notes review

**Current** · `/admin/tasting-notes` · Publish bundle

[Open desktop and phone wireframes](wireframes.html#ops-guest-notes)

- **Review boundary** · A host may review notes within Sessions with Gather access. Publish handles editorial acceptance and output. Verify guest attribution and release visibility.
- **M11** · Ordinary sessions accept notes afterward. Structured live tasting results and personal journaling remain separate surfaces.

Sources · [src/admin/views/CustomerNotesView.tsx](../../src/admin/views/CustomerNotesView.tsx), [src/admin/components/EventDetail.tsx](../../src/admin/components/EventDetail.tsx)

Related · [Publish · Magazine entry](#ops-publish), [Sessions · Host workspace](#ops-event), [Sessions · Structured tasting host controls](#ops-group-tasting)

<a id="ops-wisdom"></a>

### Publish · Wisdom and integrity review

**Current** · `/admin/wisdom` · Publish bundle

[Open desktop and phone wireframes](wireframes.html#ops-wisdom)

- **Addressing** · Wisdom reads its tab, entry, query and shape parameters. review=integrity and finding select a review surface and record.
- **Preview mode** · A local-only tea-reference-preview build opens Wisdom against local read-only endpoints. Normal product access still requires the Publish grant.
- **Evidence chain** · Resolve duplicate or ambiguous tea identity and preserve provenance. A source refresh does not publish copy. Ambiguous and hidden relations stay private.

Sources · [src/admin/views/WisdomView.tsx](../../src/admin/views/WisdomView.tsx), [src/admin/views/TeaReferenceIssuesView.tsx](../../src/admin/views/TeaReferenceIssuesView.tsx), [src/admin/views/TeaReferenceReviewView.tsx](../../src/admin/views/TeaReferenceReviewView.tsx)

Related · [Publish · Magazine entry](#ops-publish), [Stock · Product story and evidence](#ops-stock-story), [Stock · Holding and movements](#ops-stock-record), [Curate · Library](#ops-library), [Curate · Capture evidence and corrections](#ops-source-evidence)

<a id="ops-tea-masters"></a>

### Publish · Tea Masters roster

**Partial** · `/admin/contributors` · Owner tier

[Open desktop and phone wireframes](wireframes.html#ops-tea-masters)

- **Identity** · Person, public contributor profile and hosted shop are separate records. Current invite can provision a private hosted shop. The approved person-first option is separate and remains an onboarding work item.
- **Permissions** · Owner entry belongs under Publish. Profile publication, invite acceptance and payment pages have their own permission checks and public outcomes.

Sources · [src/admin/views/ContributorsView.tsx](../../src/admin/views/ContributorsView.tsx), [src/admin/components/contributorEditor/PersonPage.tsx](../../src/admin/components/contributorEditor/PersonPage.tsx), [todo/plans/tea-master-onboarding.md](../../todo/plans/tea-master-onboarding.md)

Related · [Publish · Magazine entry](#ops-publish), [Settings · Members and access](#ops-members), [Settings · Shop and launch readiness](#ops-settings), [Network · Shared sourcing catalog](#ops-network)

<a id="ops-settings"></a>

### Settings · Shop and launch readiness

**Current** · `/admin/account-settings` · Owner tier

[Open desktop and phone wireframes](wireframes.html#ops-settings)

- **Role** · Owner can reach settings. Members-only operator lands in Members. Rates, Platform and Adoptions doorways require a platform role.
- **Changes** · System identifiers are read only here. Compare storefront publication with intended account state. Review shipping route changes and ownership transfer explicitly.
- **Release evidence** · Checklist UI is a starting point. It cannot satisfy the first-sale or second-shop acceptance gate on its own.

Sources · [src/admin/views/AccountSettingsView.tsx](../../src/admin/views/AccountSettingsView.tsx)

Related · [Settings · Members and access](#ops-members), [Settings · Relationship audit](#ops-audit), [Settings · Voice and agent access](#ops-agents), [Settings · Exchange rates](#ops-rates), [Platform · Accounts, users and audit](#ops-platform), [Network · Adoption review](#ops-network-adoptions), [Proposed · Freight bill and rate approval](#ops-freight)

<a id="ops-members"></a>

### Settings · Members and access

**Current** · `/admin/access` · Members bundle

[Open desktop and phone wireframes](wireframes.html#ops-members)

- **Capability** · Sales, Stock, Events, Content, Manager, Access manager and Viewer presets map to bundle grants. Roster access, owner changes and placement approvals have distinct checks.
- **Invites** · A newly generated link is copyable and establishes account acceptance. Confirm expired/invalid invitation and address scope on acceptance.
- **Compatibility** · /admin/team and /admin/members redirect here. Maintain separation from global accounts and platform users.

Sources · [src/admin/views/AccessView.tsx](../../src/admin/views/AccessView.tsx)

Related · [Settings · Shop and launch readiness](#ops-settings), [Settings · Relationship audit](#ops-audit), [Platform · Network membership](#ops-platform-access), [Publish · Tea Masters roster](#ops-tea-masters)

<a id="ops-audit"></a>

### Settings · Relationship audit

**Current** · `/admin/audit` · Owner tier or Members bundle

[Open desktop and phone wireframes](wireframes.html#ops-audit)

- **Placement** · Settings owner menu links here. Members-bundle operators can reach the direct route; their Settings opens Members with no equivalent child in manageNav.
- **Scope** · Review relationship evidence before repairing. Keep account-level data distinct from the platform audit log.

Sources · [src/admin/components/PeopleAuditView.tsx](../../src/admin/components/PeopleAuditView.tsx)

Related · [Settings · Shop and launch readiness](#ops-settings), [Settings · Members and access](#ops-members), [People · Directory and tags](#ops-people), [People · Supplier profile](#ops-supplier), [Stock · Holding and movements](#ops-stock-record), [Platform · Audit log](#ops-platform-audit)

<a id="ops-agents"></a>

### Settings · Voice and agent access

**Current** · `/admin/mcp-tokens` · Owner tier

[Open desktop and phone wireframes](wireframes.html#ops-agents)

- **Read and write** · Private MCP access scopes by token and tenant. Writes use preview and confirmation on scoped actions. Public MCP is read-only.
- **Security and errors** · Secret appears on mint, and revoke changes future access. Never reproduce credentials in the blueprint. Verify expired, restricted and denied credential behavior separately.

Sources · [src/admin/views/MCPTokensView.tsx](../../src/admin/views/MCPTokensView.tsx), [docs/claude/mcp.md](../../docs/claude/mcp.md)

Related · [Settings · Shop and launch readiness](#ops-settings), [Agent authorization request](#ops-oauth-consent), [Curate · Capture evidence and corrections](#ops-source-evidence), [Proposed · Freight bill and rate approval](#ops-freight)

<a id="ops-oauth-consent"></a>

### Agent authorization request

**Current** · `/admin/oauth-consent or /admin/oauth-consent/:requestId` · Owner tier

[Open desktop and phone wireframes](wireframes.html#ops-oauth-consent)

- **Request shapes** · Both path-based request and legacy query fields feed the consent component. Invalid, missing and pending request states have dedicated copy.
- **Return** · Validate the requesting client, redirect and scoped approval before issuing authority. User declines via the consent flow.

Sources · [src/admin/views/OAuthConsentView.tsx](../../src/admin/views/OAuthConsentView.tsx)

Related · [Settings · Voice and agent access](#ops-agents), [Settings · Shop and launch readiness](#ops-settings)

<a id="ops-rates"></a>

### Settings · Exchange rates

**Current** · `/admin/currency` · Platform role

[Open desktop and phone wireframes](wireframes.html#ops-rates)

- **Money** · A missing rate remains unavailable and displays a dash. An in-use currency cannot be deleted. Preserve canonical display aliases and manually entered zero where appropriate to the owning field.
- **Door gap** · Today can surface a rate link for a shop owner; the target requires a platform role. Compare the accurate missing-rate recovery state for ordinary owners.

Sources · [src/admin/views/CurrencyRatesView.tsx](../../src/admin/views/CurrencyRatesView.tsx), [docs/claude/money.md](../../docs/claude/money.md)

Related · [Settings · Shop and launch readiness](#ops-settings), [Today](#ops-today), [Stock · Holding and movements](#ops-stock-record), [Proposed · Freight bill and rate approval](#ops-freight)

<a id="ops-freight"></a>

### Proposed · Freight bill and rate approval

**Proposed** · `/admin/account-settings (Commerce) plus Purchases / agent preview` · Owner tier

[Open desktop and phone wireframes](wireframes.html#ops-freight)

- **M13 approval** · An agent may file the bill and propose a shop-wide rate. Applying a rate needs Adrian’s approval after seeing old rate, proposed rate and number of affected prices.
- **Two legs** · Supplier invoice shipping covers the supplier-to-forwarder leg. The shop rate covers air plus Bali. Keep shipment billing and shop-wide price inputs separate.
- **Implementation boundary** · Current settings contain the rate field and Stock has freight tools. This approval interaction is a future wireframe.

Sources · `todo/plans/manage-rebuild-decisions.md M13`, [worker/src/shippingRate.ts](../../worker/src/shippingRate.ts), [src/admin/views/AccountSettingsView.tsx](../../src/admin/views/AccountSettingsView.tsx)

Related · [Settings · Shop and launch readiness](#ops-settings), [Purchases · Warehouse and shipment tracking](#ops-logistics), [Purchases · Tracking task](#ops-purchase-record), [Stock · Holding and movements](#ops-stock-record), [Settings · Voice and agent access](#ops-agents), [Settings · Exchange rates](#ops-rates)

<a id="ops-network"></a>

### Network · Shared sourcing catalog

**Current** · `/admin/network?tab=catalog` · Catalog, Sell or platform role

[Open desktop and phone wireframes](wireframes.html#ops-network)

- **Capability split** · Network route accepts Catalog, Sell or platform role. Catalog and Suggestions require Catalog. Adoptions needs a platform role. A Sell-only user may get the no-working-surface message.
- **Validation** · A partner listing projection does not prove buyer and seller account isolation or the real second-operator order.

Sources · [src/admin/views/NetworkLanding.tsx](../../src/admin/views/NetworkLanding.tsx), [src/admin/views/CatalogBrowse.tsx](../../src/admin/views/CatalogBrowse.tsx)

Related · [Network · Suggestions inbox](#ops-network-suggestions), [Network · Adoption review](#ops-network-adoptions), [Network · Partner listing](#ops-network-listing), [Sales · Wholesale orders](#ops-sales-wholesale), [Stock · Tea Glossary / catalog](#ops-glossary)

<a id="ops-network-suggestions"></a>

### Network · Suggestions inbox

**Current** · `/admin/network?tab=suggestions` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-network-suggestions)

- **Decision state** · Check source, reviewed status and local shop scope from inbox to listing. After resolving, return with the correct active tab.
- **Alias** · /admin/network/suggestions is retained for inbound links.

Sources · [src/admin/views/NetworkLanding.tsx](../../src/admin/views/NetworkLanding.tsx), [src/admin/views/SuggestionsInbox.tsx](../../src/admin/views/SuggestionsInbox.tsx)

Related · [Network · Shared sourcing catalog](#ops-network), [Network · Partner listing](#ops-network-listing), [Network · Adoption review](#ops-network-adoptions)

<a id="ops-network-adoptions"></a>

### Network · Adoption review

**Current** · `/admin/network?tab=adoptions` · Platform role

[Open desktop and phone wireframes](wireframes.html#ops-network-adoptions)

- **Plan gate** · Platform staff can review adoption requests. Confirm the destination shop only receives intended record and resale data.
- **Compatibility** · /admin/network/adoptions redirects here. Settings exposes this link to platform roles.

Sources · [src/admin/views/NetworkLanding.tsx](../../src/admin/views/NetworkLanding.tsx), [src/admin/views/AdoptionQueue.tsx](../../src/admin/views/AdoptionQueue.tsx)

Related · [Network · Shared sourcing catalog](#ops-network), [Network · Partner listing](#ops-network-listing), [Publish · Received collection](#ops-collection-inbound), [Settings · Shop and launch readiness](#ops-settings), [Platform · Accounts, users and audit](#ops-platform)

<a id="ops-network-listing"></a>

### Network · Partner listing

**Current** · `/admin/network/listings/:listingId` · Catalog, Sell or platform role

[Open desktop and phone wireframes](wireframes.html#ops-network-listing)

- **Price and permissions** · Preserve entered currency when asynchronously loading shop context. Source data and local edits remain separate. Viewer ability to open a route does not grant every write.
- **Scope** · Confirm sourcing across separate accounts including removed listings and refreshes.

Sources · [src/admin/views/PartnerListingEdit.tsx](../../src/admin/views/PartnerListingEdit.tsx)

Related · [Network · Shared sourcing catalog](#ops-network), [Network · Suggestions inbox](#ops-network-suggestions), [Network · Adoption review](#ops-network-adoptions), [Wholesale · Draft and submission](#ops-wholesale-draft), [Stock · Holding and movements](#ops-stock-record)

<a id="ops-platform"></a>

### Platform · Accounts, users and audit

**Current** · `/admin/platform` · Platform role

[Open desktop and phone wireframes](wireframes.html#ops-platform)

- **Role tiers** · The route admits a platform role. Individual grant, shelf and account actions have additional controls. Verify a privileged admin and a lower-role viewer independently.
- **Audit** · Audit preview and full audit page coexist. Only global tasks should land in this platform space.

Sources · [src/admin/views/PlatformAdminView.tsx](../../src/admin/views/PlatformAdminView.tsx)

Related · [Platform · Network membership](#ops-platform-access), [Platform · Audit log](#ops-platform-audit), [Platform · All stock](#ops-platform-stock), [Settings · Shop and launch readiness](#ops-settings)

<a id="ops-platform-access"></a>

### Platform · Network membership

**Current** · `/admin/access/platform` · Platform role

[Open desktop and phone wireframes](wireframes.html#ops-platform-access)

- **Different scope** · Platform directory is distinct from per-shop Members. Suspending/reactivating a network account requires the corresponding permission, review and audit trail.
- **Second operator** · Establish the intended account and person relationship before testing it through scoped Your Table access.

Sources · [src/admin/views/PlatformAccessView.tsx](../../src/admin/views/PlatformAccessView.tsx)

Related · [Platform · Accounts, users and audit](#ops-platform), [Settings · Members and access](#ops-members), [Network · Shared sourcing catalog](#ops-network), [Settings · Shop and launch readiness](#ops-settings)

<a id="ops-platform-audit"></a>

### Platform · Audit log

**Current** · `/admin/platform/audit-log` · Platform role

[Open desktop and phone wireframes](wireframes.html#ops-platform-audit)

- **Read states** · Distinguish an empty filtered query, no events and failed refresh. Global activity concerns remain separate from shop relationship Audit and site incident repair.

Sources · [src/admin/views/PlatformAuditLogPage.tsx](../../src/admin/views/PlatformAuditLogPage.tsx)

Related · [Platform · Accounts, users and audit](#ops-platform), [Platform · Network membership](#ops-platform-access), [Settings · Relationship audit](#ops-audit), [Your Table · Site problems](#ops-fixes)

<a id="ops-platform-stock"></a>

### Platform · All stock

**Current** · `/admin/platform/all-stock` · Platform role

[Open desktop and phone wireframes](wireframes.html#ops-platform-stock)

- **Permission** · Cross-shop holdings appear on a platform-role route. Keep this view and its data separate from the active shop’s Stock permissions.
- **Visibility** · Listed and shown in the shop are distinct signals. Verify anonymized/cross-shop outcomes through their read models.

Sources · [src/admin/views/MovementStockView.tsx](../../src/admin/views/MovementStockView.tsx)

Related · [Platform · Accounts, users and audit](#ops-platform), [Stock · Shelf and saved views](#ops-stock), [Stock · Holding and movements](#ops-stock-record)

<a id="ops-fixes"></a>

### Your Table · Site problems

**Current** · `/account/fixes` · Platform-owner doorway; global incident API requires platform admin

[Open desktop and phone wireframes](wireframes.html#ops-fixes)

- **Ledger** · Visitor issues and stale rates stay in incident_ledger. Correct the root cause before marking resolved with resolution_ref. Worker health checks use the existing problem helpers.
- **Gap** · The current quiet list is a disclosure. A later compact view can keep the same actions visible by moving quiet history to ordinary navigation.
- **Access** · Launchpad uses platform-owner visibility. The page uses useAuth().isAdmin and the API requires platform admin for human requests. Verify this mismatch for a non-platform shop owner and platform staff. Empty results show Nothing needs fixing.

Sources · [src/pages/SiteFixesPage.tsx](../../src/pages/SiteFixesPage.tsx), [src/components/AccountPanel/LaunchpadView.tsx](../../src/components/AccountPanel/LaunchpadView.tsx), [docs/claude/site-problems.md](../../docs/claude/site-problems.md)

Related · [Your Table · Membership and location](#ops-table), [Your Table · Development library and briefing](#ops-access-docs), [Platform · Audit log](#ops-platform-audit), [Settings · Exchange rates](#ops-rates)

<a id="ops-table"></a>

### Your Table · Membership and location

**Current** · `/account` · Signed-in user; tool links vary by grant

[Open desktop and phone wireframes](wireframes.html#ops-table)

- **Switch** · Change the active membership or location without disclosing another account’s cached data. Re-enter a deep link only where access is still granted.
- **Personal surfaces** · Profile, journal, cellar, orders and collections are account/personal destinations. The operator’s settings and platform roles are distinct.

Sources · [src/components/AccountPanel/index.tsx](../../src/components/AccountPanel/index.tsx), [src/components/AccountPanel/AccountSwitcherChip.tsx](../../src/components/AccountPanel/AccountSwitcherChip.tsx), [src/components/AccountPanel/LaunchpadView.tsx](../../src/components/AccountPanel/LaunchpadView.tsx)

Related · [Manage shell and access gate](#ops-shell), [Settings · Shop and launch readiness](#ops-settings), [Settings · Members and access](#ops-members), [Your Table · Personal settings and profile](#ops-personal-settings), [Your Table · Site problems](#ops-fixes), [Your Table · Development library and briefing](#ops-access-docs)

<a id="ops-personal-settings"></a>

### Your Table · Personal settings and profile

**Current** · `/account/settings or /account/profile` · Signed-in user

[Open desktop and phone wireframes](wireframes.html#ops-personal-settings)

- **Scope** · Do not mix an individual’s preferences or profile with a shop’s public settings. Hosted Master profile, public preview and payment controls vary by role and ownership.
- **Paired account proof** · Validate account switching and profile links where an identity belongs to multiple stores.

Sources · [src/pages/AccountSettingsPage.tsx](../../src/pages/AccountSettingsPage.tsx), [src/pages/AccountProfilePage.tsx](../../src/pages/AccountProfilePage.tsx)

Related · [Your Table · Membership and location](#ops-table), [Settings · Shop and launch readiness](#ops-settings), [Settings · Members and access](#ops-members), [Publish · Tea Masters roster](#ops-tea-masters)

<a id="ops-access-docs"></a>

### Your Table · Development library and briefing

**Current** · `/account/docs or /account/briefing` · Restricted by each page and launchpad gate

[Open desktop and phone wireframes](wireframes.html#ops-access-docs)

- **Audience** · View separately from shared shop administration. Check route access and keep actionable incident state in Needs fixing.
- **Reference** · Operational/readiness explanation may link to current jobs. It is not evidence of a completed sale, shipment or second store.

Sources · [src/pages/DeveloperDocsPage.tsx](../../src/pages/DeveloperDocsPage.tsx), [src/pages/BriefingPage.tsx](../../src/pages/BriefingPage.tsx)

Related · [Your Table · Membership and location](#ops-table), [Your Table · Site problems](#ops-fixes), [Settings · Shop and launch readiness](#ops-settings)

<a id="ops-curate-classic"></a>

### Reference · Classic Source

**Reference** · `/admin/compass?form=classic` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-curate-classic)

- **Reference** · Keep available while changes to the current Source are reviewed. The approved base is the current compact flow. Browser specs opt into classic for parity.

Sources · [src/components/TeaCompass/CaptureCard.tsx](../../src/components/TeaCompass/CaptureCard.tsx), [src/components/curate/captureFormLayout.ts](../../src/components/curate/captureFormLayout.ts)

Related · [Curate · Source](#ops-source), [Curate · Library](#ops-library)

<a id="ops-curate-v2"></a>

### Reference · Curate v2

**Reference** · `/admin/compass/v2` · Catalog bundle

[Open desktop and phone wireframes](wireframes.html#ops-curate-v2)

- **Retained reference** · /admin/curate/v2 is a compatibility door. V2 is a retained study. Apply approved Source and Library refinements to the current Curate base.
- **Comparisons** · Existing V2 tests prove the study states they name. The current Manage baseline uses its own fixtures.

Sources · [src/admin/AdminApp.tsx](../../src/admin/AdminApp.tsx), [src/components/CurateV2/](../../src/components/CurateV2/)

Related · [Curate · Source](#ops-source), [Curate · Library](#ops-library)
