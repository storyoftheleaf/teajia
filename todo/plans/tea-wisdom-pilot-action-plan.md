# Tea Wisdom pilot — action plan

Revised 2026-11-23. Merges our draft with an independent plan Fable wrote without seeing it, and Fable's review of the draft. Checked against origin/main `3eecf1d5`. Since the build plan (`bbd1fed2`), only a family voice-note change has landed, which is unrelated. Companion to [tea-wisdom-publishing.md](tea-wisdom-publishing.md). Stops at sandbox review: no production writes, no deploy, no push to main.

## Current state: the gaps that matter (each checked in code)

1. **Two Wisdom systems disagree.** The cited Markdown pages (`data/tea-reference/pages/` → `generatedPages.ts`) are new. The older uncited corpus is live and contradicts them:
   - Gong Ting is "the highest grade… seen on shou pu-erh and aged Taiwanese oolong" (`src/wisdom/generated/marks.ts:65-76`). This is the real general definition that the correction narrows.
   - Naka is a "village on Nannuo Mountain" (`src/wisdom/generated/regions.ts:444-449`), which contradicts TeaDB's Mengsong.
2. **No claim identity, revision, scope or axis.** The unit is a whole section (`catalogue.ts:422`). The builder reads current files only, so Git history cannot serve "last approved while a draft is pending". `translations.json` already holds locator, hash, Han original and English (`page-builder.mjs:186-239`). It is tracked in a public repo.
3. **New pages would go public on merge.** Every kind except `reference_topic` is forced public (`page-builder.mjs:127`). Han script is banned from prose and labels (`:87,130,147`). There is no Shou, grade, Mengsong or Dayi entry.
4. **Lot text already breaks the brief.** Naka's live record:
   - `terroir` says the trees are 300–500 years old;
   - `processing_notes` says "full-bodied and earthy";
   - five flavour tags have `tasting_source: null`.

   The page renders all of it (`AlcoveCard.tsx:539-565`).
5. **Three paths carry claims onto a lot without evidence:**
   - "Potential character" falls through region and style research (`productResearch.ts:27-33`).
   - The older resolver reads the product name, so "Naka Gushu" yields variety "Gushu".
   - Any name containing "Gong Ting" yields the grade mark into the grid (`AlcoveCard.tsx:694`).

   Products have no grade field.
6. **Listings have no slot for a Wisdom passage.** The tea page omits the reference section (`AlcoveCard.tsx:707-746`). The only style-reference device is per-product text split on `## Style aroma reference` (`AlcoveAboutSection.tsx:62-63,150`).
7. **Articles can't cite claims.** Article links require `status='published'` (`worker/src/index.ts:10033,10912`). `wisdom_relations` accepts only legacy node ids (`menghai` exists, `menghai-county` doesn't) and has no revision.
8. **Tasting consent lives only on the local branch `codex/naka-integrated-sandbox`:**
   - unpushed and 8 commits behind main;
   - migration `0073_…` collides with main's `0073_teajia_family.sql` (main is at 0077);
   - `show_on_listing` defaults to 0, so promoted notes hide on deploy;
   - `NAKA_LOT_ID` is hard-coded in `AlcoveCard.tsx`.
9. **`npm run sandbox` returns 503 on current main** (`shared_allowance_paused`). Use the practice shop instead (`npm run practice`, API 8798, site 7813, `worker/sandbox/README.md:48-65`).

## Phases (≈6.5 working days)

### 0. Ground and coordinate (½ day)
- Message the Codex strategist session. They rebase, renumber to 0078 and decide the `show_on_listing` default. I don't edit their files. Agree one `exactLotLead` prop on `AlcoveCard`.
- Seed the practice DB with Naka (real id, live fields verbatim) and Aged Ripe Pu-erh.
- Field audit of the three cases: mark each rendered field supported, unsupported or withheld.
- **Done when:** `/shop/product/naka-gushu` renders on 7813 and reaches Menghai County and back.

### 1. Claims and pilot entries (1½ days)
- `page-builder.mjs`:
  - add the kind `leaf_grade`;
  - allow `visibility: draft` on any kind;
  - parse claim markers on sections;
  - emit drafts to `generatedDraftPages.ts`, loaded only in preview mode (`previewMode.ts`).
- Add a structured `terms` field (original, pinyin, gloss) for 宫廷, 特级 and 七级. Public prose stays English.
- New drafts:
  - `shou.md` (wet piling, plain language);
  - `gong-ting.md`, `special-grade.md` and `seventh-grade.md` (T/MHC 003–2020 §5.3.3.2.2 Table 5, kept separate from the national GI standard);
  - Mengsong/Naka (TeaDB) and Dayi 1973/1975 sections in `menghai-county.md`.
- Seller observations (Jingmai, Simao, Nannuo) and Yang et al. each become a separate sensory claim tied to its batch or sample.
- A held list of unresolved claims, such as an origin date for the Gong Ting name.
- **Done when:**
  - `npm run test:tea-reference-pages` and `:pages:check` pass;
  - new tests prove the production registry holds no draft text;
  - approved rev 1 with pending rev 2 builds rev 1.

### 2. Listing passages (1½ days)
- `src/wisdom/reference/listingPassages.ts`:
  - recorded facts only (type, form, origin parts, explicit grade);
  - at most two passages, ranked grade > place > type;
  - the second is dropped if it shares an axis;
  - only `listing_eligible` claims;
  - history and sensory claims are never primary;
  - sensory claims come back separately as style references.
- Route "Potential character" through the same guard or turn it off in the pilot. A product name never supplies grade, age or maker.
- `alcove/AlcoveWisdomPassages.tsx` goes directly under Provenance (`AlcoveCard.tsx:738`), linked from its grid row. "Style reference · …" goes after About (`:743`). The pilot view suppresses the Naka fields the audit marks unsupported.
- Dev-only, localhost-only fixtures:
  - `/preview/wisdom-pilot/gong-ting-external`: banner "External reference example. Not Teajia stock"; no price, cart, Taste or Collect; never a DB row; never in `catalogue.productIds`;
  - `/preview/wisdom-pilot/type-only`: `{type:'Shou'}` only.

  Fixture queries are stubbed.
- **Done when** unit tests prove:
  - Naka gets the Mengsong sentence and nothing on grade, maker, vintage, tree age or sensory;
  - the type-only case gets wet piling, and its output is identical with the withheld fields added;
  - a product merely named "Gong Ting" gets no grade passage.

### 3. Article and round trip (1 day)
- Seed the article draft through the existing admin editor in the practice DB. It opens with the two Gong Ting cups, then Table 5, then the side-by-side exercise.
- Record its claim uses in `article_wisdom_claim_uses` (practice DB only). One grade sentence is pinned to rev 1.
- Add a `/wisdom/grade/:id` page reusing `ReferenceFactSections`, plus a preview-only "Compare ripe pu'er leaf grades" link from the grade passage.
- Check whether `handleGetPublicArticle` (`index.ts:31000`) serves drafts to an admin. If not, use the admin Drafts preview.
- **Done when:** listing → article → Gong Ting → Menghai → Naka works by clicking, and signed-out visitors see no draft.

### 4. Correction demo (1 day)
- Rev 1 is the legacy wording from `marks.ts`. Rev 2 is scoped to loose ripe pu'er in T/MHC 003–2020 Table 5.
- A `/preview/wisdom-pilot` panel approves rev 2 or withdraws the claim.
- **Done when:**
  - the Gong Ting fixture wording changes, and Naka and type-only are unchanged;
  - the article sentence shows "Needs review: claim changed, rev 1 → 2" with old and new text;
  - a seeded exact-lot tasting keeps its text, byline and lot;
  - withdrawing removes the shop passage and flags the article.

### 5. Verify and hand over (1 day)
- A Playwright spec importing from `tests/fixtures.ts`, run on Desktop and Mobile Chrome, checking overflow and console errors.
- `npm run lint`, `lint:colors`, `test:mobile` and the receiving suites.
- Screenshots at 1440 and 390 on one page with direct links, and the list of every path tested. Stop.

## Research and capture (runs alongside Phases 0–1, ≈1½ days)

Every public sentence must trace to a captured evidence record. The repo already has a governed capture tool for this:
- **Allowlist:** `scripts/tea-reference-capture/*-allowlist.json`. Each entry records robots decision, licence, publisher role, permitted claim scopes and rate limit.
- **Capture and claims:** `npm run tea-reference:capture:*` does a deterministic curl fetch through per-site adapters (`adapters/`). It writes evidence (locator, hash, original) and claims, then a review workbook.
- **Handoff and receiving:** `website-handoff.json` feeds the receiving preview's **Review incoming** screen in `/admin/wisdom`.
- **Publication:** Markdown pages plus `translations.json` evidence.

No AI in capture, and no metered service.

**Already captured (10 sources):** TeaDB (Yunnan, Lincang, Greater Yiwu, Menghai), CTMA ×4, MarshalN and Tea Guardian. TeaDB Menghai is captured, but only its "Characteristic Taste" and "A Brief History" sections. The Mengsong passage that places Naka is **not** in evidence yet.

**Already in your notes:** nothing citable on Gong Ting or Mengsong. The vault holds inventory notes and a few research-wiki captures. The i64os library was unreachable during this check (core down); search it again when it's up.

| Source | Role | Adapter | Status |
|---|---|---|---|
| TeaDB Menghai, Mengsong section | specialist editorial | specialist-article | re-capture with the Mengsong heading |
| T/MHC 003–2020 PDF, §5.3.3.2.2 Table 5 | standard | **new `standard-pdf`** | add; Chinese PDF, may need OCR |
| SAMR national standard record (GB/T 22111) | standard (metadata) | html | add; record only, kept separate |
| Dayi chronology (1973, 1975 entries) | producer, own history | **new `producer-chronology`** | add; Chinese |
| Yang et al. 2025 (spgykj) | study | journal-abstract | add |
| MDPI fermentation study | study | journal-abstract | add |
| Yunnan Sourcing Jingmai, Simao, Nannuo | seller, own batch | **new `seller-listing`** | add; robots and terms check first |
| white2tea ripe process article | specialist editorial | specialist-article | add |

**Still open, not found by scraping:** a documented origin date for the Gong Ting name stays on the held list unless a source turns up. A second, Chinese source for Naka-in-Mengsong is optional corroboration.

**Steps and who does them:**
1. **Allowlist entries:** Sonnet drafts all nine; Opus checks robots, licence and role.
2. **Adapters and tests:** three new adapters (Opus), with fixture tests from saved pages.
3. **Capture runs:** Haiku runs the capture commands; any failure goes to Opus.
4. **Translation and wording:**
   - Opus translates the Table 5 rows and Dayi entries, checked against the `tea-terms` library.
   - Sonnet drafts proposed public wording for each claim from evidence only, citing evidence ids.
   - Sensory observations stay one claim per batch or sample.
5. **Check:** Fable checks that each sentence traces to its evidence and stays inside its scope.
6. **Review and approval:** Adrian reviews in **Review incoming**; approval is a reviewed commit.

**Scraping rule:** use the capture tool's own fetcher. Use Firecrawl only for a page that needs JavaScript, and then the self-hosted one through i64os. The cloud Firecrawl connected to this session is metered.

## Data model

```
claim (translations.json → "claims")
  claim_id      "gong-ting:definition"          // stable
  axis          grade | place | type | process | maker_history | sensory_observation
  scope         "Loose ripe pu'er, T/MHC 003–2020"
  applies_when  { grade: "gong-ting" }          // recorded product facts only
  listing_eligible  true
  current_rev   2
  status        approved | pending | withdrawn
  revisions[]   { rev, public_text, reason, approved_by, approved_at, evidence_ids[] }
evidence (exists) + source_role standard | producer | seller_own_batch | study | editorial
                  + sample  "Jingmai loose, YS listing" / "12 samples, 4 areas"
                  locator, excerpt_sha256, original (zh), english

article_wisdom_claim_uses (practice DB only)
  article_id, block_index, claim_id, rev_used, use_kind (prose | live_block)
  -- flag when current_rev > rev_used or status = withdrawn
```

Exact-lot tastings stay in `product_impressions`, keyed to author and product id. They are never touched by a claim change.

## Browser paths (practice shop, http://127.0.0.1:7813, each at 1440 and 390)
1. `/shop/product/naka-gushu`, then Provenance, then `/wisdom/region/menghai-county`, then Available teas, then Naka.
2. `/preview/wisdom-pilot/gong-ting-external`, then "Compare ripe pu'er leaf grades", then `/article/what-a-ripe-puer-leaf-grade-can-tell-you`.
3. From the article: `/wisdom/grade/gong-ting`, then Menghai, then Naka.
4. `/preview/wisdom-pilot/type-only`, then `/wisdom/type/shou`.
5. `/preview/wisdom-pilot`: approve rev 2, recheck paths 1, 2 and 4 and the admin article flag; then withdraw and recheck.
6. Signed out: the draft article and draft entries return not-found.
7. `/wisdom/mark/gong-ting` is unchanged.

## Decisions for Adrian
1. **Canonical Wisdom:** the cited Markdown pages (recommended). The legacy Gong Ting mark and Naka region entry get corrected later, as a separately authorized change.
2. **Naka's live copy** (tree age, "earthy", five unsourced tags): mirror it in the sandbox, hide it in the pilot view and list the conflicts. Editing the record is a production write.
3. **Name as a place source:** only when the recorded origin corroborates it (recommended). A name never supplies grade, age or maker.
4. **Chinese terms:** allow them in a structured `terms` field. This changes the "no Han script in public prose" rule.
5. **Original excerpts in a public repo:** short table rows only (recommended), or move `translations.json` out of the repo.
6. **"Approved" in the pilot:** a reviewed commit (recommended). In-app editing comes later.
7. **Tasting branch:** keep it separate and test the empty lead slot (recommended). It gets merged only after the strategist rebases it.
8. **Product grade field:** defer it until a Teajia lot has grade evidence.

## Not in this pilot
- No production data, no deploy, no migration outside the local DB.
- No edits to the strategist's tasting files or to navigation.
- No in-app Wisdom editor, AI drafting pipeline or flavour suggestions.
- No removal of the legacy corpus.
- No Gong Ting claim on any Teajia lot, no sensory copy on Naka, and no product row for the external example.
