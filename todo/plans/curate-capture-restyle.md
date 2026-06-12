# Curate capture screen restyle — bring the Source capture surface into the Teajia editorial language

Status: plan approved-pending-Adrian-pushback. Structure of the screen is INTENTIONAL and locked (vendor → photo → identity → pricing → notes → marks → done). This plan changes skin only, never layout order, field set, or flow.

Canonical reference: `docs/DESIGN_SYSTEM.md` (read §1, §2, §3, §6, §7, §12, §13, §22 before any stage). The screen today is fully tokened (the impeccable detector returns zero findings) but composed like a generic dark-mode SaaS form: bordered boxes nested four deep, no editorial typography, banned pill tabs, a neutral Done.

## Files

All in `src/components/TeaCompass/`:
- `index.tsx` — page shell, top bar (back / Source switcher / Tea·Teaware·Samples tabs / mic), batch strip
- `CaptureCard.tsx` — the form card, fieldClass definitions (~line 707), EntryMark component (~line 162), NOTES divider (~line 1834), Done/share footer (~line 2040)
- `PricingRow.tsx` — price/grams/form row + gram presets
- `VendorStrip.tsx` — vendor select row
- `PhotoCapture.tsx` — photo strip + sparkle/camera buttons
- `StatusActions.tsx`, `DetailsRow.tsx`, `FormRow.tsx`, `TypeGrid.tsx` — secondary, sweep in stage 7

Verification after EVERY stage: `npm run lint:colors`, then Playwright screenshot of `/admin` Curate → Source → Tea at 390×844 (dev server on port 7777, `dangerouslyDisableSandbox: true` for Playwright per memory). Compare against the stage's acceptance line. `npm run test:mobile` at the end of stages 2, 4, 7.

## Decisions assumed (Adrian gets one pushback window before dispatch)

- D1: DELETE the classic skin. Every component branches on `isPlaybookSurface`; classic is reachable only via the `compass-playbook` admin route (`AdminApp.tsx:655-665`, note the route ironically renders classic). Collapse to one skin, remove `surfaceVariant` prop plumbing, point/remove that route.
- D2: Full editorial pass (all 7 stages), not a minimal compliance pass.
- D3: Marks (Taste/Want/Buy/Sample) keep the 2×2 grid footprint but drop the always-on description lines; serif label + small-caps treatment.

## Stage 1 — collapse the skin fork (prereq for everything)

Remove `surfaceVariant`/`isPlaybookSurface` branching from all TeaCompass files, keeping the PLAYBOOK branch as the survivor everywhere. Remove the prop from `TeaCompassProps`, `CompassWithMode` (`AdminApp.tsx:122`), and the `compass-playbook` route's `surfaceVariant="classic"`.
- Exception: where this plan's later stages specify a new treatment, the survivor will be replaced anyway; still collapse first so later stages edit one string, not two.
- Acceptance: `grep -rn "isPlaybookSurface\|surfaceVariant\|'classic'" src/components/TeaCompass/` returns nothing; screen renders identical to current playbook screenshot.

## Stage 2 — top chrome: de-box, underline tabs

Today: a bordered `bg-tea-surface` toolbar (`mx-4 my-2 rounded-md border`) holding a pill mode-switcher, pill tabs, and a bordered mic square; below it a second bordered batch-strip box. Two stacked stroked containers before any content. DESIGN_SYSTEM §6 bans pill tabs and two-tier toggle chrome.

- Top bar container → full-bleed hairline strip: `flex items-center gap-2 h-11 px-3 border-b border-tea-border` (no box, no bg, no radius, no mx-4).
- Tea / Teaware / Samples → canonical underline tabs (§6): `py-2.5 text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec hover:text-tea-text border-b border-transparent`, active `text-tea-text border-b border-tea-gold`. Remove pill bg/border/radius. Keep the Samples count badge as parenthesized inline count `(3)` in `text-tea-text-dim`, not a gold pill.
- Source switcher: keep dropdown behavior, restyle quiet: `inline-flex items-center gap-1.5 h-8 px-2 rounded-md text-ui-12 uppercase tracking-[0.15em] text-tea-text hover:bg-tea-accent-sub` with the existing 6px gold dot. Drop its border and bg.
- Mic button: keep size/behavior, drop the resting border: `text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub rounded-md`; recording state keeps gold tint as today.
- Batch strip: remove its container box (`rounded-md border bg-tea-surface p-2` → `flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-tea-border`). Chips stay, but unify to ONE chip treatment, bg tint only, NO visible chip borders (standing feedback rule): inactive `px-3 py-1.5 rounded-md text-ui-12 text-tea-text-sec hover:bg-tea-accent-sub`, active `bg-tea-accent-sub text-tea-text` (keep the small gold check icon as the active signal). The `+` button matches inactive chip treatment.
- Acceptance: zero `rounded-*` + `border` containers above the form; tabs are underline; exactly two hairlines (under top bar, under batch strip).

## Stage 3 — surface collapse + §12 field language (the core stage)

Today: bordered form card (`bg-tea-surface border rounded-md p-5`) containing a second bordered shell (vendor+photo, `bg-tea-bg border`), containing bordered `bg-tea-bg` inputs: four stroked depths, inputs read as holes punched in the card. §21 caps depths at two.

- Drop the outer form card chrome entirely. The form becomes the page surface: container `px-4 md:px-6 max-w-3xl mx-auto` (narrow form chrome, §4) with `space-y-5`, page stays `bg-tea-bg`.
- Drop the vendor+photo inner shell's border/bg (stage 5 restyles its contents).
- New single `fieldClass` per §13 boxed input: `w-full bg-tea-surface border border-tea-border rounded-md px-3 py-2.5 text-base text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none`. Keep `text-base` (16px) on inputs: it is the iOS no-zoom floor, do not shrink. Apply to tea name, year, origin, price shell, grams shell, Type trigger, Form trigger.
- Section eyebrows: extend the existing NOTES divider pattern (hairline · label · hairline) to mark the form's sections. Add the same divider with labels `Tea` above the name row and `Pricing` above the price row, exactly matching the NOTES divider classes (`text-ui-9 text-tea-text-dim tracking-[0.2em] uppercase` between `h-px bg-tea-border` lines). Do NOT add per-field labels; placeholders remain the field hint (capture-speed decision, intentional).
- Spacing rhythm: `gap-2` within a row, `space-y-3` between rows in a section, the divider rows get `pt-2`.
- Acceptance: max two surface depths anywhere (page → input/tile); three matching eyebrow dividers (TEA, PRICING, NOTES); all fields share one class string.

## Stage 4 — the commitment: gold Done

Today Done is a neutral bordered box (`bg-tea-bg border-tea-border`), visually identical to a disabled control; the page's one commitment carries no weight, and gold appears nowhere load-bearing.

- Done (enabled): primary per §7 scaled up for full-width: `flex-1 rounded-md bg-tea-gold text-tea-bg font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors` with `shadow-lg shadow-tea-gold/10` (the §11 page-commitment exception), keep the existing display-serif label + `letterSpacing: 0.06em` inline style replaced by `font-display tracking-[0.06em]` classes, `py-3`.
- Done (disabled): same shape + `disabled:opacity-40`, no separate gray skin.
- Remove the classic gradient/inset-shadow inline style entirely (violates the token-only rule).
- Share: quiet icon button, `w-12 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub` (unchanged shape, it is correct).
- Acceptance: Done is the only gold fill on the screen; disabled state is opacity, not a recolor.

## Stage 5 — vendor + photo block: kill the dead zone

Today: ~180px of bordered emptiness; "Select vendor..." floats top-left, two unlabeled icon chips (sparkle, camera) float bottom-right; nothing communicates "add a photo here".

- Vendor row: keep behavior; placeholder `text-tea-text-dim` (remove the `/70` opacity variant), the leading contact icon keeps its 32px chip but `rounded-md` (radius unification) and `bg-tea-surface`.
- Photo strip: when empty, render ONE labeled dashed slot instead of blank space: `w-[60px] h-[60px] rounded-md border border-dashed border-tea-border text-tea-text-dim flex flex-col items-center justify-center gap-0.5` with `<Camera size={16}/>` and a `text-ui-9 uppercase tracking-[1.2px]` "Photo" label; tapping it = same action as the camera button. Thumbnails (when present) switch `rounded-xl` → `rounded-md`.
- The sparkle (AI scan) and camera buttons: keep both, `rounded-xl` → `rounded-md`; sparkle keeps its gold-tinted treatment (it is the one allowed "smart" accent); drop its inline inset boxShadow.
- Collapse the block's vertical height: vendor row + one 60px photo row + `gap-2`, no filler space.
- Acceptance: empty state shows the dashed Photo slot; block height ≤ ~120px; no `rounded-xl` left in VendorStrip/PhotoCapture.

## Stage 6 — marks: from SaaS feature tiles to editorial marks

Today the 2×2 Taste/Want/Buy/Sample grid is the generic icon + bold-title + description tile, the single most "AI-made" element on the screen, and its always-on helper sentences add four lines of permanent noise.

- Keep the 2×2 grid and 76px min-height (tap ergonomics, locked structure).
- Tile skin: `rounded-md border border-tea-border bg-transparent text-left px-3 py-3` (no bg fill at rest; the page is the surface now). Active: `bg-tea-accent-sub border-tea-gold/30`.
- Label becomes the brand voice: `font-display text-ui-15 text-tea-text` (serif, like sidebar nav), icon stays 18px/1.5-stroke to its left in `text-tea-text-sec`, gold when active.
- DELETE the description lines (`Start tasting notes.` etc.) from the resting tiles. If a hint is wanted, show it only inside the expanded/active state that already exists for Buy/Sample.
- Acceptance: tiles show icon + serif label only; active tile carries the gold-tint border; no `text-ui-11` descriptions render at rest.

## Stage 7 — sweep + polish

- Radius audit: `grep -rn "rounded-xl\|rounded-2xl\|rounded-\[" src/components/TeaCompass/` → everything interactive lands on `rounded-md` (popovers/menus may keep `rounded-xl` per system modal shell rules; dropdown panels = `rounded-xl shadow-lg` is canonical, leave those).
- Placeholder audit: no `placeholder:text-tea-text-sec/70` anywhere (banned opacity-on-sec); all `placeholder:text-tea-text-dim`.
- Numeric fields (price, grams, year, presets, currency prefix): ensure `tabular-nums` everywhere (mostly present) and the currency/unit affixes use `text-ui-11` + `text-tea-text-dim`.
- Inline style audit: remove remaining `style={{ fontFamily: 'var(--font-display)' ... }}` in favor of `font-display` + tracking classes; remove decorative inline boxShadows outside the scanner animation.
- Gram presets: anchor them visually to the grams field (`mt-1.5`, indent under the grams column) instead of a free-floating row; selected preset `bg-tea-accent-sub text-tea-text` (bg tint only, no border, not the gold-tinted `bg-tea-gold/15` pill, which is the banned chip idiom).
- aria-labels present on mic, share, sparkle, camera, photo slot.
- Run full: `npm run lint`, `npm run lint:colors`, `npm run test:mobile`, screenshot light AND dark mode at 390×844 + desktop 1280.

## Out of scope (do not touch)

- Field order, field set, batch/session logic, voice/AI-scan behavior, InputParser, sync logic, Teaware/Samples tab content beyond what the shared components inherit, desktop two-column layout logic in CaptureCard, NoteThread internals.
- BottomTabBar / any nav (never without explicit confirmation).
