# Curate Compact Sourcing Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose Curate Source into a compact, order-independent phone workbench with Buying above Tasting, stable visual clusters, embedded Chinese-name Suggest, and Type beside Chinese Name.

**Architecture:** Keep the existing TeaCompass state, persistence, overlays, and actions intact. Change only presentation structure and reusable Curate styles, using DOM landmarks for regression tests and responsive CSS/Tailwind layout at phone, tablet, and desktop breakpoints.

**Tech Stack:** React 19, TypeScript, Tailwind v3, Playwright, existing TeaCompass Zustand store.

---

### Task 1: Add mobile composition regression coverage

**Files:**
- Create: `tests/curate-compact-canvas.spec.ts`
- Reuse: `tests/helpers/compassHarness.ts`

- [ ] **Step 1: Write the failing mobile test**

```ts
import { test, expect } from '@playwright/test';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.use({ viewport: { width: 390, height: 844 } });

test('keeps the order-independent sourcing canvas compact and spatially stable', async ({ page }) => {
  await installCompassHarness(page);
  await openCompass(page);
  const identity = page.getByTestId('curate-cluster-identity');
  const buying = page.getByTestId('curate-cluster-buying');
  const tasting = page.getByTestId('curate-cluster-tasting');
  await expect(identity).toBeVisible();
  await expect(buying).toBeVisible();
  await expect(tasting).toBeVisible();
  const positions = await Promise.all([identity, buying, tasting].map(async locator => (await locator.boundingBox())!.y));
  expect(positions[0]).toBeLessThan(positions[1]);
  expect(positions[1]).toBeLessThan(positions[2]);
  expect(positions[2]).toBeLessThan(844);
  await expect(page.getByTestId('curate-chinese-type-row')).toBeVisible();
  await expect(page.getByTestId('curate-chinese-suggest')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Grams' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx playwright test tests/curate-compact-canvas.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: FAIL because the new cluster landmarks and compact placement do not exist.

### Task 2: Compact the header and visible control chrome

**Files:**
- Modify: `src/components/TeaCompass/index.tsx`
- Modify: `src/components/TeaCompass/DecisionControl.tsx`
- Modify: `src/components/TeaCompass/CaptureContextChips.tsx`
- Modify: `src/components/TeaCompass/EncounterContext.tsx`
- Modify: `src/components/TeaCompass/PhotoCapture.tsx`
- Modify: `src/styles/card-utilities.css`

- [ ] **Step 1: Add reusable compact action chrome**

Create a Curate utility whose outer button remains a 44px target while an inner `.curate-action-chrome` carries a 32–36px painted control. Reduce `.curate-action` typography to the established 14px UI role while keeping editable controls 16px.

- [ ] **Step 2: Recompose navigation and context**

Use quiet text tabs with an active underline, reduce the two header bands, make Decision one compact line, and arrange context/evidence as two disciplined rows. Preserve every handler, ARIA role, label, and route.

- [ ] **Step 3: Run the focused test**

Run: `npx playwright test tests/curate-compact-canvas.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: still FAIL only on the missing/reordered content clusters.

### Task 3: Recompose identity, buying, and tasting clusters

**Files:**
- Modify: `src/components/TeaCompass/CaptureCard.tsx`
- Modify: `src/components/TeaCompass/PricingRow.tsx`
- Modify: `src/styles/card-utilities.css`

- [ ] **Step 1: Build the stable cluster order**

Add `data-testid` landmarks and render the tea layout in this order: Context, Identity, Buying, Tasting, conditional Storage, purchase proposal. Keep existing state updates and overlays unchanged.

- [ ] **Step 2: Move Type and embed Suggest**

Place the Type trigger to the right of the Chinese-name field. Render Suggest as an absolutely positioned trailing icon button inside the Chinese-name control shell, with `aria-label="Suggest Chinese name"`, focus treatment, disabled state, and a 44px hit target.

- [ ] **Step 3: Preserve the form-aware gram slider**

Keep `PricingRow` and its existing `DEFAULT_GRAMS`/form behavior. Tighten its painted rows and spacing without replacing the slider with manual gram entry.

- [ ] **Step 4: Verify GREEN**

Run: `npx playwright test tests/curate-compact-canvas.spec.ts --project='Mobile Chrome' --reporter=list`

Expected: PASS.

### Task 4: Responsive and visual verification

**Files:**
- Modify as needed: `src/components/TeaCompass/CaptureCard.tsx`
- Modify as needed: `src/styles/card-utilities.css`

- [ ] **Step 1: Verify tablet and desktop composition**

At `md`, use an asymmetric two-column cluster composition where it shortens travel without changing field order. At `lg`, preserve the existing rail/detail behavior and cap the working width.

- [ ] **Step 2: Run required checks**

Run:

```bash
npm run lint
npm run lint:colors
npm run build
npx playwright test tests/curate-compact-canvas.spec.ts tests/compass-library.spec.ts tests/compass-samples-parity.spec.ts --project='Mobile Chrome' --reporter=list
```

Expected: all commands exit 0 with no horizontal overflow or unhandled Compass API calls.

- [ ] **Step 3: Inspect live screenshots**

Capture 390×844 and 1280px screenshots. Confirm that Buying precedes Tasting, Profile is reachable near the first viewport, section boundaries remain recognizable without label repetition, and no action/footer is obscured by mobile navigation.

