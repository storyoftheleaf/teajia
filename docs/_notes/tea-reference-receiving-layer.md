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

Run the standalone local website preview:

```bash
npm run tea-reference:website:serve -- --handoff /absolute/path/to/website-handoff.json --no-open
```

The server exposes only the public projection in memory. The screen uses ordinary cited reference language, limits excerpts, omits Chinese excerpts rather than translating them implicitly, and includes a visible Report an inaccuracy action. It does not add or change an application route or navigation item.

## Current 12-source rehearsal

The completed Chinese industry run contains 12 sources, 12 entity candidates, 181 atomic claims, and 181 citations. All 181 claims remain held in the source package. Against an empty receiving snapshot, the report plans 12 source creates, 181 citation creates, 12 held entities, and 181 held facts. Replaying the projected source and citation state produces 193 no-ops and the same 193 explicit holds.

The local public projection contains one tea family, one tea style, three reference terms, three major regions, and four tea areas. The package has no mountain or village entity candidates yet, so those geographic levels correctly remain empty rather than being invented from prose.
