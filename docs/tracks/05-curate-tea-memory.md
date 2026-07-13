# Track 5: Product & Curate Integrity

> Keep sourcing capture, member tea memory, and first-operator product loops coherent without inventing new social or algorithmic systems.

Status: the starred-note curation loop is shipped; the active queue contains only confirmed integrity and usability gaps. Human validation lives in [Launch Validation](../LAUNCH_VALIDATION.md).

## Active queue

- [ ] **Fix shared-tea acceptance destination and model.** `handleCompassAcceptShare` writes accepted shares to `tea_compass_entries`, then sends the recipient to `/account/journal`, whose source of truth is the tasting journal. Choose the intended member outcome, write to the matching model, and route the recipient to the surface where the accepted tea actually appears.

- [ ] **Add Compass capability gates.** The six Compass entry handlers use `requireAccount` without the `catalog` capability boundary. Align read/write authorization with the intended operator roles and hide the Compass admin entry when the active account lacks access.

- [ ] **Partition Compass persistence by account and user.** `teaCompassStore.ts` persists under the fixed `teajia-compass` key. Key or reset/reload local state when the authenticated user or active account changes so unsynced captures cannot appear across account boundaries on a shared device.

- [ ] **Consolidate Curate currency maps.** Replace the repeated currency symbol, label, and reverse-map literals across TeaCompass and Sources with one typed shared source, preserving each current display and parse behavior.

- [ ] **Render first-door readiness.** `isFirstDoorCandidate`, `firstDoorReadiness`, `FIRST_DOOR_WORKFLOW`, and `OPERATOR_SUPPORT_LINKS` are computed but not rendered. Add the readiness card to the owner/tea-master Your Table experience with progress, the next incomplete step, and existing support links.

- [ ] **Resolve the orphaned brewing QR system.** `BrewingQRCard` points at six nonexistent `/craft/brew/:type` destinations and has no live importer. Either build the six guides and wire the card into a real product/sample/table-card surface, or delete the dead component and route concept. Do not leave generated QR codes pointing at missing pages.

- [ ] **Correct journal labels and empty-state links.** Change the ambiguous “Type” sort language to “By tea” while retaining the current understandable sort interaction, and add the specified quiet “Browse teas” link to `/shop` in both journal empty states.

## Design decision outside the active queue

Folding `tea_compass_entries` into `products` is a major data-model decision, not an assumed cleanup task. Write and approve a focused design first if real maintenance or user evidence shows that the current promotion bridge cannot remain reliable.

## Validation

Real-user and operator checks are tracked in [Launch Validation](../LAUNCH_VALIDATION.md).
