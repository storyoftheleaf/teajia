# Inventory Three-Row Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the narrow inventory header into three visible rows while keeping every current control and making only the table column row sticky.

**Architecture:** `AdminApp.tsx` continues to own the first global/operational row and passes the required action state into `InventoryView`. `InventoryView.tsx` renders the purpose/attention row directly above its scroll container, while its existing table `thead` remains the sole sticky row. Existing handlers and menus are moved, not rewritten.

**Tech Stack:** React 19, TypeScript, Tailwind v3 semantic tokens, Zustand, React Router, Playwright.

---

### Task 1: Add the three-row regression contract

**Files:**
- Modify: `tests/inventory-scroll.spec.ts`

- [ ] **Step 1: Write a failing narrow-layout test**

Add a test that opens `/admin/stock`, waits for the mocked inventory, and asserts the presence of exactly these test IDs: `inventory-primary-row`, `inventory-purpose-row`, and `inventory-column-row`. Assert that Search, Incoming, Retail, Group, Sort, Bali, USD, Purpose, All, Working, Samples, Personal, and Needs attention are visible. Scroll the inventory table and compare bounding boxes: the column row remains at the top of its scroll box while the first two rows do not use `position: sticky`.

Use computed style for the sticky contract:

```ts
for (const id of ['inventory-primary-row', 'inventory-purpose-row']) {
  await expect(page.getByTestId(id)).toBeVisible();
  expect(await page.getByTestId(id).evaluate(el => getComputedStyle(el).position)).not.toBe('sticky');
}
expect(await page.getByTestId('inventory-column-row').evaluate(el => getComputedStyle(el).position)).toBe('sticky');
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npm run test:mobile -- --grep "three-row inventory header"`

Expected: FAIL because the three test IDs and consolidated composition do not exist.

- [ ] **Step 3: Keep the failing test for Tasks 2 and 3**

Do not weaken visibility assertions or replace them with DOM-presence checks.

### Task 2: Build row one in the admin inventory header

**Files:**
- Modify: `src/admin/AdminApp.tsx:360-430`
- Modify: `src/admin/AdminApp.tsx:550-670`
- Modify: `src/admin/AdminApp.tsx:740-765`
- Modify: `src/admin/components/InventoryView.tsx:65-105`

- [ ] **Step 1: Add the narrow search expansion state**

Add `inventorySearchExpanded` state in `AdminContent`. Search is a visible button in the normal row. Clicking it expands the existing input inside the same row and focuses it. Escape or the close button collapses it and returns focus without clearing a submitted query.

- [ ] **Step 2: Move operational triggers into row one**

Expose callbacks/state from `InventoryView` only where required, preferring a small typed control contract over duplicating business logic. Row one must render, in order where space permits:

```text
Tea | Wares | Search | Incoming | Retail/Cost | Group | Sort | MapPin Bali | USD | More
```

Use `data-testid="inventory-primary-row"`. Keep labels visible. Preserve existing menus, `aria-expanded`, `aria-pressed`, and direct Incoming navigation. Replace the account-name badge with `<MapPin /> Bali`, deriving `Bali` from the active account name by removing the `Teajia ` prefix; fall back to the full account name when it does not use that prefix.

- [ ] **Step 3: Preserve the height chain and narrow width**

The row remains `flex-none`, does not become sticky, and does not add a wrapper between `AdminContent`, `main`, routes, `PageTransition`, and `InventoryView`. Use compact gaps and `tap-target`; do not add horizontal page scrolling.

- [ ] **Step 4: Run TypeScript and color checks**

Run: `npm run lint && npm run lint:colors`

Expected: both exit 0.

### Task 3: Consolidate purpose and attention into row two

**Files:**
- Modify: `src/admin/components/InventoryView.tsx:1640-1990`
- Modify: `src/admin/components/InventoryView.tsx:2410-2435`
- Modify: `src/admin/components/InventoryView.tsx:2740-2760`
- Modify: `src/admin/components/InventoryView.tsx:2850-2870`

- [ ] **Step 1: Remove detached mobile bands after moving their triggers**

Replace the current separate Incoming band, Purpose block, Needs attention block, and Retail/Group/Sort band with one non-sticky purpose row. Do not delete handlers, menus, state, saved views, or query behavior.

- [ ] **Step 2: Render the complete purpose row**

Add `data-testid="inventory-purpose-row"` and render:

```text
Purpose | All | Working | Samples | Personal | Needs attention +
```

Use compact text tabs. All four purpose choices remain visible and labeled. Needs attention remains a visible labeled trigger for the existing attention views. Active state uses semantic color plus underline/background and `aria-pressed`; it must not rely on color alone.

- [ ] **Step 3: Integrate transient vendor and batch context**

Render vendor or batch context as compact removable inline state within row one or row two. Do not restore either standalone banner. Preserve the current clear behavior and result count.

- [ ] **Step 4: Mark the sticky column row**

Add `data-testid="inventory-column-row"` to the active table `thead` in grouped and ungrouped render paths. Keep `sticky top-0`, column sorting, horizontal alignment, and the mobile pinned Product column unchanged.

- [ ] **Step 5: Make the mobile table height independent of removed toolbar estimates**

Replace the fragile `maxHeight: calc(100dvh - 100px)` assumption with a value derived from the actual enclosing flex/scroll layout, or remove it if the existing `flex-1 overflow-auto` container correctly bounds the table. Do not use `h-dvh` on the inventory scroll container.

- [ ] **Step 6: Run the focused header and scroll tests**

Run: `npm run test:mobile -- --grep "three-row inventory header|scroll container has height"`

Expected: PASS on Mobile Chrome and Desktop Chrome configurations.

### Task 4: Full verification and visual inspection

**Files:**
- Modify only if verification exposes a defect in the files above.

- [ ] **Step 1: Run static verification**

Run: `npm run lint && npm run lint:colors && npm run build`

Expected: all commands exit 0.

- [ ] **Step 2: Run required mobile suite**

Start the reserved dev server on port 7777 if it is not already running, then run `npm run test:mobile`.

Expected: all Playwright tests pass with no console errors, horizontal overflow, or collapsed inventory scroll container.

- [ ] **Step 3: Inspect the 390 by 844 screenshot**

Confirm the initial screen contains three header rows, all named controls are readable, the first product data appears substantially higher than before, and only the column row remains visible after vertical scrolling.

- [ ] **Step 4: Review the diff against the design spec**

Confirm no navigation label/route changes, no hidden controls, no new overflow menus for required controls, no legacy color tokens, and no height-chain wrappers.
