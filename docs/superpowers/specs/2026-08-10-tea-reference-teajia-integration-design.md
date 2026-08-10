# Tea Reference Teajia Integration Design

**Date:** 2026-08-10
**Status:** Approved for local implementation
**Scope:** Citation-aware receiving model and local-only preview inside Teajia Wisdom

## Outcome

Teajia will receive the deterministic Tea Reference `website-handoff.json` through a pure, preview-only importer and render the safe public projection inside the existing Wisdom experience. The detached preview site will be retired. The work will remain local, disabled in production, and will not write to a database, API, inventory, product catalogue, or the handoff package.

The integration must make it clear how reference knowledge relates to teas people can actually buy without turning source publishers into producers or blending general reference claims with exact-lot descriptions or Adrian's tasting.

## Public information architecture

The local preview changes only the Wisdom-specific taxonomy navigation:

- The visible `Regions` label becomes `Origins`.
- Existing `/wisdom/regions` and `/wisdom/region/:id` URLs remain valid and unchanged.
- A `Types` holding is added at `/wisdom/types`.
- Tea-family pages use `/wisdom/family/:id`.
- Tea-type pages use `/wisdom/type/:id`.

These additions are available only in Tea Reference preview mode. Normal development and production builds retain the present navigation and route exposure until Adrian separately authorizes publication.

The `Types` holding contains sellable tea identities rather than research labels. For this batch, Pu'er is a tea family and Sheng and Shou are child tea types. A family or type is publicly surfaced only when it matches an active Teajia product or is required as the parent of a matched type.

The `Origins` holding supports a real geographic tree:

1. major region;
2. tea area;
3. mountain;
4. village;
5. locality where needed.

Each place retains its declared level and an optional parent ID. A place is surfaced when it matches an active Teajia product or is a necessary ancestor of one. Missing parents are never guessed. Existing flat Wisdom regions remain available and keep their URLs; the new model expands the domain without coercing tea areas, mountains, or villages into the old flat type.

Taxonomy terms, article headings, route labels, publisher names, and research groupings do not become public entities merely because they occur in the handoff.

## Receiving domain model

The receiving model keeps the following records separate:

- `TeaFamily`: a broad sellable family such as Pu'er.
- `TeaType`: a sellable identity such as Sheng or Shou, with a parent family ID.
- `Place`: a hierarchical origin with a geographic level and optional parent place ID.
- `ReferenceSource`: publisher and page metadata. Publisher role is descriptive and never implies producer, factory, brand, retailer, or vendor identity.
- `ReferenceCitation`: a fact-to-source link plus a private evidence pointer.
- `ReferenceFact`: one cited claim with a subject, field, public wording, scope, and semantic register.
- `PrivateVerificationRecord`: held/conflicting candidate data, evidence pointers, source roles, and the exact reason it cannot enter the public projection.

Fact registers remain distinct:

- general cited reference;
- cited common characteristics;
- cited cultivar potential;
- exact-lot source description;
- Adrian's personal tasting.

Only the first three may appear as general reference content. Exact-lot descriptions remain attached to their source lot, and Adrian's tasting remains personal editorial content. Neither can populate a family, type, or origin's common-characteristics section.

## Preview data flow

The immutable handoff follows this path:

1. A local preview command reads `website-handoff.json` from an explicit absolute path.
2. The existing pure importer validates schema, manifest counts, deterministic hashes, IDs, references, and duplicate consistency.
3. It plans every source, citation, entity, and fact as `create`, `update`, `no-op`, `conflict`, or `held` against an optional existing receiving snapshot.
4. It returns the operation report, projected receiving state, private verification state, and a sanitized public projection in memory.
5. A Vite development-only adapter exposes only that public projection to the actual Teajia application.
6. Wisdom pages combine the safe reference projection with active catalogue matches to determine which families, types, origins, and `Available teas` links are visible.

The importer has no writer. It does not write snapshots, source files, approval state, API data, D1 rows, inventory, lots, or products. The local adapter exists only when Vite runs in the dedicated Tea Reference preview mode and receives a handoff path. Production has neither the adapter endpoint nor the preview navigation/routes.

The complete batch remains accounted for in the private operation report even when only a safe subset qualifies for display.

## Public rendering and privacy

The preview uses the current Teajia Wisdom frame, typography, colour tokens, responsive behavior, and bottom-navigation clearance. It is not a separate tool interface.

Family, type, and origin pages may show:

- ordinary cited reference prose;
- clearly separated common-characteristics and cultivar-potential sections;
- a breadcrumb and child-place links for known origin hierarchy;
- source publisher, title, author/date when present, and outbound URL;
- a minimal source excerpt when it adds necessary context;
- matching active teas under `Available teas`;
- a clear `Report an inaccuracy` contact action containing the page identity.

They must not show:

- held/conflict labels or review instructions;
- verification reasons, candidate payloads, evidence IDs, hashes, or internal status;
- full captured evidence or snapshots;
- unsupported translations or invented parent relationships;
- exact-lot source descriptions as general characteristics;
- Adrian's personal tasting as sourced consensus;
- a publisher presented as a producer, vendor, retailer, factory, or brand unless a separately verified entity record establishes that role.

The report action uses Teajia's existing contact handoff and creates no submission store or backend write.

## Error and conflict behavior

The receiver fails closed before projection when the schema is unsupported, manifest counts or hashes do not match, IDs are malformed, citations point to missing sources, claims point to missing resolutions, or duplicate IDs disagree.

Valid but unsafe candidates do not abort the batch. They receive explicit `held` or `conflict` operations and private verification records. Examples include an unresolved geographic parent, an unsupported website field, an ambiguous family/type mapping, a taxonomy heading masquerading as an entity, or an exact-lot claim aimed at a general reference field.

The public adapter performs a second allowlist projection. Any private field or unsupported register reaching that boundary is rejected rather than rendered. Endpoint/loading failures leave existing Wisdom content usable and show a quiet local-preview diagnostic without exposing private data.

Repeated import of identical input and identical existing state produces the same ordered output and no-op classifications. Ordering does not depend on filesystem enumeration, locale, or network responses.

## Components and module boundaries

- The pure receiving module owns validation, normalization, comparison, operation planning, and public/private projections.
- The local Vite adapter owns read-only handoff loading and serves only the sanitized projection.
- The Wisdom reference client owns loading/error state for the local adapter.
- Tea taxonomy helpers own family/type relationships and catalogue matching.
- Origin helpers own hierarchy traversal, breadcrumbs, descendants, and flat-region compatibility.
- Shared citation components own public fact sections, source metadata, minimal excerpts, and the inaccuracy action.
- Wisdom index/detail pages compose those helpers without reading handoff or verification data directly.

No component may import the raw handoff or private verification state.

## Current batch treatment

The completed 12-source package is consumed read-only from its existing output directory. Its full contents remain outside the browser bundle and Git-tracked public data.

Pu'er and Sheng are mapped to the explicit family/type model when catalogue matching qualifies them. Shou is represented in the model and appears only if it qualifies under the same product/parent rule. Geographic candidates retain their declared major-region or tea-area level. The batch contains no resolved mountain or village entity candidates, so those levels remain supported but empty rather than being invented from prose. Research taxonomy entries remain in the receiving report and do not receive public entity pages.

## Verification

Focused automated checks will cover:

- schema and integrity rejection;
- deterministic create/update/no-op/conflict/held planning;
- replay idempotency;
- publisher-role separation;
- family/type relationships;
- geographic level and parent preservation;
- product-connected public surfacing;
- fact-register separation;
- private-field and held-language exclusion;
- existing region URL compatibility;
- preview-only route and navigation gating;
- source metadata, minimal excerpt, and inaccuracy action rendering.

The implementation will also run TypeScript lint, the mandatory colour-token lint, a production build, focused unit/integration tests, and the required mobile browser suite for routing/navigation changes. The actual Teajia Wisdom preview will be inspected on desktop and mobile for readable hierarchy, working links, no horizontal overflow, and bottom-navigation clearance.

## Explicit exclusions

This phase does not perform production or live database writes, assimilation, mass import, product/lot/inventory creation, approval, autonomous capture, deployment, push, or publication. It does not change global Read/Learn/Consult/Shop navigation. It does not discard user-owned untracked files.
