# Shop Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved All teas / My selection / Find a tea refinement to the existing ledger, separate available and past teas, and repair the product-price and order-access trust gaps without redesigning the shop.

**Architecture:** Keep `TeaInventory` as the owner of filters and modal routing, but move pure view/availability/finder decisions into `teaShopView.ts` and the two small visual controls into shop-owned components. Reuse one ledger renderer for All teas and My selection. Repair commerce through the existing shop-price and cart contracts, then add a read-only catalogue hygiene scanner instead of mutating production data.

**Tech Stack:** React 19, TypeScript, Vite 6, Vitest, React Router, Zustand, Tailwind v3 semantic tokens, Playwright.

---

## File map

- Create `src/components/shop/teaShopView.ts`: pure view order, curated/availability selection, and finder intents.
- Create `src/components/shop/teaShopView.test.ts`: unit contract for the pure shop-view model.
- Create `src/components/shop/TeaShopViewTabs.tsx`: slim local view controls using existing type roles and accessible button semantics.
- Create `src/components/shop/TeaShopViewTabs.test.tsx`: rendered order, selection state, and copy checks.
- Create `src/components/shop/TeaFinder.tsx`: ruled finder choices that emit canonical filter intents.
- Create `src/components/shop/TeaFinder.test.tsx`: rendered choices and callback contracts.
- Create `src/components/shop/TeaLedger.tsx`: extracted existing grouped ledger renderer shared by All teas and My selection.
- Modify `src/components/TeaInventory.tsx`: orchestrate the three views, existing filters, past archive, shared ledger, and modal state.
- Modify `src/components/shop/AlcoveCard.tsx`: use rate formatting instead of whole-total formatting for per-gram copy.
- Modify `src/components/shop/alcove/AlcoveCommerceFooter.tsx`: accept a complete rate label and avoid adding a second `/g`.
- Modify `src/pages/ProductPage.tsx`: expose a persistent cart/order reopen action after adding from a cold-loaded product page.
- Modify `src/App.tsx`: pass cart state/open behavior into `ProductPage` without changing routes.
- Create `src/components/shop/shopPrice.test.tsx`: price-rate regression coverage.
- Create `scripts/audit-shop-catalogue.mjs`: read-only scanner for malformed public catalogue records.
- Create `scripts/audit-shop-catalogue.test.mjs`: deterministic scanner tests using fixture objects only.
- Create `src/components/shop/setContents.ts`: public-safe set-item resolution that never exposes internal IDs.
- Create `src/components/shop/setContents.test.ts`: resolved and unresolved set-item coverage.
- Modify `src/components/Shop.tsx`: use the public-safe set resolver without changing the Sets layout.
- Modify `package.json`: add a read-only `audit:shop-catalogue` script.
- Modify `tests/inventory-scroll.spec.ts`: cover shop view order, mobile fit, finder transition, and modal opening where the shared server fixture permits.

---

### Task 1: Pure shop-view model

**Files:**
- Create: `src/components/shop/teaShopView.ts`
- Create: `src/components/shop/teaShopView.test.ts`

- [ ] **Step 1: Write failing model tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  TEA_SHOP_VIEWS,
  applyFinderIntent,
  selectAvailableTeas,
  selectCuratedTeas,
  selectPastTeas,
} from './teaShopView';

const tea = (overrides: Record<string, unknown> = {}) => ({
  id: 'tea-1', category: 'tea', type: 'White', name: 'Tea', year: '2024',
  origin: 'Fujian', stock_g: 100, cost_price: '0', price_per_gram: '0.2',
  description: '', tags: [], ...overrides,
});

describe('tea shop views', () => {
  it('keeps the approved order', () => {
    expect(TEA_SHOP_VIEWS.map(view => view.id)).toEqual(['all', 'selection', 'find']);
  });

  it('separates available, curated, and past tea', () => {
    const items = [
      tea({ id: 'available' }),
      tea({ id: 'curated', isCurated: true }),
      tea({ id: 'past', stock_g: 0, isCurated: true }),
      tea({ id: 'invalid-price', price_per_gram: '0' }),
    ] as any[];
    expect(selectAvailableTeas(items).map(item => item.id)).toEqual(['available', 'curated']);
    expect(selectCuratedTeas(items).map(item => item.id)).toEqual(['curated']);
    expect(selectPastTeas(items).map(item => item.id)).toEqual(['past']);
  });

  it('maps finder choices to canonical filters', () => {
    expect(applyFinderIntent('light-fragrant')).toEqual({ categoryId: 'flavor', termId: 'floral' });
    expect(applyFinderIntent('grounding-deep')).toEqual({ categoryId: 'feeling', termId: 'grounding' });
    expect(applyFinderIntent('clear-focused')).toEqual({ categoryId: 'feeling', termId: 'clarifying' });
    expect(applyFinderIntent('all')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npx vitest run src/components/shop/teaShopView.test.ts`

Expected: FAIL because `teaShopView.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure model**

```ts
import type { InventoryItem } from '../../types';

export type TeaShopView = 'all' | 'selection' | 'find';
export type TeaFinderIntent = 'light-fragrant' | 'grounding-deep' | 'clear-focused' | 'all';

export const TEA_SHOP_VIEWS = [
  { id: 'all' as const, label: 'All teas' },
  { id: 'selection' as const, label: 'My selection' },
  { id: 'find' as const, label: 'Find a tea' },
];

const saleReady = (item: InventoryItem) => Number(item.price_per_gram) > 0;

export const selectAvailableTeas = (items: InventoryItem[]) =>
  items.filter(item => item.stock_g > 0 && saleReady(item));
export const selectCuratedTeas = (items: InventoryItem[]) =>
  selectAvailableTeas(items).filter(item => item.isCurated);
export const selectPastTeas = (items: InventoryItem[]) =>
  items.filter(item => item.stock_g <= 0 && saleReady(item));

export function applyFinderIntent(intent: TeaFinderIntent) {
  if (intent === 'light-fragrant') return { categoryId: 'flavor' as const, termId: 'floral' };
  if (intent === 'grounding-deep') return { categoryId: 'feeling' as const, termId: 'grounding' };
  if (intent === 'clear-focused') return { categoryId: 'feeling' as const, termId: 'clarifying' };
  return null;
}
```

- [ ] **Step 4: Run the model test and verify GREEN**

Run: `npx vitest run src/components/shop/teaShopView.test.ts`

Expected: 3 tests pass.

- [ ] **Step 5: Commit the model**

```bash
git add src/components/shop/teaShopView.ts src/components/shop/teaShopView.test.ts
git commit -m "feat(shop): define refined tea views"
```

---

### Task 2: Slim view controls and finder

**Files:**
- Create: `src/components/shop/TeaShopViewTabs.tsx`
- Create: `src/components/shop/TeaShopViewTabs.test.tsx`
- Create: `src/components/shop/TeaFinder.tsx`
- Create: `src/components/shop/TeaFinder.test.tsx`

- [ ] **Step 1: Write failing rendered-contract tests**

```tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TeaShopViewTabs } from './TeaShopViewTabs';
import { TeaFinder } from './TeaFinder';

describe('TeaShopViewTabs', () => {
  it('renders the approved compact order and selected state', () => {
    const html = renderToStaticMarkup(<TeaShopViewTabs active="all" onChange={() => {}} />);
    expect(html.indexOf('All teas')).toBeLessThan(html.indexOf('My selection'));
    expect(html.indexOf('My selection')).toBeLessThan(html.indexOf('Find a tea'));
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('overflow-x-auto');
  });
});

describe('TeaFinder', () => {
  it('renders only the approved finder doors', () => {
    const html = renderToStaticMarkup(<TeaFinder onChoose={() => {}} />);
    expect(html).toContain('Light and fragrant');
    expect(html).toContain('Grounding and deep');
    expect(html).toContain('Clear and focused');
    expect(html).toContain('Open all teas');
    expect(html).not.toContain('rounded-xl');
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/components/shop/TeaShopViewTabs.test.tsx src/components/shop/TeaFinder.test.tsx`

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement the slim controls with existing roles**

Use `LABEL`, `BODY`, and `HIT_AREA` from `src/components/shared/typeRoles.ts`. `TeaShopViewTabs` renders three ordinary buttons with `aria-pressed`; the container is a flex row with `border-b border-tea-border`, compact responsive gaps, and no horizontal scroll. The active button uses `text-tea-text` plus an absolutely positioned one-pixel `bg-tea-gold` baseline. `TeaFinder` renders four full-width ruled buttons with labels and arrows, no card backgrounds, and reports the exact `TeaFinderIntent`.

- [ ] **Step 4: Run and verify GREEN**

Run: `npx vitest run src/components/shop/TeaShopViewTabs.test.tsx src/components/shop/TeaFinder.test.tsx`

Expected: 2 tests pass.

- [ ] **Step 5: Run the mandatory style detector for the new markup**

Run: `node /Users/adrianrasmussen/.agents/skills/impeccable/scripts/detect.mjs --json src/components/shop/TeaShopViewTabs.tsx src/components/shop/TeaFinder.tsx`

Expected: `[]` or only reviewed false positives.

- [ ] **Step 6: Commit the controls**

```bash
git add src/components/shop/TeaShopViewTabs.tsx src/components/shop/TeaShopViewTabs.test.tsx src/components/shop/TeaFinder.tsx src/components/shop/TeaFinder.test.tsx
git commit -m "feat(shop): add quiet tea view controls"
```

---

### Task 3: Shared ledger and TeaInventory integration

**Files:**
- Create: `src/components/shop/TeaLedger.tsx`
- Modify: `src/components/TeaInventory.tsx`
- Test: `src/components/shop/teaShopView.test.ts`

- [ ] **Step 1: Add failing tests for filtered-view orchestration**

Extend `teaShopView.test.ts` so `selectAvailableTeas`, `selectCuratedTeas`, and `selectPastTeas` preserve source order and never mutate their input. Add an `isSaleReadyTea` assertion for `NaN`, negative, and missing prices.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/components/shop/teaShopView.test.ts`

Expected: FAIL until `isSaleReadyTea` is exported and invalid-price cases are rejected.

- [ ] **Step 3: Extract the existing grouped ledger without visual changes**

Move only the category-label and item-row markup currently under `/* LIST VIEW */` into `TeaLedger.tsx`. Give it explicit props for grouped items, active filter state, tasting counts, price formatting, favorite toggling, opening a product, and optional admin editing. Copy the current classes exactly, adding `tap-target` only where existing interactive controls are under 44px. Do not redesign or rename product-row content.

- [ ] **Step 4: Integrate the three views in `TeaInventory`**

Add `teaView` initialized to `'all'` and `showPast` initialized to `false`. Render `TeaShopViewTabs` directly above the sticky search/filter toolbar. Behavior:

```ts
const baseAvailable = selectAvailableTeas(inventory);
const baseCurated = selectCuratedTeas(inventory);
const basePast = selectPastTeas(inventory);
```

All teas uses the existing filter pipeline over `baseAvailable` (or `basePast` when the archive is open). My selection uses the same filter/group/sort pipeline over `baseCurated` and the same `TeaLedger`. Find a tea renders `TeaFinder` without the toolbar or ledger. Choosing a finder intent clears conflicting type/region/special/tag state, sets either `tastingFilter` or `activeFeeling`, switches to All teas, and lets the existing URL synchronization expose the filter.

Add the quiet text link after the available ledger for `Past teas · sold out archive`; in past mode show `Return to available teas`. Preserve modal routing and the scroll container.

Expose the filtered result count through a compact `aria-live="polite"` line so the finder transition is understandable without adding a new visual block. Empty My selection and filtered-result states should remain typographic and point back to All teas or Find a tea.

- [ ] **Step 5: Run focused tests and TypeScript**

Run: `npx vitest run src/components/shop/teaShopView.test.ts src/components/shop/TeaShopViewTabs.test.tsx src/components/shop/TeaFinder.test.tsx src/components/shop/conditionalHooks.test.ts`

Expected: all focused tests pass.

Run: `npm run lint`

Expected: TypeScript exits 0.

- [ ] **Step 6: Run color/style guards**

Run: `npm run lint:colors`

Expected: all blocking color and typography rules pass.

Run: `node /Users/adrianrasmussen/.agents/skills/impeccable/scripts/detect.mjs --json src/components/TeaInventory.tsx src/components/shop/TeaLedger.tsx`

Expected: no unexplained findings.

- [ ] **Step 7: Commit the integrated views**

```bash
git add src/components/TeaInventory.tsx src/components/shop/TeaLedger.tsx src/components/shop/teaShopView.ts src/components/shop/teaShopView.test.ts
git commit -m "feat(shop): integrate refined tea ledger views"
```

---

### Task 4: Price-rate and persistent cart regressions

**Files:**
- Create: `src/components/shop/shopPrice.test.tsx`
- Modify: `src/components/shop/AlcoveCard.tsx`
- Modify: `src/components/shop/alcove/AlcoveCommerceFooter.tsx`
- Modify: `src/pages/ProductPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write a failing rate-format regression test**

```tsx
import { describe, expect, it } from 'vitest';
import { fmtShopPrice, fmtShopPricePerGram } from '../../utils/formatNumber';

describe('shop price roles', () => {
  it('does not format a fractional rate as a whole-dollar total', () => {
    expect(fmtShopPrice(0.15)).toBe('$1');
    expect(fmtShopPricePerGram(0.15)).toBe('$0.15/g');
  });
});
```

Add a rendered footer assertion that a supplied `'$0.15/g'` rate appears once and `'/g/g'` never appears. This test must fail against the current `perGramDisplay`/footer contract before production code changes.

- [ ] **Step 2: Run and verify RED**

Run: `npx vitest run src/components/shop/shopPrice.test.tsx`

Expected: the formatter comparison passes, but the rendered footer contract fails because the footer appends `/g` to an already complete rate or the current card still supplies `$1`.

- [ ] **Step 3: Repair the rate contract minimally**

Change the card/footer prop from a fragment-like `perGramDisplay` to a complete `rateLabel`. In the public shop use `shopPrice.perGram(pricePerGram)`. For admin `formatPrice` overrides, construct the full rate once at the card boundary. The footer renders `rateLabel` verbatim and never appends another unit.

- [ ] **Step 4: Add persistent cart access on cold product pages**

Extend `ProductPageProps` with `onCartClick` and `cartItemCount`. Pass both from `App.tsx`. When `cartItemCount > 0`, render a compact existing-style cart/order button near the commerce/reassurance area using `LABEL`, `NUMERAL`, semantic tokens, and `tap-target`. The control calls `onCartClick`; no route or checkout behavior changes.

Keep the existing WhatsApp/personal-order reassurance adjacent to the commerce action at both mobile and desktop widths. This is a placement cleanup only; do not rewrite the checkout model or add a new promise.

- [ ] **Step 5: Run price, product, and navigation tests**

Run: `npx vitest run src/components/shop/shopPrice.test.tsx src/components/shop/alcove/AlcoveTableSection.test.tsx src/lib/publicProductNavigation.test.ts`

Expected: all tests pass.

Run: `npm run lint`

Expected: TypeScript exits 0.

- [ ] **Step 6: Commit commerce fixes**

```bash
git add src/components/shop/shopPrice.test.tsx src/components/shop/AlcoveCard.tsx src/components/shop/alcove/AlcoveCommerceFooter.tsx src/pages/ProductPage.tsx src/App.tsx
git commit -m "fix(shop): keep product pricing and cart access trustworthy"
```

---

### Task 5: Catalogue hygiene audit and public-safe set contents

**Files:**
- Create: `scripts/audit-shop-catalogue.mjs`
- Create: `scripts/audit-shop-catalogue.test.mjs`
- Create: `src/components/shop/setContents.ts`
- Create: `src/components/shop/setContents.test.ts`
- Modify: `src/components/Shop.tsx`
- Modify: `package.json`

- [ ] **Step 1: Write failing scanner tests**

Use Node's built-in test runner. Export `inspectCatalogueProduct(product)` and verify it reports stable codes for: `INVALID_NAME`, `ZERO_PRICE`, `PLACEHOLDER_COPY`, `INCONSISTENT_CASE`, `UNRESOLVED_SET_ITEM`, and `STALE_AGE_COPY`. Verify a valid tea returns an empty array and that findings never contain secret/customer fields. Add a Vitest contract for `resolvePublicSetItems` proving resolved names pass through and missing catalogue items return a neutral `Unavailable item` label rather than the raw internal ID.

- [ ] **Step 2: Run and verify RED**

Run: `node --test scripts/audit-shop-catalogue.test.mjs && npx vitest run src/components/shop/setContents.test.ts`

Expected: FAIL because the scanner and public set resolver do not exist.

- [ ] **Step 3: Implement the read-only scanner**

The module accepts JSON from a file path or stdin, normalizes array/object API envelopes, prints a table of product ID, public name, and finding codes, and exits 2 when findings exist. It performs no network request and no write. Placeholder detection includes the known phrase `comments are going to go`; set resolution only inspects supplied set item names/IDs. Add `"audit:shop-catalogue": "node scripts/audit-shop-catalogue.mjs"` to `package.json`.

Implement `resolvePublicSetItems(set, inventory)` as a pure helper and replace the inline resolver in `Shop.tsx`. Preserve all existing layout and pricing behavior; only substitute `Unavailable item` for unresolved display names so internal IDs never reach the public catalogue.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test scripts/audit-shop-catalogue.test.mjs && npx vitest run src/components/shop/setContents.test.ts`

Expected: all scanner tests pass.

- [ ] **Step 5: Commit the audit tool**

```bash
git add scripts/audit-shop-catalogue.mjs scripts/audit-shop-catalogue.test.mjs src/components/shop/setContents.ts src/components/shop/setContents.test.ts src/components/Shop.tsx package.json
git commit -m "fix(shop): guard public catalogue hygiene"
```

---

### Task 6: Browser regression coverage and full verification

**Files:**
- Modify: `tests/inventory-scroll.spec.ts`
- Modify: `src/components/TeaInventory.tsx` only if the semantic result status from Task 3 needs a stable test identifier

- [ ] **Step 1: Add failing Playwright assertions**

Add a Shop describe block that checks at 390×844 and desktop widths:

```ts
await expect(page.getByRole('button', { name: 'All teas' })).toHaveAttribute('aria-pressed', 'true');
await expect(page.getByRole('button', { name: 'My selection' })).toBeVisible();
await expect(page.getByRole('button', { name: 'Find a tea' })).toBeVisible();
await expect(page.locator('html')).toHaveJSProperty('scrollWidth', await page.locator('html').evaluate(el => el.clientWidth));
```

Switch to Find a tea, choose Light and fragrant, verify All teas becomes active and the floral filter/result state is visible. Where fixture products exist, click a tea and verify `/shop/product/:id` plus the Alcove close control.

- [ ] **Step 2: Run the targeted browser test and verify RED**

Start the isolated server in one terminal:

```bash
VITE_API_URL=http://127.0.0.1:7781 npx vite --host 127.0.0.1 --port 7781
```

Then run the targeted test in another terminal:

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:7781 npx playwright test tests/inventory-scroll.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --reporter=list
```

The spec's existing route fixtures remain the data source. Expected: FAIL before any missing selectors/integration issues are corrected.

- [ ] **Step 3: Make only testability corrections revealed by the browser test**

Prefer accessible names already required by the UI. Add `data-testid` only for the ledger root or result live region when no semantic selector is stable. Do not add visual wrappers or change the inventory height chain.

- [ ] **Step 4: Run full relevant verification**

Run:

```bash
npx vitest run src/components/shop src/lib/publicProductNavigation.test.ts --reporter=dot
node --test scripts/audit-shop-catalogue.test.mjs
npm run lint
npm run lint:colors
npm run build
PLAYWRIGHT_BASE_URL=http://127.0.0.1:7781 npm run test:mobile
PLAYWRIGHT_BASE_URL=http://127.0.0.1:7781 npx playwright test tests/inventory-scroll.spec.ts --project='Desktop Chrome' --project='Mobile Chrome' --reporter=list
```

Expected: every command exits 0. Both browser commands require the isolated server above and must show zero failures.

- [ ] **Step 5: Inspect actual desktop and mobile screenshots**

Capture `/shop` at 1440×1000 and 390×844. Confirm visually: All teas default, slim local tabs, current ledger scale, no large selection cards, no clipping or horizontal overflow, sticky controls do not cover rows, and bottom navigation clearance holds.

- [ ] **Step 6: Commit browser coverage and any final scoped corrections**

```bash
git add tests/inventory-scroll.spec.ts src/components/TeaInventory.tsx
git commit -m "test(shop): cover refined ledger journey"
```

---

## Plan self-review checklist

- Every approved view, visual boundary, filter transition, availability rule, price correction, cart access requirement, and catalogue-hygiene boundary maps to a task above.
- The plan does not authorize production-data mutation; it creates a read-only report only.
- All new behavior starts with a failing test and includes the exact failure reason expected.
- Shared types and canonical IDs are consistent: `TeaShopView`, `TeaFinderIntent`, `isCurated`, `floral`, `grounding`, and `clarifying`.
- Existing top-level navigation, routes, taxonomy, checkout model, and inventory height chain remain unchanged.
