# Tea Wisdom: one composed entry per tea

Status: plan, awaiting Adrian's decisions (2026-11-23). Follows `todo/plans/tea-wisdom-pilot-action-plan.md`.

## The problem Adrian named

The pilot listing stacks Wisdom claims as separate blocks ("What ripe pu'er is", "Wet piling"), each with its own "Read more in Wisdom" link and a visible internal "Scope" line. It reads as pieces, explains basics a tea buyer often knows, and the links land on a page that repeats the sentence. Adrian does not want to rewrite each listing. He wants to feed facts and have the entry come out well written, with the right links.

## What exists today (surveyed 2026-11-23)

- Descriptions: Curate's "propose description" (`worker/src/curateTeaDescription.ts`) drafts one to three paragraphs from the record, notes and voice transcripts, on Groq `gpt-oss-20b` or Workers AI Llama 3.3. Its prompt is inline and does not use `docs/PRODUCT_DESCRIPTION_STYLE.md`. It never sees Wisdom claims. Nothing is stored until a person accepts it.
- Wisdom on the page: `AlcoveWisdomPassages` sits after Provenance; `AlcoveWisdomStyleReferences` after About. Live shop passes no claims yet (`PRODUCTION_LISTING_CLAIMS = []`).
- Matching: `resolveListingPassages` already picks the right approved claims per tea. No product row has a grade.
- Correction tracking: `article_wisdom_claim_uses` already flags article sentences when a claim changes.

## The system

Facts in, one writer, links and checks by the system.

1. **Inputs, never prose.** The tea record (type, grade, origin, form, year, maker), the approved Wisdom claims that match it (existing resolver), and Adrian's own notes and tastings.
2. **One composer writes the whole entry** in the house voice from `PRODUCT_DESCRIPTION_STYLE.md`. It leads with what is specific to this tea, puts general knowledge in a clause (the reader may know Gong Ting), and leaves depth to Wisdom. Taste goes last, as what people often notice about the style, never as a claim about the lot.
3. **Every sentence carries its sources.** Each paragraph is stored with the claim ids and revisions it used, the same record articles keep. The existing citation check refuses any sentence not traceable to an input.
4. **Links are placed by the system, not the writer.** The composer marks the terms it used (Gong Ting, wet piling, Mengsong). The page turns them into inline links only when the Wisdom target offers more than the sentence: other sections, other teas, or articles. The stacked blocks, "Read more in Wisdom" buttons and the Scope line go.
5. **Adrian approves once per tea**, from one screen: the entry, its links and what each sentence rests on. No rewriting.
6. **Corrections flow through.** When a claim changes, entries that used it are flagged and a recomposed draft waits beside the old one, exactly like the article flag.

## Phases

1. Target entry (about 2 hours): hand-compose the Jingmai Gong Ting entry on the real product layout with photos, desktop and phone. Adrian approves the look and voice before anything is automated.
2. Composer (about a day): prompt from the style guide plus claims, output paragraphs with claim ids and link terms, voice lint (no em-dashes, no superlatives).
3. Page (about half a day): one entry block, inline links with the "more than the sentence" rule, Provenance rows linking to Wisdom, Scope hidden from customers.
4. Corrections (about half a day): entry claim uses, flag and recompose on claim change.
5. Intake (about half a day): a grade field on the tea record carried to the product, and composing offered when a tea is promoted from Curate.

## Decisions for Adrian

1. Who writes. Recommended: a script on the Mac using the `claude` CLI (Opus to compose, then a check pass), saving drafts for approval. Alternatives: keep the Worker's free Groq/Llama models (weaker voice), or call the Anthropic API from the Worker (needs a paid key and a meter).
2. Grade on the product. Recommended: add a grade field to the tea record, set at intake, never read from the name.
3. Approval. Recommended: approve each entry at first; revisit auto-publish once ten entries pass without edits.

## The framework: a layer stack (added 2026-11-23)

Every entry is built from the same stack of layers, most specific first. The composer uses the top layers the tea actually has, one paragraph at most per layer, then always closes with brewing and the style notice.

| Layer | Comes from | Example |
|---|---|---|
| 1. Your word on this lot | voice note, tasting, notes | where you found it, why you bought it |
| 2. Maker or recipe | maker_history claims | 7572 as Menghai's reference recipe |
| 3. Grade | grade claims (needs the grade field) | Gong Ting, the finest sieve |
| 4. Place | place claims | Naka, a Lahu village in Mengsong |
| 5. Age | new age-band claims per type | a ripe at 10+ years: pile smell gone, smoother |
| 6. Type | type and process claims | ripe pu'er and wet piling |
| Close: brewing | new brewing claims per type, per grade where it differs | short pours for fine leaf |
| Close: what people notice | sensory claims, style only | smooth, sweet, deep red |

Rules: lead with the most specific layer present; two to four paragraphs; a layer the tea lacks is skipped, never guessed (nothing is read from the name); taste is always last and about the style.

What a thin tea gets. Name, year and type only: type (6) and age (5) make the body, then brewing and what people notice. That is a complete, true entry. Adding an origin, a grade or a voice note later produces a richer draft beside the live one.

### The type kit

A thin tea can go up only when its type has a kit in Wisdom: definition, process, three age bands (young, 5 to 10 years, 10+), brewing, and what people notice. Phase 1 builds the ripe pu'er kit and counts how many shop teas each missing kit would unlock, so research goes where it puts the most teas online.

### Research reach (tested 2026-11-23)

- Open Chinese trade sites (ipucha, guchaju, thetea.app, Sohu): Claude reaches them directly. Hermes's citations to them were checked and are real pages.
- Zhihu and Baidu Baike: refuse plain fetches from both the Mac and the VPS (403). Firecrawl is blocked too.
- Xiaohongshu, Taobao, JD: pages load but the content sits behind sign-in and scripts.
- So the blocked sites are reached through a signed-in browser: Claude in Chrome with Adrian's own sessions, read-only, or Hermes's browser on the VPS. Everything else Claude does directly.
