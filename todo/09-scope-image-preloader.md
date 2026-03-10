# TODO 09: Scope ImagePreloaderProvider to Reader Only

**Priority:** P2 — MEDIUM
**Impact:** Memory usage (save up to 40MB global cache), startup performance
**Effort:** Low (1 hour)
**Category:** Performance

---

## Problem

`ImagePreloaderProvider` wraps the entire app in `src/App.tsx` but is only used by:
- `src/components/Reader.tsx` — calls `preloadImages()`
- `src/components/shared/PreloadIndicator.tsx` — shows preload progress

The provider maintains a 40MB memory cache globally with:
- No automatic cleanup on route navigation
- 4 concurrent image loads even on slow connections
- Incomplete `clearOldPages()` logic
- Cache that accumulates across the session

## Steps

1. Remove `<ImagePreloaderProvider>` from `src/App.tsx` provider stack
2. Wrap `<Reader>` component in `<ImagePreloaderProvider>` directly:
   ```tsx
   // In the route or wherever Reader is rendered
   <ImagePreloaderProvider>
     <Reader />
   </ImagePreloaderProvider>
   ```
3. Move `<PreloadIndicator>` inside the same provider scope
4. Reduce `maxMemoryMB` from 40 to 25 in the provider config
5. Add cleanup in the provider's unmount: clear all cached images when leaving Reader

## Files to Modify

- `src/App.tsx` — Remove `ImagePreloaderProvider` from the provider stack (line ~577)
- `src/components/Reader.tsx` — Wrap in `ImagePreloaderProvider`
- `src/context/ImagePreloaderContext.tsx` — Reduce cache size, add unmount cleanup

## Verification

- Navigate between Shop/Magazine/Learn — no image preloader in memory
- Open an article in Reader — image preloading works as before
- Leave Reader — cached images are cleaned up
- Check Chrome DevTools Memory tab — memory usage drops after leaving Reader

## Related Issues

- None (standalone quick win)
