# TODO 09: Optimize Texture Overlays (Reduce from 3 to 1)

**Priority:** P2 — MEDIUM
**Impact:** Paint performance, battery life on mobile, FCP
**Effort:** Low (2 hours)
**Category:** Performance

---

## Problem

Three fixed-position overlays render on every single page:

1. **`.texture-overlay`** (`index.html` CSS) — SVG `feTurbulence` fractal noise filter
2. **`.grain-texture`** (`App.tsx:347`) — `mix-blend-mode: multiply` grain
3. **Radial gradient vignette** (`App.tsx:348`) — `bg-gradient-radial` overlay

`feTurbulence` SVG filters are computationally expensive (fractal noise generation on GPU). `mix-blend-mode: multiply` forces expensive blend calculations on every repaint. All three overlays cover 100% of the viewport and render on top of all content.

## Impact

- Increased paint/composite time on every frame
- Battery drain on mobile (constant GPU compositing)
- Slower scroll performance
- Affects all pages, not just visually complex ones

## Steps

1. **Remove the `feTurbulence` SVG filter** — This is the most expensive overlay. The visual contribution is minimal compared to the performance cost.
   - In `index.html`: Remove the SVG filter definition and `.texture-overlay` class
   - In `App.tsx:346`: Remove `<div className="texture-overlay"></div>`

2. **Keep one CSS-only grain texture** — Either:
   - The existing `.grain-texture` with `mix-blend-mode` (but consider removing `mix-blend-mode` and using `opacity` only)
   - OR replace with a lightweight CSS `background-image` using a small repeating PNG grain texture

3. **Evaluate the radial vignette** — If it adds meaningful warmth, keep it. If not, remove.
   - In `App.tsx:348`: Assess the `bg-gradient-radial` overlay

4. **Add `will-change: contents`** to any remaining overlay for GPU compositing hint

## Files to Modify

- `index.html` — Remove SVG filter definitions and `.texture-overlay` CSS
- `src/App.tsx:346–348` — Remove/reduce overlay divs

## Verification

- Visual quality: the page should still feel warm and textured (A/B test with screenshots)
- Performance: Chrome DevTools Paint profiler shows reduced paint time
- Mobile: noticeably smoother scrolling
- Battery: reduced GPU usage in Chrome task manager

## Related Issues

- #01 (Tailwind PostCSS — texture CSS moves to external file)
