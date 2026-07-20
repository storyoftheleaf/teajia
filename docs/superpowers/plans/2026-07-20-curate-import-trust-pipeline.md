# Curate Import Trust Pipeline Implementation Plan

> **Execution:** Use fresh task agents with non-overlapping file ownership. Every behavior change begins with a failing test, then the smallest passing implementation. Shared orchestration in `worker/src/curateImports.ts` is integrated only after the standalone modules pass.

**Goal:** Make Curate Import reliably interpret, translate, validate, review, and permanently store arbitrary sourcing records without losing reviewed fields or creating incorrect stock.

**Architecture:** Introduce a typed canonical import record between AI output and persistence. Keep semantic interpretation provider-driven, but normalize arithmetic, provenance, matching, dispositions, and permanent writes deterministically. Extract source normalization and canonical mapping into small Worker modules so fallback providers and finalization can share one contract.

**Stack:** Cloudflare Workers, D1, R2, Workers AI, Anthropic, Groq, React 19, TypeScript, Vitest, Playwright.

---

## Task 1: Canonical record, migrations, and permanent field mapping

**Files:**

- Create: `worker/src/curateImportCanonical.ts`
- Create: `worker/tests/curate-import-canonical.test.ts`
- Modify: `worker/src/compassCodec.ts`
- Create: `worker/migrations/121_curate_import_trust_pipeline.sql`
- Modify: `worker/schema.sql`
- Modify: `worker/tests/curate-inventory-migrations.test.ts`

### 1. Write failing canonical mapping and migration tests

Cover all reviewed identity fields, exact purchase fields, provenance, and each disposition. Assert that camel-case analysis values become same-purpose snake-case Library and Inventory values and that no field in the canonical allowlist is silently discarded.

```ts
const record = normalizeCanonicalImportRecord({
  englishName: 'Aged Liu Bao Tea',
  originalName: '陈年六堡茶',
  classification: 'post-fermented tea',
  originCountry: 'China',
  description: 'Aged Liu Bao tea listed by the supplier.',
  sourceExcerpt: '陈年六堡茶380元/500克 x1=380元',
  disposition: 'received',
});
expect(canonicalImportToCompassValues(record)).toMatchObject({
  name: 'Aged Liu Bao Tea',
  chinese_name: '陈年六堡茶',
  classification: 'post-fermented tea',
  origin_country: 'China',
});
```

Run the focused tests and confirm failure before implementation.

### 2. Add the canonical type and adapters

Implement `normalizeCanonicalImportRecord`, `canonicalImportToCompassValues`, and `canonicalImportToProductValues`. Normalize Han-script names, quantities, currencies, explicit provenance, and backwards-compatible dispositions. Do not infer catalog prose.

### 3. Add schema columns

Migration 121 adds:

```sql
ALTER TABLE tea_compass_entries ADD COLUMN origin_country TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN classification TEXT;
ALTER TABLE tea_compass_entries ADD COLUMN description TEXT;
ALTER TABLE products ADD COLUMN classification TEXT;
ALTER TABLE curate_import_batches ADD COLUMN analysis_annotations_json TEXT;
```

Mirror the columns in `worker/schema.sql` and add migration contract coverage.

### 4. Run tests and commit

Run canonical and migration tests, then commit only these files.

## Task 2: Robust parsing, arithmetic, and translation trust

**Files:**

- Modify: `worker/src/curateImportAnalysis.ts`
- Modify: `worker/tests/curate-import-analysis.test.ts`

### 1. Write failing interpretation tests

Add table-driven cases for Chinese and Western separators, decimal weights, per-pack versus line prices, optional totals, multiple supplier sections, headings, notes, fees, and subtotal/total lines. The Huang Wei record must produce exactly three items, 3,500 grams, and CNY 2,300.

```ts
expect(result.records.map(({ englishName, totalQuantityGrams, lineCostExact }) => ({
  englishName,
  totalQuantityGrams,
  lineCostExact,
}))).toEqual([
  { englishName: 'Aged Liu Bao Tea', totalQuantityGrams: 500, lineCostExact: '380' },
  { englishName: 'Aged Ripe Pu-erh Tea', totalQuantityGrams: 1000, lineCostExact: '800' },
  { englishName: 'Aged Northern Vietnam Ripe Pu-erh Tea', totalQuantityGrams: 2000, lineCostExact: '1120' },
]);
```

### 2. Implement deterministic numeric locking

Tokenize separators and multiplication symbols, parse exact decimals, convert supported mass units to grams, determine whether price is per pack or line, and treat totals only as checks. Classify totals, fees, headings, and notes as annotations instead of items.

### 3. Add explicit translation confidence

Replace empty confidence objects with typed confidence keys. Validate that a non-English item has a separate English name, reject Han characters in the English field, reuse exact canonical identity names, and apply a small tea-term consistency validator. Missing optional metadata is `not_present`, not a blocker; uncertain material identity or translation is a blocker.

### 4. Run tests and commit

Run the analysis suite and commit only the analysis module and its tests.

## Task 3: Source normalization and provider fallback inputs

**Files:**

- Create: `worker/src/curateImportEvidence.ts`
- Create: `worker/tests/curate-import-evidence.test.ts`
- Modify: `worker/wrangler.toml`

### 1. Write failing source-normalization tests

Cover direct text/CSV/JSON decoding, Workers AI Markdown conversion for PDF/DOCX/XLS/XLSX/ODT/ODS and common images, bounded legacy DOC extraction, HEIC-to-JPEG conversion through an injected transformer, partial source failures, exact excerpts, content hashes, and Groq-compatible text/vision payloads.

### 2. Implement a provider-neutral evidence module

Expose injected interfaces so unit tests never call external services:

```ts
export interface EvidenceConverters {
  toMarkdown(input: { name: string; blob: Blob }): Promise<string>;
  heicToJpeg(input: Uint8Array): Promise<Uint8Array>;
}

export async function normalizeImportSources(
  sources: StoredImportSource[],
  converters: EvidenceConverters,
): Promise<NormalizedEvidence[]>;
```

Keep the original R2 object authoritative. Derived text includes converter/version/hash metadata. Fail one source without discarding usable siblings. Bound legacy DOC scanning by byte and output limits.

### 3. Configure Workers AI

Add the `AI` binding in `worker/wrangler.toml`. Keep Cloudflare Images conversion behind an injected production adapter so unsupported account configuration returns a source-specific review error rather than failing the batch.

### 4. Run tests and commit

Run focused evidence tests and commit only the module, tests, and binding config.

## Task 4: Wire canonical analysis and fallbacks into import orchestration

**Files:**

- Modify: `worker/src/curateImports.ts`
- Modify: `worker/src/index.ts`
- Modify: `worker/tests/curate-imports.test.ts`

### 1. Write failing integration tests

Test provider order for text and media, Workers AI conversion, Anthropic failure to Groq text/vision, deterministic fallback after all providers fail, per-source failures, exact source excerpts, annotations persistence, canonical parsed JSON, retry protection for user edits, and account isolation.

### 2. Integrate standalone modules

Normalize stored evidence before provider routing. Send the minimum required account-scoped context, never vendor contact fields. Parse all provider responses into the canonical record, then deterministically lock proven arithmetic and excerpts. Record model/converter attempt metadata and persist annotations.

### 3. Add Groq vision fallback

Use a configured vision-capable Groq model with bounded image inputs. PDF and Office evidence falls back through normalized Markdown. If external providers all fail, return proven deterministic records and explicit review blockers.

### 4. Run tests and commit

Run import integration tests and commit the orchestration changes.

## Task 5: Disposition-aware finalization

**Files:**

- Modify: `worker/src/curateImports.ts`
- Modify: `worker/tests/curate-import-finalize.test.ts`

### 1. Write failing finalization tests

Cover received, in-transit, Library-only, and mixed batches; nullable result identifiers; vendor and identity reuse thresholds; incompatible holding rejection; idempotent retry after each persistence boundary; and preservation of canonical fields.

### 2. Apply explicit disposition semantics

- `received`: identity + compatible holding + receipt line + stock movement.
- `in_transit`: identity + compatible holding + in-transit receipt line; no stock movement.
- `library_only`: identity only; no holding, receipt line, or movement.

Require inventory purpose only for stock-bearing dispositions. Create receipts only for stock-bearing lines. Preserve source excerpt and original cost provenance. Maintain backward compatibility by treating existing acquired items as received unless a saved disposition says otherwise.

### 3. Run tests and commit

Run finalize and receipt tests and commit the finalization changes.

## Task 6: Review UI, source provenance, and file intake

**Files:**

- Modify: `src/components/TeaCompass/import/importTypes.ts`
- Modify: `src/components/TeaCompass/import/importReviewDomain.ts`
- Modify: `src/components/TeaCompass/import/ImportItemRow.tsx`
- Modify: `src/components/TeaCompass/import/ImportBatchReview.tsx`
- Modify: `src/components/TeaCompass/import/ImportInput.tsx`
- Modify: `src/components/TeaCompass/import/importEvidence.ts`
- Modify/add focused tests beside the affected modules
- Modify: `tests/compass-import.spec.ts`

### 1. Write failing domain and browser tests

Assert exact source excerpts, English/original names, pack equation, grams or units, exact line cost, disposition controls, provenance labels, category-aware issue wording, AI-provider disclosure, accepted DOC/DOCX/spreadsheet/HEIC types, and no horizontal overflow on mobile.

### 2. Implement the review contract

Expose canonical fields and annotations in client types. Show `source fact`, `canonical match`, `AI interpretation`, `user edit`, `not present`, and `uncertain` distinctly. Add a visible three-option disposition control and a final action label that describes how many items will be received, held in transit, or saved to Library only.

### 3. Expand and explain file intake

Accept supported document, spreadsheet, and HEIC extensions. State the exact source count and size limits and disclose that bounded record content is sent to configured AI providers for analysis.

### 4. Run tests and commit

Run focused component tests and the Compass import Playwright tests on desktop and mobile, then commit only the UI changes.

## Task 7: Full verification, production migration, deployment, and live check

### 1. Verify locally

Run:

```bash
npm run test:worker
npm run lint
npm run lint:colors
npm run build
npx playwright test tests/compass-import.spec.ts --project='Desktop Chrome' --project='Mobile Chrome'
git diff --check
```

### 2. Review integrated behavior

Perform one specification review and one code-quality review of the full diff. Resolve every material finding and rerun the affected tests.

### 3. Apply migration and deploy Worker

Apply migration 121 to the remote D1 database, deploy the Worker, and verify the deployment and schema columns. If Cloudflare Images transformations are unavailable on the account, leave HEIC conversion surfaced as a source-specific configuration issue while every other source type remains functional.

### 4. Push Pages deployment and verify production

Push the task-scoped commits to `origin/main`, confirm the remote contains the final commit, wait for the Cloudflare Pages deployment for `teajiafinal`, and exercise the production import flow without finalizing real stock. Re-run the Huang Wei source and verify three items, 3,500 grams, and CNY 2,300 with no summary row.

