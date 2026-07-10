# Admin code-split plan — the durable cure for the AdminApp chunk failure

> Companion to the shipped hotfix (PR #264, `src/lib/recoverFromChunkError.ts` +
> `lazyWithReload` retry). The hotfix makes a failed load *recover*; this plan
> stops the failure from happening by shrinking what has to download.

## The problem in one paragraph

Every admin view is a **static top-level `import`** in `src/admin/AdminApp.tsx`
(lines 64-120). Rollup therefore bundles all ~40 views + their satellites into a
single `AdminApp-*.js` chunk of **~1.78 MB gzip 413 KB**. Opening *any* admin
surface (even the 6 KB NetworkLanding) requires the whole 1.78 MB to arrive
first. On a jumpy or firewalled connection that single large download drops
mid-flight and the user hits "Failed to fetch dynamically imported module". A new
deploy rotates the hash, so the cached copy stops helping exactly when a fresh
download is least likely to complete.

## What's actually in the 1.78 MB

| Mass | Source | Note |
|---|---|---|
| TeaCompass / Curate (`compass`) | `src/components/TeaCompass/*` (~14k lines) | Largest. Primary surface. |
| InventoryView (`stock`) + satellites | `InventoryView.tsx` (3.1k) + SourcesView, CustomersView, ProductEditPanel, AddProductModal, OrdersView (~9k combined) | Second largest. Primary surface. |
| ~35 other views | `src/admin/views/*`, `src/admin/components/*` | The long tail; each 1-64 KB. |
| **recharts** | only `DashboardView.tsx` imports it | Falls out for free once `dashboard` is lazy. |
| framer-motion | `AdminApp.tsx:6` + 22 files | Shared with public app; consolidates to a common chunk, does not vanish. |

Already OUT of the chunk (via dynamic `import()`): **xlsx**, **@react-pdf/renderer**.
No other heavy npm libs live in admin. The weight is our own code + recharts.

## The fix

Convert the static view imports to **route-level `lazy()`**, so each view is its
own async chunk fetched only when its route opens. The first admin load then
pulls only the shell + the one view requested. No single download is 1.78 MB;
the two surfaces Adrian actually uses (~400-600 KB each) are far likelier to
complete on a bad connection, and every other view is a small on-demand fetch.

### Mechanism (one shared change, then N one-liners)

1. **Bake Suspense into `PageTransition`** (`AdminApp.tsx:154-164`) — it already
   wraps every routed view and already carries `h-full`. Wrap its children in a
   `<Suspense>` whose fallback is `h-full` (see height-chain rule below):

   ```tsx
   const ViewFallback = () => (
     <div className="h-full flex items-center justify-center">
       <EmblemLoader />           {/* or the existing admin spinner */}
     </div>
   );

   const PageTransition = ({ children }: { children: React.ReactNode }) => (
     <motion.div ... className="h-full">
       <Suspense fallback={<ViewFallback />}>{children}</Suspense>
     </motion.div>
   );
   ```

   This is the ONLY structural insertion. Because it lives inside PageTransition
   (which is already an `h-full` child of the routes wrapper), no ancestor in the
   documented height chain changes.

2. **Convert each view import to `lazy()`.** Views are *named* exports, so:

   ```tsx
   const InventoryView = lazy(() =>
     import('./components/InventoryView').then(m => ({ default: m.InventoryView })));
   ```

   `import type { CompassMode }` (line 96) stays a static type-only import (types
   are erased; no runtime weight).

That's it. No routing rewrite, no barrel untangling (there is no view barrel),
no change to any view's internals.

## Height-chain guardrail — DO NOT BREAK (CLAUDE.md:65-83)

The inserted `<Suspense>` and its **fallback** sit between the routes wrapper
(`AdminApp.tsx:648`, `flex-1 min-h-0`) and the view root. Both the Suspense
boundary's rendered subtree and the fallback element MUST carry `h-full`, or the
`[data-testid="inventory-scroll"]` container silently collapses to 0px and the
inventory page stops scrolling on every device. Putting Suspense *inside*
PageTransition's `h-full` motion.div (as above) satisfies this, and the fallback
is explicitly `h-full`. Verify with `npm run test:mobile` (runs
`tests/inventory-scroll.spec.ts` on Desktop + Mobile Chrome) after Wave 1.

Note: CLAUDE.md's line numbers in that section are stale (file grew to 837
lines). Current anchors: App.tsx:762 / App.tsx:790 / AdminApp.tsx:508 / :524 /
:648 / PageTransition :154. Update CLAUDE.md's numbers as part of Wave 1.

## Build sequence — heaviest first, each wave its own PR

**Wave 1 — the two giants + Dashboard (captures ~60%+ of the win).**
- Add Suspense to PageTransition (the shared change).
- Lazy-load `TeaCompass`/`CompassWithMode`, `InventoryView`, `DashboardView`.
- Dashboard going lazy evicts **recharts** from the shell chunk automatically.
- Verify: `npm run build` (confirm AdminApp shell chunk drops sharply + new
  `TeaCompass-*`, `InventoryView-*`, `DashboardView-*` chunks appear);
  `npm run lint`; `npm run test:mobile` (inventory scroll + mobile audit);
  drive Curate + Inventory + Dashboard live.
- This wave alone makes the shell load reliably; ship and observe before Wave 2.

**Wave 2 — the long tail (~35 remaining views).**
- Convert the rest to `lazy()`. Mechanical, low-risk, but large diff — do it in
  one PR since the pattern is identical and each view is independent.
- Verify: build chunk map (no view >~600 KB; shell is small), full `test:mobile`,
  spot-drive 4-5 representative views incl. one platform-owner-only view.

**Wave 3 — optional polish (only if the common case feels slower).**
- **Prefetch the two hot chunks** after the shell mounts (idle-time `import()` or
  `<link rel="modulepreload">`) so Curate/Inventory feel instant while staying
  resilient. Curate and Inventory are what Adrian opens most, so warming them is
  the highest-value prefetch.
- Optionally add `framer-motion` to `manualChunks` as a named `motion` chunk to
  dedupe it across public + admin (currently it consolidates on its own).

## Risks and how each is caught

| Risk | Mitigation |
|---|---|
| Inventory scroll collapses (height chain) | `h-full` on Suspense + fallback; `inventory-scroll.spec.ts` gate. |
| A view is a default export, not named | Grep each import; use the `.then(m => ({default: m.X}))` form; tsc catches mismatch. |
| Flash of fallback on every nav feels janky | Fallback is a quiet `h-full` centered loader; hot chunks prefetched in Wave 3. |
| A lazy chunk itself fails to load | Already covered by the shipped `lazyWithReload` retry + cache-purge; extend it to the admin-side lazy() wrapper or reuse the same helper. |
| Shared code duplicated across chunks | Rollup hoists `types.ts`, `useAdminData`, framer-motion into an admin common chunk automatically; confirm in the build chunk map. |

## Definition of done

- `AdminApp` shell chunk is under ~400 KB gzip; TeaCompass, InventoryView,
  Dashboard, and the long-tail views are separate on-demand chunks.
- recharts no longer in the shell chunk.
- `test:mobile` green (incl. inventory scroll) on Desktop + Mobile.
- Live Curate, Inventory, Dashboard, and one platform-only view all render.
- CLAUDE.md height-chain line numbers refreshed.
