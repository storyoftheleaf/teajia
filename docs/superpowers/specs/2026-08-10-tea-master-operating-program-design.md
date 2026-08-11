# Tea Master Operating Program Design

**Date:** 2026-08-10

**Status:** Ready for user review

**Program owner:** Teajia

## Goal

Make Teajia's existing tea, person, tasting, inventory, editorial, and Wisdom systems operate as one coherent Tea Master toolkit.

The program delivers five outcomes:

1. Inventory reads as a clean lifecycle instead of an undifferentiated spreadsheet.
2. A Tea Master has one durable public identity across every associated store.
3. That identity can publish a curated tea selection, favorites, writing, and external payment destinations.
4. Personal tasting is directly reachable from stock and remains distinct from the authoritative product tasting profile.
5. Wisdom nodes have validated links to the teas and writings that support them, with technical gaps repaired and editorial gaps made reviewable.

The first release is intentionally basic in breadth and complete in behavior. It extends Teajia's existing systems; it does not create parallel profile, tasting, inventory, article, or knowledge platforms.

## Product boundaries

- Payments remain external transfers. Teajia presents methods and context but does not process money or claim that a transfer succeeded.
- Orders remain inquiry-led through personal conversation.
- Journal, ordinary shopper Favorites, Cellar, Curate, public Tea Master favorites, and authoritative product tasting profiles remain distinct records.
- Public Tea Master favorites are human curation, not ratings, rankings, likes, or algorithmic recommendations.
- Wisdom links are explicit and reviewable. The system never invents missing tea knowledge.
- No social graph, feed, gamification, engagement notification, auto-replenishment, or phone-at-the-table mode is introduced.
- The approved Profile entry may be added to the Account Panel and appropriate admin area. The four primary Read, Learn, Consult, and Shop navigation sections remain unchanged.

## Shared architecture

The program has two load-bearing identities.

### Person identity

`contributors` becomes Teajia's global public-person record. It remains the source for `/people/:slug`, article bylines, portraits, biographies, and public contributor material.

The current contributor primary key is also its public slug and is already referenced by articles. The program preserves that identifier. It does not replace contributor IDs with user IDs.

Current `contributors.account_id` is retained for migration compatibility and treated as the editorial steward/origin account, not as proof that the person belongs to only one store. A new many-to-many association records public store relationships:

```text
contributor_accounts
  contributor_id
  account_id
  public_role
  is_host
  display_order
  created_at
  updated_at
```

The pair `(contributor_id, account_id)` is unique. At most one contributor can be the host of an account. Existing `face_of_account_id`, account-host data, and contributor account ownership are backfilled into associations without changing public slugs.

`account_members` continues to authorize work. `contributor_accounts` only describes public identity and association. A person may be publicly associated with a store without receiving operational access, and membership alone does not publish a profile.

A linked login is unique: at most one contributor may reference a given non-null `user_id`. A signed-in user may edit the safe public fields of the contributor linked to that user. Account associations, public roles, host status, approval, and publication remain owner/platform-controlled. A profile owner may immediately unpublish their own profile but cannot approve or publish it.

Publication requires `display_name` and `beginnings`; `beginnings` is the basic public biography. The profile migration adds `languages` as a JSON array of short display labels. Portrait, location, languages, links, favorites, and payment methods remain optional.

Article author selection continues to store the global contributor ID. Editing an article remains account- and Publish-bundle-scoped, but author validation no longer requires the contributor's steward account to equal the article account. Public article reads continue to expose published article and contributor fields only.

### Tea identity

`tea_profiles` remains the canonical tea identity. Operational stock stays in account-owned product/listing records. The program does not collapse canonical tea content and per-store inventory.

Public Tea Master favorites and Wisdom relationships point at canonical tea profiles. When the experience must preserve where a tea was selected, the relationship also stores an optional source account or source listing/product reference.

Existing legacy product rows remain supported through the current `tea_profiles` and `product_listings` migration anchors. No broad product-table replacement is part of this program.

### Publication boundary

Every public response is an allowlisted projection:

- Draft profiles, inactive payment methods, private favorites, hidden teas, personal tasting journal data, and editorial findings remain private.
- Published profile fields, public store associations, visible tea listings, approved writing, public favorites, and active payment methods may be returned.
- Cross-account public reads resolve the requested public identity explicitly; they never depend on the viewer's active account.
- Authenticated writes still use live membership, bundle, owner, and platform checks. Client visibility never substitutes for Worker authorization.

## Inventory lifecycle

### Primary sections

The inventory table gains one exclusive derived stage and several overlapping facets. The stage is computed from existing product, publication, readiness, stock, and receipt data; it is not a mutable database column.

The displayed order is:

1. **Published** — the tea currently passes the effective public/store publication gate.
2. **Ready, private** — the record is operationally ready but is not publicly listed.
3. **Incoming** — the tea has no received/on-hand holding and has a remaining planned, ordered, or in-transit receipt quantity.
4. **Needs preparation** — the active record is neither public, operationally ready, nor incoming-only.
5. **Archived** — the product is archived, sold out, or otherwise intentionally historical/unavailable.

Stage precedence is deterministic:

1. Archived and Sold Out records always become Archived.
2. Records passing the effective publication gate become Published, even when a missing-information facet also needs attention. This preserves the requirement that everything visible on the website appears first.
3. A zero-on-hand record with an open incoming quantity becomes Incoming.
4. A ready non-public record becomes Ready, private.
5. Every other active record becomes Needs preparation.

An existing tea with on-hand stock and additional stock in transit remains Published or Ready, private and receives an Incoming replenishment facet. It is not moved out of its operational section.

The implementation introduces one pure, tested domain seam:

```text
deriveInventoryStage(product, incomingSummary)
deriveInventoryFacets(product, personalTastingSummary, writingSummary)
```

The existing readiness and effective-publication helpers remain the underlying truth. Existing grouped/collapsible table behavior is reused. Section headers show a name and count, remember their folded state through the existing URL/state pattern, and add no horizontal scrolling.

### Facets and filters

The following facets may overlap:

- Personally tasted / personally untasted / personal tasting count
- Product tasting profile present / missing
- Product description present / missing
- Linked draft article
- Linked published article
- Incoming replenishment
- Low stock / sold out
- Inventory purpose
- Tea Master or stock owner
- Missing readiness information
- Effective hidden/publication-gate reason

The table keeps search and sorting. Filters narrow the staged table without reclassifying records or duplicating rows.

### Incoming stock

`inventory_receipts` and `inventory_receipt_lines` remain the modern incoming-stock source. Planned and in-transit quantities stay outside on-hand stock until receipt. Partial receipt, cancellation, idempotency, stock-ledger provenance, and purpose validation remain intact.

Legacy product-level in-transit fields remain a compatibility input. The inventory summary API normalizes modern receipts and legacy incoming data into one read model.

An incoming-only tea cannot become sellable solely because a product record exists. Publication commands and UI eligibility reject a record with zero on-hand stock and a remaining incoming quantity until receipt moves quantity into on-hand stock.

### Tasting from inventory

Teajia currently has two valid tasting concepts:

1. A personal tasting journal entry containing one or more sittings for the signed-in person.
2. An authoritative product tasting profile used on the tea's public/editorial presentation.

The inventory currently conflates “To taste” with absence of an owner-authored product tasting profile. The build separates them.

- **Record tasting**, **Continue tasting**, and **View tasting** operate on the signed-in person's journal using the normal `TastingSession` path.
- **Edit product tasting profile** opens the existing admin tasting editor and requires the appropriate catalog/publication authority.
- Inventory row state and filters use personal journal status for “tasted/untasted.”
- Product-profile status appears as a separate writing/editorial facet.
- The selected-row action rail exposes the personal tasting action directly. Long-press quick edit and the full product editor remain secondary entry points.

The inventory action preselects the tea and current account context. Private received teas may be tasted. Incoming receipt lines are not treated as tasteable holdings; pre-arrival samples continue through the existing sample record flow.

### Writing summary

Inventory receives an enriched, batched writing summary rather than querying per row. For each product/tea it distinguishes:

- No description
- Product description only
- Linked draft article
- Linked published article

The existing article-product relationship is repaired and used as the compatibility source. Public article state and title are joined server-side. The staged inventory does not infer article linkage from prose or matching titles.

### Inventory visual behavior

This remains an Operate surface: dense, quiet, and spreadsheet-like. Sections use typography, spacing, and dividers rather than cards or colored status pills. Facets are short text/marks with bronze reserved for the active or actionable state.

The InventoryView height chain is unchanged. No new wrapper may break `h-full`, `flex-1 min-h-0`, or the `data-testid="inventory-scroll"` container. Desktop and mobile scroll regression coverage remains mandatory.

## Tea Master profile and account management

### Public profile

`/people/:slug` remains the canonical public person page. The basic release supports:

- Portrait and avatar thumbnail
- Display and Chinese names
- Short biography and current practice
- Location and languages
- Approved external/contact links
- Public store associations and roles
- Public tea selections from associated Tea Master accounts
- Authored articles and existing subject/pull-quote material
- Public Tea Master favorites
- A payment entry when at least one method is published

The existing deeper contributor fields remain supported. The first-release editor groups them into a comprehensible basic profile rather than removing them.

Public tea selection is derived from visible listings belonging to associated accounts. Profile management does not duplicate inventory editing. Authorized Tea Masters follow a management link into the existing Stock surface to change the selection.

### Profile management

The Account Panel gains a **Profile** management destination at `/account/profile`. This is the explicitly approved navigation addition; it does not change the four primary site sections.

The owner sees:

- Publication state and any approval requirement
- Basic identity and biography fields
- Portrait upload/crop
- Public links
- Store associations as read-only unless the owner has authority to manage them
- Favorites editor
- Payment-method editor
- Links to manage associated tea selections and authored work

Profile owners save drafts. Owner/platform editors retain the existing contributor administration path and may approve, publish, unpublish, associate stores, set public roles, and assign host status.

Profile image upload reuses the existing R2 and crop infrastructure through a profile-purpose upload endpoint. It is authorized by contributor ownership or owner/platform authority rather than requiring the Catalog bundle. Object paths and metadata identify the contributor, not a product.

Loading, first-time, draft, awaiting-approval, published, validation-error, upload-error, and authorization-denied states are explicit. A new Tea Master may prepare a complete draft before approval, but signup never publishes a public identity automatically.

### Public identity routes

- `/people/:slug` — canonical profile
- `/people/:slug/favorites` — directly shareable favorites view
- `/people/:slug/pay` — public payment-method chooser

The existing `/u/:slug` shelf remains a distinct personal-tea ownership surface during this program. Where a shelf owner has a published contributor profile, each surface cross-links to the other. This avoids a risky route merge while preventing identity dead ends.

## Public Tea Master favorites

Ordinary shopper favorites remain in `user_favorites` and keep their current account-aware save behavior. Public Tea Master favorites use a separate durable model because they are globally shareable curation:

```text
profile_favorites
  contributor_id
  tea_profile_id
  source_account_id nullable
  source_product_id nullable
  source_listing_id nullable
  note nullable
  position
  is_public
  created_at
  updated_at
```

The pair `(contributor_id, tea_profile_id)` is unique in v1. A Tea Master has one ordered favorites collection. Each item may include one short “Why I chose this” note.

At most one of `source_product_id` and `source_listing_id` is set. When either source is set, `source_account_id` is required and must own that source. This supports both the current operational product table and the canonical listing path during the existing compatibility period.

The editor can search visible teas across the network, select a tea from the Tea Master's own account or another public selection, reorder items, edit the note, and keep an item private.

The public resolver:

1. Checks that the profile and favorite are published.
2. Resolves the canonical tea.
3. Uses the recorded source listing only when it remains public.
4. Falls back to another public listing for the same canonical tea when appropriate.
5. Omits the item when no public representation is available.

Omitted private items do not leak through counts, blank placeholders, ordering gaps, or API metadata. The public profile and direct favorites route use the same response contract.

## Payment destinations

### Model

Payment methods are owned by the global contributor and may optionally belong to one associated account:

```text
payment_methods
  id
  contributor_id
  account_id nullable
  method_type
  label
  recipient_name
  account_identifier nullable
  instructions nullable
  external_url nullable
  qr_image_url nullable
  position
  is_published
  created_at
  updated_at
```

A null `account_id` is the person's default. Without an account parameter, the public page returns published default methods. With a valid account parameter, it returns that account's published methods when any exist; otherwise it falls back to published default methods. Every account-scoped method must reference an account associated with the contributor.

`method_type` is one of `bank_transfer`, `payment_link`, `provider_qr`, or `other`. Provider and regional names such as QRIS or PayPal live in the editable label, so adding a provider does not require backend integration.

Account identifiers and instructions may be intentionally public. They are never written to logs, analytics payloads, error prose, or audit details. API tokens, passwords, private keys, and provider secrets are not accepted fields.

### Public payment page

The QR code encodes `/people/:slug/pay`, optionally with `account=<store-slug>`. It does not encode one payment provider.

The page displays the published recipient identity and ordered active methods. A method may offer copyable instructions, a provider-supplied QR image, or an external link. Teajia's existing QR library generates the profile payment-page QR.

An invoice or order may append display-only context:

```text
?account=<store-slug>&amount=<positive-decimal>&currency=<supported-code>&reference=<bounded-text>
```

The page validates and displays this context for copying. It does not persist query context, initiate a charge, poll a provider, or mark an invoice paid. The existing authorized invoice workflow remains the only way to record payment state in Teajia.

If the profile is unpublished, the requested store is not publicly associated, or no applicable methods are published, the public page returns a neutral unavailable state without exposing private configuration.

### Management

The profile owner may create, edit, order, publish, unpublish, and delete their own methods. Owner/platform editors may manage methods for profiles they are authorized to steward. Publication is explicit per method.

The editor previews exactly what the public response will expose. Delete requires confirmation; unpublish is the preferred reversible action.

## Wisdom relationship integrity

### Preserved source of truth

The static Wisdom Base in `src/wisdom` and its generated source corpus remain the canonical factual reference. This program does not move the entire knowledge base into D1 or make the browser a general-purpose knowledge editor.

The seven node types remain type-scoped identities. A node key is always `(node_type, node_id)`; a bare ID is never sufficient.

### Relationship seam

One validated relations module owns cross-domain links. Public pages, article surfaces, inventory, and admin Wisdom tools consume that module instead of implementing separate joins.

```text
wisdom_node_overrides
  node_type
  node_id
  editorial_status
  public_state
  editor_note nullable
  reviewed_by nullable
  reviewed_at nullable
  updated_at

wisdom_relations
  id
  node_type
  node_id
  target_type
  target_id
  target_subtype nullable
  relationship_kind
  source
  review_status
  account_id nullable
  created_by nullable
  created_at
  updated_at
```

`editorial_status` is `draft`, `review`, or `approved`. `public_state` is `inherit`, `public`, or `hidden`. Existing useful public Wisdom routes remain public by default through `inherit`; the current static authorship rung is not automatically treated as a publication gate. Editors can explicitly hide an inadequate node. New relations become public only after approval.

Supported targets in v1 are:

- D1 article
- Canonical tea profile
- Another typed Wisdom node
- Authoritative product tasting profile
- Promoted/public tasting-note material

Private personal journal sittings are not public Wisdom targets.

`target_type` is one of `article`, `tea_profile`, `wisdom_node`, `product_tasting`, or `promoted_tasting_note`. `target_subtype` is required only for `wisdom_node` and contains its node type. `relationship_kind` is one of `supports`, `illustrates`, `mentions`, or `is_example_of`; the validator owns the legal source/target matrix.

The validator confirms that the source node exists, the target exists, the relationship kind is legal for the target, and the caller may view or mutate the target. Public reads include approved relations whose targets independently pass their public gate.

### Existing article-product relationship

The existing `article_products` relationship is repaired before being adapted into the Wisdom seam:

- Add its idempotent schema to the numbered Worker migration ledger so clean and upgraded databases match.
- Replace legacy static-story selection in the live admin editor with D1 article/product data.
- Render reverse relationships on the live D1 article and product paths.
- Backfill canonical tea-profile relations only when the legacy product-to-profile anchor is unambiguous.

The compatibility table may remain behind an adapter in v1. A second independent article-to-tea truth is not introduced.

### Integrity findings and review queue

The admin Wisdom surface extends its existing gap and usage patterns with derived findings:

- Node lacks supporting writing
- Node has no related visible tea where one is expected
- Relation target is missing
- Relation points to an unpublished dependency
- Article is orphaned from tea/Wisdom structure
- Product resolves ambiguously or not at all
- Node is hidden or incomplete while public dependencies point to it
- Existing article-product link cannot be mapped reproducibly

Safe exact relationships are backfilled. Name-based, semantic, ambiguous, and editorial judgments become proposed relationships or review findings. The first release provides a linkable review queue and relation editor; it does not require assignment, notification, or workflow analytics.

Public Wisdom pages gain related writings and teas only from approved, public-safe relationships. Admin pages show the complete relationship state and findings. Existing Wisdom search, grouping, shareable address state, usage counts, and inventory return links remain intact.

## API and authorization boundaries

New or changed routes remain registered in the existing Worker router for bundle-size discipline. Domain validation and query logic live in focused helper modules rather than adding more unrelated behavior to route handlers.

### Profile

- Public profile reads return published allowlisted fields.
- Self profile reads/writes require `contributors.user_id` to equal the live authenticated user.
- Publication, store association, host assignment, and public-role changes require owner/platform authority.
- Article editing remains scoped to the article account and Publish capability.

### Favorites

- Public reads require a published profile and omit non-public teas.
- Self writes require contributor ownership.
- Admin writes require owner-tier authority in the contributor's steward account or platform authority.
- Source-account references are validated against public visibility and contributor associations.

### Payments

- Public reads return published fields only.
- Self writes require contributor ownership.
- Account-specific methods require a valid contributor-account association.
- Public request context is validated and never trusted as invoice state.

### Inventory and tasting

- Inventory summary reads require account membership and the existing inventory permission.
- Personal tasting status is scoped to the authenticated person and active account using the existing journal identity contract.
- Product tasting profile writes retain their existing catalog/publication authority.
- Receipt and stock commands retain current account and ledger invariants.

### Wisdom

- Base node reads are network-level.
- Relation mutations involving account-owned targets require the account's Publish bundle. Node overrides and approval of network-level relations require Platform Owner or Platform Admin authority.
- Public reverse reads enforce the target's own publication and tenancy rules.
- Cross-account denials and public-field allowlists receive focused Worker tests.

All mutation failures use stable error codes. Authorization and database failures fail closed. Batch reads prevent per-row inventory, favorites, or Wisdom request waterfalls.

## Interface direction

The program inherits Teajia's established visual world.

- Inventory and management surfaces use the Operate register: precise density, typographic hierarchy, restrained dividers, and familiar controls.
- Public profiles, favorites, payments, and Wisdom use the Read register: editorial pacing, generous space, and clear provenance.
- Bronze is rare and reserved for current focus or the primary action.
- Semantic color tokens and `TYPOGRAPHY_CLASSES` are mandatory.
- Interactive elements meet the 44px tap-target floor.
- Mobile bottom-navigation clearance, modal z-index, Cancel/Back/Close placement, and no-horizontal-scroll rules remain binding.
- Public profile and favorites layouts avoid repeated generic card grids. Portrait, writing, and tea selections use varied editorial rhythm.
- Payment UI is calm and legible rather than styled like a banking dashboard.

## States and realistic ranges

### Inventory

- Zero to several hundred tea records
- Empty section, one-row section, and dense section
- No incoming receipts, partial receipt, incoming-only tea, and replenishment on an existing tea
- Tasted once, multiple personal sittings, product tasting profile only, and no tasting
- Description only, draft article, published article, and broken legacy relationship
- Loading, stale summary, recoverable API error, authorization failure, and scroll-constrained mobile table

### Profiles and favorites

- No linked contributor
- Draft profile, awaiting approval, published profile, and self-unpublished profile
- One or several associated stores
- No portrait, upload in progress, crop failure, and durable saved portrait
- Zero favorites, several favorites, hidden favorite, source listing removed, and all favorites currently private
- No authored writing and many authored articles

### Payments

- No methods
- Personal default only
- Store-specific methods with and without a personal default
- Instructions-only, external-link, and provider-QR methods
- Invalid amount/reference context
- Unpublished profile, inactive method, or unavailable store association

### Wisdom

- Node with complete relations
- Node with no writing
- Proposed relation
- Broken or unpublished target
- Ambiguous inferred product match
- Hidden node with admin-only findings
- Large relation result constrained and paginated where needed

## Migration and backfill strategy

All schema work is additive and numbered after the current Worker migration head.

The migration sequence is:

1. Global contributor associations and linked-user uniqueness
2. Public profile favorites
3. Payment methods
4. Wisdom overrides/relations and the missing idempotent article-product schema ledger entry

Each migration is rehearsed through the repository migration ledger from a clean database and the maintained legacy fixture. Existing contributor slugs, article author IDs, product IDs, and public routes remain valid.

Backfills are split by confidence:

- Deterministic identity and exact foreign-key mappings apply automatically and idempotently.
- Public or financial changes support preview/reporting before mutation when existing business data could change.
- Semantic tea/Wisdom/article matches become proposals or review findings.
- No private favorite, payment method, or profile publication state is inferred.

## Testing and verification

Implementation uses focused behavior tests while building, followed by one integrated verification pass.

### Domain and Worker coverage

- Inventory stage precedence and overlapping facets
- Incoming-only and replenishment behavior
- Personal tasting versus product-profile tasting semantics
- Batched writing summary and article status
- Global contributor with multiple accounts
- Self-edit versus publish/association authority
- Cross-account article authorship without cross-account draft leakage
- Favorite ordering, notes, canonical resolution, and private-item non-leakage
- Payment default/store resolution and public allowlist
- Payment query context validation without payment-state mutation
- Typed Wisdom node identity, legal relation validation, publication filtering, and derived findings
- Idempotent backfills and migration rehearsals
- Cross-account denial coverage for every new owned resource

### Frontend and browser coverage

- Inventory lifecycle section rendering, folding, filters, and counts
- Direct Record/Continue/View tasting journey from stock
- Separate product tasting profile action
- Inventory scroll regression on desktop and mobile
- Tea Master draft profile, portrait upload, approval, and public rendering
- Article byline to global profile across stores
- Favorite search, reorder, note, share, and private omission
- Payment QR to public chooser and external-method interaction
- Wisdom relation editing, findings queue, and public reverse links
- Empty, loading, error, unpublished, and unauthorized states
- No horizontal overflow at 390×844 and desktop widths

### Final integrated gate

- `npm run lint`
- `npm run lint:colors`
- `npm run build`
- Focused frontend/unit suites
- Complete Worker suite
- `npm run test:mobile` with the development server running
- Inventory desktop/mobile scroll suite
- Migration rehearsal through the newest migration
- Mechanical Impeccable detector over changed UI targets
- Manual smoke journeys for inventory, tasting, profile, favorites, payment, article attribution, Wisdom, and account switching

No completion claim is allowed without fresh evidence from the integrated gate.

## Integration-safe workstreams

The implementation plan should preserve these ownership boundaries:

1. **Shared domain and migrations** — one owner for contributor associations, favorites, payments, Wisdom relations, Worker contracts, and shared types.
2. **Inventory and tasting** — inventory domain/read models and stock entry interfaces; no contributor or Wisdom schema ownership.
3. **Profile and favorites interface** — self-management and public person/favorites surfaces against the shared contracts.
4. **Payment interface** — payment management, QR, and public chooser against the shared contracts.
5. **Wisdom interface** — relation editor, findings, and public reverse links against the shared contracts.
6. **Integration and verification** — shared-route reconciliation, migration rehearsal, full tests, visual verification, and documentation.

Shared contracts and migrations land before dependent interface work. Parallel agents may own non-overlapping interface lanes after those contracts are stable. `worker/src/index.ts`, `src/lib/api.ts`, `src/types.ts`, `src/App.tsx`, and migration numbering have a single integration owner to prevent merge-by-guesswork.

## Done definition

The program is complete when:

- Inventory shows the approved lifecycle sections and truthful tasting/writing facets.
- A Tea Master can directly record and continue a personal tasting from stock without confusing it with the product tasting profile.
- One global profile can represent a person across multiple stores and be self-managed under publication approval.
- Articles, tea selections, public favorites, and payment destinations render from that profile with correct privacy.
- The shareable favorites and payment routes work without exposing private teas or inactive methods.
- Wisdom relationships are structured, public-safe, and reviewable; deterministic technical gaps are repaired and editorial gaps are reported.
- Migrations, authorization, responsive behavior, inventory scrolling, and the integrated verification matrix pass.
- Existing interfaces outside the approved Profile navigation addition remain stable.

Actual payment credentials, real profile biographies/portraits, and editorial judgments about ambiguous Wisdom relationships remain human-provided content. Their absence does not justify fabricated data and does not prevent the underlying build from being complete.
