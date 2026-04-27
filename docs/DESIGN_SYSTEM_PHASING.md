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

## Phase B — Token migration (2–3 days)

**Goal:** Every component speaks in safe tokens. Lint enforces it.

**Scope:**
1. Codemod the 49 files using banned legacy tokens (`tea-ink`, `tea-paper`, `tea-seal`, `tea-charcoal`, `tea-muted`, `tea-beige`) → safe equivalents (`tea-text`, `tea-bg`, `tea-gold`, etc.). ~215 uses total.
2. Replace ~328 hardcoded `rgba()` instances + ~65 hex-bracket instances with semantic tokens. Where no token exists for a color, add one to `designTokens.ts` rather than keep the literal.
3. Replace `text-white` / `bg-white` (~25 instances) with `text-tea-bg` / `bg-tea-text` per the existing rule in `/CLAUDE.md`.
4. Rationalize the triple gold (`#b8882d` / `#C9943A` / `#a07830`) into a single `tea-gold` palette ramp.
5. Collapse the three duplicate tea-type color maps (`themeUtils.ts`, `TeaDetailsModal.tsx`, `PersonalCollectionView.tsx`) into one shared import.
6. Promote `lint:colors` from "non-blocking notices" to "blocking errors" once the migration is complete. Wire into pre-commit hook.

**Done when:**
- `npm run lint:colors` exits 0 with no notices.
- `grep -r 'tea-ink\|tea-paper\|tea-seal\|tea-charcoal' src/` returns nothing.
- The pre-commit hook blocks any new violation.

**Risk:** Codemod may catch false positives in comments or fixture data. Run a dry-run first; review the diff before merging.

**Unblocks:** Phase C — once tokens are honest, you can confidently rename or restructure them without breaking anything visually.

---

## Phase C — Scale rationalization (2–3 days)

**Goal:** Every visual property has one scale. No more arbitrary values.

**Scope:**
1. **Typography:** delete the dead `--font-size-*` CSS custom properties. Standardize on `TYPOGRAPHY_CLASSES` from `designTokens.ts`; refactor the ~30 sites with arbitrary `text-[9px|10px|11px]` / mixed `font-light|font-normal` to use the tokens. Remove 5 of the 8 Google Fonts (keep Lora, Inter, Vollkorn). Add `font-display: swap` and `unicode-range` for CJK.
2. **Spacing:** delete non-grid increments in `card-utilities.css` (`0.625rem`, `0.875rem`). Standardize card padding to `p-4` / `p-6` per density.
3. **Border radius:** define a 4-stop scale (`sm` 2px, `md` 6px, `lg` 12px, `2xl` 16px). Migrate the ~12 inconsistent sites.
4. **Shadows:** define a 4-stop scale tied to elevation tokens. Replace inline `shadow-[...]` with classes.
5. **Transitions:** define a 3-stop duration scale (`fast` 150ms, `base` 250ms, `slow` 400ms). Migrate the ~10 inconsistent sites.
6. **Z-index:** define a named scale (`z-base` 0, `z-sticky` 10, `z-drawer` 30, `z-modal` 40, `z-toast` 50, `z-overlay` 60). Migrate the ~50 sites with arbitrary values. Resolve the `z-[9999]` collision between theme overlay and skip link.
7. **Backdrop blur:** standardize on a 2-stop scale (`sm`, `xl`). Remove `saturate-150` outliers or add it to the token if it's the intended look.

**Done when:**
- `grep -E 'text-\[[0-9]+px\]|rounded-\[[0-9]+px\]|z-\[[0-9]+\]'` returns near-zero hits in `src/`.
- A new contributor adding a heading uses `TYPOGRAPHY_CLASSES.h2`, not raw classes.

**Risk:** Visual drift on individual screens. Mitigate by walking the top 20 routes after each scale migration. Take screenshots before/after.

**Unblocks:** Phase D — once scales are tight, the touch-target + contrast fixes become trivial.

---

## Phase D — Mobile + accessibility token pass (1–2 days)

**Goal:** Touch targets, contrast, and focus rings all derive from tokens, so a single edit fixes everything.

**Scope:**
1. Add a `tap-target` token (44px) and refactor the 5–6 known violations: PageHeader Back, ChevronRight, cart stepper, Reader progress handle, footer admin link.
2. Enforce contrast pairings from `COLOR_RULES.md` Rule 6: replace `text-tea-ink/40` (2.8:1) and `text-tea-text/20` with the minimum `text-tea-text-sec`. Fix the inverted CategoryPills mapping.
3. Add a single `focus-visible:ring-2 ring-tea-gold/50` token. Apply via the existing `Button.tsx` primitive; refactor any place that bypasses Button to use it.
4. Resolve the asymmetric light/dark backdrop opacities (e.g. `bg-white/70` light vs `bg-[#1a1a1a]/80` dark) by using `tea-bg/80` consistently.

**Done when:**
- All touch targets pass the 44px floor (verifiable via Playwright a11y check).
- Color contrast passes WCAG AA at standard text sizes.
- All interactive elements have a focus ring on keyboard-tab navigation.

**Risk:** Low. These are fixes, not redesigns.

**Unblocks:** Nothing structural. This is the polish that makes the whole pass land.

---

## Phase E (optional) — Performance pass (half-day)

**Goal:** Strip the bloat that the audit flagged.

**Scope:**
1. Remove the three full-screen fixed texture overlays (`feTurbulence` + `mix-blend-mode: multiply`) or load them once at build time as a CSS background-image. Drop the `transparenttextures.com` external dependency.
2. Code-split framer-motion so it only loads on admin routes.
3. Verify the duplicate `@keyframes shimmer` is gone (was caught in Phase A).

**Done when:**
- Lighthouse main-thread blocking time drops measurably on `/`.
- Initial bundle size for non-admin routes drops by the framer-motion delta.

**Risk:** Low. Pure perf work.

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
