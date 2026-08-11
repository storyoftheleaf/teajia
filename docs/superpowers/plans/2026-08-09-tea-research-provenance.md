# Tea Research Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task. Use `test-driven-development` for every behavior change and `verification-before-completion` before claiming a phase complete.

**Goal:** Give Teajia a cited, scope-safe tea research system that can launch with useful common knowledge while preserving the difference between published research, one exact source-described tea, and Adrian's own observations.

**Architecture:** Keep shared Wisdom records, bibliographic sources, citations, and potential profiles in deterministic Git-backed source files. Keep exact products, source-described lot profiles, vendors, inventory, personal tasting, and private verification receipts in account-scoped D1. Resolve Wisdom onto product pages at read time, never by copying shared claims into product rows. Use i64OS capture as the only proposal boundary, with citation-complete hashes and Adrian's review click as the only assimilation boundary.

**Tech Stack:** React 19, TypeScript, Vite 6, Vitest, Cloudflare Workers, D1, Node.js build scripts, i64OS TypeScript CLI, existing Teajia tasting taxonomy.

---

## Non-negotiable truth model

Before implementation, keep these three sensory layers separate:

| Layer | Scope | Canonical storage | Product behavior |
|---|---|---|---|
| Wisdom PotentialProfile | A cited region, cultivar, producer, style, mark, or named tea | `data/tea-wisdom-source/potential-profiles.json` | Resolved dynamically and labeled as potential character |
| SourceDescribedProfile | One exact offered or purchased TeaLot | D1 product tasting with `tasting_source = 'source'`; raw evidence stays on Curate import | Shown as source-described until Adrian saves his tasting |
| PersonalObservation | Adrian's direct experience of one product | D1 product tasting with `tasting_source = 'owner'` | Shown as Adrian's tasting and takes product-level precedence |

Do not infer a family, producer, tree age, harvest, processing detail, or flavor for another tea merely because it shares a county, village, cultivar, or style. Do not create a Wisdom PotentialProfile from one retailer's one product page. Existing product rows marked `common` are not bulk-migrated; they remain legacy data until individually audited.

## Repository and branch boundary

- Teajia worktree: `/Users/adrianrasmussen/.codex/worktrees/75df/teajia`
- i64OS implementation worktree: `/tmp/wt-i64-tea-sync`
- Keep Teajia work on a `codex/` branch in the Teajia worktree.
- Keep i64OS work on a separate `codex/` branch in its isolated worktree.
- Never modify the unrelated main checkout in either repository.
- Never log source bodies, credentials, Cloudflare tokens, or private evidence excerpts.
- Never call `knowledge_assimilate` directly.
- Never add a schedule or permanent sync service.

## Task 1: Add the provenance domain and fail-closed source validator

**Files:**

- Create: `data/tea-wisdom-source/research-sources.json`
- Create: `data/tea-wisdom-source/citations.json`
- Create: `data/tea-wisdom-source/potential-profiles.json`
- Modify: `src/wisdom/types.ts`
- Create: `src/wisdom/research.ts`
- Create: `src/wisdom/research.test.ts`
- Modify: `src/wisdom/index.ts`
- Modify: `scripts/build-wisdom.mjs`
- Create: `scripts/__tests__/build-wisdom-research.test.ts`

### Step 1: Write failing domain and validator tests

Add fixtures that prove one source may support one exact field, that held-back citations are not publishable support, and that tasting ids cannot cross taxonomy categories.

```ts
import { describe, expect, it } from 'vitest';
import {
  getEntryCitations,
  getEntryPotentialProfile,
  getEntryResearchSources,
  validateResearchBundle,
  type ResearchBundle,
} from './research';

const bundle: ResearchBundle = {
  sources: [{
    id: 'yunnan-sourcing-yi-bang-2025',
    publisher: 'Yunnan Sourcing',
    title: '2025 Yunnan Sourcing Yi Bang Wild Arbor Raw Pu-erh Tea Cake',
    url: 'https://yunnansourcing.com/products/2025-yunnan-sourcing-yi-bang-wild-arbor-raw-pu-erh-tea-cake',
    kind: 'specialist-retailer',
    accessedAt: '2026-08-08',
    trust: 'qualified',
  }],
  citations: [{
    id: 'yi-bang-place-source',
    entryKind: 'region',
    entryId: 'yi-bang-village-yunnan',
    fields: ['description'],
    sourceIds: ['yunnan-sourcing-yi-bang-2025'],
    usage: 'qualified',
    qualification: 'Supports the place reference only, not a general sensory profile.',
  }],
  potentialProfiles: [],
};

describe('tea research provenance', () => {
  it('resolves sources through field-scoped citations', () => {
    expect(validateResearchBundle(bundle)).toEqual([]);
    expect(getEntryCitations(bundle, 'region', 'yi-bang-village-yunnan')).toHaveLength(1);
    expect(getEntryResearchSources(bundle, 'region', 'yi-bang-village-yunnan')[0]?.publisher)
      .toBe('Yunnan Sourcing');
  });

  it('does not invent a regional profile from one product page', () => {
    expect(getEntryPotentialProfile(bundle, 'region', 'yi-bang-village-yunnan')).toBeNull();
  });

  it('rejects an unknown source reference', () => {
    const invalid = structuredClone(bundle);
    invalid.citations[0].sourceIds = ['missing-source'];
    expect(validateResearchBundle(invalid)).toContain(
      'Citation yi-bang-place-source references unknown source missing-source',
    );
  });

  it('rejects cross-category tasting ids', () => {
    const invalid = structuredClone(bundle);
    invalid.potentialProfiles = [{
      entryKind: 'region',
      entryId: 'yi-bang-village-yunnan',
      tasting: { body: ['honey'] },
      citationIds: ['yi-bang-place-source'],
    }];
    expect(validateResearchBundle(invalid)).toContain(
      'Potential profile region:yi-bang-village-yunnan has invalid body id honey',
    );
  });
});
```

### Step 2: Run the tests and confirm RED

Run:

```bash
npx vitest run src/wisdom/research.test.ts scripts/__tests__/build-wisdom-research.test.ts
```

Expected: failure because the research module, types, and build validation do not exist.

### Step 3: Add the domain types and deterministic selectors

Add these types to `src/wisdom/types.ts`:

```ts
export type WisdomEntryKind = 'cultivar' | 'region' | 'producer' | 'style' | 'mark' | 'namedTea';
export type CitationUsage = 'usable' | 'qualified' | 'held_back';
export type ResearchSourceKind =
  | 'scientific'
  | 'governmental'
  | 'institutional'
  | 'producer-primary'
  | 'specialist-retailer'
  | 'book'
  | 'other';

export interface ResearchSource {
  id: string;
  publisher: string;
  title: string;
  url?: string;
  kind: ResearchSourceKind;
  accessedAt: string;
  publishedAt?: string;
  trust: 'primary' | 'strong' | 'qualified' | 'lead-only';
  privateEvidenceRef?: string;
}

export interface WisdomCitation {
  id: string;
  entryKind: WisdomEntryKind;
  entryId: string;
  fields: string[];
  sourceIds: string[];
  usage: CitationUsage;
  qualification?: string;
}

export interface WisdomPotentialProfile {
  entryKind: WisdomEntryKind;
  entryId: string;
  tasting: TastingData;
  citationIds: string[];
}
```

Implement `src/wisdom/research.ts` as the single read and validation boundary. It must:

- sort sources and citations by stable id before returning them;
- omit `privateEvidenceRef` from public selectors;
- return only `usable` and `qualified` citations to public consumers;
- require `qualification` for every `qualified` citation;
- verify every citation's entry and field against the built Wisdom holdings;
- validate tasting ids with the existing category taxonomy;
- require every PotentialProfile citation to target the same entry;
- fail when a profile has no usable or qualified citation.

### Step 4: Wire validation into the Wisdom build

In `scripts/build-wisdom.mjs`, read the three JSON inputs before generating modules. Throw one deterministic newline-joined error report if validation fails. Generate:

- `src/wisdom/generated/researchSources.ts`
- `src/wisdom/generated/citations.ts`
- `src/wisdom/generated/potentialProfiles.ts`

Every generated browser module must exclude `trust` and `privateEvidenceRef` because shipped JavaScript is public. The build validator may read those fields from the canonical source files, but neither the browser bundle nor the public dataset may contain them.

### Step 5: Seed only defensible Yi Bang knowledge

Add the Yunnan Sourcing page as a `specialist-retailer` ResearchSource with access date `2026-08-08`. Add a `yi-bang-village-yunnan` region row to `data/tea-wisdom-source/origins.csv` only if the cited wording supports the place entry. Cite the geography or trade context with limiting language. Leave `potential-profiles.json` empty for Yi Bang because one exact product listing is insufficient evidence for a village-wide sensory profile.

### Step 6: Run focused and build-data tests

Run:

```bash
npx vitest run src/wisdom/research.test.ts scripts/__tests__/build-wisdom-research.test.ts src/wisdom/regions.test.ts
node scripts/build-wisdom.mjs
git diff --check
```

Expected: all tests pass; running the build twice produces no second diff.

### Step 7: Commit

```bash
git add data/tea-wisdom-source src/wisdom scripts/build-wisdom.mjs scripts/__tests__/build-wisdom-research.test.ts
git commit -m "feat(wisdom): add cited research provenance"
```

## Task 2: Export citations without exporting private research state

**Files:**

- Modify: `scripts/export-wisdom-dataset.mjs`
- Modify: `public/wisdom/tea-wisdom.json` through the generator
- Modify: `public/wisdom/README.md` through the generator
- Create: `scripts/__tests__/export-wisdom-provenance.test.ts`

### Step 1: Write the failing public-export test

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('public wisdom provenance export', () => {
  const dataset = JSON.parse(readFileSync('public/wisdom/tea-wisdom.json', 'utf8'));

  it('publishes bibliographic metadata and field citations', () => {
    expect(dataset.researchSources).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'yunnan-sourcing-yi-bang-2025', publisher: 'Yunnan Sourcing' }),
    ]));
    expect(dataset.citations).toEqual(expect.arrayContaining([
      expect.objectContaining({ entryId: 'yi-bang-village-yunnan', fields: ['description'] }),
    ]));
  });

  it('never exports internal trust, evidence, or verification state', () => {
    const bytes = JSON.stringify(dataset);
    expect(bytes).not.toContain('privateEvidenceRef');
    expect(bytes).not.toContain('lead-only');
    expect(bytes).not.toContain('verifiedByUserId');
    expect(bytes).not.toContain('contentHash');
  });
});
```

### Step 2: Run and confirm RED

```bash
npx vitest run scripts/__tests__/export-wisdom-provenance.test.ts
```

Expected: the public dataset does not yet contain the provenance holdings.

### Step 3: Extend the exporter

Load the generated public-safe source, citation, and potential-profile modules. Add them as top-level holdings to `tea-wisdom.json`, add counts to the manifest, and document that citations support specific fields rather than certifying an entire publisher or entry.

Do not generate CSV columns containing private evidence references. Do not add verification status to the export.

### Step 4: Prove deterministic output

```bash
node scripts/export-wisdom-dataset.mjs 2026-08-09
shasum -a 256 public/wisdom/tea-wisdom.json > /tmp/teajia-wisdom-export.first
node scripts/export-wisdom-dataset.mjs 2026-08-09
shasum -a 256 public/wisdom/tea-wisdom.json > /tmp/teajia-wisdom-export.second
diff -u /tmp/teajia-wisdom-export.first /tmp/teajia-wisdom-export.second
npx vitest run scripts/__tests__/export-wisdom-provenance.test.ts
```

Expected: no hash diff; the focused test passes.

### Step 5: Commit

```bash
git add scripts/export-wisdom-dataset.mjs scripts/__tests__/export-wisdom-provenance.test.ts public/wisdom
git commit -m "feat(wisdom): publish field-level citations"
```

## Task 3: Render research sources and potential profiles on Wisdom pages

**Files:**

- Create: `src/pages/wisdom/EntryResearchSection.tsx`
- Modify: `src/pages/wisdom/wisdomShared.tsx`
- Modify: `src/pages/wisdom/CultivarPage.tsx`
- Modify: `src/pages/wisdom/RegionPage.tsx`
- Modify: `src/pages/wisdom/ProducerPage.tsx`
- Modify: `src/pages/wisdom/StylePage.tsx`
- Modify: `src/pages/wisdom/MarkPage.tsx`
- Modify: `src/pages/wisdom/NamedTeaPage.tsx`
- Modify: `src/pages/wisdom/reference.test.tsx`

### Step 1: Add failing page tests

Add fixture-backed assertions to `reference.test.tsx`:

```ts
it('shows cited sources without calling the retailer a vendor', () => {
  const html = render('/wisdom/region/yi-bang-village-yunnan');
  expect(html).toContain('Research sources');
  expect(html).toContain('Yunnan Sourcing');
  expect(html).toContain('Supports the place reference only');
  expect(html).not.toContain('Our vendor');
  expect(html).not.toContain('Our producer');
});

it('renders a potential profile only at its cited entry scope', () => {
  expect(render('/wisdom/region/yi-bang-village-yunnan')).not.toContain('Potential profile');
  expect(render('/wisdom/style/raw-pu-erh')).toContain('Potential profile');
});
```

Use a test fixture for the raw-pu-erh profile if production data is intentionally still empty.

### Step 2: Run and confirm RED

```bash
npx vitest run src/pages/wisdom/reference.test.tsx
```

Expected: source and potential-profile sections are absent.

### Step 3: Implement the shared component

`EntryResearchSection` receives only `entryKind` and `entryId`. It resolves public citations and potential character through `src/wisdom/research.ts` and renders:

- `Potential profile` in the tasting vocabulary already used by the site;
- `Research sources` with publisher, title, access date, link, and any public qualification;
- no vendor language;
- no private trust classification;
- no verification language.

Use the existing Wisdom page rhythm, `TYPOGRAPHY_CLASSES`, safe color tokens, and `flex-wrap`. Add no horizontal scroller and no new navigation item.

### Step 4: Mount the component on all six detail types

Place it after the main factual sections and before the existing authorship/source footer. Each page passes its actual kind and stable id. Do not duplicate lookup logic across page files.

### Step 5: Verify

```bash
npx vitest run src/pages/wisdom/reference.test.tsx src/wisdom/research.test.ts
npm run lint
npm run lint:colors
```

Expected: all pass, with no source section on entries that have no citations.

### Step 6: Commit

```bash
git add src/pages/wisdom src/wisdom
git commit -m "feat(wisdom): show cited research on references"
```

## Task 4: Resolve shared potential character onto product tasting surfaces

**Files:**

- Create: `src/wisdom/productResearch.ts`
- Create: `src/wisdom/productResearch.test.ts`
- Modify: `src/pages/ProductPage.tsx`
- Create: `src/pages/ProductPage.research.test.tsx`
- Modify: `src/components/shop/AlcoveCard.tsx`
- Modify: `src/components/shop/alcove/AlcoveCharacterBand.tsx`
- Modify: `src/components/tasting/ProductTastingEditorial.tsx`
- Modify: `src/components/tasting/ProductTastingEditorial.test.tsx`

### Step 1: Write failing precedence tests

```ts
import { describe, expect, it } from 'vitest';
import { resolveProductResearch } from './productResearch';

describe('product research resolution', () => {
  it('resolves Wisdom potential without mutating the product', () => {
    const product = { id: 'lot-1', name: 'Raw Pu-erh', type: 'Puerh Sheng', originRegion: 'Yiwu' };
    const before = structuredClone(product);
    const result = resolveProductResearch(product);
    expect(result.potentialProfile?.entryKind).toBe('style');
    expect(product).toEqual(before);
  });

  it('keeps owner tasting distinct from cited potential character', () => {
    const result = resolveProductResearch({
      id: 'lot-2',
      name: 'Raw Pu-erh',
      type: 'Puerh Sheng',
      originRegion: 'Yiwu',
      tastingSource: 'owner',
      tasting: { flavor: ['mineral'] },
    });
    expect(result.productTasting?.source).toBe('owner');
    expect(result.potentialProfile?.label).toBe('Potential profile');
  });
});
```

### Step 2: Run and confirm RED

```bash
npx vitest run src/wisdom/productResearch.test.ts src/components/tasting/ProductTastingEditorial.test.tsx
```

Expected: the resolver and separate rendering path do not exist.

### Step 3: Implement one resolver

Reuse the existing product identity resolution from `ProductPage.tsx` and `TeaReference`. Return:

```ts
export interface ResolvedProductResearch {
  productTasting: { tasting: TastingData; source: 'owner' | 'community' | 'source' } | null;
  potentialProfile: {
    entryKind: WisdomEntryKind;
    entryId: string;
    label: 'Potential profile';
    tasting: TastingData;
    citations: PublicWisdomCitation[];
  } | null;
}
```

Resolution order for the product-level tasting is `owner`, then `community`, then `source`. The Wisdom profile is not part of that precedence; it is a second, separately labeled reference layer. Never serialize the Wisdom profile into an inventory item or product update.

### Step 4: Render in the existing tasting section

`ProductTastingEditorial` and `AlcoveCharacterBand` should show:

- `Adrian's tasting` for `owner`;
- `Community profile` for `community`;
- `Source-described profile` for `source`;
- `Potential profile` for cited Wisdom context.

If both a product tasting and a Wisdom profile exist, render both with distinct headings. Do not put tasting prose back into the product description.

### Step 5: Verify product behavior and layout

```bash
npx vitest run src/wisdom/productResearch.test.ts src/components/tasting/ProductTastingEditorial.test.tsx src/pages/ProductPage.research.test.tsx
npm run lint
npm run lint:colors
```

Start the dev server for inspection:

```bash
npm run dev
```

Inspect one product with owner tasting and one with a Wisdom match at 390x844 and 1440x900. Confirm no console errors and `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

### Step 6: Commit

```bash
git add src/wisdom src/pages/ProductPage.tsx src/components/shop src/components/tasting
git commit -m "feat(products): resolve cited potential character"
```

## Task 5: Correct Curate's exact source-described tasting semantics

**Files:**

- Modify: `src/lib/api.ts`
- Modify: `src/types.ts`
- Modify: `src/hooks/useProductTasting.ts`
- Create: `src/hooks/useProductTasting.test.ts`
- Modify: `worker/src/curateImportCanonical.ts`
- Modify: `worker/src/curateImportAnalysis.ts`
- Modify: `worker/tests/curate-import-canonical.test.ts`
- Modify: `worker/tests/curate-import-analysis.test.ts`
- Modify: `src/admin/components/AddProductModal.test.ts`

### Step 1: Write failing tests for the exact-lot boundary

```ts
it('labels extracted tasting from one exact record as source-described', () => {
  const canonical = canonicalizeCurateRecord(exactYiBangRecord);
  expect(canonical.tasting).toEqual(expect.objectContaining({ flavor: expect.any(Array) }));
  expect(canonical.tastingSource).toBe('source');
});

it('does not turn one exact listing into a common Wisdom profile', () => {
  const canonical = canonicalizeCurateRecord(exactYiBangRecord);
  expect(canonical.tastingSource).not.toBe('common');
  expect(canonical).not.toHaveProperty('potentialProfile');
});

it('changes source-described to owner only after an explicit tasting save', () => {
  expect(resolveSavedTastingSource({ initial: 'source', editorSaved: false })).toBe('source');
  expect(resolveSavedTastingSource({ initial: 'source', editorSaved: true })).toBe('owner');
});
```

### Step 2: Run and confirm RED

```bash
npx vitest run worker/tests/curate-import-canonical.test.ts worker/tests/curate-import-analysis.test.ts src/admin/components/AddProductModal.test.ts
```

Expected: the current Curate canonical model accepts only `common | null`.

### Step 3: Make the narrow schema change

- Allow `source` in inventory/product tasting-source types and display resolvers.
- Make new Curate imports emit `source` when the pasted evidence describes the exact record.
- Keep the existing taxonomy validator for every extracted tasting term.
- Preserve the raw vendor description, processing notes, and source excerpt on the import record.
- Keep the product description neutral and factual.
- Do not add the retailer as Teajia's vendor unless the Curate operator explicitly selects or creates a real vendor relationship.
- Do not migrate legacy `common` product rows.

### Step 4: Verify the exact Yi Bang regression fixture

The regression fixture must assert:

- untouched extracted description;
- untouched processing notes;
- correct producer and exact source excerpt;
- taxonomy-valid tasting;
- `tasting_source = 'source'`;
- no product, inventory, receipt, vendor, or sourcing-run creation during analysis or draft save.

Run:

```bash
npx vitest run worker/tests/curate-import-canonical.test.ts worker/tests/curate-import-analysis.test.ts src/admin/components/AddProductModal.test.ts src/hooks/useProductTasting.test.ts
npm run lint
npm run lint:colors
```

### Step 5: Commit

```bash
git add src/lib/api.ts src/types.ts src/hooks worker/src/curateImportCanonical.ts worker/src/curateImportAnalysis.ts worker/tests src/admin/components/AddProductModal.test.ts
git commit -m "fix(curate): scope source tasting to exact lots"
```

## Task 6: Add deterministic internal verification receipts

**Files:**

- Create: `worker/migrations/123_wisdom_verifications.sql`
- Create: `worker/src/wisdomVerification.ts`
- Modify: `worker/src/index.ts`
- Create: `worker/tests/wisdom-verification.test.ts`
- Create: `src/wisdom/verificationFingerprint.ts`
- Create: `src/wisdom/verificationFingerprint.test.ts`
- Modify: `src/lib/api.ts`

### Step 1: Write failing hash and endpoint tests

```ts
import { describe, expect, it } from 'vitest';
import { fingerprintWisdomEntry } from './verificationFingerprint';

describe('Wisdom verification fingerprint', () => {
  it('is byte deterministic across object key order', async () => {
    const a = await fingerprintWisdomEntry({ entry: { id: 'rou-gui', name: 'Rou Gui' }, citations: [] });
    const b = await fingerprintWisdomEntry({ citations: [], entry: { name: 'Rou Gui', id: 'rou-gui' } });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when a citation or profile changes', async () => {
    const base = { entry: { id: 'rou-gui' }, citations: [], potentialProfile: null };
    expect(await fingerprintWisdomEntry(base)).not.toBe(await fingerprintWisdomEntry({
      ...base,
      citations: [{ id: 'new-source' }],
    }));
  });
});
```

Worker tests must prove:

- unauthenticated request returns 401;
- authenticated non-platform-owner returns 403;
- malformed hash returns 400;
- the account header scopes reads and writes;
- PUT upserts one receipt for one account, kind, and id;
- DELETE removes it;
- no endpoint returns a source body or private evidence reference.

### Step 2: Run and confirm RED

```bash
npx vitest run src/wisdom/verificationFingerprint.test.ts worker/tests/wisdom-verification.test.ts
```

Expected: fingerprint and endpoints do not exist.

### Step 3: Add the account-scoped table

```sql
CREATE TABLE wisdom_entry_verifications (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('cultivar','region','producer','style','mark','namedTea')),
  entry_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  verified_by_user_id TEXT NOT NULL,
  verified_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, entry_kind, entry_id)
);

CREATE INDEX idx_wisdom_verifications_account_entry
  ON wisdom_entry_verifications(account_id, entry_kind, entry_id);
```

### Step 4: Implement protected endpoints

Add:

- `GET /api/wisdom/verifications/:kind/:id`
- `PUT /api/wisdom/verifications/:kind/:id` with `{ "content_hash": "<64 lowercase hex>" }`
- `DELETE /api/wisdom/verifications/:kind/:id`

Use the normal authenticated user and `X-Teajia-Account` scope. Require `platform_role === 'platform_owner'`. Return only `entry_kind`, `entry_id`, `content_hash`, and `verified_at`; do not return a user email or source trust data.

### Step 5: Verify

```bash
npx vitest run src/wisdom/verificationFingerprint.test.ts worker/tests/wisdom-verification.test.ts
npx vitest run worker/tests
npm run lint
```

Expected: focused and Worker suites pass.

### Step 6: Commit

```bash
git add worker/migrations/123_wisdom_verifications.sql worker/src/wisdomVerification.ts worker/src/index.ts worker/tests/wisdom-verification.test.ts src/wisdom/verificationFingerprint.ts src/wisdom/verificationFingerprint.test.ts src/lib/api.ts
git commit -m "feat(wisdom): add private verification receipts"
```

## Task 7: Add the hidden platform-owner verification control

**Files:**

- Create: `src/pages/wisdom/WisdomVerificationControl.tsx`
- Create: `src/pages/wisdom/WisdomVerificationControl.test.tsx`
- Modify: `src/pages/wisdom/EntryResearchSection.tsx`
- Modify: `src/pages/wisdom/reference.test.tsx`

### Step 1: Write failing visibility and state tests

```tsx
it('is absent for public readers', () => {
  setPlatformRole(null);
  expect(renderControl()).not.toContain('Verify this reference');
});

it('shows a quiet check only to the platform owner', () => {
  setPlatformRole('platform_owner');
  expect(renderControl()).toContain('Verify this reference');
});

it('marks an old receipt stale instead of verified', async () => {
  mockReceipt({ content_hash: '0'.repeat(64) });
  expect(await renderCurrentEntry()).toContain('Reference changed since verification');
});
```

### Step 2: Run and confirm RED

```bash
npx vitest run src/pages/wisdom/WisdomVerificationControl.test.tsx src/pages/wisdom/reference.test.tsx
```

Expected: control is absent.

### Step 3: Implement the internal control

- Read `platformRole` from the existing app store.
- Return `null` before any query unless the role is exactly `platform_owner`.
- Fingerprint the currently rendered public entry plus its citations and potential profile.
- Render an icon-only check with a `tap-target` and accessible label.
- Empty means no receipt, filled means matching receipt, changed indicator means stored hash differs.
- Click PUTs the current hash and shows a reversible success notice.
- Undo DELETEs the receipt.
- Never alter public authorship, badges, copy, metadata, or structured data.

Place the control beside the quiet research/authorship footer on each detail page through `EntryResearchSection`, not in global navigation and not on index pages.

### Step 4: Verify interaction and privacy

```bash
npx vitest run src/pages/wisdom/WisdomVerificationControl.test.tsx src/pages/wisdom/reference.test.tsx
npm run lint
npm run lint:colors
```

Browser-check logged-out and platform-owner states at 390x844 and 1440x900. Confirm the control is absent from logged-out markup, the tap target is at least 44x44, there is no overflow, and the console has no errors.

### Step 5: Commit

```bash
git add src/pages/wisdom src/lib/api.ts
git commit -m "feat(wisdom): add owner verification control"
```

## Task 8: Make i64OS proposals citation-complete and safely supersede the old batch

**Files in `/tmp/wt-i64-tea-sync`:**

- Modify: `apps/core/lib/teajia-tea-sync/index.ts`
- Modify: `apps/core/scripts/sync-teajia-tea.ts`
- Modify: `apps/core/__vitest__/teajia-tea-sync.test.ts`
- Modify: `context/knowledge/Tea.md` only if the canonical source schema needs documentation

### Step 1: Write failing proposal-contract tests

```ts
it('includes sorted citations in canonical bytes and the content hash', () => {
  const proposal = buildProposal(citedRegionRecord);
  expect(proposal.citations.map(citation => citation.id)).toEqual([
    'yi-bang-place-source',
    'yi-bang-trade-context',
  ]);
  expect(buildProposal(citedRegionRecord)).toEqual(proposal);
});

it('holds back research-compiled entries without usable citations', () => {
  const result = previewProposal(uncitedResearchRecord);
  expect(result.status).toBe('held_back');
  expect(result.reason).toBe('research proposal has no usable field citations');
});

it('accepts a capture only when the review receipt is provable', async () => {
  mockCaptureResponse({ result: {} });
  await expect(applyProposal(citedRegionRecord)).rejects.toThrow('ambiguous capture response');
});
```

Also retain the existing assertions that a successful response must prove:

```ts
expect(response.result.routed_to).toBe('knowledge_fact');
expect(response.result.triage_id).toEqual(expect.any(String));
expect(response.result.pending_review).toBe(true);
```

### Step 2: Run and confirm RED

```bash
npx vitest run apps/core/__vitest__/teajia-tea-sync.test.ts
```

Expected: citation metadata is not yet part of the canonical proposal contract.

### Step 3: Extend the manual manifest only

- Include source ids, field paths, usage state, qualification, and evidence references in canonical proposal bytes.
- Sort all citation arrays before hashing.
- Keep reference metadata `drafted` and unreviewed regardless of future source file metadata.
- Hold back research-compiled records without `usable` or `qualified` citations.
- Allow Adrian-authored product Markdown through its existing authored-evidence path.
- Keep preview as the default.
- Keep `--apply` manual and capped at 25.
- Do not add a timer, daemon, webhook, or direct assimilation route.

### Step 4: Prove deterministic preview and no-write idempotency

Run twice and preserve only counts, hashes, and proposal ids in the handoff evidence:

```bash
npm run sync:teajia-tea -- --json > /tmp/tea-cited-preview.first.json
npm run sync:teajia-tea -- --json > /tmp/tea-cited-preview.second.json
shasum -a 256 /tmp/tea-cited-preview.first.json /tmp/tea-cited-preview.second.json
diff -u /tmp/tea-cited-preview.first.json /tmp/tea-cited-preview.second.json
```

Expected: identical bytes and hashes; no capture calls.

### Step 5: Apply no more than 25 corrected proposals

Only after Teajia source files and i64OS proposal bytes agree:

```bash
npm run sync:teajia-tea -- --apply --limit 25 --json > /tmp/tea-cited-apply.json
```

Before deferring anything, prove every submitted proposal returned a non-empty triage id, `routed_to = knowledge_fact`, and `pending_review = true`. If any response is ambiguous, stop. Do not retry blindly and do not defer the old record.

### Step 6: Defer only proven predecessors

For each corrected proposal that has a provable open replacement, call the existing triage defer endpoint for its prior uncited capture with:

```json
{ "reason": "superseded by cited tea knowledge v2" }
```

Leave every replacement waiting. Do not approve, review, or assimilate it. Do not run a later batch.

### Step 7: Verify i64OS

```bash
npx vitest run apps/core/__vitest__/teajia-tea-sync.test.ts
npm run typecheck
rg -n "knowledge_assimilate|setInterval|node-cron|schedule" apps/core/lib/teajia-tea-sync apps/core/scripts/sync-teajia-tea.ts
```

Expected: tests and typecheck pass; the forbidden direct call and scheduling mechanisms are absent.

### Step 8: Commit i64OS separately

```bash
git add apps/core/lib/teajia-tea-sync/index.ts apps/core/scripts/sync-teajia-tea.ts apps/core/__vitest__/teajia-tea-sync.test.ts context/knowledge/Tea.md
git commit -m "feat(tea): require cited knowledge proposals"
```

## Task 9: Expand the corpus in bounded, truth-preserving batches

**Files:**

- Modify as evidence supports: `data/tea-wisdom-source/research-sources.json`
- Modify as evidence supports: `data/tea-wisdom-source/citations.json`
- Modify as evidence supports: `data/tea-wisdom-source/potential-profiles.json`
- Modify only when supported: existing CSVs under `data/tea-wisdom-source/`
- Modify: `docs/_notes/tea-knowledge-final-integration.md` only with non-secret verification evidence

### Step 1: Order work by live-product value

Generate a read-only report that ranks uncited Wisdom entries by how many live products resolve to them. The report may read D1 but must not write to it. Process the highest-reuse entries first so one careful review improves several product pages.

### Step 2: Apply the claim-scope checklist to every entry

For each proposed field, record:

1. Which exact source supports it?
2. Does the source discuss this exact TeaLot, or the broader region, cultivar, producer, or style?
3. Is the wording narrower than or equal to the evidence scope?
4. Is it stable factual context, qualified trade knowledge, or merely a research lead?
5. Is sensory material mapped to valid tasting ids?
6. Would a customer reasonably mistake it for Adrian's own observation?

If question 2 or 3 cannot be answered, mark the citation `held_back` and do not publish the claim.

### Step 3: Keep early profiles conservative

Add a Wisdom PotentialProfile only when multiple sources or a suitably broad primary source support the entry-level character. A single retailer product page can remain a useful source for that exact product without producing any common profile.

### Step 4: Review complete entries opportunistically

Adrian may use the hidden check only after agreeing with the whole displayed entry. Unchecked cited entries remain public and clearly sourced; the check is not a publication gate. Any subsequent content, citation, or profile change makes the receipt stale automatically.

### Step 5: Commit each bounded research batch

```bash
node scripts/build-wisdom.mjs
node scripts/export-wisdom-dataset.mjs 2026-08-09
npx vitest run src/wisdom src/pages/wisdom/reference.test.tsx
git diff --check
git add data/tea-wisdom-source src/wisdom/generated public/wisdom
git commit -m "content(wisdom): add cited tea research batch"
```

## Task 10: Full verification, live rehearsal, and deployment

**Files:**

- Modify only if a verified defect is found in the changed path.
- Preserve non-secret evidence in `docs/_notes/tea-knowledge-final-integration.md`.

### Step 1: Run the complete Teajia gate

```bash
npm run lint
npm run lint:colors
npx vitest run src worker/tests
npm run build
git diff --check
```

Expected: every command exits 0.

### Step 2: Browser-verify real surfaces

Start the dev server and send Adrian the clickable URL before inspection:

```bash
npm run dev
```

At 390x844 and 1440x900, verify:

- a cited Wisdom entry;
- a product with Adrian tasting plus resolved potential character;
- a product with source-described exact-lot tasting;
- platform-owner verification empty, checked, undo, and stale states;
- logged-out pages contain no verification control;
- no console errors;
- no horizontal overflow.

### Step 3: Rehearse the live Yi Bang Curate import without finalization

Use the specified Yunnan Sourcing Yi Bang record. Confirm the untouched extracted description, processing notes, producer, exact source excerpt, taxonomy-valid tasting, and `source` attribution. Preserve non-secret evidence, then abandon the draft. Do not finalize inventory and do not create products, receipts, vendors, or sourcing runs.

If the real record reveals a defect, add a focused failing regression first, fix only that path, rerun the focused and full checks, deploy the changed surface, repeat the rehearsal, and abandon the replacement draft.

### Step 4: Deploy only changed surfaces

- If Worker code changed, deploy it manually and verify the protected endpoints and Curate behavior.
- Deploy the Teajia Pages surface through the repository's normal production path.
- Do not touch or document Infisical or Cloudflare token values.
- Verify `https://teajia.com`, never the abandoned `teajia.pages.dev` project.

### Step 5: Stop at the requested boundary

Stop when:

- the first corrected capture batch is waiting for Adrian;
- the older matching captures are explicitly deferred only where replacements were proven;
- the real import draft was verified and abandoned;
- all checks pass;
- any required Worker change is live;
- mobile and desktop browser checks are clean.

Do not review captures, populate live cultivar fields, run later batches, repair deployment credentials, or begin unrelated inventory work.

### Step 6: Final commits and handoff

Commit only task-scoped changes in each isolated repository. The handoff should report:

- the exact proposal count submitted, held back, and deferred;
- proof that submitted proposals are still pending review;
- source/citation/profile holding counts;
- exact check commands and results;
- live URLs verified;
- whether any Worker deployment occurred;
- confirmation that the Yi Bang draft was abandoned and created no operational records;
- no source bodies, secrets, or tokens.

## Final acceptance checklist

- Yunnan Sourcing appears as a cited Research Source and never as Teajia's vendor unless Adrian separately creates that actual relationship.
- The exact Yi Bang listing may retain its source-described profile without becoming a claim about all Yi Bang tea.
- Wisdom pages show citations and qualified potential profiles where evidence supports them.
- Product tasting surfaces distinguish source-described, owner, community, and cited potential character.
- Product descriptions remain factual and do not absorb tasting prose.
- Shared Wisdom is resolved dynamically and is not copied into product rows.
- Internal verification is platform-owner-only, account-scoped, reversible, and hash-stale after change.
- Public exports omit private evidence, trust classifications, vendor relationships, and verification receipts.
- Research proposals fail closed without citations, remain manual, and apply at most 25.
- No direct assimilation, automatic schedule, secret handling, or unintended inventory mutation is introduced.
