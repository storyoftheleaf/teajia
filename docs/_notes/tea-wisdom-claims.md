# Tea Wisdom claims — the contract the pilot builds against

Status: pilot contract, 2026-11-23. Plan: [todo/plans/tea-wisdom-pilot-action-plan.md](../../todo/plans/tea-wisdom-pilot-action-plan.md). Types: [src/wisdom/reference/claims.ts](../../src/wisdom/reference/claims.ts).

## One section is one claim

Each `## Heading {#key}` section in `data/tea-reference/pages/*.md` is one claim. Its ID is `pageId:key` (for example `gong-ting:definition`). This is the same identity the catalogue already uses (`catalogue.ts:422`), so existing links keep working.

The Markdown section is the **editing surface**: what an editor or an AI draft proposes. The **claim ledger** `data/tea-reference/claims.json` is the **approval record**. It holds every revision's text and the claim's metadata. Public builds read the ledger, never the Markdown text directly.

| Section text compared with the ledger | Meaning | Public build | Preview build |
|---|---|---|---|
| equals the current approved revision | settled | approved text | approved text |
| differs from every revision | pending edit | approved text (unchanged) | pending text, labelled "Pending rev N+1" |
| claim `status: withdrawn` | withdrawn | omitted | omitted, listed in the review panel |
| claim has no approved revision yet | new draft | omitted | draft text, labelled "Draft" |

Approval is a reviewed commit made by `npm run tea-reference:claims:approve -- <claimId> --reason "<why>"`. The script appends the Markdown text as a new revision with the date and reason, and sets it as current. Nothing else writes approved text.

## Page visibility

`visibility: draft` is allowed on every page kind. Every claim on a draft page is held out of the public registry (`generatedPages.ts`). Draft pages are built only into `generatedDraftPages.ts`, which is loaded only when `MODE === 'tea-reference-preview'` or on the dev-only `/preview/wisdom-pilot/*` routes. A test asserts that no draft text appears in the public registry.

The new page kind is `leaf_grade`. Its parent must be a `tea_type` page (Gong Ting → `shou`).

## Claim ledger entry

```jsonc
{
  "claim_id": "gong-ting:definition",
  "axis": "grade",                     // grade | place | type | process | maker_history | sensory_observation | terminology
  "scope": "Loose ripe pu'er, Menghai Tea Alliance standard T/MHC 003–2020",
  "listing_eligible": true,            // may appear on a shop listing
  "applies_when": { "grade": "gong-ting" },
  "attribution": null,                 // required for sensory_observation, see below
  "terms": [
    { "original": "宫廷", "pinyin": "gōngtíng", "gloss": "palace; used here as a grade name" }
  ],
  "status": "approved",                // approved | withdrawn (pending is derived, never stored)
  "current_rev": 2,
  "revisions": [
    { "rev": 1, "text": "…", "approved_at": "2026-11-24", "reason": "Imported from the legacy marks corpus", "evidence_ids": ["EVIDENCE-…"] },
    { "rev": 2, "text": "…", "approved_at": "2026-11-25", "reason": "Scoped to the loose-tea table", "evidence_ids": ["EVIDENCE-…"] }
  ],
  "withdrawn": null                    // { "at": "…", "reason": "…" } when status is withdrawn
}
```

Rules the builder enforces:
- Every revision's `evidence_ids` exist in `data/tea-reference/private/translations.json`, and each evidence record's `uses` lists this `claim_id` (`uses: [{ page_id, section_key }]` already exists, and the claim ID is `page_id:section_key`).
- `text` follows the existing prose rules: English, ends with punctuation, no Han script. Chinese goes only in `terms` and in the page's `native_name`.
- `terms[].original` must contain Han script. `pinyin` and `gloss` are English or Latin script.
- `axis: sensory_observation` requires `attribution` and `listing_eligible: false`.
- `axis: maker_history` requires `listing_eligible: false`.
- A claim's `scope` is shown with the passage wherever it is projected.

## Sensory observations

Each account is its own claim: one seller batch, one study sample group or one taster. Differing accounts are never merged.

```jsonc
"attribution": {
  "source_id": "yunnan-sourcing-jingmai-gong-ting",
  "source_role": "seller_own_batch",   // standard | producer | seller_own_batch | study | specialist_editorial | taster
  "sample": "Jingmai Mountain Gong Ting loose ripe, Yunnan Sourcing listing"
}
```

On a listing they appear only in the last block, labelled "Style reference", with the attribution sentence. They never describe the lot on screen.

## What a listing may match on

The resolver receives `ListingFacts` (types file). It is built from recorded product fields only:

| Fact | From | Never from |
|---|---|---|
| `type` | `normalizeTeaType(product.type)` | name |
| `grade` | an explicit grade field. None exists today, so fixtures only. | name, description |
| `originParts` | `product.originRegion` split on commas, lower-cased | name |
| `nameTokens` | product name | — (used only to corroborate a place, see below) |
| `form` | `product.form` | name |

`applies_when` keys: `type`, `grade`, `origin_includes` (all must be present in `originParts`), `name_includes` (all must be in `nameTokens`; only valid together with `origin_includes`), and `form`. A name never supplies grade, age or maker.

Ranking: grade > place > type > process. The resolver returns at most two `listing_eligible` passages, and the second must have a different axis from the first. Sensory claims that apply are returned separately as `styleReferences`.

## Article claim uses

Articles record what they cite in `article_wisdom_claim_uses` (practice DB only during the pilot):

```sql
CREATE TABLE article_wisdom_claim_uses (
  id INTEGER PRIMARY KEY,
  account_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  claim_id TEXT NOT NULL,
  rev_used INTEGER NOT NULL,
  use_kind TEXT NOT NULL CHECK (use_kind IN ('prose', 'live_block')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

A use needs review when the claim's `current_rev > rev_used`, or when the claim is withdrawn. A `live_block` always shows the current approved text and is never flagged. Only `prose` uses are flagged. Exact-lot tastings (`product_impressions`) are keyed to author and product, and claim changes never touch them.
