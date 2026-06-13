# Curate capture: good to amazing — 10 brand-authentic richness moves

The restyle (PR #202) took the screen from generic to correct: right tokens, right tabs, right Done, two surface depths. This plan takes it from correct to amazing. Every move below uses a primitive that ALREADY EXISTS in the Teajia codebase (the alcove texture system, the magazine editorial set, the card-utilities warm primitives). Nothing generic is invented; the richness is borrowed from the brand's own best surfaces.

Branch: feat/curate-capture-restyle (continue on it). Files: src/components/TeaCompass/{index.tsx, CaptureCard.tsx, PricingRow.tsx, VendorStrip.tsx, PhotoCapture.tsx}. Verify each: npm run lint, npm run lint:colors. The standing rule (no decorative-only elements) still holds: every flourish must earn its place, none can be a ghost indicator.

## The 10 moves (ranked by impact-per-effort)

### 1. Editorial eyebrows instead of plain hairline dividers  [keystone]
The TEA / PRICING / NOTES dividers are currently a flat `h-px bg-tea-border` line + plain uppercase label. The brand's real eyebrow is `EYEBROW_STYLE` (MagazineTabbed.tsx:111): Cormorant italic, `font-variant: all-small-caps`, gold, 0.05em tracking. Extract it into a shared const and apply to the SectionDivider label. This single change is what moves the whole screen from "form" to "editorial" because the section markers are the most-repeated brand-voice moment on the page.
- Also swap the flat line for `.divider-warm` (card-utilities.css:489): the gold gradient hairline (transparent to gold/0.3 to transparent), not a solid border. Optionally `.divider-ornament` adds the centered 6px gold dot at the midpoint, but use it on ONE divider (NOTES) only so it reads as punctuation, not decoration.

### 2. Warm the page surface (radial warmth + grain)
The capture page is flat `bg-tea-bg`. The alcove and every premium surface carry two invisible layers: a top-right radial ember glow and fine SVG grain. Drop `.surface-warm` (card-utilities.css:361) on the form's scroll container. It adds `radialWarmth` + grain at opacity 0.06 via ::before/::after, zero markup cost, and gives the espresso field the lit-from-within depth the alcove has. This is the difference between "dark grey app" and "warm room."

### 3. Recess the inputs (letterpress-feel inset)
Inputs are flat `bg-tea-surface` boxes. The brand recesses content zones with an edge-lit inset bevel (`.surface-warm-inset` / SHADOWS.insetPanel: `inset 0 1px 0 rgba(200,170,120,0.06), inset 0 -1px 0 rgba(200,170,120,0.04)`). Add a subtle warm inset to the field shells so they read as pressed-into-the-surface, not floating boxes: `inset 0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(200,170,120,0.04)`. This is the closest the brand gets to letterpress and it makes fields feel crafted. Keep it whisper-quiet (this is the one net-new value, matched to the existing insetPanel idiom).

### 4. Staggered entrance on the form
The screen pops in all at once. The brand has `.stagger-grid` (card-utilities.css:1179): children fade+rise (translateY 16px to 0) at 60ms increments. Apply to the form's section stack so vendor, then identity, then pricing, then notes, then marks cascade in over ~400ms on mount. Editorial reveal, not app-snap. Honors prefers-reduced-motion (collapses to 0).

### 5. The marks: warm recessed track, underline-active idiom
The 2x2 marks are flat bordered tiles. The brand's segmented-control idiom is `.tasting-segment-toggle` (warm recessed track, card-utilities.css:1841) with the `.alcove-qty-btn` active state: `box-shadow: inset 0 -1px 0 var(--tea-gold)` (a gold underline, no fill). Restyle the active mark to use the gold-underline-on-warm-surface idiom instead of the gold-tint-border, matching how the alcove's own controls behave. Quieter and more brand-native than the border.

### 6. Drop-cap-grade Done commitment
Done is now gold-filled, good. Make it the screen's editorial period: add SHADOWS.card-style depth (`inset 0 1px 0 rgba(255,255,255,0.08)` top highlight for the pressed-metal feel the alcove order button has) and on hover a faint `0 0 20px rgba(184,146,78,0.12)` warm bloom (already the cardHover idiom). It should feel like pressing a brass key, not clicking a web button.

### 7. Photo slot: dashed becomes a framed plate
The empty Photo slot is a plain dashed square. The magazine uses geometric gold-line ornaments (ArticlePage plate idiom: nested concentric borders `border: 1px solid rgba(184,146,78,0.28)` on a warm field). Give the empty slot a 1px gold-tint inner frame + the tiny grain texture so it reads as "a plate waiting for an image," not "an upload affordance." Camera icon stays.

### 8. Vendor identity gets the gold eyebrow
When a vendor is selected, the name is plain text. Borrow the AlcoveIdentityHeader gold eyebrow (Cormorant 10px uppercase gold 0.18em) for a "SOURCED FROM" micro-label above the vendor name, so the vendor reads as provenance (the brand's whole thesis) not a form value. Only when a vendor is set; nothing when empty.

### 9. Numerics get the real .num treatment
Price, grams, year, and presets use `tabular-nums` but not the full `.num` class (card-utilities.css:168: mono + tabular + lining + 0.01em tracking + lnum/tnum feature-settings). Apply `.num` to every numeric value so the ledger numbers column-align with the same crafted monospace the rest of the app uses. Small, but it is the detail that separates "typed in a box" from "entered in a register."

### 10. A quiet Chinese watermark
The alcove carries a vertical Chinese calligraphy watermark at opacity 0.045 (AlcoveShell.tsx:57, or the simpler `.vertical-cjk` utility). A single character (e.g. the tea radical, or the current type's character) placed bottom-right at ~0.04 opacity gives the capture surface the same cultural depth the product pages have, without adding a single readable element. Lowest priority, highest "expensive" payoff. Use sparingly: one character, near-invisible, pointer-events-none.

## Build order
1, 2, 3 first (the surface + eyebrow + inset = 80% of the felt difference), verify, screenshot. Then 4, 5, 6 (motion + marks + Done). Then 7, 8, 9, 10 as polish. Each is independently shippable; none changes structure or behavior.

## Out of scope
Layout, field order, flow, behavior, nav. Same locks as the restyle plan. The watermark (10) and ornament dot (1) are the only two purely-decorative additions and both are capped at one instance to avoid the ghost-indicator failure.
