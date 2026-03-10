# TODO 01: Replace Tailwind CDN with PostCSS Build

**Priority:** P0 — CRITICAL
**Impact:** Performance (FCP improvement: 0.5–1.5s), reliability, bundle size
**Effort:** Medium (half-day)
**Category:** Performance

---

## Problem

`index.html:25` loads the entire Tailwind CSS engine (~500KB uncompressed) from CDN via JavaScript on every page load. This:

- Blocks rendering until the script downloads, parses, and compiles
- Causes visible Flash of Unstyled Content (FOUC)
- Prevents CSS tree-shaking (all unused utilities are present)
- Creates a dependency on a third-party CDN for basic styling
- Adds 0.5–1.5s to First Contentful Paint

## Files to Modify

- `index.html` — Remove `<script src="https://cdn.tailwindcss.com">` and inline Tailwind config script
- `vite.config.ts` — Add PostCSS integration (Vite supports it natively)
- `package.json` — Add `tailwindcss`, `postcss`, `autoprefixer` as devDependencies
- `tailwind.config.ts` — Already exists, may need the inline config merged in
- New: `postcss.config.js`
- New: `src/styles/tailwind.css` — `@tailwind base; @tailwind components; @tailwind utilities;`

## Steps

1. Install: `npm install -D tailwindcss postcss autoprefixer`
2. Create `postcss.config.js` with tailwindcss + autoprefixer plugins
3. Create `src/styles/tailwind.css` with `@tailwind` directives
4. Import it in `src/index.tsx`: `import './styles/tailwind.css'`
5. Merge the inline Tailwind config from `index.html` into `tailwind.config.ts`
6. Move all CSS custom properties from the inline `<style>` block in `index.html` into `src/styles/globals.css`
7. Remove the CDN `<script>` tag and inline config `<script>` from `index.html`
8. Verify `npm run dev` works — all Tailwind classes should still render
9. Run `npm run build` — verify output CSS is tree-shaken (should be much smaller)

## Verification

- No FOUC on page load
- All existing Tailwind classes render correctly in both themes
- `dist/` CSS bundle is under 50KB (vs ~500KB CDN)
- Lighthouse FCP improves measurably

## Risks

- The inline config in `index.html` contains CSS custom properties for theme switching — these must be preserved in the migration
- SVG texture filters defined in the inline `<style>` block must be moved to an external CSS file
- Some Tailwind classes may be dynamically generated (string interpolation) — verify with a full build

## Related Issues

- #02 (inline CSS extraction)
- #09 (texture overlay optimization)
