# TODO 08: Establish a Z-Index Scale

**Priority:** P2 — MEDIUM
**Impact:** Layering predictability, overlay stacking correctness
**Effort:** Low (half-day)
**Category:** Design System

---

## Problem

Z-index values are arbitrary, ranging from 10 to 9999 with no documented scale:

| Component | Current z-index | Problem |
|-----------|----------------|---------|
| Theme radial overlay | `z-[9999]` | Overlays everything, including browser devtools |
| Skip link | `z-[9999]` | Conflicts with theme overlay |
| Toast messages | `z-[250]` | Undocumented gap from modals |
| Contact modal | `z-[210]` | Different from other modals at `z-[100]` |
| Most modals/drawers | `z-[100]` | 80+ instances fighting for same layer |
| Sidebar drawer | `z-[90]` | No gap between modal layers |
| Contributor profile | `z-[80]` | Unclear stacking intent |
| TeaInventory buttons | `z-[70]` | Overlaps with photo viewer |
| Bottom tab bar | `z-[65]` | Can be occluded by photo viewer |
| Photo essay viewer | `z-[60]` | Blocks iOS back-swipe |

When two overlays open simultaneously, the stacking order is unpredictable.

## Proposed Scale

Add to `src/designTokens.ts`:

```typescript
export const Z_INDEX = {
  base: 0,        // Normal content flow
  dropdown: 10,   // Dropdowns, tooltips, popovers
  sticky: 20,     // Sticky headers, bottom tab bar, floating action buttons
  overlay: 30,    // Backdrop overlays (dim background)
  drawer: 35,     // Side drawers, cart panel
  modal: 40,      // Modal dialogs
  toast: 50,      // Toast notifications (above modals)
  priority: 60,   // Skip links, critical accessibility UI
} as const;
```

Also add corresponding Tailwind utilities in `tailwind.config.ts`:
```typescript
zIndex: {
  base: '0',
  dropdown: '10',
  sticky: '20',
  overlay: '30',
  drawer: '35',
  modal: '40',
  toast: '50',
  priority: '60',
}
```

## Migration Map

| Component | Current | New |
|-----------|---------|-----|
| Theme overlay | `z-[9999]` | `z-overlay` (30) |
| Skip link | `z-[9999]` | `z-priority` (60) |
| Toast | `z-[250]` | `z-toast` (50) |
| Contact modal | `z-[210]` | `z-modal` (40) |
| All modals | `z-[100]` | `z-modal` (40) |
| Account panel | `z-[90]` | `z-drawer` (35) |
| Sidebar drawer | `z-[90]` | `z-drawer` (35) |
| Contributor profile | `z-[80]` | `z-modal` (40) |
| TeaInventory | `z-[70]` | `z-dropdown` (10) |
| Bottom tab bar | `z-[65]` | `z-sticky` (20) |
| Photo viewer | `z-[60]` | `z-modal` (40) |

## Files to Modify

- `src/designTokens.ts` — Add Z_INDEX scale
- `tailwind.config.ts` — Add zIndex theme extension
- All 50+ files using arbitrary z-index values (search: `z-\[`)

## Verification

- Open modal + toast simultaneously — toast appears above modal
- Open drawer + modal — modal appears above drawer
- Bottom tab bar is always visible except behind modals
- Skip link is always reachable via keyboard

## Related Issues

- None (standalone task)
