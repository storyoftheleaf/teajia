# Curate and Inventory Ingestion Design

**Status:** Approved design implemented and verified
**Date:** 2026-07-12  
**Surfaces:** Curate (`/admin/compass`), Inventory (`/admin/stock`), existing sample workflows, imports, purchase records  
**Primary user:** Adrian sourcing tea and teaware in person, through WeChat, vendor lists, labels, photographs, and invoices

**Implemented boundary (2026-07-12):** Text, TXT, CSV, and JSON evidence can be extracted into reviewed import drafts. Images and PDFs are preserved as original evidence for manual review; OCR is not claimed. Accepted acquisitions become reviewed Inventory receipt proposals, possession is derived only after receipt acceptance, and transfers require a destination holding linked to the same identity. Additive migrations `099`–`107` carry the account-scoped, retry-safe schema. Tasks 1–18, migration rehearsals, full automated verification, and both independent final reviews are complete.

## 1. Why this work exists

Curate and Inventory are individually capable, but too many concepts currently appear in multiple places or sit beside unrelated concepts as if they were peers. The goal is not to replace the current Curate interface. Its live-capture layout is already close to the desired experience. The goal is to clarify where information belongs, remove duplicated mental models, and connect ingestion to physical stock without re-entry.

The governing distinction is:

- **Curate records what Adrian encounters and learns.**
- **Inventory records what physically exists in Adrian's possession.**

The same tea or teaware identity should connect both for all new ingestion-created holdings. A Curate record can exist without Inventory. Existing Inventory products and structured Inventory imports remain valid even when they have no Curate link; legacy records can be linked progressively rather than through a dangerous non-null migration.

## 2. Field reality this design must respect

### In-person sourcing

Adrian usually discusses one tea at a time, sequentially. Information arrives as spoken fragments in no reliable order. Price may arrive before identity and may determine whether the tea is worth pursuing. Adrian is trying to connect with the vendor, not operate a structured data-entry workflow.

Therefore:

- Curate must open directly into a blank or resumed tea entry.
- It must never open to a choice screen.
- Common fields must remain independently writable in any order.
- Price must remain first-class and visible, not hidden behind a later buying decision.
- Incomplete entries are legitimate records.
- `Done` means "finished for now," not "all required fields are complete."
- Work must be continuously preserved while the conversation continues.
- Any deliberate fragment makes an entry saveable. Price, type, origin, year, form, classification, quantity, decision, vendor, photograph, or notes must each be sufficient on their own. Only a truly untouched auto-created entry may be discarded.

This corrects a critical current mismatch: the existing `entryHasContent` logic does not count price, type, origin, year, form, status, or acquisition details, so a price-only entry can currently disappear when Done is pressed.

### Later ingestion

Information also arrives through:

- Pasted WeChat messages
- Vendor tea or teaware lists
- Sample invoices
- Purchase invoices
- Labels and packaging photographs
- Files or copied text

This material may describe multiple teas or teaware items. Import should separate it into draft Curate entries while retaining the original material as provenance.

### Delayed decisions and development

Adrian may decide in a store that he wants to work with a tea, while still lacking the description, classification, final pricing, or considered writing required for a sellable product. He may take a sample home and sit with it for a long time before deciding or developing it.

The system must represent this delay without pretending that the tea is ready, losing the encounter, or forcing duplicate entry.

## 3. Non-negotiable preservation rules

The following are design constraints, not suggestions:

1. **Preserve the current Curate field sheet.** Do not replace it with a wizard, fragment feed, dashboard, landing screen, or new card system.
2. **Curate remains one button away.** Opening Curate immediately creates or resumes the active tea entry.
3. **Tea remains the default.** No intermediate choice is introduced.
4. **Teaware remains one visible tap away.** Curate ingests both tea and teaware.
5. **Pricing remains visible in the main tea capture surface.** It is not progressively disclosed behind Buy.
6. **Information remains order-independent.** No completeness gate blocks capture.
7. **Every encountered item can be kept.** Buying is not required for Library inclusion.
8. **Storefront publication remains deliberate.** Readiness never auto-publishes a product.
9. **No navigation labels or routes change without explicit confirmation.** This specification can recommend changes but does not authorize them.
10. **Inventory's height and scrolling contract must remain intact.** Any implementation must preserve every required `h-full`, `flex-1`, and `min-h-0` ancestor.
11. **Do not change the existing Tea or Teaware field-sheet composition in the first rollout.** Field order, widths, grouping, typography, expanded state, price placement, and session switching are frozen unless separately reviewed.
12. **Import cannot interrupt the active entry.** Closing Import returns to the previously active Tea or Teaware entry without silently committing, replacing, or discarding it.

## 4. Proposed Curate structure

The visible top-level Curate structure remains:

```text
Source | Library | Ledger
```

This design does not assume that `Ledger` is the final label. Reviewers should evaluate whether it clearly communicates vendor purchases and acquisition records, but must not add another top-level destination casually.

### 4.1 Source capture modes

Replace the third option in the current capture row:

```text
Tea | Teaware | Samples
```

with:

```text
Tea | Teaware | Import
```

Behavior:

- **Tea:** the current tea field sheet, opened by default.
- **Teaware:** the current teaware field sheet.
- **Import:** opens a temporary ingestion panel for pasted text, photos, invoices, labels, and files. It may contain tea and teaware together. Closing it restores the previously active entry.

Opening Curate must still land in Tea. Import is one action away, never a landing gate.

Tea and Teaware are entity categories while Import is an ingestion method. This mixed taxonomy is accepted deliberately because one-tap access and the existing spatial pattern matter more than taxonomic purity. The accessible label for the control should therefore become `Capture method`, not `Capture type`.

### 4.2 Existing session queue

The existing session row and sequential-entry behavior should be preserved. Imported records converge on the same review model, but a multi-item import appears first as one grouped import batch that can expand into its entries. It must not flood the session strip with dozens of indistinguishable chips.

Import must not create a parallel repository.

### 4.3 Import behavior

Import accepts one or more inputs:

- Paste text
- Add photograph
- Add file
- Scan invoice or label

It should:

1. Preserve the untouched original input.
2. Identify likely tea and teaware records.
3. Split multiple items into distinct draft entries.
4. Extract fields only when confidence is sufficient.
5. Mark uncertain values visibly without blocking the import.
6. Allow merging accidental duplicates.
7. Place all draft entries into the current Curate session queue.
8. Allow Adrian to accept the whole import, correct individual entries, or leave them incomplete.
9. If quantities were acquired, propose Inventory receipts for review rather than silently creating stock.
10. Persist incomplete imported entries durably. The current client-only `pendingEntries` queue is not sufficient because it is lost on refresh.

The name is **Import**, not Quick Import. The capability should be broad and durable.

### 4.4 What happens to Samples

Samples are not an entity type. Tea and Teaware describe what a record is. However, `sample` currently represents two distinct concepts that must remain separate:

1. **Sample holding:** a physical quantity owned for evaluation.
2. **Sample portion or set:** a prepared or received tasting unit used in a sourcing set, panel, event, label workflow, or customer gift.

A sample portion may reference a tea identity and a physical holding, but it is not reducible to an Inventory purpose flag.

Therefore, Samples moves out of the Tea/Teaware capture-type row without removing its existing functions.

Sample functions should remain available through:

- A contextual Sample action on a tea entry
- A current sample order/cart entry point when the cart is non-empty
- Importing a sample invoice
- Inventory's purpose-based Samples view after physical receipt
- Library filters for sample-related state
- Existing sample tasting, labeling, set, and decision workflows
- A persistent, count-bearing current sample-order action whenever the cart is non-empty
- A visible way to start a sample order from an empty state through the contextual Sample action on a tea
- Continued access to historical sample sets and `/admin/samples` until a separately reviewed replacement proves full parity

The implementation must audit and preserve the current `SampleCartPanel`, `SampleSetCreator`, sample labels, tasting status, panels/events/customer purposes, and Compass/product linkage. This is a relocation and clarification, not deletion. The Samples tab can only move after every replacement entry point is visible and tested.

## 5. Curate Library

The Library is the complete memory of every tea or teaware item Adrian has recorded or imported.

Library inclusion does not depend on purchase, possession, readiness, or publication.

It includes items Adrian:

- Only heard about
- Was offered
- Saw on a vendor list
- Sampled
- Bought
- Received for free
- Was interested in
- Selected to develop
- Passed on
- Might revisit later

### 5.1 Natural retrieval

Library must support how Adrian remembers encounters:

- Journey or sourcing trip
- Visit or vendor
- Place
- Date
- Tea or teaware type
- Origin
- Price
- Photograph
- Free-text search

The current automatic six-hour session is not a journey. The context model is:

```text
Journey (optional, long-lived)
  Visit (optional, vendor / place / date)
    Capture session or import batch (automatic)
      Entries
```

Journey and Visit must never be mandatory before capture. The active context can be quietly inherited from the previous entry and edited afterward. An import batch preserves provenance but does not pretend to be a physical visit.

Example:

```text
Taiwan, Spring 2026
  Chen Family visit
    Dong Ding 1998
    Competition Qingxin
  Lin Tea House visit
    Aged Tieguanyin
```

Each item remains independently searchable.

### 5.2 Curate decision state

Curate needs a small decision vocabulary describing Adrian's relationship to an encountered item:

- **No decision:** the default; no visible status needs to be applied
- **Considering:** worth revisiting, sampling, or considering
- **Selected:** Adrian has chosen to develop or work with it
- **Passed on:** consciously declined as a sourcing decision

This decision is independent from tasting verdict (`love`, `like`, `neutral`, `pass`). `Passed on` and tasting `Not for me` must not be collapsed even if both currently use variants of `pass`.

The existing Compass `status` mixes decision, acquisition, possession, and depletion. Implementation must add a nullable decision field and retain legacy status read-compatibility during migration. Only unambiguous values may be conservatively backfilled. Selected must not be inferred from `buying`, `incoming`, `in_stock`, or `depleted`.

Physical possession and stock do not belong in this decision state.

### 5.3 Library filters and sorting

Do not place unrelated dimensions in one row of peer tabs.

Recommended primary views:

- All
- To taste
- Selected

Decision values such as No decision, Considering, and Passed on belong inside Filters rather than all competing as primary tabs.

Recommended filters:

- Journey / visit
- Vendor
- Place
- Date range
- Tea / teaware
- Type / classification
- Origin
- Year
- Price range
- Sample requested / received / tasted
- Has photograph
- Missing selected information
- Decision: No decision / Considering / Selected / Passed on
- Tasting verdict: Loved / Liked / Neutral / Not for me
- Possession: None / Sample / Working / Personal

Recommended sorting:

- Recently captured
- Recently updated
- Name
- Vendor
- Price
- Year

Recommended display controls:

- List
- Photos

The final visual hierarchy must keep search and the collection itself dominant. Maintenance, incoming shares, batch review, cleanup, sort, and display must not all compete in the first viewport.

## 6. Inventory as physical truth

Anything physically possessed belongs in Inventory, including a free 10g sample. Otherwise the system cannot reliably answer, "What do I have?"

A Curate record can have zero, one, or multiple Inventory movements over time.

### 6.1 Purpose

Inventory purpose describes why the physical holding exists:

- **Sample:** held for evaluation
- **Working:** operational stock used, served, or sold
- **Personal:** owned outside operational stock
- Incoming is not a purpose because unreceived tea is not physically possessed.

Depleted is derived from quantity and movement history, not chosen as a purpose.

Acquisition logistics are separate:

- Planned
- Ordered
- In transit
- Partially received
- Received
- Cancelled

The visible Incoming view is derived from open expected receipts.

### 6.2 Development readiness

Readiness is independent of purpose and publication.

A Working tea is **Ready** when it has the four requirements Adrian specified:

1. A description of the tea type
2. Pricing
3. Classification
4. A stock amount

Before implementation, these phrases must be mapped to exact fields. The current working interpretation for review is:

- `description of the tea type` = a sellable public description, not merely a selected type label
- `pricing` = a positive retail sell price, not vendor cost
- `classification` = the appropriate tea classification/type taxonomy
- `stock amount` = a known working quantity; whether zero counts as known-but-not-sellable must be decided explicitly

Readiness should initially be derived rather than stored as another mutable status. This specification defines tea readiness only. Teaware readiness remains unchanged until separately specified.

Photos, tasting profile, brewing guidance, product story, and additional provenance are optional enrichment. Their absence never blocks sellability.

Inventory must name missing requirements explicitly:

```text
Da Xue Shan
Missing price and classification
```

Selecting a missing requirement should open the same identity record at the relevant Curate development field. Inventory identifies the work; Curate is where knowledge is developed.

### 6.3 Publication

Publication is a deliberate choice and never inferred from readiness. Existing publication has more than one gate (`isPublic` and location-level `shownInShop`); implementation must preserve those meanings and present effective storefront visibility rather than flattening them into one lossy boolean.

```text
Purpose: Working
Readiness: Ready
Publication: Hidden
```

is valid and expected.

### 6.4 Inventory views

Recommended primary purpose views:

- Working
- Samples
- Personal
- All holdings

Incoming remains a separate operational view derived from open receipts, not a purpose tab.

Recommended action-oriented views:

- Needs development
- To taste
- Reorder
- Low stock
- Missing location

Purpose views and action views must be visually distinguished. They are different questions:

- Purpose: Why is this held?
- Action: What needs attention?

Recommended filters:

- Tea / teaware
- Classification
- Type
- Vendor / source
- Origin
- Location
- Purpose: Sample / Working / Personal
- Receipt state
- Readiness
- Publication
- Stock state

Recommended sorting:

- Name
- Recently received
- Recently changed
- Stock quantity
- Stock value
- Retail price
- Development readiness

Sorting must not masquerade as a saved view.

### 6.5 Stock movement

Inventory owns reductions and all other physical movements:

- Receipt
- Sale
- Sample use
- Gift
- Waste
- Transfer
- Recount / correction
- Return

The default interaction should record a movement with reason and quantity rather than silently overwrite the balance. Absolute replacement remains available for deliberate recount/verification workflows.

## 7. Cross-surface examples

### Encountered but not bought

```text
Curate Library: No decision or Considering
Inventory: No holding
Readiness: Not applicable
Publication: Not applicable
```

The tea remains findable by journey, vendor, date, type, origin, price, and search.

### Free 10g sample

```text
Curate Library: Considering
Inventory: Sample, 10g
Readiness: Not required for sample possession
Publication: Hidden
```

### Selected in person, not developed

```text
Curate Library: Selected
Inventory: Sample holding 10g, or expected receipt 500g with zero on hand
Readiness: Not ready
Publication: Hidden
```

The visible Incoming view may show the expected 500g, but Incoming is not an Inventory purpose.

### Developed but deliberately unpublished

```text
Curate Library: Selected
Inventory: Working 500g
Readiness: Ready
Publication: Hidden
```

### Published working stock

```text
Curate Library: Selected
Inventory: Working 500g
Readiness: Ready
Publication: Published
```

## 8. Existing capabilities that must be reconciled

Implementation planning must audit, not bypass:

- Current Curate Source / Library / Ledger routing
- Current Tea / Teaware / Samples capture option
- `SampleCartPanel` and sample cart store
- Sample sets, label printing, tasting state, and graduation into products
- Curate status vocabulary and filters
- Automatic Curate commit and Draft product promotion
- Current CSV Inventory import
- Current Add Product modal
- Inventory saved views, filters, grouping, sorting, and columns
- `is_sample`, `is_personal`, `is_public`, product status, publication, and placement flags
- Stock ledger and invoice-driven reductions
- Multi-account scoping and store publication
- Desktop and mobile behavior
- Current six-hour automatic session heuristic and the absence of Journey/Visit entities
- Device-local pending captures and sample data that are not yet durably synced
- Existing dual publication gates and location-owner approval

The reviewer must explicitly identify which existing fields can be reused, which need migration, and which meanings are currently overloaded.

## 9. Technical model and compatibility direction

This is a design-level model, not a final migration. It records the minimum boundaries implementation planning must preserve.

### 9.1 Curate decision and legacy status

- Add a nullable decision dimension: `none | considering | selected | passed_on`.
- Keep the current overloaded Compass status readable during migration.
- Backfill only unambiguous meanings.
- Preserve tasting verdict separately.
- Never infer Selected from purchase, possession, depletion, or publication.

### 9.2 Import provenance and durable review

Import requires durable, account-scoped records for:

- Original import metadata and source references
- Individual parsed items
- Confidence and uncertainty
- Review state
- Linked Curate entry
- Optional proposed receipt

Large source files should remain in object storage with references in D1. Server handlers must derive the active account from authentication rather than accepting arbitrary client account identifiers.

### 9.3 Journey, visit, session, and import batch

- Journey and Visit are optional editable context.
- Capture session and import batch remain automatic operational groupings.
- Current six-hour sessions may be retained but cannot be promoted directly into Journey.
- Every new context entity must include `account_id` and creator provenance.

### 9.4 Curate-to-Inventory creation

The current completion flow attempts to promote every committed Curate entry into a Draft product. That trigger must change.

- Encounter-only Curate records stay in Library.
- Import creates Curate records first.
- A reviewed receipt or explicit `Create inventory record` action creates or links the operational product/holding.
- Retry and idempotency guarantees from the current promotion queue must be preserved.
- Existing products without Curate links remain valid.

### 9.5 Inventory purpose compatibility

The long-term purpose dimension is:

```text
working | sample | personal
```

Existing `isSample` and `isPersonal` flags remain during a compatibility period with dual-read/dual-write behavior. Incoming/in-transit remains separate logistics. No destructive boolean migration occurs until all views and APIs use the new meaning consistently.

### 9.6 Readiness and publication

- Readiness starts as a derived predicate, not a stored mutable enum.
- Publication retains the existing public/listing and location-level visibility gates.
- The UI may display an effective storefront state, but must not discard the underlying controls.

### 9.7 Import ownership boundary

- Curate Import owns unstructured evidence: WeChat text, photographs, labels, vendor lists, and invoices requiring interpretation.
- Inventory Import remains available for already structured physical-stock data.
- Confirmed physical lines from Curate Import must reuse the same server-side product/intake and stock-ledger logic as Inventory Import.
- Curate Import must not duplicate stock insertion logic or silently create opening balances.

### 9.8 Stock movements

- All new movement-first operations ledger-write atomically.
- Direct absolute stock editing remains available temporarily as Recount/Correction.
- Direct overwrite can only be removed after Receipt, Sale, Sample use, Gift, Waste, Transfer, Return, and Recount are all covered and tested.

## 10. Safe incremental rollout

### Stage 0: Characterize and protect what exists

- Add regression tests for one-tap Curate opening, visible pricing, Teaware access, responsive field-sheet layout, session switching, sample cart/set/labels, current imports, account scoping, stock ledger, and Inventory scroll.
- Fix deliberate-fragment persistence first, including price-only and type-only entries.
- No visible navigation changes.

### Stage 1: Data safety

- Make incomplete imported/captured work durable across refresh.
- Add nullable decision and import provenance fields.
- Preserve legacy status and sample fields.
- No filter migration yet.

### Stage 2: Add Import without moving Samples

- Prototype Import behind a feature flag or reversible switch.
- Create grouped, durable Curate drafts only.
- Preserve original evidence.
- Do not create Inventory or stock automatically.
- Keep the Samples tab during parity development.

### Stage 3: Add encounter context

- Add optional Journey and Visit.
- Continue automatic sessions/import batches underneath.
- Inherit context quietly; never add a pre-capture step.

### Stage 4: Separate decision and Library filters

- Add the new decision control additively.
- Preserve tasting verdict and legacy status.
- Introduce All / To taste / Selected and the consolidated filter sheet only after data parity tests.

### Stage 5: Review receipts and decouple automatic promotion

- Stop encounter-only saves and imports from automatically creating Draft products.
- Add explicit reviewed receipt proposals or Create inventory record.
- Reuse server intake and ledger behavior.
- Preserve offline retry and idempotency.

### Stage 6: Relocate Samples and expose Import

- Confirm sample cart, active order count, historical sets, labels, tastings, events/panels, and product linkage are all visibly reachable.
- Replace Samples with Import in both responsive capture controls.
- Keep rollback compatibility until real workflows are verified.

### Stage 7: Purpose and readiness views

- Add Working / Samples / Personal / All purpose views through compatibility fields.
- Add Incoming from expected receipts.
- Add derived Needs development after the four readiness predicates are confirmed.
- Do not alter publication.

### Stage 8: Movement-first Inventory

- Add explicit movement workflows.
- Retain direct stock entry as Recount/Correction.
- Remove old overwrite semantics only after complete coverage and ledger verification.

### Stage 9: Remove obsolete chrome last

- Remove legacy filters, labels, duplicated entry points, and compatibility behavior only after every workflow is reachable and validated on desktop and mobile.

## 11. Out of scope for this design

- Replacing the visual design of the current Curate field sheet
- Changing storefront navigation or labels without confirmation
- Gamification, streaks, reminders, or engagement systems
- Requiring photographs or tasting profiles for sellability
- Automatically publishing Ready products
- Creating separate databases for Curate, Samples, Collection, and Inventory when one linked identity can serve them
- Building before the reviewed specification and later implementation plan are approved
- Applying tea readiness rules to teaware without a separate decision

## 12. Success criteria

The final system succeeds when:

1. Adrian taps Curate once and can immediately enter the first fragment about a tea.
2. Price can be entered before any other identity field.
3. A price-only, type-only, origin-only, classification-only, teaware-only, vendor-only, or photo-only deliberate entry survives Done and refresh.
4. Teaware is one tap away.
5. A WeChat list or invoice can be imported without creating a parallel workflow.
6. Every encountered item remains findable even if never purchased.
7. Imported and manually entered items converge in the same Library and grouped review model.
8. A physical sample appears in Inventory without becoming equivalent to Working stock or replacing sample-set operations.
9. Selecting a tea for future work does not pretend it is Ready.
10. Inventory clearly shows which Working items lack the four sellability requirements.
11. Ready never means Published.
12. Stock reductions and receipts are explicit movements with reasons.
13. Existing sample, invoice, and import functions are preserved or deliberately migrated.
14. The number of destinations and duplicated controls is reduced rather than increased.

## 13. Decisions still requiring Adrian's judgment

The independent reviews reduced the remaining curatorial questions to three:

1. In a real tea example, what is the visible difference between **description of the tea type** and **classification**?
2. Is the natural word for a tea Adrian may pursue **Considering**, **Interested**, or **Want**? The design must choose one.
3. For readiness, does a known stock amount of zero mean Ready but unavailable, or does Ready require a positive on-hand quantity?

These are product-language decisions. Exact fields, schema names, endpoints, and migrations are implementation decisions and should not be pushed onto Adrian.

## 14. Questions reviewers must answer

1. Does replacing Samples with Import in the capture-type row preserve every important sample workflow?
2. Is No decision / Considering / Selected / Passed on sufficient and natural, or does it collapse meaningful existing distinctions?
3. Is Incoming correctly modeled as an open-receipts view rather than a purpose?
4. What is the minimum data model that separates identity, physical holding, readiness, and publication without creating migration risk?
5. How should current automatic Draft product promotion change so every Curate encounter does not clutter operational Inventory?
6. Which current Inventory import capabilities belong inside Curate Import, and which should remain Inventory-specific?
7. How should journeys/visits be represented without adding a setup step before field capture?
8. Which filters are primary views, which are secondary filters, and which should disappear because they duplicate another dimension?
9. What are the safest incremental implementation stages?
10. What part of this design is overcomplicated or based on a false assumption?

## 15. Reusable reviewer prompt

Copy the complete prompt below when assigning an independent review.

---

You are reviewing a proposed redesign of ingestion, curation, and physical inventory for Teajia, a professional tea infrastructure product. This is a critique task, not an implementation task. Do not edit code.

Read these sources completely before reviewing:

1. `PRODUCT.md`
2. `AGENTS.md` or repository instructions
3. `docs/superpowers/specs/2026-07-12-curate-inventory-ingestion-design.md`
4. Current Curate implementation under `src/components/TeaCompass/`
5. Current Inventory implementation in `src/admin/components/InventoryView.tsx` and `src/admin/components/inventory/`
6. Current sample workflows under `src/samples/` and related Curate components
7. Current data types and stores relevant to Curate, products, samples, and stock

Context that must not be lost:

- Curate is used in live vendor conversations. Information arrives as spoken fragments in unpredictable order.
- Adrian usually records one tea at a time and wants to stay engaged with the person.
- Price may be the first and most decision-relevant fact.
- Curate must open directly into the current tea entry form. No landing choice or wizard.
- The current Curate layout is strong and must be preserved, not replaced.
- Curate also captures teaware.
- Later inputs include WeChat lists, vendor lists, invoices, labels, photos, and files.
- Every encountered item must remain in the Library even if Adrian never buys it.
- Anything physically possessed, including a free 10g sample, must be represented in Inventory.
- Physical purpose, sellability readiness, and storefront publication are independent.
- A Working tea is Ready when it has a tea-type description, price, classification, and stock amount.
- Photos and tasting profiles are optional.
- Publication is always a deliberate choice.
- Samples currently have substantial workflows that must be preserved even though Samples is proposed to move out of the capture-type row.

Review the specification from your assigned perspective. Be direct and evidence-based. Return:

1. A short verdict: strong, viable with changes, or structurally flawed.
2. What the proposal understands correctly.
3. Hidden contradictions, ambiguous terminology, or missing states.
4. Existing functionality the plan would accidentally break or duplicate.
5. Specific changes that strengthen the specification.
6. A simplified model if the proposal is overcomplicated.
7. Exact file and line references for claims about current behavior.
8. Risks separated into workflow, UX/information architecture, data model/migration, and implementation sequencing.
9. A recommended incremental rollout that preserves current behavior at every stage.
10. Any question that truly requires Adrian's curatorial judgment. Do not ask him implementation-detail questions.

Do not propose a ground-up redesign. Do not hide pricing. Do not add a step before entering a tea. Do not treat incomplete records as errors. Do not assume Ready means Published. Do not delete sample functionality merely because its navigation position changes.

---

## 16. Review and approval gate

This document must be independently reviewed, strengthened, and returned to Adrian before an implementation plan is written. No product code changes are authorized by this specification.
