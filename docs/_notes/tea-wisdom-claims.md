# Tea Wisdom claims — the contract the pilot builds against

Status: pilot contract v2, 2026-11-23 (after Fable review). Plan: [todo/plans/tea-wisdom-pilot-action-plan.md](../../todo/plans/tea-wisdom-pilot-action-plan.md). Types: [src/wisdom/reference/claims.ts](../../src/wisdom/reference/claims.ts).

**Draft means off the site, not secret.** This repo is public. Draft pages, the claim ledger, withdrawn revision text and `data/tea-reference/private/` can all be read on GitHub. The ledger never holds source excerpts. Excerpts stay short (single table rows) in `translations.json`.

## One section is one claim

Each `## Heading {#key}` section in `data/tea-reference/pages/*.md` is one claim. Its ID is `pageId:key` (for example `gong-ting:definition`), the identity the catalogue already uses (`catalogue.ts:422`).

- **Markdown** is the editing surface: the label, the citations and the proposed text.
- **The claim ledger** `data/tea-reference/claims.json` is the approval record. It holds all claim metadata (axis, applies_when, listing_eligible, terms, attribution, status) and every revision. Metadata is authored only in the ledger; section headings carry no extra markers.
- Labels and citations come from Markdown and are not versioned.
- Public builds take claim text from the ledger, never from Markdown.

### Pending detection

The builder compares the section's cleaned text with the text of `current_rev` only. Cleaned text is the output of `cleanSectionText`: citations stripped, whitespace collapsed, paragraphs joined by `\n\n`. Any difference means pending, including text that equals an older revision.

| State | Ledger | Public build | Preview build |
|---|---|---|---|
| draft | `status: draft`, `current_rev: null` | omitted | Markdown text, labelled "Draft" |
| approved, settled | `status: approved`, Markdown equals current_rev | current_rev text | current_rev text |
| approved, pending edit | `status: approved`, Markdown differs | current_rev text (unchanged) | current_rev text, with the pending text beside it as "Pending rev N+1" |
| withdrawn | `status: withdrawn` | omitted | omitted, listed in the review panel |

Build failures:
- a ledger entry whose section no longer exists in Markdown, unless it is withdrawn;
- a section with no ledger entry.

A page with no approved claims is omitted from the public registry. A public page's `sourceIds` are the union of its approved claims' citations.

### Commands (each one is a reviewed commit)

- `npm run tea-reference:claims:approve -- <claimId> --reason "<why>"` appends the cleaned Markdown text as a new revision with `origin: "approved"` and makes it current. If `axis`, `applies_when`, `listing_eligible` or `scope` changed, the same command records the change: a metadata change always requires a new revision.
- `npm run tea-reference:claims:withdraw -- <claimId> --reason "<why>"` sets `status: withdrawn` and records `withdrawn`.
- `npm run tea-reference:claims:import-legacy -- <claimId> --from marks:gong-ting` adds a revision with `origin: "legacy_import"` and `evidence_ids: []`. This is allowed only for a claim on a draft page. It is how rev 1 of the Gong Ting definition enters from `src/wisdom/generated/marks.ts`.

### Backfill (the builder thread's first commit)

Every section of every existing `visibility: public` page gets a ledger entry with:
- rev 1, `origin: "approved"`, reason "Backfilled from pages";
- `listing_eligible: false` and `applies_when: {}`;
- axis set by hand per section.

`npm run tea-reference:pages:check` must show `generatedPages.ts` byte-identical afterwards.

## Page visibility and generated modules

`visibility: draft` is allowed on every page kind. The new kind `leaf_grade` must have a `tea_type` parent (Gong Ting → `shou`).

A draft page may cite a source whose evidence capture is still pending. The builder records these citations as `unresolvedSourceIds` on the draft claim, and the preview shows them as "Evidence pending". A public page never may. Approving a revision still requires real `evidence_ids`.

| Module | Exports | Contents | Loaded |
|---|---|---|---|
| `src/wisdom/reference/generatedPages.ts` | `GENERATED_TEA_REFERENCE_REGISTRY` (unchanged shape) | public pages, approved text | always |
| `src/wisdom/reference/generatedClaims.ts` | `GENERATED_CLAIMS: readonly PublicClaim[]` | approved claims only (`reviewState: 'approved'`) | always |
| `src/wisdom/reference/generatedDraftClaims.ts` | `GENERATED_DRAFT_CLAIMS: readonly PublicClaim[]`, `GENERATED_DRAFT_PAGES` | every claim in every state, with `previousRevisions` and `pendingText` | only through a mode-guarded dynamic `import()`, when `MODE === 'tea-reference-preview'` or on dev-only `/preview/wisdom-pilot/*` |

A test builds production and greps `dist/` for a sentence from a draft page; the sentence must not be found.

### Correction demo panel

The demo panel on `/preview/wisdom-pilot` is an in-memory preview override, not an approval. Over `GENERATED_DRAFT_CLAIMS` it lets the viewer pick, per claim, which revision counts as current: rev 1, rev 2 or withdrawn. Every projection on the preview page (listing passages, the grade page, the article "needs review" flag) is computed client-side from the overridden set with the same functions production uses. The real approval stays the `claims:approve` commit.

## Claim ledger entry

```jsonc
{
  "claim_id": "gong-ting:definition",
  "axis": "grade",            // grade | place | type | process | maker_history | sensory_observation | terminology
  "listing_eligible": true,
  "applies_when": { "grade": "gong-ting" },
  "attribution": null,        // required for sensory_observation
  "terms": [{ "original": "宫廷", "pinyin": "gōngtíng", "gloss": "palace; used here as a grade name" }],
  "status": "approved",       // draft | approved | withdrawn
  "current_rev": 2,           // null while draft
  "revisions": [
    { "rev": 1, "origin": "legacy_import", "legacy_ref": "marks:gong-ting",
      "scope": "General grade designation (shou pu'er and aged Taiwanese oolong)",
      "text": "…", "approved_at": "2026-11-24", "reason": "Imported from the legacy marks corpus", "evidence_ids": [] },
    { "rev": 2, "origin": "approved",
      "scope": "Loose ripe pu'er, Menghai Tea Alliance standard T/MHC 003–2020",
      "text": "…", "approved_at": "2026-11-25", "reason": "Scoped to the loose-tea table", "evidence_ids": ["EVIDENCE-…"] }
  ],
  "withdrawn": null           // { "at": "…", "reason": "…" }
}
```

Rules the builder enforces:
- **Evidence:** each `evidence_ids` entry exists in `translations.json`, and that evidence's `uses` includes this claim (`{page_id, section_key}`). Empty `evidence_ids` is allowed only for `origin: legacy_import`. The render thread must tolerate empty `sourceIds`.
- **Text:** English prose rules, with no Han script. Chinese goes only in `terms[].original` (which must contain Han) and in a page's `native_name`.
- **Sensory observations:** `axis: sensory_observation` requires `listing_eligible: false`. `attribution` is optional; when present, its `source_id` must exist in sources.
- **Basis:** `basis: "trade_knowledge"` claims need no evidence or citation. `basis: "sourced"` claims (the default) do.
- **Never listing-eligible:** `axis: maker_history` and `axis: terminology`.
- **Scope:** belongs to the revision and is shown with the passage wherever it is projected.

## Adrian's decisions, 2026-11-23 (these override anything below)

1. **Common trade knowledge needs no citation.** Wet piling, what Gong Ting, special grade and seventh grade mean, Naka sitting in Mengsong: we write these in our own words, informed by sources but never copied. A claim takes `basis: "trade_knowledge"` (default `"sourced"`). A trade_knowledge revision has no `evidence_ids`, and its Markdown section needs no `[cite:]` marker. Sources we read stay in private research notes, not on the page.
2. **Taste is described as what people commonly notice in the style, with no credit.** Several accounts are folded into one sentence in our own words ("People often notice dried fruit and a creamy sweetness…"). This replaces separate attributed observations. It is still shown last under its own label ("What people often notice"), it describes the style or grade, and it is never presented as the taste of the lot on screen. Adrian's or a guest's exact-lot tasting is the only taste text about the lot itself.
3. **The research list shrinks.** Yang et al. and the MDPI study are dropped. Seller pages are read for background only.

The rules below are updated to match: `attribution` is optional on `sensory_observation`, and `listing_eligible` stays false for every sensory claim (they appear only as the style block, never as a passage).

## Sensory observations

Each account is its own claim: one seller batch, one study sample group or one taster. Differing accounts are never merged.

```jsonc
"attribution": { "source_id": "yunnan-sourcing-jingmai-gong-ting", "source_role": "seller_own_batch",
                 "sample": "Jingmai Mountain Gong Ting loose ripe, Yunnan Sourcing listing" }
```

On a listing they appear only in the last block, labelled "Style reference", with the attribution sentence. They never describe the lot on screen.

## What a listing may match on

`ListingFacts` is built only from recorded product fields:

| Fact | Value | From | Never from |
|---|---|---|---|
| `type` | `normalizeTeaType(product.type)`, e.g. `'Shou'` | type field | name |
| `grade` | a `leaf_grade` page id, e.g. `'gong-ting'` | explicit grade field (fixtures only today) | name, description |
| `originParts` | `originRegion` split on `,`, each part run through `normalizedWords` (`catalogue.ts:75`): Naka is `['mengsong', 'menghai', 'yunnan']` | origin field | name |
| `nameTokens` | `normalizedWords(name).split(' ')`, e.g. `['naka', 'gushu']` | name | used only to corroborate a place |
| `form` | `normalizeTeaForm(product.form)` | form field | name |

`applies_when` matching:
- Keys are ANDed. An empty `applies_when` never matches.
- `type`, `grade` and `form` use exact equality.
- `origin_includes` uses whole-part equality: every listed value must equal one `originParts` entry.
- `name_includes` means every value is in `nameTokens`. It is valid only together with `origin_includes`.

The three pilot cases:

| Case | Claim | applies_when |
|---|---|---|
| Naka | `menghai-county:mengsong-naka` (place) | `{ origin_includes: ['mengsong'], name_includes: ['naka'] }` |
| Jingmai fixture | `gong-ting:definition` (grade) | `{ grade: 'gong-ting' }` |
| Type-only fixture | `shou:wet-piling` (process) or `shou:definition` (type) | `{ type: 'Shou' }` |

Ranking:
1. Axis order is grade > place > type > process.
2. Within an axis, the claim with more `applies_when` conditions wins. A remaining tie goes to the lower `claim_id` by code point.
3. At most two passages, and the second must have a different axis from the first.
4. Sensory claims that apply are returned separately as `styleReferences`.

## Article claim uses

```sql
CREATE TABLE article_wisdom_claim_uses (   -- practice DB only during the pilot
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  claim_id TEXT NOT NULL,
  rev_used INTEGER NOT NULL,
  use_kind TEXT NOT NULL CHECK (use_kind IN ('prose', 'live_block')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (article_id, block_index, claim_id)
);
```

The "needs review" flag is computed client-side with `articleUseNeedsReview` against the claims module in use: `GENERATED_CLAIMS`, or the overridden draft set on the demo panel. The worker stores the article’s dependency on a specific revision. Its authenticated article read includes the cited wording from the retained approved history of public pages. Public reads include only published articles and claim IDs in the generated public index. A `live_block` shows the current approved text and is never flagged. Exact-lot tastings (`product_impressions`) are keyed to author and product, and no claim change touches them.
