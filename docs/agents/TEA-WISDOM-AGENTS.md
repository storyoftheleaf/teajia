# Tea Wisdom for agents: from a new tea to its entry on the shop

> Before you start: read [the handoff](TEA-WISDOM-HANDOFF.md) for what is open right now.

How a tea that has just gone public gets its Tea Wisdom entry, and every Wisdom page it needs, without any agent deciding where anything goes. Approved by Adrian on 2026-11-27 ([process page](https://claude.ai/artifact/8N9HcPPeDqHmfUbZbLdT21)). The rule this serves is in [CLAUDE.md](../../CLAUDE.md#the-wisdom-base-is-one-place-adrian-2026-11-27): one Wisdom Base, records plus pages, joined by id. The storage is described in [TEA_WISDOM_BASE.md](../TEA_WISDOM_BASE.md#one-wisdom-base-two-layers-read-this-before-adding-anything).

The chain is run by the `/tea-wisdom` command (`.claude/commands/tea-wisdom.md`), only when Adrian asks. It stops at three points, and each one is Adrian's: the pages, the entries, and "push".

## The rules every step keeps

1. **Nothing is invented.** No fact, date, year, cost, price, altitude or grade that the tea's record or an approved claim does not give. A fact that is missing goes into a Wisdom page first, never straight into an entry.
2. **No agent reads facts out of the tea's name.** A place or an age is used only when the record holds it; the name may confirm a recorded place, but never supply one. A grade or mark in the name (Palace Grade is Gong Ting) counts only when the shared matcher finds it (`gradeIdsIn` in `src/wisdom/reference/teaMatching.ts`, which the check and the composer both use), never by an agent's own reading.
3. **Nothing goes to the live shop.** No step writes to the shop's database or calls a Teajia write tool. Everything is files in this repo, plus the review page.
4. **Nothing is pushed without Adrian's "push".** Commits are fine; `git push` waits for his word in chat.
5. **One Wisdom Base.** Pages go in `data/tea-reference/pages/`, claims in `data/tea-reference/claims.json`, records in `data/tea-wisdom-source/`, entries in `data/tea-reference/entries/`. No other store, list or library, and the vault holds only research notes.
6. **Adrian sees rendered pages, never diffs.** Every review goes through the review page (step 3).
7. **A missing connection is built, not worked around.** If a step needs to read or write something through the shop connection and no tool does it, build the tool in `worker/src/mcpTools/` (Adrian's standing permission, 2026-11-27). Its preview and confirm rules still apply.

## Models

| Step | Model | Why |
|---|---|---|
| 1 Check | none | Code: `wisdomNeeds()` |
| 2 Research and draft | Sonnet | Reading and writing up many sources is synthesis |
| 3, 6 Review page | none | A script builds it |
| 4 Write the entry | Opus | Adrian's choice, 2026-11-27: it wrote all 210 entries so far, and he keeps that voice |
| 5 Check the entry | Opus | Spotting a sentence the claims don't quite support is the judgment that keeps an invented fact off the shop |
| 5 Fix a flag | Sonnet | Cutting or rewording one sentence |
| Sorting send-backs | Haiku | Classification: wording, fact or wrong page |

Subagents are dispatched with these models named explicitly (`model: "sonnet"` / `"haiku"`). The composer calls Opus itself through the `claude` CLI on the Mac.

## Step 1. Check what the Wisdom Base lacks

- **Run:** `node scripts/tea-wisdom-compose/needs.mjs --products <file> --ids <id,…>`, where the file is the public product list (`curl -s https://www.teajia.com/api/products/public > $TMPDIR/products.json`). The same check shows on the tea in Curate as its "Wisdom Base" list. With no `--ids` it checks every public tea and ends with the missing pages most teas need.
- **It prints** one line per need: state (`covered`, `drafted`, `record`, `missing`), kind (`style`, `place`, `grade`, `process`, `producer`, `named`), label and page id.
- **A missing kit is a need like any other.** When the tea's type or style has no approved kit, the check prints `missing style … No style kit for <type>`. That is "kit missing": step 2 drafts the kit, and the tea's entry waits until Adrian approves it. A drafted kit reads `drafted`.
- **Hand on:** each `missing` or `record` line becomes one research job for step 2, addressed by the table below. `drafted` means a page is written and waiting for step 3. When everything is `covered`, go straight to step 4.
- The check's rules are the table in [TEA_WISDOM_BASE.md](../TEA_WISDOM_BASE.md#when-a-new-tea-is-posted-what-the-wisdom-base-needs) and the composer's own matching, so what it calls covered is what step 4 will find.

### Where each page goes (decided here, never by the agent)

| Need | Page `kind` | `id` | `parent` | Claim `axis` | `applies_when` |
|---|---|---|---|---|---|
| style | `tea_type` (or `tea_family` for a whole family) | the style's canonical id (`liu-bao`, `yancha`) | its family or type page | `type` | `{type}`, plus `origin_includes` or `name_any` for a style within a type |
| place | `tea_area` (a village or mountain) or `major_region` (a county or province) | the region row's id in `data/tea-wisdom-source/origins.csv` | the row's parent region | `place` | `{origin_includes: [<place words>]}` |
| grade | `leaf_grade` | the mark row's id in `marks.csv` | the `tea_type` page it grades | `grade` | `{grade: <id>}` |
| process | a section in the style's `tea_type` page, or a `reference_topic` page if it spans types | `<process-id>` | the style page | `process` | `{type}` plus the process words |
| producer | `reference_topic` | the producer row's id in `producers.csv` | none | `maker_history` | the producer's own match words |
| named | `named_tea` | the row's id in `named-teas.csv` | none | `named_tea_history` | `{named_tea: <id>}` |

A page's id is always the id of its record. If the record row does not exist (state `missing`), add it to the right CSV in `data/tea-wisdom-source/` with that id and every fact you can support, then run `node scripts/build-wisdom.mjs`. Never delete a row. A place page shows publicly only once a public tea links it.

## Step 2. Research and draft each missing page (Sonnet, one agent per page)

**Kits come only through this chain (Adrian, 2026-11-27).** A type or style kit is drafted here, by `/tea-wisdom`, when the check reports it missing, and it stops at Adrian's review like any page. No separate session, folder or batch writes kits. The 15 approved kits on main are the models; the sections every kit has are in [the kit template](../../todo/plans/tea-wisdom-all-teas.md#the-kit-template).

**Read first:** this file; [WISDOM_PAGE_STYLE.md](../WISDOM_PAGE_STYLE.md), the rules for how every page reads, which grow from Adrian's review notes; one approved page of the same kind (`shou.md` for a style, `banzhang.md` for a place, `y562.md` for a named tea); [the claims contract](../_notes/tea-wisdom-claims.md).

**Research method.** It used to live in the vault at `Teajia/Research/tea-wisdom/HOW-TO-RESEARCH.md`; this section now holds it.

- Everything on a Wisdom page is common knowledge in the tea trade: what a tea master, a farmer in the growing area or an experienced seller would tell anyone who asked. Find what that shared knowledge is by reading many places, and show where they agree and where they don't.
- Read at least 5 independent places, in Chinese and English, mixing kinds: producers' own history pages, sellers describing their own teas, tea educators and specialist blogs, Chinese trade and industry sites, county or provincial government pages, standards documents, tea forums and Q&A sites, academic abstracts. Two pages that copy each other count as one.
- Zhihu and Baidu Baike refuse plain reads, and Xiaohongshu, Taobao and JD hide their content behind sign-in. Read them through Adrian's signed-in Chrome (Claude in Chrome), read only, or skip them and list them as "not reachable". Never complete a login, an app prompt or a CAPTCHA.
- A statement is "commonly agreed" only when 3 or more independent places support it. Anything weaker goes under "Not established", including founding dates and "first used" claims.
- Keep type, grade, place and maker apart. A grade name says nothing about where a tea grew. A village name says nothing about tree age. A factory's history is not a fact about every tea from its county. Never describe one product as if it were the whole category.
- Taste notes are counted across places ("smooth, 4 of 6"), never quoted. Copy no source's wording: every statement is in your own plain English.

**Research note** (vault: `Teajia/Research/tea-wisdom/<id>.md`):

```
# <Entry name>            (entry-id: <id>)
Kind: tea type | leaf grade | growing area | village | producer | process | named tea
Part of: <parent id>     Related: <id>, <id>

## Chinese names
- <characters> · <pinyin> · <plain-English meaning>

## What is commonly agreed
1. <One statement, own words, one fact per line.>
   Applies to: <exactly what it covers>
   Agreement: <n> of <n read>
   Places: <name> (<kind>, <language>, <URL>); ...

## Where places disagree or are unclear
## What people commonly notice when drinking it   (styles and grades only)
## Not established
## Places read
| Place | Kind | Language | URL | Date read |
```

**Draft page** (`data/tea-reference/pages/<id>.md`):

- Frontmatter: `id`, `slug` (same as id), `kind`, `label`, `native_name`, `parent`, and `visibility: draft`, all from the table in step 1.
- One `## Heading {#key}` per claim, built only from "commonly agreed" statements. A style kit has the sections in [the kit template](../../todo/plans/tea-wisdom-all-teas.md#the-kit-template), each saying why and not only what. A place page has where it is, what it is known for, and how it sits in its parent.
- Write by [WISDOM_PAGE_STYLE.md](../WISDOM_PAGE_STYLE.md) (why people care, few numbers, simple) over the house voice in [PRODUCT_DESCRIPTION_STYLE.md](../PRODUCT_DESCRIPTION_STYLE.md). No em-dashes, no superlatives, lining numerals.
- Rewriting a page that is already public: keep each section's `{#key}` so its approval history carries on, and change only the text. A section that should go is listed in your report for withdrawal, never deleted. A heading's words are not held for approval (only the text is), so a renamed heading shows on the live page at the next push: rename one only if it still fits the text that is live now.
- Sections are `trade_knowledge` (own words, no citation) unless a source has been captured into `data/tea-reference/private/translations.json` through the capture workflow. The research note in the vault is where the places are listed.

**Ledger entries:** for every new section, add an entry to `data/tea-reference/claims.json` with `claim_id: "<id>:<key>"`, `basis: "trade_knowledge"`, the `axis` and `applies_when` from the table, `listing_eligible: true` (false for a section that only makes sense on its own page), `attribution: null`, `terms` (Chinese, pinyin, gloss), `status: "draft"`, `current_rev: null`, `revisions: []`, `withdrawn: null`. Write the proposed scope for each claim (what it covers, from "Applies to") into `.tea-wisdom-review/scopes.json` as `{"<id>:<key>": "<scope>"}`; the review page shows it and approval records it.

**Then:** `npm run tea-reference:pages` (must pass), commit with the research note's path in the message, and hand on the page id.

**Never:** publish a page, approve a claim, set `visibility: public`, or invent a fact to fill a section.

## Step 3. Adrian approves the pages

1. `node scripts/tea-wisdom-compose/review-page.mjs --scopes .tea-wisdom-review/scopes.json` writes `.tea-wisdom-review/review.html` and prints the run id.
2. Publish it with the Artifact tool, `capabilities: {db: {}, user: {}}`, to the one Wisdom Review artifact, [claude.ai/artifact/2MZWE6AFWwCmih1PonbesE](https://claude.ai/artifact/2MZWE6AFWwCmih1PonbesE): pass that URL so the link Adrian keeps stays the same (read it first if this conversation has not). Give Adrian the link.
3. Wait for him to say he has reviewed it. Do not poll.
4. Save his choices: ArtifactData `list` on collection `runs/<run>/decisions` with `out_dir: .tea-wisdom-review/decisions`.
5. `node scripts/tea-wisdom-compose/apply-review.mjs --decisions .tea-wisdom-review/decisions` approves each section through the claim ledger, makes a draft page public once all its sections are approved (never one whose current text is a legacy import), and rebuilds the pages.
6. Send-backs are in `.tea-wisdom-review/sent-back.json`. A note marked `rule: true` (Adrian ticked "Make this a rule for every page") is written into [WISDOM_PAGE_STYLE.md](../WISDOM_PAGE_STYLE.md) first, as a dated rule in his words with one before/after from the section he sent back; then every waiting page is checked against it. Sort the other notes (Haiku): **wording** goes back to its step 2 agent with the note; **fact** goes back to research for that statement; **wrong page** means the record or the table above is wrong, so tell Adrian in one line.

## Step 4. Write the entry (Opus)

- **Run:** `node scripts/tea-wisdom-compose/compose.mjs --products <file> --ids <id>`. It reads the record, the approved claims that match it, [PRODUCT_DESCRIPTION_STYLE.md](../PRODUCT_DESCRIPTION_STYLE.md), `rules.json` and `examples.md`, and writes `data/tea-reference/entries/<productId>.json`.
- Each tea takes two or three Opus calls, about 3 minutes.
- **Never** hand-edit an entry's text to add a fact.

## Step 5. Check the entry and fix flags

- The composer already re-writes once against its fixed checks (dashes, superlatives, taste words in the story, unsupplied links, unknown numbers), then Opus checks every sentence against the inputs. An entry with flags is saved as `needs_review` with `problems` and `unsupported`.
- **Fix agent (Sonnet)** for each flag: re-run the composer for that tea first. If the same flag comes back, cut or reword the flagged words in the entry file so they say only what the claims say. If the entry truly needs the missing fact, stop and send it to step 2 as a section on the right page.
- **Never:** add a fact, a number or a link the inputs don't carry.

## Step 6. Adrian approves the entries

The same review page and the same apply step as step 3. Entries appear under the pages. When more than one entry has no flags, an "Approve all clean entries" button approves them together (Adrian's default, 2026-11-27). `entries-cli.mjs approve` refuses any entry whose claims are not approved or have changed since, so an entry approved before its page is caught.

## Step 7. Push

1. Run the checks: `npm run tea-reference:pages:check`, `npm run test:tea-reference-pages`, `node --test scripts/tea-wisdom-compose/tests/*.test.mjs`, `npx vitest run src/wisdom`, `npm run lint`, `npm run lint:colors`.
2. Commit. When Adrian says "push", rebase onto `origin/main`, re-run the checks, and push to `main` (the "Ship" rule in CLAUDE.md).

## Placement, end to end

Nothing in this chain chooses a URL. An entry is saved under the product id and shows only on that tea's page (`generatedEntries.ts`, keyed by id). A page takes its record's id, and its `kind` decides its address (`/wisdom/region/:id`, `/wisdom/grade/:id`, `/wisdom/type/:id`, `/wisdom/named/:id`, `/wisdom/producer/:id`). Its parent comes from the record. Inline links in an entry are claim ids, which the page turns into links to the right section.
