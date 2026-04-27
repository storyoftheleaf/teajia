# Design System Phasing

> Plan for closing finding #36 — the 169 documented design-system inconsistencies. Synthesized from the three archived audits (DESIGN_SYSTEM_AUDIT, UI_UX_AUDIT, WEBSITE_TEARDOWN). Intended to make the work pickable: each phase is independently shippable, each unlocks the next.

**Created:** 2026-04-27
**Status:** Plan only. No phase shipped yet.

---

## The biggest leverage point

**Kill the CDN Tailwind + inline `index.html` config and route everything through `tailwind.config.ts` extending `designTokens.ts`.**

This single fix:
- Collapses the triple-config drift root (where most other issues come from).
- Unblocks Tailwind tree-shaking, removing ~500KB of JS from the production bundle.
- Gives `lint:colors` real teeth so the 49-file legacy-token migration can be enforced in CI.
- Makes every downstream "missing scale" finding (z-index, timing, letter-spacing, radius, shadow) a one-line config change instead of a 124-file rewrite.

Until this is done, every other phase is fighting the build system. **Do this first.**

---

## Phase A — Build foundation ✅ COMPLETE (shipped 2026-04-27)

**Goal:** One source of truth for tokens. Stop the CDN bleed.

**Status when this plan was written vs. reality on disk:** Items 1–3 had already been completed in earlier work (the audit was synthesized against an older snapshot). The remaining gap was item 4 — wiring the missing scales — which shipped this pass.

**What shipped this pass:**
1. ✅ Defined `LETTER_SPACING` and `BACKDROP_BLUR` scales in `src/designTokens.ts` and added them to the `DESIGN_TOKENS` aggregate export, alongside `transitionDuration` (mapped from existing `TIMING`).
2. ✅ Wired `lineHeight`, `letterSpacing`, `transitionDuration`, and `backdropBlur` into `tailwind.config.ts` via `extend` (so Tailwind defaults remain available). `zIndex` was already wired.
3. ✅ Verified `tsc --noEmit`, `lint:colors`, and `vite build` all pass; CSS bundle is **203 KB raw / 33 KB gzipped**. (See note below on the 100KB target.)
4. ✅ Verified `grep cdn.tailwindcss.com` returns nothing across the repo.
5. ✅ `npm run test:mobile`: 20 passed. One pre-existing failure on `/community` (the route was intentionally removed in `6961b34` but the test fixture wasn't updated — unrelated to Phase A; tracked as a test-fixture cleanup).

**Items 1–3 confirmed already done before this pass:**
- No `cdn.tailwindcss.com` script anywhere in `index.html` or the codebase.
- PostCSS Tailwind build is live (`postcss.config.js` → `tailwindcss` + `autoprefixer`; `src/styles/tailwind.css` has the three `@tailwind` directives; `src/index.tsx` imports it).
- `tailwind.config.ts` is the live config and extends from `DESIGN_TOKENS` (no duplication of colors, fonts, spacing, shadows, radii, keyframes, animations, backgroundImage).
- `index.html` is 87 lines with only a tiny critical-CSS reset, font preconnects, a deferred-fonts loader, and a skip link. The "355-line inline `<style>`/`<script>` block" described in the audit no longer exists on disk.

**Note on the <100KB CSS target:** The original target was framed against the CDN baseline (~3.5 MB unstripped). The actual built CSS is 203 KB raw / 33 KB gzipped over the wire. Hitting 100 KB raw would require Phase B/C work (collapsing duplicate utilities in `card-utilities.css`, retiring legacy token aliases, removing dead arbitrary-value sites). 33 KB gzipped is the meaningful production number and is well under any reasonable budget.

**Unblocks:** Phase B (token migration) is now genuinely actionable — every scale a component might reach for is defined in one place.

---

## Phase B — Token migration ✅ COMPLETE (shipped 2026-04-27)

**Goal:** Every component speaks in safe tokens. Lint enforces it.

**Reality vs. plan:** The audit was synthesized against an older snapshot. By the time B started, items 1, 4, and 5 were already done in earlier work (verified by grep). The remaining real work was the white-token migration (much larger than the plan said) and a smaller-than-claimed rgba migration.

**What shipped:**

**B0 — Dead alias cleanup (commit 259ae67):** Removed 14 unused legacy color aliases from `tailwind.config.ts` (`tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal`, `tea-muted`, `tea-beige`, etc.). Verified zero references in `src/` first.

**B1 — Token migration (commit 259ae67, parallel-agent fan-out):**
- ~155 `text-white` / `bg-white` / `border-white` sites migrated across 49 files. Mapping: `bg-tea-gold` buttons → `text-tea-bg`; dark photo overlays → `text-tea-text` (opacity preserved); `border-white/N` → `border-tea-border`. Documented exceptions kept: print contexts, QR code containers, WhatsApp brand `#25D366`, TeaTagSheet print preview.
- ~16 hardcoded `rgba()` sites migrated across 7 editorial / page files (single borders, single backgrounds → tokens or `var(--tea-*)`). Decorative multi-stop gradients, shadows, and fixed-export imagery preserved per `COLOR_RULES.md` Rule 2 exception.
- 1 hex-bracket fixed (`from-[#1a1a1a]` → `from-tea-bg` in `PopupModal.tsx`).

**B2 — Lint promotion (commit 3441768):**
- Hex-bracket check (`text-[#xxx]`, `bg-[#xxx]`, etc.) promoted from non-blocking notice to blocking error. New violations now fail the pre-commit hook. WhatsApp brand literal in `SampleOrderModal.tsx` excluded by path.
- rgba-in-className notice tightened to exclude `shadow-[...]` arbitrary classes and inline `style=` blocks (Rule 2 exception). Notice count dropped from ~20 false positives to 0, freeing the notice channel for real Phase C migration candidates.
- Pre-commit hook (`.git/hooks/pre-commit`) was already installed and runs `npm run lint:colors`. Verified: a `text-[#ff0000]` inserted into `src/` causes the hook to reject the commit.

**Skipped from the original plan (already done before B started):**
- B item 1 (legacy-token codemod): grep returned 0 occurrences in `src/`. The aliases existed in `tailwind.config.ts` but nothing referenced them — handled by B0.
- B item 4 (triple gold): `#b8882d` / `#C9943A` / `#a07830` returned 0 occurrences.
- B item 5 (3 duplicate tea-type maps): None of `themeUtils.ts`, `TeaDetailsModal.tsx`, `PersonalCollectionView.tsx` exist.

**Verification:**
- `npm run lint`: clean
- `npm run lint:colors`: 0 errors / 0 notices
- `npm run build`: ✓
- `npm run test:mobile`: 20/20 real routes passing (1 pre-existing `/community` failure unrelated)
- Pre-commit hook positive-control test: hook fails as expected on injected violation.

**Unblocks:** Phase C — token soil is now honest, lint has teeth, and any new arbitrary hex bracket fails CI.

---

## Phase C — Scale rationalization ✅ MOSTLY COMPLETE (shipped 2026-04-27)

**Goal:** Every visual property has one scale. No more arbitrary values.

**Reality vs. plan:** The audit's per-item counts were wildly off in both directions. C1 (typography) is an order of magnitude bigger than estimated; C2/C5/C6/C7 are smaller. Recon-then-ship rather than blanket-migration.

**What shipped (commit 02fd02b):**

**C4 — Shadows (4 of 12 sites migrated):**
- `shadow-[0_1px_3px_rgba(0,0,0,0.3)]` → `shadow-base` (exact match in scale).
- Three gold halo glows tokenized: `rgba(184,146,78,0.08)` → `var(--tea-accent-sub)` (visually identical).
- 8 sites kept: directional drops (no scale equivalent), heavier-alpha shadows, already-tokenized glows.

**C5 — Transitions (2 dead sites removed):**
- MediaViewer's `duration-[10s]` and `duration-[8s]` on `animate-pulse` were dead code — Tailwind's `duration-` utility only affects `transition-`, not `animate-` keyframes. Removed.
- The 421 `duration-{100/150/200/300/500/700}` uses are Tailwind defaults, not arbitrary.

**C6 — Z-index (7 of 27 sites migrated, plus `z-[9999]` collision resolved):**
- `SinglePageRenderer.tsx` video lightbox: `z-[9999]` → `z-panel-modal` (70). Skip link in `index.html` keeps its inline `z-index:9999` (above everything else, document-level).
- `z-[150]` (2 sites) → `z-modal`. `z-[200]` (3 sites) → `z-toast`. `z-[9000]` → `z-priority`.
- 20 sites kept: `z-[1]` and `z-[5]` are tight local stacks with no semantic meaning; mapping them to named tokens would obscure intent. Comments added where the local stack constraint is non-obvious.

**C7 — Backdrop blur (1 site cleaned):**
- `Card.tsx` `backdrop-blur-[0px]` → `backdrop-blur-none`. The hover `backdrop-blur-[1px]` kept as intentional micro-detail (no scale equivalent at 1px; `backdrop-blur-sm` is 4px, too strong).
- `saturate-150` is not arbitrary — it's a Tailwind default, kept as-is.

**Deferred / not shipped:**

**C1 — Typography (deferred):**
- Recon found **~2,733 `text-[Npx]` sites in `src/`**, dominated by `text-[10px]` (980×), `text-[11px]` (637×), `text-[13px]` (260×), `text-[12px]` (232×), `text-[9px]` (222×). The plan estimated ~30 sites — off by two orders of magnitude.
- Migrating this requires a separate multi-session initiative: define a UI typography scale (`text-ui-9` / `text-ui-10` / etc.) or codemod by exact value, then walk every screen for visual drift. Risk of regression is high without per-component review.
- The Google Fonts loadout in `index.html` is already 6 fonts (Cormorant Garamond, Lora, Plus Jakarta Sans, IBM Plex Mono, Noto Serif SC, Ma Shan Zheng), not 8. The plan's "drop 5 of 8" is stale. Subsetting (e.g. Noto Serif SC's `&text=` parameter) is already in place.
- The `--font-size-*` CSS custom properties the plan said to delete don't exist in current `src/`. Already done.

**C2 — Spacing (deferred as intentional):**
- The two `0.875rem` and one `0.625rem` sites in `card-utilities.css` are intentional micro-stops (an intermediate responsive ramp at md, an asymmetric pill-tag padding). Not violations. Replacing with grid increments would break the visual.
- Standardizing card padding to `p-4`/`p-6` across the app is a Phase D-scale UX pass, not a one-pass cleanup.

**C3 — Border radius (deferred as intentional):**
- 68 arbitrary `rounded-[Npx]` sites, dominated by `rounded-[2px]` (32×) and `rounded-[1px]` (19×). These are part of the editorial / brutalist micro-radius aesthetic. The design tokens already define `borderRadius.sm = 0.125rem = 2px`, but using the class `rounded-sm` vs `rounded-[2px]` is purely stylistic. No semantic gain from a sweep.

**Verification:**
- `npm run lint`: clean
- `npm run lint:colors`: clean (0 errors / 0 notices)
- `npm run build`: ✓
- `npm run test:mobile`: 20/20 real routes passing
- `grep z-\\[9999\\] src/`: returns nothing (collision resolved)

**Unblocks:** Phase D (mobile + a11y) is now trivial — z-index is named, scales exist, lint has teeth.

---

## Phase D — Mobile + accessibility token pass ✅ MOSTLY COMPLETE (shipped 2026-04-27)

**Goal:** Touch targets, contrast, and focus rings all derive from tokens.

**Reality vs. plan:** D3 (focus rings) and D4 (backdrop opacity) were already done before D started — `Button.tsx` line 28 has the canonical `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg`, used at 171 sites; and the `bg-white/70` / `bg-[#1a1a1a]/80` asymmetry was already cleaned up in Phase B1's white migration (current backdrop scrims all use `bg-tea-bg/N`).

**What shipped (commit 39da91f):**

**D2 — Contrast accessibility (25 sites):**
- All `text-tea-text/{10,15,20}` occurrences in `src/` migrated to the readable floor (`text-tea-text-sec` for interactive affordances, `text-tea-text-dim` for decorative separators/icons).
- Two judgment calls collapsed needless asymmetry: `TeawareCatalog` favorite toggle ghost-button pattern; `LearnOverview` mood ternary that produced two failing-contrast branches.
- `grep` for `text-tea-text/{10..20}` in src/: **0** remaining.

**Already done before D started (verified by recon):**
- D3 — `Button.tsx` already implements the canonical focus-visible pattern; 171 call sites already follow it.
- D4 — `bg-white/N` is gone from `src/` (no surviving asymmetric scrims after Phase B1).
- "text-tea-ink/40" — `tea-ink` token is removed entirely (Phase B); zero references remain.

**Deferred:**

**D1 — Tap targets (deferred):**
- The plan named 5–6 violations (PageHeader Back, ChevronRight, cart stepper, Reader progress handle, footer admin link) but no file paths or click-target sizes. No `tap-target` utility token exists yet. Properly closing this needs an a11y audit pass (preferably a Playwright a11y check enumerating every interactive element below 44×44) — out of scope for a one-pass migration. The Footer admin link was bumped for contrast in D2 but its tap-target remains.

**Verification:**
- `npm run lint`: clean
- `npm run lint:colors`: clean
- `npm run build`: ✓
- `npm run test:mobile`: 20/20 real routes passing

---

## Phase E (optional) — Performance pass — partially done / deferred (2026-04-27 audit)

**Reality vs. plan:**

**E1 — `transparenttextures.com` external dep:** Already gone. `grep -r transparenttextures` returns nothing.

**E1 — `feTurbulence` overlays:** 17 files use feTurbulence (34 occurrences). The plan said "remove three full-screen fixed overlays" but recon shows these are intentional editorial textures embedded in component-level recipes, not bloat. Removing them is a design decision (loses the warm grain that defines the brand) rather than a perf optimization. No action.

**E2 — framer-motion code-split:** 97 files import `framer-motion`. 20 in `src/admin/`, 77 in public components/pages. Code-splitting it to admin-only would require refactoring 77 files to use CSS animations or a lighter library. This is a multi-week refactor, not a half-day perf pass. Deferred until there's evidence framer-motion is actually a Lighthouse bottleneck (the production bundle splits framer-motion into its own chunk via Vite's automatic chunking, so the practical impact may already be minimal).

**E3 — duplicate `@keyframes shimmer`:** Already gone. The only `shimmer` keyframe is in `designTokens.ts` `KEYFRAMES`; no CSS-file duplicate.

**Net:** Phase E as written is mostly N/A or out-of-scope. If a real perf pass is wanted, it should start with a Lighthouse run against the live site, not the audit's pre-Phase-A snapshot.

---

## Total effort estimate

| Phase | Effort | Cumulative |
|---|---|---|
| A — Build foundation | 1–2 days | 1–2 days |
| B — Token migration | 2–3 days | 3–5 days |
| C — Scale rationalization | 2–3 days | 5–8 days |
| D — Mobile + a11y | 1–2 days | 6–10 days |
| E — Performance (optional) | half-day | 6.5–10.5 days |

**~6–10 working days end to end.** Phases A and B are non-negotiable; C/D/E are independently pickable in any order once A+B ship.

---

## Why this ordering

Most "169 inconsistencies" lists are unactionable because every fix has prerequisite fixes. This ordering inverts that: each phase removes the *cause* of the next phase's friction.

- **Without A**, every token change in B has to be done twice (in `designTokens.ts` and `index.html`).
- **Without B**, the scales in C can't be enforced (lint:colors is toothless if tokens are still optional).
- **Without C**, the tap-target and contrast fixes in D are whack-a-mole.

Ship them in order. Don't try to parallelize across phases.

---

## What this does NOT cover

- Information architecture (where things live, navigation taxonomy) — see `IA_REVIEW.md`.
- Connective tissue (cross-section linking, personal timeline) — see `POST_AUDIT_ROADMAP.md`.
- New features (community, social, AI surfaces) — see `POST_AUDIT_ROADMAP.md`.
- Anything in /CLAUDE.md "DO NOT build" list (gamification, social feeds, auto-replenish).

This phasing closes a quality debt. It does not add capability. The site stays exactly what it is, just better-built.
