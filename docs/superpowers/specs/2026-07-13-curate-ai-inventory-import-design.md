# Curate AI Inventory Import Design

**Status:** Approved interaction design and hardening scope
**Date:** 2026-07-13  
**Surface:** Curate Import on mobile first, responsive on desktop  
**Destination:** Inventory, with linked Curate Library identity and provenance

## 1. Outcome

Curate Import turns a pasted vendor list, Chinese message, photograph, invoice, or supported file into reviewed physical Inventory without requiring duplicate entry.

The final user action is `Add N teas to Inventory`. That action reuses or creates the connected records required by the existing systems:

- A Curate Library identity for each tea or teaware item
- An existing Inventory vendor when a credible match exists, otherwise a newly confirmed vendor created through the current vendor system
- One optional existing or newly created sourcing run for the complete import
- A linked Inventory holding or product
- A received purchase receipt and stock movement containing quantity and cost
- The untouched original evidence and AI extraction provenance

Library and Inventory remain separate responsibilities but are created through one coordinated workflow. Library answers what the item is and where it came from. Inventory answers what physical quantity is held and what it cost.

## 2. Current failure

The shipped Import panel is durable but intentionally limited:

- It splits pasted input into one item per non-empty line.
- It extracts only a simple name and tea/teaware category guess.
- It does not translate Chinese.
- It does not parse pack weight, multiplier, per-pack price, total quantity, total cost, or cost per gram.
- Photographs and PDFs are stored as evidence but are not interpreted.
- Accepted items enter Curate review but the import does not complete the intended Inventory intake.
- Review repeats form controls instead of optimizing for a 5–10 item mobile batch.
- Import inputs use 13–14px text, causing iOS to zoom when the user focuses or pastes into them.

The existing durability, account scoping, evidence retention, idempotency, receipt proposal, and stock-movement foundations must be preserved.

## 3. Governing structure

One import represents one coherent purchase or intake batch.

```text
Import batch
  Optional sourcing run, applied once to the whole import
  Vendor group
    Tea item
    Tea item
  Vendor group
    Tea item
```

The common case is one vendor. Multiple vendors are allowed when the pasted evidence has recognizable separators or vendor headings.

### Sourcing run

- Sourcing run is optional and visually secondary.
- It is selected once above all vendor groups.
- The control searches the existing Curate Journey/sourcing-run system first.
- `Create new sourcing run` creates through that same system.
- There are no vendor-level or item-level sourcing-run overrides.
- A different sourcing run requires a separate import.

### Vendor groups

- AI proposes vendor grouping and possible matches.
- Each vendor is resolved once at the group heading, never separately on every tea.
- Matching searches the existing Inventory vendor/customer system first.
- Strong matches are preselected but editable.
- Weak or absent matches require confirmation.
- `Create new vendor` creates through the existing vendor system and then assigns that vendor to the complete group.
- The metadata line reads `Vendor · N teas` or `Vendor · N teas · suggested`.
- A very small `Change` text action sits at the top right of that metadata line.
- The vendor name occupies the complete line below and may wrap. No button may truncate or compete with the vendor name.

## 4. Input and AI analysis

Import accepts:

- Pasted text, including Chinese WeChat and vendor lists
- Photographs of labels, lists, packaging, or invoices
- PDF invoices and vendor sheets
- TXT, CSV, and JSON files already supported by the current evidence pipeline

The system preserves original evidence before analysis.

AI analysis returns typed structured data, not prose-only output:

- Detected source language
- A short batch overview
- Proposed vendor groups and match cues
- Item boundaries and category
- Original name
- English translation
- Chinese name when present
- Tea type, form, year, origin, classification, and description when supported by evidence
- Pack weight and unit
- Pack count or multiplier
- Price amount, currency, and whether the amount is per pack or a line total
- Acquisition state and proposed Inventory purpose when supported
- Field-level confidence and uncertainty reasons
- Evidence spans or source references supporting each extracted value

The overview is brief and operational. Example:

> 8 teas found across 2 vendors. Chinese translated. Prices appear to be per pack. Proposed purchase: 4.21kg for ¥3,840. Two lines need review.

AI may interpret evidence but cannot directly calculate or write stock. Deterministic application code validates types and performs all arithmetic.

Example:

```text
Evidence: 500g ×2 ¥380
Interpretation: ¥380 per 500g pack
Total quantity: 1,000g
Line cost: ¥760
Unit cost: ¥0.76/g
```

Currency conversion is display assistance, not replacement of original cost. The original amount and currency remain authoritative provenance. Converted account-currency estimates use the existing exchange-rate system and show the rate/date used.

## 5. Review by exception

The mobile interface is a compact batch proofread, not a repeated form.

### Batch summary

The top of review shows:

- Optional sourcing run
- Number of items and vendor groups
- Total proposed quantity
- Total cost by original currency
- The AI overview
- Count of items that require review

### Vendor group

Each vendor group shows its resolved or suggested vendor once, followed by all of its compact item rows.

### Compact item row

Every item remains visible. A ready row contains:

- Status mark
- English inventory name
- Original Chinese name when available
- Pack equation, such as `500g ×2 · ¥380 each`
- Total quantity and line cost when space permits
- `Edit tea` action

`Ready` means no blocking ambiguity, not locked. Any row can be opened and edited.

### Expanded item editing

Expanded editing uses a single vertical column on mobile. It edits only item data:

- English name
- Original/Chinese name
- Classification and tea metadata
- Pack weight
- Count
- Price and currency
- Per-pack versus line-total interpretation
- Inventory purpose
- Duplicate identity/product match

Vendor and sourcing-run controls do not repeat inside item editing.

The original evidence line or image reference remains visible during correction.

## 6. Matching and identity

Matching is reuse-first.

### Vendor matching

Candidate scoring uses normalized name, known aliases, company/contact information, previous import evidence, and account scope. No cross-account candidate can appear.

### Tea identity and Inventory matching

For each accepted item, the server proposes:

1. An existing Curate entry/identity match
2. An existing linked Inventory product or holding match
3. A new identity and holding only when no match is accepted

Matching cues include original and translated names, Chinese name, type, year, origin, vendor, and normalized product identity. A weak duplicate match requires review. Import never silently creates a second holding when a credible existing match is unresolved.

## 7. Final Inventory write

The final button reads `Add N teas to Inventory` and includes the batch total when one currency is used.

The server performs the accepted batch as a retry-safe coordinated operation:

1. Validate account ownership, batch state, vendor resolution, item resolution, quantities, and prices.
2. Reuse or create the Curate identity for each item.
3. Reuse or create the Inventory product/holding linked to that identity.
4. Create one received purchase receipt grouped by vendor, under the optional shared sourcing run.
5. Add receipt lines with pack count, received grams/units, original cost, currency, and normalized unit cost.
6. Accept the receipt through the existing receipt/stock-movement domain so stock changes have explicit provenance.
7. Mark import items and the batch completed.

The final operation must reuse current receipt and ledger primitives. Curate Import must not implement a separate stock mutation path or write an opening balance directly.

If multiple vendors exist, the final action creates one received receipt per vendor group while completing one import batch.

An idempotency key covers the final batch acceptance. A network retry must return the existing result without duplicating identities, products, receipts, or stock movements.

## 8. Blocking and non-blocking uncertainty

The final action is blocked when unresolved uncertainty could change:

- Vendor ownership of an item
- Duplicate identity/product choice
- Pack count
- Weight or unit
- Per-pack versus line-total interpretation
- Price or currency
- Whether the item was acquired into physical stock

Naming or descriptive uncertainty may remain visible and be corrected later if it does not affect identity matching, quantity, or cost.

The interface explains the exact blocking field and opens the relevant row. It never reports only a generic `Import failed` when structured validation details are available.

## 9. Mobile and accessibility requirements

- No horizontal review grids or horizontal scrolling.
- Vendor titles receive the full available width.
- Group actions are small secondary text actions on the metadata line.
- Expanded fields stack vertically.
- Every interactive target meets the existing 44px tap-target rule even when the visible action is visually small.
- All text inputs, textareas, and selects render at a minimum computed font size of 16px below `lg` to prevent iOS focus/paste zoom.
- The Import panel retains `pb-nav` bottom-navigation clearance and `z-modal` overlay behavior.
- Focus trapping, Escape/Close behavior, review-later behavior, and durable incomplete imports remain intact.
- Loading, partial analysis, analysis failure, evidence upload failure, validation failure, and retry states remain recoverable without losing the original evidence.

## 10. Service boundary

AI analysis runs server-side through one Curate import analysis endpoint. API credentials remain server-side and the model receives only the evidence for the account-scoped import being analyzed.

Recommended boundary:

```text
POST /api/curate/imports/:id/analyze
```

The endpoint:

- Loads the stored batch evidence
- Extracts text from supported files and images
- Calls the configured multimodal model
- Validates the response against a strict schema
- Performs deterministic normalization and arithmetic
- Writes proposed vendor groups and item parsed data
- Returns the durable batch detail

Analysis is rerunnable without creating Library or Inventory records. Reanalysis retains manual corrections unless the user explicitly chooses to replace them.

The model and image/PDF extraction choice are implementation details, but the implementation must support Chinese text and vision input and must fit the Cloudflare Worker deployment constraints. Large original files remain in R2.

## 11. Schema evolution

Use additive migrations. Preserve current import batches and items.

Required durable additions include:

- Batch-level optional sourcing run/journey reference
- Vendor-group records or an equivalent normalized grouping structure
- Account-scoped resolved vendor reference per group
- Original and translated naming fields in parsed item data or typed columns where queried
- Analysis status, version, model metadata, and batch overview
- Field-level confidence/evidence references
- Manual-correction markers so reanalysis cannot overwrite reviewed values
- Finalization idempotency and links to created receipts

Do not create a parallel vendor, sourcing-run, Library, product, receipt, or stock model for imports.

## 12. Verification

### Pure parsing and arithmetic

- `500g ×2 ¥380` resolves to 1,000g and ¥760 when price is per pack.
- A stated line total remains a line total.
- Mixed `g`, `kg`, count, and common Chinese units are normalized with explicit uncertainty where conversion is unsafe.
- Multiple currencies retain separate batch totals.
- Malformed and adversarial model output fails schema validation without writing stock.

### Worker/API

- Account isolation for evidence, groups, matches, analysis, and finalization
- Strong, weak, missing, and newly created vendor matches
- Optional sourcing run and no-run imports
- Multiple vendor groups under one batch
- Existing/new Curate identity and Inventory holding paths
- One receipt per vendor group
- Idempotent retry after partial network failure
- No stock mutation before final confirmation
- Receipt acceptance creates exactly one stock movement per line

### UI

- Paste, photo, and file analysis
- Chinese original and English name visible together
- Ten-item compact mobile review
- Ready rows remain editable
- Only uncertain rows demand attention
- Vendor adjustment occurs at group level only
- Small `Change` action does not truncate vendor titles
- No group/item sourcing-run overrides
- No horizontal overflow at 390×844
- No iOS input zoom caused by sub-16px form controls
- Bottom-navigation clearance and modal stacking
- Review later, resume, retry, and evidence preservation

### Regression

Run focused import unit/worker tests, Curate Playwright tests on Desktop and Mobile Chrome, `npm run lint`, `npm run lint:colors`, `npm run build`, and the relevant complete mobile suite before shipping.

## 13. Out of scope

- Purchase-order management
- Shipping and landed-cost allocation
- Supplier reconciliation
- Automatic publication to the storefront
- Automatic product copy generation beyond evidence-grounded translation and extraction
- Cross-import merging without explicit identity review
- Multiple sourcing runs inside one import

## 14. Pre-release hardening addendum

Independent UX and integrity review exposed twenty gaps. All are in scope before merge; the approved interaction direction remains unchanged.

### 14.1 Concurrency and terminal-state safety

- Analysis receives a unique attempt token. Its final write succeeds only while the batch remains nonterminal, has no finalization reservation, and still owns that token.
- Completed, abandoned, or finalization-reserved batches can never return to `reviewing` through analysis or error handling.
- Every mutation, including evidence upload, Journey assignment, vendor resolution/creation, item correction, reanalysis, and abandonment, atomically requires `finalize_idempotency_key IS NULL` and a nonterminal review state.
- Superseded analysis returns a conflict result without marking the batch failed.

### 14.2 Deterministic proposal and money validation

- AI group keys are unique within a proposal; `sourceItemId` values are unique across the complete proposal.
- A Han-script original name requires a separate non-Han English inventory name before finalization.
- Low confidence or material uncertainty in vendor, identity, translation, quantity, price basis, price, currency, or acquisition state creates a blocking field.
- Currency is a canonical uppercase ISO 4217 code. Ambiguous symbols such as `¥` remain blocked until resolved.
- Authoritative monetary provenance uses exact decimal representation or integer minor units rather than binary floating point.

### 14.3 Reuse-first matching

- Exact name alone cannot auto-match an identity.
- Matching combines category, original and translated names, Chinese name, year, origin, form/classification, and vendor when present.
- Auto-match requires one high-confidence candidate with a clear margin over the next candidate. Generic names, ties, and weak matches remain unresolved.
- Existing products are joined deterministically to their Curate identities even when `draft_product_id` is absent.
- Review names every proposed identity and holding and allows searching other compatible account-scoped records.

### 14.4 Evidence and privacy

- The chooser advertises only formats the analysis pipeline can interpret. DOC/DOCX may be attached only when explicitly labelled reference-only.
- One unsupported or oversized source cannot prevent other usable evidence from being analyzed. Each source receives `analyzed`, `reference_only`, or `failed` status.
- Upload and analysis limits are aligned before selection. Originals may remain in R2 while an analysis-safe derivative is sent to the provider.
- Attachments can be removed, replaced, or cleared before upload.
- Evidence references identify a real source and, when available, a valid page, text range, or image region.
- AI candidates are bounded locally. Email, phone, and WhatsApp are not sent as matching aliases.

### 14.5 Durable input and recovery

- Unsubmitted text, selected Journey, and attachment metadata form an account-scoped local draft. Closing dirty input warns unless it is already preserved.
- Vendor, Journey, identity, and holding lookups distinguish loading, empty, and failed states. Creation is not the only visible route while reuse lookup has failed.
- Upload and analysis report per-file progress and retry only failed work without duplicating evidence.
- Conflicting controls are disabled consistently while a mutation is active; no action silently refuses to run.

### 14.6 Review hierarchy

- The optional sourcing run rests as `No sourcing run · Add` or the selected run with `Change`; search and creation appear only after expansion.
- Vendor resolution is a searchable combobox ranked by deterministic similarity. Creation follows existing matches.
- Expanded items show blocking fields first with relevant evidence; nonblocking metadata lives under `All details`.
- Tea type and production/classification receive distinct domain labels and examples.
- Editor drafts refresh from the latest item revision whenever editing opens.
- Saved evidence copy reflects actual processing state.

### 14.7 Destination, accessibility, and completion

- Copy states the actual contract: review reuses or creates a Library identity and adds acquired quantity to Inventory.
- The open dialog makes the underlying Curate surface inert and hidden from assistive technology; proxy file inputs do not create duplicate controls.
- Destructive confirmation is either a normal disclosed group or a correctly isolated, described alert dialog.
- Finalization opens a durable batch receipt summary listing every created/reused Library identity, Inventory holding, vendor receipt, quantity, and cost, with links to all results.

### 14.8 Additional merge gates

- Race tests cover analysis versus finalization and every finalization-reserved mutation.
- Proposal tests cover duplicate IDs, translation/confidence blockers, match ties, canonical currency, and exact money.
- Evidence tests cover mixed supported/reference-only batches, size limits, removal, local drafts, per-file retry, and candidate privacy.
- Browser tests cover searchable matching, blocking-first editing, quiet Journey controls, modal isolation, global busy states, and batch completion on mobile and desktop.
- The full Worker suite, import matrix, Inventory scroll tests, mobile audit, lint, color lint, and production build pass.
- The seven existing Curate draft-lifecycle failures are repaired to the intended contract or deliberately re-specified with regression coverage; they cannot remain an unexplained red baseline.
