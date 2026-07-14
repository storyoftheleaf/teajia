# Curate Sourcing Second-Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose Curate Source as a continuous, compact mobile-first sourcing sheet while preserving every function and making desktop use its run rail and canvas width productively.

**Architecture:** Keep the existing React state and API flows intact. Change only capture composition, reusable Curate CSS, and desktop placement. Encode the mobile height, state, photo, action, and desktop-rail contracts in Playwright before changing production markup.

**Tech Stack:** React 19, TypeScript, Tailwind v3, Zustand, Framer Motion, Playwright, Vite.

---

### Task 1: Lock the second-pass UI contract

**Files:**
- Modify: `tests/curate-compact-canvas.spec.ts`
- Modify: `tests/compass-responsive.spec.ts`

- [ ] Add a mobile test asserting one visible `[data-curate-source]` uses `data-visual-layout="continuous-sheet"`, Tea/Buy/Taste share the same horizontal edges, the painted decision rail is at most 36px while its radio targets remain at least 44px, and the mobile canvas is no taller than 760px in the empty state.
- [ ] Add a mobile test asserting `data-testid="curate-primary-workflow"` contains the Tea name, gram slider, tasting launcher, Notes textbox, and action footer, and its bottom remains above the mobile bottom navigation after scrolling the workflow to its top.
- [ ] Add state assertions for a neutral disabled Done control, an enabled primary Done control, a non-color decision selected marker, a shortened Tea name placeholder, a current gram value cue, and an inline Intent empty state inside the notes band.
- [ ] Add a desktop test at 1280×900 asserting the sourcing rail exposes current-run entries through `data-testid="curate-run-rail"`, the active draft appears in that rail, and `data-testid="capture-action-footer"` is contained by the desktop canvas rather than the viewport-level column footer.
- [ ] Run the new tests against the existing UI and confirm failures specifically identify the missing continuous sheet, height, state, and desktop-rail contracts.

### Task 2: Build the continuous mobile sourcing sheet

**Files:**
- Modify: `src/components/TeaCompass/CaptureCard.tsx`
- Modify: `src/components/TeaCompass/DecisionControl.tsx`
- Modify: `src/components/TeaCompass/CaptureContextChips.tsx`
- Modify: `src/components/TeaCompass/PricingRow.tsx`
- Modify: `src/components/TeaCompass/GramSlider.tsx`
- Modify: `src/components/TeaCompass/CaptureActionFooter.tsx`
- Modify: `src/components/TeaCompass/IntentBar.tsx`
- Modify: `src/components/TeaCompass/PhotoCapture.tsx`
- Modify: `src/styles/card-utilities.css`
- Test: `tests/curate-compact-canvas.spec.ts`

- [ ] Add `data-visual-layout="continuous-sheet"` and `data-testid="curate-primary-workflow"` to the primary capture composition.
- [ ] Remove separate card gutters and repeated slab fills. Use one sheet surface, one optical edge, major dividers between Tea/Buy/Taste, and lighter internal rules.
- [ ] Recompose context into a provenance row and evidence row without removing Run, Vendor, Journey/Visit, Scan, Photo, Share, New Entry, or sync.
- [ ] Reduce the painted decision rail to 34–36px inside 44px radio targets and add a check/dot marker for selection.
- [ ] Shorten the name placeholder to `Tea name`, retain floating labels, and increase empty/value contrast while preserving Type/Year geometric parity.
- [ ] Recompose pricing as one measurement band. Preserve the gram slider, add an active track/current value cue without a new row, and keep form selection visible.
- [ ] Recompose Taste, Notes, voice capture, and Intent into a compact band. Keep detected intents actionable/dismissible and render the empty state inline.
- [ ] Update action hierarchy: Done neutral while disabled, bronze only when enabled, Buy as contextual secondary, Sample visually associated with Taste. Preserve existing callbacks and 44px targets.
- [ ] Add concise readiness feedback through `aria-describedby` and a transient/visually compact hint without reserving a new permanent row.
- [ ] Run focused tests until all Task 1 mobile assertions pass.

### Task 3: Make desktop use the workspace

**Files:**
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/styles/card-utilities.css`
- Test: `tests/curate-compact-canvas.spec.ts`
- Test: `tests/compass-capture.spec.ts`

- [ ] Replace the empty sourcing search/New Entry rail with `data-testid="curate-run-rail"`, using existing session entries and active-entry state. Show the active draft first, then other current-session drafts; retain search and New Entry.
- [ ] Keep the form canvas within its readable maximum width while using desktop width for balanced internal bands rather than stretched controls.
- [ ] Move the desktop `CaptureActionFooter` into the canvas-aligned sourcing region and remove the detached full-column bottom tray for sourcing.
- [ ] Preserve Library and Ledger desktop layouts and all existing mode transitions.
- [ ] Run the desktop contract plus existing Done, Buy disclosure, Sample, and entry-switching tests until green.

### Task 4: Browser critique and responsive fixes

**Files:**
- Modify as needed: files from Tasks 2–3 only
- Test: `tests/curate-compact-canvas.spec.ts`

- [ ] Capture the empty state at 390×844, 768×900, and 1280×900.
- [ ] At 390px, verify Tea, Buy, Taste launcher, Notes, and actions are reachable without bouncing between sections; confirm bottom navigation clearance and no horizontal overflow.
- [ ] Inspect default, selected decision, disabled/enabled Done, photo-empty/photo-filled, and detected-intent states.
- [ ] Apply one critique pass for optical edge alignment, divider strength, placeholder/value contrast, active bronze scarcity, and desktop rail balance.
- [ ] Re-capture all three widths and confirm no material defect remains.

### Task 5: Regression verification

**Files:**
- No production changes unless verification exposes a task-scoped regression.

- [ ] Run `npx playwright test tests/curate-compact-canvas.spec.ts tests/compass-capture.spec.ts tests/compass-responsive.spec.ts --project='Mobile Chrome' --workers=1 --reporter=list` against the correct worktree server.
- [ ] Run the relevant Compass Library, Samples, Import, and receipt suites against the same server.
- [ ] Run `npm run lint`.
- [ ] Run `npm run lint:colors`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`, review the final diff for unrelated changes, and commit the completed second pass without staging the temporary local preview configuration.
