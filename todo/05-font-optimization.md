# TODO 05: Reduce Fonts from 8 to 3–4 with `display=swap`

**Priority:** P1 — HIGH
**Impact:** FCP improvement (0.3–1.0s), eliminates invisible text (FOIT)
**Effort:** Low (1 hour)
**Category:** Performance

---

## Problem

`index.html:22` loads 8 Google Font families in a single blocking request with no `font-display: swap`:

1. Vollkorn (display headings) — **KEEP**
2. Lora (body serif) — **KEEP**
3. Inter (UI sans) — **KEEP**
4. JetBrains Mono (code blocks) — LAZY-LOAD
5. Noto Serif SC (Chinese characters) — LAZY-LOAD with `unicode-range`
6. Ma Shan Zheng (Chinese decorative) — REMOVE unless actively used
7. Fraunces (Alcove cards) — LAZY-LOAD
8. Bricolage Grotesque — REMOVE unless actively used

Users see invisible text (FOIT) for 1–3 seconds on slow connections until all 8 fonts load.

## Steps

1. Add `&display=swap` to the Google Fonts URL in `index.html`
2. Split into two font requests:
   - Critical (blocking): Lora, Inter, Vollkorn — `<link rel="preload" as="style">`
   - Non-critical (lazy): Noto Serif SC, Fraunces, JetBrains Mono — `<link rel="preload" media="print" onload="this.media='all'">`
3. Search codebase for usage of Ma Shan Zheng and Bricolage Grotesque — if unused, remove entirely
4. Add `unicode-range` descriptor for Noto Serif SC to avoid loading the full CJK font for pages without Chinese text
5. Verify font fallback chains in `tailwind.config.ts` font families

## Files to Modify

- `index.html` — Font loading links
- `tailwind.config.ts` — Font family definitions (verify fallbacks)

## Verification

- No invisible text on initial page load
- Chinese characters render correctly when present
- Lighthouse "Eliminate render-blocking resources" improves
- Network waterfall shows only 3 fonts blocking

## Related Issues

- #01 (Tailwind PostCSS — font config may need adjustment)
