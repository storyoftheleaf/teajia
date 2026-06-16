# Immersive Article System — Plan

Full design brief: [docs/superpowers/specs/2026-06-16-immersive-article-system-design.md](../../docs/superpowers/specs/2026-06-16-immersive-article-system-design.md)

A single flagship, responsive, scroll-driven article reader that replaces the 4:5 carousel as the default (the carousel is kept as a selectable type). Writing is the spine; visuals and a catalog of text-effects punctuate it. Phone-first, scales to desktop. Fed by the existing Composition Studio; authored via a block-stack editor.

This is the **reader/output end** of the `writing-studio` direction (the not-built gap that direction names). Composition Studio (intake + writing) already exists and is out of scope.

## Build sequence
- [ ] AR.0 — Reader foundation + `renderMode` discriminator; body-prose layout + scroll-highlight reading + progress bar; phone + desktop.
- [ ] AR.1 — Opening + narrative section families.
- [ ] AR.2 — Visual section family (responsive forms).
- [ ] AR.3 — Text-effect dials (~12, per-section toggles).
- [ ] AR.4 — Interactive & data family; audit + port dormant `src/components/reader/*`.
- [ ] AR.5 — Block-stack authoring UI (drag-reorder, layout + effect dials, live responsive preview, seed-from-Composition-Studio).
- [ ] AR.6 — Share-card generation (4:5 / 9:16 / 1:1 from a chosen moment).

## Locked decisions
One flagship (not a chooseable template set). Drop the 4:5 cage but keep the old reader. Scroll-highlight reading is a core effect. Responsive phone-to-desktop, not phone-only. Restraint is the law. AI never generates the whole article.

## Reference mockups
`~/builds/teajia-article-registers.html`, `teajia-section-catalog-v3.html`, `teajia-text-effects.html`, `teajia-full-article.html`, `teajia-template-{A-atlas,B-scroll,C-folio}.html`.
