# Tea Reference website receiving layer

This phase receives the deterministic `website-handoff.json` produced by the Tea Reference capture tool. It is deliberately preview-only. It has no database, API, inventory, product, approval, assimilation, or publication writer.

## Model boundary

The receiving model keeps five concerns separate:

1. Sources contain publisher and page metadata. A publisher is never inferred to be a producer, factory, brand, retailer, or vendor entity.
2. Citations point from one fact to one private evidence record. Full evidence text and research snapshots stay outside the public projection.
3. Entities retain their stated kind. Pu'er major regions, tea areas, mountains, villages, and localities are distinct geographic levels with an optional parent entity.
4. Facts retain their field, claim scope, citation, and semantic register. General reference facts, common characteristics, cultivar potential, exact-lot source descriptions, and Adrian's personal tasting do not share a register.
5. Verification records are private. They contain the candidate value, evidence pointers, source roles, and the reason a fact or entity remains held.

The current handoff does not include verified parent identifiers for its geographic candidates. The present public Wisdom region type is also flat and has no fact-level citations. The receiver therefore holds those candidates and reports the exact hierarchy gap. It does not flatten a tea area into a generic region or write cited prose into the existing uncited description field.

## Deterministic preview

Run the receiving report against a handoff:

```bash
npm run tea-reference:website:preview -- --handoff /absolute/path/to/website-handoff.json --no-open
```

Compare with an existing receiving snapshot by adding `--existing /absolute/path/to/snapshot.json`. The report classifies every source, citation, entity, and fact as `create`, `update`, `no-op`, `conflict`, or `held`. The importer is a pure in-memory projection and does not write a snapshot.

Run the integrated local website preview:

```bash
npm run tea-reference:teajia:preview -- --handoff /absolute/path/to/website-handoff.json
```

This opens the real Teajia application on `http://localhost:7777`. In this local mode only, the Wisdom Base adds Types and calls the region holding Origins. These are preview-only routes and labels; the normal production build keeps them disabled.

The terminal operation report is private operator material. It includes create/update/no-op/conflict/held planning and verification reasons and must not be copied into the browser. The browser receives only the allowlisted public transport: public wording, limited excerpts where available, citation and source metadata, and the public correction action. Chinese excerpts are omitted rather than translated implicitly. The preview reads the handoff and public product response in memory; it has no database, API, filesystem, product, inventory, approval, assimilation, or publication writer.

Types and origins surface only when they connect to eligible products in Teajia's public catalogue. Active teas appear as Available teas and sold-out catalogue history appears as Previously offered. A cited place keeps its declared major-region, tea-area, mountain, village, or locality level. When the handoff does not verify a parent chain, the missing hierarchy remains held in the private operation report rather than being flattened or invented in the public page.

The dedicated browser check uses the same integrated server without tracking or copying the private handoff:

```bash
TEA_REFERENCE_HANDOFF_PATH=/absolute/path/to/website-handoff.json npm run test:tea-reference-browser
```

The command fails immediately when `TEA_REFERENCE_HANDOFF_PATH` is absent. It is intentionally not part of the default receiving or CI suite because the external private fixture is not stored in this repository.

## Current 12-source rehearsal

The completed Chinese industry run contains 12 sources, 12 entity candidates, 181 atomic claims, and 181 citations. All 181 claims remain held in the source package. Against an empty receiving snapshot, the report plans 12 source creates, 181 citation creates, 12 held entities, and 181 held facts. Replaying the projected source and citation state produces 193 no-ops and the same 193 explicit holds.

The local public projection contains one tea family, one tea style, three reference terms, three major regions, and four tea areas. The package has no mountain or village entity candidates yet, so those geographic levels correctly remain empty rather than being invented from prose.
