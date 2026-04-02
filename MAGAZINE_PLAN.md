# Magazine Design Plan — Teajia

> Locked decisions from design audit conversation, April 2026.
> This is the source of truth for all magazine implementation work.

## Format

Teajia Magazine is a **single-page-per-screen editorial carousel**. Each page is one shareable unit of information — one idea, one moment, one visual. Pages are swiped through sequentially but any single page can stand alone as a screenshot, export, or print.

This is not a traditional magazine. It's closer to a high-production Instagram carousel — but longer, taller, with multimedia, and designed to be printed as a book later.

## Design Decisions

| # | Decision | Choice |
|---|----------|--------|
| — | Aspect ratio | **4:5** (800×1000) — IG post fit, prints clean on letter/A4 |
| — | Desktop | **Gallery Frame** — single centered page, contextual margins |
| — | Mobile nav | **Tap zones** — right=next, left=prev, center=show controls |
| — | Authoring | **Hybrid** — author tags key moments (COVER, CHAPTER, QUOTE, VIDEO, CLOSING), system handles layout rhythm for untagged blocks |
| — | Sharing | **Canvas-to-PNG export** with subtle watermark, one-tap via bottom-left icon |
| — | Video | **Poster frame** on page canvas (shareable as image), tap expands to full-screen native player |
| — | Progress | Keep current progress bar + brief "7 / 24" counter (bottom-right) |
| — | Print | Design-ready now (no dark-only elements, clean page boundaries), build print CSS later |
| F | Page transition | **Push with depth** — outgoing page scales to 95% + fades, incoming fades up. Premium, works with tap zones. |
| G | Grid card style | **Elevated cover page** — the actual page 1 rendered as thumbnail with paper shadow, slight tilt (1-2°), stack indicator showing page count |
| H | Grid layout | **Editorial asymmetric** — first story spans full width as hero, rest in 2-column grid. Scales to dozens. |
| I | Desktop margins | **Minimal metadata** — story title small-caps top-left, page counter bottom-right, both in tea-text-dim at ~11px. Appear on hover/page-turn, fade on idle. |
| J | Share placement | **Persistent subtle icon** bottom-left of page, always one tap. ↗ glyph in tea-text-dim. Triggers canvas-to-PNG → native share sheet. |
| K | Grid organization | **Manual editorial order** now (Option 3). Architecture supports collections later when catalog exceeds 20 stories. |

## Page Layout

```
┌─────────────────────────┐
│                         │
│     [page content]      │
│      800 × 1000         │
│        (4:5)            │
│                         │
│  ↗                7/24  │
│  ━━━━━━━━━━━━━━━━━━━━━  │
└─────────────────────────┘
   share          counter
```

## Tap Zones (Mobile)

```
┌──────────┬──────┬──────────┐
│          │      │          │
│   PREV   │ CTRL │   NEXT   │
│  (left   │(show │  (right  │
│   30%)   │share,│   30%)   │
│          │book- │          │
│          │mark) │          │
│          │(40%) │          │
└──────────┴──────┴──────────┘
```

## Desktop Gallery Frame

```
┌─────────────────────────────────────────────────┐
│  ARTICLE TITLE                                  │
│                                                 │
│           ┌─────────────────┐                   │
│           │                 │                   │
│     ◄     │   page content  │     ►             │
│           │    800×1000     │                    │
│           │                 │                    │
│           └─────────────────┘                   │
│                                          7 / 24 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
└─────────────────────────────────────────────────┘
  title: tea-text-dim, 11px small-caps, top-left
  counter: tea-text-dim, 11px, bottom-right
  arrows: appear on hover, in margins
  all metadata fades to near-invisible on idle
```

## Page Transition (Push with Depth)

```
Outgoing page:  scale(0.95), opacity → 0    (200ms)
Incoming page:  opacity 0 → 1               (250ms)
Easing:         cubic-bezier(0.4, 0, 0.2, 1)
```

## Grid Layout (MagazineTabbed)

```
┌─────────────────────────────────┐
│  ┌───────────────────────────┐  │
│  │     HERO STORY            │  │  ← first story, full width
│  │     (cover page render)   │  │     4:5 aspect, large title
│  │     24 pages              │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌─────────────┐ ┌───────────┐  │
│  │  Story 2    │ │  Story 3  │  │  ← 2-column grid
│  │  (elevated  │ │  (slight  │  │     each card = cover page
│  │   card)     │ │   tilt)   │  │     with paper shadow
│  │  12 pages   │ │  8 pages  │  │     + stack indicator
│  └─────────────┘ └───────────┘  │
│                                 │
│  ┌─────────────┐ ┌───────────┐  │
│  │  Story 4    │ │  Story 5  │  │
│  └─────────────┘ └───────────┘  │
└─────────────────────────────────┘
```

## Card Design (Elevated Cover)

Each grid card renders the story's page 1 (cover) as a thumbnail with:
- Paper shadow: `0 4px 16px rgba(0,0,0,0.25), 0 1px 4px rgba(0,0,0,0.15)`
- Slight rotation: alternating ±1° to ±2° (randomized per card)
- Stack hint: faint offset rectangle behind, suggesting depth/pages
- Page count badge: "24 pages" in folio text, bottom of card
- No torn edges, no gyroscope, no overlays on the grid level

## Content Pacing Engine

The system tracks page "weight" and avoids consecutive pages of the same type:
- `text-heavy` → followed by `image-heavy` or `spacious`
- `image-heavy` → followed by `text-heavy` or `mixed`
- Two `text-heavy` pages in a row → system inserts a `spacious` or `quote` break

Author-tagged pages (COVER, CHAPTER, QUOTE, VIDEO, CLOSING) override auto-sequencing.

## Video Page Treatment

```
┌─────────────────────────┐
│                         │
│   ┌─────────────────┐   │
│   │                 │   │
│   │  poster frame   │   │
│   │    (still)      │   │
│   │       ▶         │   │  ← play icon overlay
│   │                 │   │
│   └─────────────────┘   │
│                         │
│   Caption text below    │
│                         │
│  ↗                7/24  │
│  ━━━━━━━━━━━━━━━━━━━━━  │
└─────────────────────────┘

Tap ▶ → full-screen native player overlay
Page itself is always a static image (shareable, printable)
```

## Files Affected

| File | Changes |
|------|---------|
| `Reader.tsx` | Canvas 800×1000, tap zones, push transition, share button, desktop Gallery Frame, center-tap controls |
| `SinglePageRenderer.tsx` | Adjust all layouts for 4:5 canvas, video poster treatment |
| `MagazineTabbed.tsx` | Full grid redesign — editorial asymmetric layout, elevated cards |
| `ArticleCard.tsx` | Replace with new elevated cover card component |
| `card-utilities.css` | New card styles, transition keyframes, grid card shadows |
| `reader-animations.css` | Push transition keyframes |
| `index.html` | Fix font-family mismatch (Lora → Plus Jakarta Sans) |
| `tailwind.css` | Any new utility classes needed |

## Cleanup

Remove dead code:
- Gyroscope tilt hook (`useGyroscopeTilt` in ArticleCard.tsx)
- Torn edge SVG polygons (`TORN_EDGE_PATHS` in ArticleCard.tsx)
- Tilt-shift overlay component (ArticleCard.tsx)
- Paper texture overlay at card level (move to Reader only)
- CardContainer `variant` prop (dark/light are identical)
- Fix `text-neutral-100` / `text-neutral-400` → `text-tea-text` / `text-tea-text-sec`
