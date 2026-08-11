# Tea Research Provenance Design

## Purpose

Teajia needs to use reputable published tea research at launch without presenting a retailer as Adrian's supplier, transferring one retailer's product claims onto a different tea, or implying Adrian personally verified every reference entry.

This design makes the research chain explicit, keeps operational sourcing private, and lets one reviewed Wisdom Entry improve the public reference and every related product page.

## Decision

Use a hybrid storage model.

- Git-backed structured files remain canonical for global Wisdom content, source metadata, citations, and potential profiles.
- Cloudflare D1 remains canonical for account-scoped products, vendors, inventory, and personal tasting.
- D1 also stores Adrian's private verification receipt because it is an internal mutable workflow state, not public Wisdom content.
- Private excerpts and page snapshots remain in i64OS Research or Vault records and are excluded from the public dataset.
- i64OS capture remains the proposal and review boundary. It is not the public website database.

### Alternatives considered

**All Wisdom in D1** would make editing easy, but it would discard the current reproducible Git-built public dataset, make global reference content depend on a live database, and mix public knowledge with operational records.

**All state in Git** would preserve excellent history, but an internal verification check could not be a quiet one-click action without creating commits or pull requests from the browser.

**Hybrid storage** keeps each kind of truth in its existing natural home and adds only one small operational table for private verification.

## Domain model

### ResearchSource

A public bibliographic record with:

- stable id;
- publisher or author;
- page or work title;
- canonical URL when applicable;
- source kind;
- access date;
- optional publication date;
- internal trust classification;
- optional private evidence reference, excluded from public exports.

Yunnan Sourcing can be a ResearchSource without becoming a Vendor.

### Citation

A many-to-many relationship connecting one or more ResearchSources to the exact fields or sections of one WisdomEntry. A citation carries a usage state:

- `usable`: supported well enough for qualified public reference use;
- `qualified`: usable only with limiting language recorded on the citation;
- `held_back`: contradictory or too weak for public use.

Source reputation alone does not make every claim from that source universally portable.

### WisdomEntry

The existing shared region, cultivar, producer, style, mark, or named-tea record. A public field must be authored by Adrian or supported by at least one usable or qualified Citation. Unsupported new fields fail the build rather than silently publishing.

### PotentialProfile

A taxonomy-valid sensory profile attached to a WisdomEntry and supported by Citation ids. It describes possible character at the correct scope. It never becomes a product-specific owner tasting merely because a product resolves to that WisdomEntry.

### VerificationReceipt

An internal D1 record containing:

- account id;
- Wisdom entry kind and id;
- deterministic content hash covering the public entry, citations, and potential profile;
- verifying user id;
- verification time.

The receipt is current only when its stored hash matches the entry currently displayed. Any content or citation change makes it stale automatically.

### SourceDescribedProfile

A taxonomy-valid sensory profile transcribed from evidence about one exact TeaLot. It may be stored on that product with `tasting_source = 'source'` until Adrian records his own tasting. It does not become a Wisdom PotentialProfile and does not generalize to the tea's village, cultivar, producer, or style.

When Adrian saves his own tasting, the product profile becomes `owner`. The original source description and excerpt remain on the private Curate import record, so replacing the displayed profile does not erase the evidence trail.

### TeaLot, Vendor, Producer, and PersonalObservation

These keep their current meanings and storage boundaries. A ResearchSource never fills Vendor. A product-specific producer, harvest, tree age, processing claim, or tasting claim transfers only when it describes the exact TeaLot. New Curate imports label exact source-described tasting as `source`; they do not write `common`. Existing `common` product records remain untouched until they are individually audited.

## Canonical storage

### Global Wisdom in Git

Add three source files under `data/tea-wisdom-source/`:

- `research-sources.json` for bibliographic records;
- `citations.json` for entry and field support;
- `potential-profiles.json` for cited taxonomy-valid potential tasting profiles.

`scripts/build-wisdom.mjs` validates and generates lean runtime modules under `src/wisdom/generated/`. `scripts/export-wisdom-dataset.mjs` includes public source metadata and citation relationships in `public/wisdom/tea-wisdom.json`, while omitting trust classifications, private evidence references, and verification receipts.

The existing CSVs and cultivar stories remain canonical for their current content. Citations refer to entry ids and field paths rather than duplicating prose.

### Operational data in D1

Products, inventory, actual vendor relationships, costs, producer fields, and exact tasting remain in D1. Product Markdown remains an editorial archive and D1 synchronization mirror, not the research-source registry.

Add one account-scoped D1 table for internal verification. No Wisdom prose is copied into this table.

### Private evidence

Exact copied excerpts, screenshots, and page snapshots are retained in private i64OS Research or Vault records with stable evidence references. Public pages receive citations and paraphrased knowledge, not copied source bodies. Teajia never needs runtime access to those private bodies.

## Data flow

### Research intake

1. A research page is captured with source metadata and private evidence.
2. Claims are scoped to a Wisdom entry and fields.
3. Potential sensory terms are mapped only to existing tasting taxonomy ids.
4. The complete proposal, including citation metadata, goes through `capture`.
5. Adrian's normal review action remains the only assimilation boundary.
6. A manual deterministic publisher prepares reviewed changes to the Git-backed Wisdom source files.
7. Teajia's normal build validates, generates, tests, and deploys the reference.

There is no direct `knowledge_assimilate` call, automatic schedule, or permanent background sync.

### Public Wisdom page

Each detail page renders its current record, qualified potential character where present, and a Research Sources section. The page may say that an entry was sourced from research, but private verification state is never rendered publicly.

### Product page

The product page combines:

- the exact D1 product description and facts;
- the actual private vendor relationship where the admin surface needs it;
- the exact producer when known;
- Adrian's product tasting from D1;
- an exact source-described product profile from D1 when Adrian has not yet replaced it with his own tasting;
- related Wisdom context resolved from existing product identity fields;
- a cited Potential Profile from Wisdom, visually and semantically separate from Adrian's tasting.

The product does not copy Wisdom prose or tasting into its D1 record. Updating the shared entry updates every resolving product after the normal site build. The tasting section labels the three possible layers plainly: source-described for this exact product, Adrian's tasting, and broader potential character from cited Wisdom research.

### Internal verification

When Adrian is authenticated as platform owner, each Wisdom detail page shows a quiet check control beside the internal source/status line. It is absent from public markup for unauthenticated visitors.

- Empty check: no current VerificationReceipt.
- Filled check: the current content hash is verified.
- Changed indicator: a receipt exists for an older hash.
- Click: write the current receipt and show a reversible success notice.
- Undo: delete the current receipt.

Verification applies to the complete entry. There is no bulk verification and no partial star.

The receipt does not change public authorship, wording, badges, structured data, or citations. Existing authorship rungs continue to describe who wrote or edited the public entry. Internal verification describes only Adrian's private review state.

## Source policy

Use source type and claim scope together.

- Scientific, governmental, institutional, and producer-primary records can support stable factual claims within their stated scope.
- Reputable specialist retailers such as Yunnan Sourcing can support qualified trade descriptions and provide research leads.
- Retailer price, format, harvest, tree age, family, exact processing, and exact tasting remain attached to that retailer's exact product unless independently supported.
- A retailer page used to analyze an actual purchase or offer may supply a SourceDescribedProfile for that exact TeaLot. The same page cannot create a regional or style PotentialProfile without separate broader evidence.
- General style, place, cultivar, and processing knowledge may be promoted only when the citation supports that broader scope and the prose remains qualified.
- Contradictory or unattributed claims are held back.

## Existing first capture batch

The 25 open Tea captures remain unapproved while this structure is built.

After the source-aware manifest is complete:

1. preview the full corpus;
2. prove deterministic bytes and idempotency;
3. require citation completeness for every research-compiled proposal;
4. apply at most 25 corrected new or changed proposals;
5. prove all corrected replacements are open with receipts;
6. defer the prior 25 with the audited reason `superseded by cited tea knowledge v2`;
7. leave the corrected batch waiting for Adrian.

The prior batch is never approved, assimilated, silently deleted, or confused with the corrected batch.

## Failure behavior

- Unknown ResearchSource id: build fails.
- Citation points to an unknown entry or field: build fails.
- PotentialProfile contains an unknown or cross-category tasting id: build fails.
- Research-compiled capture lacks usable citation metadata: proposal is held back and cannot apply.
- Verification write from a non-platform-owner: Worker returns 403.
- Verification hash is missing or malformed: Worker returns 400.
- Displayed content changes after verification: control becomes stale without changing public content.
- Source URL disappears: citation remains historically legible and is flagged during the next source audit; no product field is rewritten automatically.

## Security and privacy

- Vendor relationships, costs, private excerpts, evidence snapshots, and internal verification remain private.
- Public exports include only bibliographic citation metadata.
- Verification endpoints require normal authentication, account scope, and platform-owner authorization.
- Public product APIs remain unchanged and do not expose vendor data.
- No secrets enter source files, logs, commits, or evidence notes.

## Delivery sequence

### Phase 1: Provenance foundation

Define the glossary, source registry, citations, potential profiles, validators, generated runtime modules, and public export. Seed a small representative corpus including Yunnan Sourcing as a ResearchSource, not a Vendor.

### Phase 2: Reference surfaces

Render Research Sources and Potential Profile on Wisdom detail pages. Add product-page resolution so the same shared profile appears in the tasting section without copying it into D1.

### Phase 3: Private verification

Add the D1 receipt, protected Worker endpoints, client API, and platform-owner-only check control on Wisdom detail pages.

### Phase 4: Source-aware capture

Extend the i64OS manifest and capture payload with citations, fail closed on missing research provenance, replace the first proposal batch safely, and leave corrected captures waiting.

### Phase 5: Corpus expansion

Add citations in bounded batches, starting with the entries used by live products. Publish only sourced fields, and let Adrian verify complete entries opportunistically while reading the site.

## Acceptance criteria

- Yunnan Sourcing can appear publicly as a Research Source without appearing as Teajia's Vendor or the producer of a different tea.
- A Wisdom entry shows the sources supporting it.
- A product page keeps its exact description and Adrian tasting while showing separately cited potential character.
- An exact retailer tasting imported through Curate is labeled source-described for that product, not common to its region or style.
- Updating one Wisdom entry changes every resolving product without editing product records.
- Only Adrian as platform owner sees and can use the verification check.
- Verification becomes stale when entry content, citations, or potential profile changes.
- Research-compiled capture cannot apply without usable citations.
- The corrected first 25 proposals wait for review and the uncited predecessors are explicitly superseded in the audit trail.
- No direct assimilation, automatic sync, inventory creation, vendor creation, or secret handling is introduced.
