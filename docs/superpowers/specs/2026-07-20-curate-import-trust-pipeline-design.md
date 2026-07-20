# Curate Import Trust Pipeline Design

**Date:** 2026-07-20
**Status:** Approved direction, pending written specification review

## Goal

Make Curate Import a reliable translator and organizer for whatever sourcing record Adrian receives. AI interprets free-form material, while deterministic application code controls arithmetic, provenance, review gates, and every permanent write into Library, Inventory, receipts, and stock history.

## Success Criteria

1. Pasted text, photos, PDFs, DOC and DOCX files, spreadsheets, and HEIC photos can be analyzed without requiring a fixed layout.
2. Supplier lines, product lines, headings, notes, shipping charges, subtotals, and totals are assigned to the correct roles.
3. Original names and natural English names are retained separately.
4. Pack size, count, total grams or units, original currency, line cost, and unit cost are derived and validated deterministically whenever the record provides enough information.
5. Review fields map explicitly into their permanent destinations. No reviewed field may disappear during finalization.
6. Existing vendors, Library identities, and Inventory holdings are reused only when a safe match is established.
7. Every item supports one explicit disposition: received now, ordered or in transit, or Library record only.
8. The original source fragment remains visible and retrievable for every proposed item.
9. Provider failure never destroys the record. Text and multimodal analysis each have a working fallback path.
10. Finalization remains account-scoped, private by default, idempotent, and resumable.

## Design Choice

Use a trust-first hybrid pipeline.

- AI performs semantic interpretation, translation, grouping, and catalog enrichment.
- Deterministic parsing locks explicit numeric facts when a supported pattern is found.
- Deterministic normalization recomputes all derived quantities and prices.
- Deterministic matching chooses whether a vendor, identity, or holding can be reused.
- Human review is required only for material ambiguity, not for fields the system can prove.
- Final writes use a typed canonical record rather than passing model-shaped JSON directly into database codecs.

The rejected alternatives are AI autopilot, which can silently invent operational data, and strict templates, which cannot satisfy the requirement that records may arrive in arbitrary forms.

## Canonical Import Record

Each analyzed item is normalized into five sections. The first release stores the canonical sections in `curate_import_items.parsed_data_json` and exposes the same typed shape on the server and client.

### Provenance

- `sourceId`
- `sourceItemId`
- `evidenceRefs`
- `sourceExcerpt`
- `sourceLanguage`

### Identity

- `englishName`
- `originalName`
- `chineseName`
- `category`
- `type`
- `classification`
- `form`
- `year`
- `originCountry`
- `originRegion`
- `description`

`chineseName` defaults to `originalName` when the original contains Han characters. `description` may summarize only facts supported by the source. Inferred marketing prose is forbidden.

### Purchase

- `packWeight`
- `weightUnit`
- `packCount`
- `priceAmountExact`
- `currency`
- `priceBasis`
- `lineCostExact`
- `unitCostExact`
- `totalQuantityGrams`
- `totalUnits`

The provider supplies source values only. Application code computes all derived values with exact decimal arithmetic.

### Inventory Intent

- `disposition`: `received` | `in_transit` | `library_only`
- `inventoryPurpose`: `working` | `sample` | `personal` | null

`inventoryPurpose` is required for `received` and `in_transit`. It is optional for `library_only` because that disposition creates no stock holding.

### Resolution

- `vendorResolution`: existing vendor id or explicit new-vendor proposal
- `identityResolution`: existing Library id or `new`
- `holdingResolution`: compatible Inventory id, `new`, or null for `library_only`

The AI may suggest names and candidates, but application code owns the resolution state.

## Analysis Pipeline

### Source Normalization

1. Preserve the original upload in R2 before analysis.
2. Plain text, CSV, and JSON are decoded directly.
3. PDF, DOCX, XLSX, XLS, ODT, ODS, and supported images are converted to Markdown with the Cloudflare Workers AI `toMarkdown` binding.
4. Legacy binary DOC files use a bounded OLE text extractor in the Worker, then enter the same Markdown and provider path. Extraction failure remains isolated to that source.
5. HEIC and HEIF are transformed server-side to JPEG through Cloudflare Images, then passed to Markdown conversion and multimodal analysis. The original HEIC remains the retained source.
6. Extracted text is stored as derived source metadata with a content hash and converter version. Retries reuse it unless the original changes.
7. Source size and count limits remain bounded, but the UI explains the exact limit and which source was skipped.

Cloudflare currently documents Markdown conversion for PDFs, DOCX, spreadsheets, and common image formats. Cloudflare Images supports HEIC ingestion and JPEG output. These services avoid adding large PDF, Office, or HEIC codecs to the main Worker bundle.

### Provider Routing

1. Anthropic remains the primary structured multimodal analyzer.
2. Groq text analysis remains the fallback for text-normalized records.
3. Groq vision, using the configured vision-capable model, is the fallback for normalized image inputs.
4. PDF and Office files always have Markdown text available before provider routing, so a primary document failure can still fall back to text analysis.
5. If every provider fails, deterministic record parsing returns every fact it can prove and marks translation or identity as reviewable.

Provider routing records the selected model, converter, attempt, and failure class without storing credentials or leaking contact data.

### Semantic Extraction

The model must classify every source fragment as one of:

- supplier
- tea
- teaware
- shipping or fee
- heading
- note
- subtotal
- total
- ignored duplicate

Only tea and teaware become import items. Shipping, totals, and notes are stored in a new batch `analysis_annotations_json` field as provenance and consistency checks. They never become stock rows.

### Deterministic Record Parser

The fallback parser accepts common variations rather than one exact Chinese layout:

- `380元/500克 x2=760元`
- `500g x 2 @ CNY 380`
- `2 × 500 g, 380 RMB each`
- `1000g total, CNY 760`
- columns separated by commas, tabs, pipes, or repeated whitespace
- Chinese and Western multiplication symbols
- optional equals totals and optional currency symbols
- decimal weights and prices
- multiple supplier sections in one source

The parser uses totals only as checks. It never multiplies item quantity from a batch total. Ambiguous price basis remains blocked.

## Translation and Enrichment Trust

1. The output schema exposes explicit confidence keys for translation and each material field. The current empty-object confidence schema is replaced.
2. Non-English items require a separate English name. Han characters in the English field remain blocking.
3. Exact existing identity matches by original or Chinese name use the stored canonical English name instead of a fresh translation.
4. A small tea terminology validator checks high-signal terms such as aged, raw, ripe, Liu Bao, white tea, oolong, brick, cake, loose, and place names. It does not manufacture a full translation.
5. Translation confidence that is absent or below threshold becomes a review issue unless an exact canonical identity or deterministic glossary match validates it.
6. Optional enrichment fields remain non-blocking when the source does not contain them. The UI distinguishes `not present in record` from `AI uncertain`.
7. The same original name within one account reuses the canonical translation after human confirmation, preventing translation drift across imports.

## Matching Rules

### Vendors

- Exact normalized name or known alias can auto-select an existing vendor.
- A source-explicit supplier with no match becomes an explicit `create new vendor` proposal.
- Finalization may create that vendor only after the review displays the action.
- Partial name matches remain suggestions and never auto-merge.

### Library Identities

- Exact original or Chinese name plus compatible category is the strongest signal.
- English name, year, origin, type, form, classification, and vendor add evidence.
- Contradictions prevent auto-match.
- A match must clear both an absolute score and a runner-up margin.
- Canonical original and Chinese names must persist so future imports can match reliably.

### Inventory Holdings

- A holding can be reused only when account, Library identity, category, and inventory purpose are compatible.
- `library_only` never creates or selects a holding.

## Review Experience

The existing editorial review remains, with these changes:

1. Each item shows the exact source excerpt, not only a source id and character range.
2. The primary row shows English name, original name, pack equation, total quantity, line cost, disposition, and resolution state.
3. AI-filled optional metadata lives under All details and is labeled by provenance state: source fact, canonical match, AI interpretation, or user edit.
4. One disposition control is visible whenever it changes finalization behavior.
5. `Next issue` visits only material blockers.
6. The final action describes the result, for example `Receive 2 teas and save 1 Library record`.
7. Existing manual corrections remain protected during retry and reanalysis.

## Permanent Field Mapping

A migration adds `origin_country`, `classification`, and `description` to `tea_compass_entries`, `classification` to `products`, and `analysis_annotations_json` to `curate_import_batches`. These fields are explicit because overloading `notes` or `type` would lose meaning and weaken future duplicate matching.

A single `canonicalImportToCompassValues` adapter replaces direct filtering of model-shaped JSON. It maps:

- `englishName` to Library `name` and Inventory `given_name` or `product_name`
- `originalName` or `chineseName` to Library and Inventory `chinese_name`
- `type`, `classification`, `form`, `year`, `originCountry`, and `originRegion` to same-purpose Library and Inventory columns
- `description` to Library and Inventory `description`
- the exact source excerpt to Library `notes`, leaving interpreted description separate
- resolved supplier id and name to Library `vendor_id` and `vendor_name`, receipt vendor fields, and Inventory `vendor_id` and `vendor`
- purchase values to receipt-line cost provenance

Tests must fail if any reviewed canonical field is silently dropped.

## Finalization Semantics

### Received

- Create or reuse the Library identity.
- Create or reuse the compatible Inventory holding.
- Create a received receipt line.
- Apply the stock movement immediately.
- Store original cost and unit cost provenance.

### In Transit

- Create or reuse the Library identity and Inventory holding.
- Create an in-transit receipt line.
- Do not apply a stock movement.
- Stock is added later through the existing receipt workflow.

### Library Only

- Create or reuse the Library identity.
- Do not create a holding, receipt line, or stock movement.
- Preserve supplier, source, translated name, and catalog metadata on the Library record.

A mixed batch may contain all three dispositions. Receipts contain only received or in-transit items. Finalization results use nullable product, receipt, and movement identifiers where the disposition does not create them.

## Failure Handling

- Original records are saved before any conversion or provider call.
- Conversion failures are per source and retryable.
- Provider failures are per source and retryable.
- A usable source can complete even when another source fails.
- Finalization validates the latest saved record after reserving an idempotency key.
- Every downstream creation and movement remains idempotent.
- A partial finalization resumes with the same key without duplicating vendors, identities, holdings, receipts, or stock.
- The client refreshes saved server state when opening the panel and when regaining focus.

## Privacy and Account Boundaries

- Original records and derived text remain account-scoped.
- Provider prompts include only bounded vendor names, journey labels, identity metadata, and holding metadata needed for matching.
- Vendor contact fields are never sent to providers.
- The review UI states that record contents are sent to configured AI providers for analysis.
- Original uploads remain private and are never exposed through unsigned URLs.
- HEIC transformation URLs use short-lived server signatures and cannot access another account's source.

## Testing

### Unit

- Parsing variations, currencies, decimals, totals, multiple vendors, and ignored lines
- Exact decimal arithmetic and gram conversion
- Translation confidence and terminology validation
- Canonical field mapping into Library and Inventory shapes
- Vendor, identity, and holding resolution thresholds
- Disposition-specific validation

### Worker Integration

- Primary text and multimodal analysis
- Groq text and vision fallbacks
- Workers AI Markdown conversion for PDF, DOCX, spreadsheets, and images
- HEIC transformation with a mocked Cloudflare Images response
- Mixed usable and failed sources
- Received, in-transit, Library-only, and mixed finalization
- Retry and idempotency after each partial failure point
- Account isolation and signed source access

### Browser

- Arbitrary pasted layouts
- Exact source excerpt visibility
- Disposition controls and category-aware language
- Only genuine blockers stop finalization
- Permanent refresh after background analysis
- Mobile input sizing, reachability, and no horizontal overflow

### Production Verification

- Re-run the Huang Wei record and confirm three translated items, 3,500 total grams, and CNY 2,300 total without creating a summary item.
- Confirm each disposition path against a disposable test batch.
- Verify permanent Library, Inventory, receipt, and stock-ledger rows contain their expected mapped fields.
- Confirm active Cloudflare deployment and the selected analysis model in D1.

## Rollout

1. Ship canonical mapping and regression tests first because it prevents permanent data loss.
2. Ship the expanded parser and translation trust rules.
3. Add disposition-aware finalization and review controls.
4. Add Workers AI Markdown conversion and Groq vision fallback.
5. Enable HEIC transformation after Cloudflare Images transformations are verified on the production zone.
6. Reanalyze incomplete imports with the new pipeline. Do not modify completed imports automatically.

## Non-Goals

- No automatic public catalog listing.
- No automatic retail pricing or currency conversion.
- No silent merging of ambiguous teas or vendors.
- No rewriting completed imports without an explicit migration or review action.
- No unbounded model context or file processing.
