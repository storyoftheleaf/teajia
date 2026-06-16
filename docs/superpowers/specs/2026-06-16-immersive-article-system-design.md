# Immersive Article System — Design Brief

> Date: 2026-06-16
> Status: approved design, pre-implementation
> Supersedes (as the article reader): the 4:5 paginated `ArticlePage` carousel (kept, not removed — see Coexistence)
> Feeds: the `writing-studio` direction (this is the not-built **reader/output** end of that pipeline)

## One-sentence framing

A single flagship, responsive, scroll-driven article system where sustained long-form writing is the spine, and visuals plus a catalog of text-effects punctuate the read — phone-first, classy, recognizably Teajia, and unmistakably state-of-the-art.

## The decisions that produced this (locked in conversation 2026-06-16)

1. **Drop the 4:5 cage.** The Instagram-screenshot frame dictated the reading experience backwards. Articles are now real responsive web experiences; a share image is *generated from* a chosen moment, not the shape the article is built inside.
2. **Register: immersive editorial scroll, restraint as the law.** Motion serves the meaning of the sentence it sits on, or it is cut. The line between "expensive editorial" and "parallax slop" is intent and restraint.
3. **Writing is the spine.** These are articles with a good amount of real prose. Visuals and effects are *punctuation between sustained passages* — they never replace or interrupt the read. The artifact is read end-to-end, not swiped through like a slideshow.
4. **One flagship template, not a chooseable set.** Atlas / Scroll / Folio were the audition. The best moves of all three fold into one recognizable Teajia article identity. Range comes from arranging sections + effects, not from switching art directions.
5. **Phone-first, but responsive — NOT phone-only.** Designed at 390px first (short measure, large type, comfortable reading), scaling up to tablet/desktop with equal craft (wider measure, more expansive visuals, the same spine).
6. **Scroll-highlight reading is a core effect.** Words brighten from faint to full as the reading line passes them (the one effect Adrian singled out). It is built into the body-reading experience, available per-section.
7. **Authoring = block-stack fed by the Composition Studio.** The composed draft (the writing-studio engine, already built) pours into a vertical stack of blocks; each block carries a layout + an optional text-effect dial; drag to reorder; live responsive preview; publish.

## The three layers (architecture)

```
  Composition Studio  ──>   Block Stack (article doc)   ──>   Immersive Reader
  (intake + writing,        (ordered sections, each with       (responsive render,
   ALREADY BUILT)            layout + text-effect dials)         phone-first, scroll-driven)
```

### Layer 1 — Intake & writing (ALREADY BUILT, do not rebuild)
The Composition Studio: search Tea resources, lock passages, two-register (sourced vs your-voice) writing on a TipTap surface, scoped to a Study topic. This brief does NOT touch it. It produces the prose that flows into Layer 2.

### Layer 2 — The Block Stack (the article document + authoring)
An article is an **ordered list of blocks**. Each block has:
- a **`layout`** (which section type from the catalog),
- a **`content`** payload (prose, image refs, quote, slider images, map points, etc.),
- an optional **`textEffect`** dial (scroll-highlight, blur-focus, word-rise, underline-draw, etc.),
- responsive behaviour baked into the layout (every layout knows its phone + desktop form).

This extends the existing `ArticleBlock` system in `src/lib/articleBlockRegistry.ts` — current block types become layout types; the catalog below adds new ones. The dormant `src/components/reader/` components (ComparisonSlider, TimelineVisual, AnnotatedImage, etc.) are audited and the strong ones become interactive-object layouts.

**Authoring interaction:** vertical block list; click a block to set its layout + text-effect + drop content; drag to reorder; a live responsive preview (phone + desktop toggle) beside it. This is how Ghost/Substack work, raised to Teajia quality. The composed draft can seed the stack as prose blocks; Adrian holds the layout pen.

### Layer 3 — The Immersive Reader (the output, the new craft)
Renders a block stack as one continuous, responsive, scroll-driven article. Phone-first; scales up. A reading-progress indicator. IntersectionObserver-driven reveals (never scroll-listener for reveals; passive listeners only for progress bar + scrubbed sequences). Animate only `transform` / `opacity` / `stroke-dashoffset` / `background-position` / `clip` / `filter`. Coexists with the old 4:5 reader.

## The Section Catalog (~24 layouts, 4 families)

Families keep a large catalog coherent rather than a junk drawer.

**I · Openings**
- Immersive cover (image backdrop, oversized Cormorant headline, eyebrow, read-time)
- Centered ceremonial cover (mark + centered title)
- Masked-reveal hero (headline letters cut from the photograph — from Scroll)

**II · Narrative (the spine)**
- Body prose (the foundation: 18px Lora, ~1.78 line-height, short measure, drop-cap option)
- Reveal prose (fade-up + blur-clear per paragraph on enter)
- Section heading (numeral + Cormorant title, line-by-line stagger)
- Pinned hero (held image, text crosses it — from Scroll)
- Pull-quote (oversized, breaks the column, bronze italic)
- Chapter divider (vertical Chinese numeral 二 — from Folio)

**III · Visual**
- Full-bleed image (ken-burns)
- Inline image (sits inside the prose flow, captioned, reading continues after)
- Split diptych (two ideas side by side; stacks on phone)
- Horizontal swipe gallery (snap-scroll pills — from Atlas)
- Book plate (quiet sepia/duotone, single image treated like a fine-press plate — from Folio)

**IV · Interactive & Data**
- Comparison slider (steep 1 vs 5; double-bezel framed — from all)
- Brewing steps (numbered rows)
- Tasting radar (self-drawing polygon — from v3)
- Origin map (self-drawing route cliff→roast→cup — from Atlas)
- Count-up stat (number counts up on enter — from Atlas)
- Product cross-link card (links to a Tea product; material-flow reference rule)
- Audio / listen block (read-aloud, animated waveform)
- Closing colophon (credits + "Share a card ↗" button-in-button pill)
- (audit dormant reader components for: timeline, annotated-image hotspots, definition, recipe, poem, footnote-reveal)

## The Text-Effect Dials (~12, attachable to reading sections)

These are toggles on a section, not sections themselves. Same words, different feeling per article.

1. **Scroll-highlight** (CORE — Adrian's pick): words brighten faint→full as the reading line passes.
2. Word-by-word rise
3. Gradient shimmer headline
4. Text masked by image
5. Blur-focus arrival (from Folio)
6. Underline-draw on key phrases (from Atlas)
7. Line-by-line stagger
8. Scale-jump opener (one giant line leads a passage)
9. Color-wipe phrase (bronze fills behind a phrase — from Folio)
10. Letter-space expand (from Folio)
11. Count-up (for stats)
12. (reserve: ink-bleed, masked line-clip, draw-on letterforms)

## Brand law (non-negotiable, applies everywhere)

- Tokens: `--bg #1c1a16`, `--bg2 #22201c`, `--text #ede4d4`, `--text-sec #ddd2bd`, `--text-dim #b3a283`, `--gold #a8874d` (AGED BRONZE, never bright gold), `--gold-lt #bfa06a`, `--border rgba(168,135,77,.16)`. Use the project's real CSS variables (`src/styles/tailwind.css`).
- Fonts: Cormorant Garamond (display), Lora (body serif), Plus Jakarta Sans (sans labels).
- No em-dashes anywhere. No icons/emoji/symbol glyphs (text labels + the `↗` arrow + Chinese characters are fine). No bright borders. No `text-white`/`bg-white`.
- Custom cubic-bezier easing only. GPU-safe animation only (`transform`/`opacity`/etc., never `top`/`left`/`width`/`height`). `backdrop-blur` only on fixed/sticky elements.
- Restraint is the law: every motion serves the sentence it sits on, or it is cut.

## Responsive contract

- **Phone (≤640px):** short measure, 18px body, single column, sections stack, large tap targets, the reading-progress bar.
- **Tablet/desktop (≥768px):** wider measure (cap ~680px reading column even on wide screens — never full-bleed prose), more expansive visuals (full-bleed can go truly full-bleed, diptychs go side-by-side, galleries show more), the same spine and the same effects. The article is recognizably the same piece, just breathing wider.
- Never `h-screen` for full-height sections; use `min-h-[100dvh]` (iOS Safari). Test both widths.

## Coexistence (do not remove the old reader)

The 4:5 paginated `ArticlePage` carousel stays as a **selectable article type** — kept "just in case" per Adrian. The new immersive reader is a second type. The article record gains a `renderMode` (or equivalent) discriminator: `carousel_4x5` (existing) | `immersive_scroll` (new). New articles default to immersive; existing magazine pieces stay on the carousel until/if migrated.

## Slop tests (from the writing-studio direction, applied here)

1. **Reads as a real article, not a gallery of tricks.** If a stranger scrolls it and feels they read a story (not watched a slideshow), it passed.
2. **The writing leads; effects punctuate.** Remove every effect and the prose still stands as a complete, beautiful read. If removing the effects leaves nothing, it failed.
3. **One flagship identity.** Every article is recognizably Teajia. If two articles read as two different brands, the catalog drifted into separate templates.
4. **Phone-first, equally great wide.** If it only works on one width, it failed.
5. **Material is referenced, not re-gathered** (photos/products link to where they live; carries material-flow's reference rule).

## What's new vs. what exists

- **New:** the immersive reader (Layer 3), the expanded section catalog, the text-effect dials, the responsive contract, the `renderMode` discriminator, the block-stack authoring UI (Layer 2 editor).
- **Exists, extend:** `src/lib/articleBlockRegistry.ts` (block→layout types), `src/components/reader/*` (audit dormant components into interactive-object layouts), the Composition Studio (Layer 1, untouched).
- **Exists, keep:** the 4:5 `ArticlePage` reader (coexists).

## Out of scope (explicitly)

- The Composition Studio intake/writing engine (already built).
- The writing-studio grid, file-links, and tool chain (separate writing-studio WS.x work).
- Auto-generating articles from raw text (slop line: AI never generates the whole article).
- Migrating existing 4:5 magazine pieces (they coexist; migration is a later, optional pass).

## Build sequence (proposed; ordered, each shippable)

- **AR.0 — Reader foundation + `renderMode`.** Add the discriminator; render an immersive article from a hardcoded block stack. The body-prose layout + scroll-highlight reading effect + reading-progress bar. Phone + desktop. (The spine, proven.)
- **AR.1 — Opening + narrative families.** Cover variants, reveal prose, section heading, pinned hero, pull-quote, chapter divider.
- **AR.2 — Visual family.** Full-bleed, inline image, diptych, gallery, book plate. Responsive forms.
- **AR.3 — Text-effect dials.** Wire the ~12 effects as per-section toggles; scroll-highlight already in AR.0.
- **AR.4 — Interactive & data family.** Comparison slider, tasting radar, origin map, count-up, brewing steps, product cross-link, audio block. Audit + port dormant reader components.
- **AR.5 — Block-stack authoring UI.** The editor: ordered blocks, layout + effect dials, drag-reorder, live responsive preview, seed-from-Composition-Studio.
- **AR.6 — Share-card generation.** Render a chosen moment to a 4:5 / 9:16 / 1:1 image (replaces the old screenshot-native constraint).

UI feel gets Adrian's eye at every step (design work, not plumbing). Plumbing underneath proceeds autonomously.

## Reference mockups (the design conversation that produced this)

In `~/builds/`: `teajia-article-registers.html` (3 registers), `teajia-section-catalog-v3.html` (~24 sections + showpieces), `teajia-text-effects.html` (12 text effects), `teajia-full-article.html` (the woven full-article model), `teajia-template-A-atlas.html` / `-B-scroll.html` / `-C-folio.html` (the three auditioned identities folded into this one flagship).
