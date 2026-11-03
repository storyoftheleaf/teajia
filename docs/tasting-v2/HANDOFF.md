# Tasting v2 — resume here

Updated 22 October 2026. Owner: Adrian. Status: **standalone, published preview; intentionally unintegrated**.

## The boundary that must survive this handoff

Adrian explicitly said to keep version two separate until it is ready. Do not connect it to the current tasting flow, site navigation, accounts, journal, shop records or backend without a new explicit instruction. Do not interpret publication as approval for integration. No schema changes, automatic data transfers or replacement of existing tasting are authorized.

Live preview: https://teajia.com/tasting-v2/
Verified release: `32699c3057a8a1af38cfa197d454006030b2c127`.
Cloudflare Pages project: `teajiafinal`; deployment: `ce2b2d3d-5d78-4cd3-a3d6-7aaca6e2803d`.
Production HTML matched both the pinned deployment and checked-in release, SHA-256 `d8228be267de97a2ed4fb5ff65c3ea27eba178fb0544543ae0c7e51396f2a4e8`.

This is the verified historical release, not a claim about whatever may be live when this document is read later.

## What we are trying to achieve

A fast, phone-first way to record why a particular tea is good, ordinary or disappointing, useful for sourcing, comparison and study. Flavor is important, but not the only or necessarily the strongest reason to value a tea. Someone may prize its energy, texture or returning sweetness while its flavor is ordinary. Aroma can be excellent while storage character detracts.

The user wants less time looking at a phone, not an exhaustive mandatory questionnaire. A short record must be useful; more precise language should be available when wanted. This is not a completion game or a scientific scoring instrument. Brewing choices explain the session, not intrinsic tea quality.

## What is finished

- A standalone working preview published at `/tasting-v2/`; editable sources, generated output, content sources and verification are in the repository.
- Overall assessment: Exceptional / Good / Average / Disappointing, with concise visible captions.
- Four areas: Flavor & aroma, Body & texture, Energy, Storage.
- Strength and Weakness can coexist. Ordinary is excluded from guided exploration; unmarked remains available without displaying a right-hand Undecided label. Filters preserve recorded choices.
- Independent Aroma and Flavor wheel views using shared vocabulary. Independent note details. Copy aroma notes to flavor adds missing names, does not overwrite existing flavor notes and does not copy intensity/timing/comments. Edits/removals remain independent.
- Basic tastes, expression, returning sweetness and aftertaste sit on the Flavor side.
- Compact, variable-width observation rows; longer labels receive more space. Brown/espresso selected styling, descriptions, direct deselection and attached intensity editing retained.
- Absence answers have no intensity editor. Feel observation location/persistence and general drying/coating location are available.
- Energy onset, development and duration are distinct, with Still feeling it separate.
- Separate Study workspace holds optional endurance, whole-tea development, coherence and session context. Note and Edit tea remain available. One Save action.
- Browser-local saving, including notes and study answers. Explicit local-only status. Voice note is visibly a non-recording preview control.
- 11 flavor families, 14 style starting sets, attributed reference profiles and original vocabulary preserved.

## Why the decisions were necessary — and what can change

| Need / problem observed | Current response | What matters if redesigned |
|---|---|---|
| Nine required judgments or a long wizard meant too much phone time | Quick overall/section assessment, then freely switchable exploration | Preserve a useful fast path; do not require every section or a fixed order |
| A tea can have strengths and flaws in the same area | Strength + Weakness together | Do not force mixed evidence into a misleading single judgment |
| “Disappointed” or “not for me” confused personal preference, ordinary quality and a flaw | Quality judgment separate from named observations | Strong intensity is not high quality; an ordinary feature need not be a failure |
| Untouched/neutral/undecided added decisions without helping | Unmarked defaults to undecided for navigation; no dedicated control or right-side label | Keep absence of a recorded answer distinct from an explicit Ordinary or Not noticed |
| All positive and negative descriptors together caused decision fatigue | Assessment filters editorial positives/drawbacks; context-dependent terms stay available under either | Filtering is relevance, not automatic appraisal. Never delete hidden answers |
| Flavor and aroma often differ, but sometimes match | Two independent wheel views with shared vocabulary and explicit copy | Keep the experiences independent and comparable. Two stacked wheels, another navigation pattern or another visualization may be better; shared vocabulary does not require shared selections |
| Re-entering identical aromas in the sip was wasteful | Copy missing note names only | Copy must be explicit and non-destructive; no ongoing linkage or silent overwriting |
| “Feel” sounded like energy/mood | Body & texture, with mouth/throat sensations explained | This title is a working proposal, not sacred. Preserve body, friction/slickness, coating, drying, salivation and throat comfort as distinct ideas |
| Number-only intensity lacked meaning; big popups felt detached; inline expansion moved buttons | Slight / Moderate / Strong in an attached overlay, visible chosen level, direct name deselection | Keep understandable amounts, easy removal and stable geometry. Exact overlay presentation may change if it improves clarity and touch usability |
| Repeated observations and “Your observations” controls forced scrolling just to edit intensity | Editing attached to the observation itself | Keep the user's attention near the item they tapped |
| Rigid grids looked clumpy or wasted space; oversized tiles made the page long | Measured rows fitting more short terms and fewer long terms | Keep all labels readable, descriptions available and touch targets usable; row counts and dimensions are negotiable |
| Yellow/gold, jade and bright white selection fills felt wrong for this site | Espresso/parchment with darker brown selection | Keep visual coherence and obvious selection; exact colors and treatment are not final aesthetic doctrine |
| Repeated Save/status and large navigation consumed space | One Save, compact navigation | Navigation can change; do not create duplicate commitments or lose unfinished data |
| Accordions hid choices and interrupted exploration | Visible groups, no collapsible option sections | User explicitly rejected accordion organization; do not reintroduce it as a shortcut to compactness |
| Timing mixed when something starts, how it develops and how long it remains | Separate optional energy questions | Keep those meanings distinct; do not guess eventual duration from Still feeling it |
| More study detail risked making every tasting long | Separate optional Study workspace | Study's current placement is provisional. Whole-tea endurance/coherence must not be mislabeled as Energy or flavor harmony |
| Vocabulary simplification risked erasing actual distinctions | Standard terms with definitions; preserve personal wording | Oily is not Coating, Light is not Watery, returning sweetness is not sweetness merely remaining; never silently translate existing records |
| Shop presets could bias or fabricate observations | Style suggestions navigate, never preselect; sourced profiles labeled separately | Preserve provenance and the distinction between expected/reference character and what was actually experienced |

## What still needs work

### Product and design validation

- Adrian has not approved the entire experience as final. Test with real tasting/sourcing examples and unfamiliar users; comprehension and speed are not validated.
- Continue improving phone density and hierarchy without removing descriptions, shrinking useful touch targets or hiding options. Test outdoors/readability and actual device Safari as well as Chromium.
- Wheel palette remains provisional. Natural Pigments, Chinese Ceramics and Antique Textiles were explored; no final winner was chosen. Keep source palettes available rather than treating the current family colors as final.
- Body & texture naming, Study placement, wheel navigation and detail editing remain open design choices. Preserve the reasons above, not every current screen arrangement.
- Validate whether an optional separate aroma/flavor appraisal is needed. It was discussed, but has not been implemented or approved as a required step. The quick section assessment currently covers both.
- Review the novice cost of distinctions and copy. A definition in a document alone is not a usable explanation; inspect actual access to meanings on a touch device.

### Preview limitations / engineering debt

- Local storage only. No account sync, server journal, real shop/product binding, auth integration or production data model. Da Hong Pao is editable sample context, not an actual linked shop record.
- Clearing browser data, changing devices or using another origin/file URL can lose access to local drafts. Prototype copies are not automatically synchronized. Repo files preserve code/content, not a user's browser entries.
- Voice recording is not implemented.
- State is still a prototype model with accumulated CSS and inline generation. Do not assume it is a production-ready React implementation.
- Shared sensory objects preserve separate aroma/flavor detail fields and storage association, but require explicit migration tests before any real data integration. Legacy unspecified notes remain in the original Flavor record; no aroma claim is invented. Original mockup widget records are not automatically imported into the published page.
- Wheel family positions are remembered within a running session, not guaranteed across a full reload.
- No export/recovery workflow or cross-device journal exists. This needs a decision before relying on v2 for valuable long-term records.
- Header labels/fonts/styles in the published preview can differ from the conversational wrapper. Validate the target that will actually be used.

### Only after explicit integration approval

Choose product/account binding, durable storage and migration semantics; decide how to preserve old notes and personal terms; add real recording if wanted; integrate with existing authorization/sync and site tokens; provide a reversible rollout. None of that work is authorized merely by this handoff.

## Files and authoritative sources

- `public/tasting-v2/index.html`: generated published preview.
- `prototypes/tasting-v2/work/app.js`: current behavior/state.
- `prototypes/tasting-v2/work/integration.css`, `shell.css`: styling.
- `prototypes/tasting-v2/work/wheel-component.js`, `.css`: wheel implementation.
- `prototypes/tasting-v2/work/vocabulary.json`: compiled selection definitions/visibility.
- `prototypes/tasting-v2/work/build.py`: regenerates the published page. Run `python3 prototypes/tasting-v2/work/build.py` from the repo.
- `prototypes/tasting-v2/verify.cjs`: focused browser checks. See VERIFICATION.md for serving instructions.
- `docs/tasting-v2/TEA-TASTING-CONSOLIDATED.md`: primary content reference, including separate-wheel amendment. Current explicit user decisions override older appendix guidance.
- `docs/tasting-v2/sources/`: original vocabulary, wheel vocabulary, style starting sets, reference profiles, interaction rationale, design findings and manifest. Do not overwrite historical snapshots when revising current guidance.
- `docs/tasting-v2/INTEGRATION-REVIEW.md`: historical gap review; many listed gaps were addressed in the current release. Do not treat it as an unqualified current backlog.
- `docs/tasting-v2/VERIFICATION.md`: release testing scope.

Original chat artifacts remain at `/Users/adrianrasmussen/.codex/visualizations/2026/10/21/01a15e1e-b940-7c80-84bf-62aad86f2c8c/`, including `combined/`, `tea-tasting-combined-preview.html`, older mockups and `tasting-reference/`. The published source is the repository copy; choose one working copy deliberately before changing anything and regenerate other previews to prevent drift.

## Verification already completed

Release typecheck, color lint and production build passed. Live HTML matched the exact release and deployment bytes. Focused live checks used touch-enabled Chromium phone emulation at 320/390px and a wider 900px layout: actual wheel taps, independent notes and intensity, copy merge, separate removal, four-section navigation, Both/absence behavior, intensity clearing, stable tiles, Feel precision, notes/study save and reload, no horizontal overflow or browser script errors. Screenshots were inspected. This is not a claim of physical iPhone/Safari testing or complete accessibility coverage; the full repository CI suite was still running when the live verification was reported.

## How to resume without losing work

1. Read this handoff and the consolidated content reference; inspect current Git status and the live preview. Keep other chats' uncommitted work out of this task.
2. State which problem the next change solves. Use the rationale table to challenge a design choice without losing its underlying requirement.
3. Work from repository sources, not only generated HTML; preserve existing draft state and historical content. Add focused regression coverage for any changed state semantics.
4. Check the actual phone layout with both empty and selected states, long labels and mixed assessments. Verify touch removal, detail editing, tab switching and save/reload.
5. Update this handoff/content reference when decisions change. Do not connect v2 to the existing product or publish further releases without the appropriate explicit instruction.
