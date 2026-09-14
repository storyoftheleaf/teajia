import { test, expect, type Page } from './fixtures';
import {
  expectNoUnhandledCompassApi,
  installCompassHarness,
  openCompass,
} from './helpers/compassHarness';

test.use({ viewport: { width: 390, height: 844 } });

async function openTeawareCanvas(page: Page) {
  await page.getByRole('tab', { name: 'Teaware', exact: true }).click();
  const canvas = page.locator('[data-curate-source]:visible');
  await expect(canvas).toBeVisible();
  return canvas;
}

test.describe('Curate compact sourcing canvas', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page);
    await openCompass(page);
  });

  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('keeps the order-independent work clusters compact and spatially stable', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const identity = canvas.getByTestId('curate-cluster-identity');
    const buying = canvas.getByTestId('curate-cluster-buying');
    const tasting = canvas.getByTestId('curate-cluster-tasting');

    await expect(identity).toBeVisible();
    await expect(buying).toBeVisible();
    await expect(tasting).toBeVisible();

    const identityBox = await identity.boundingBox();
    const buyingBox = await buying.boundingBox();
    const tastingBox = await tasting.boundingBox();
    expect(identityBox).not.toBeNull();
    expect(buyingBox).not.toBeNull();
    expect(tastingBox).not.toBeNull();
    expect(identityBox!.y).toBeLessThan(buyingBox!.y);
    expect(buyingBox!.y).toBeLessThan(tastingBox!.y);
    expect(tastingBox!.y).toBeLessThan(844);

    await expect(canvas.getByTestId('curate-chinese-type-row')).toBeVisible();
    await expect(canvas.getByTestId('curate-chinese-suggest')).toBeVisible();
    await expect(canvas.getByRole('slider', { name: 'Grams' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('presents one continuous mobile sheet with a bounded empty-state height', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    await expect(canvas).toHaveAttribute('data-visual-layout', 'continuous-sheet');

    const clusters = [
      canvas.getByTestId('curate-cluster-identity'),
      canvas.getByTestId('curate-cluster-buying'),
      canvas.getByTestId('curate-cluster-tasting'),
    ];
    const boxes = await Promise.all(clusters.map((cluster) => cluster.boundingBox()));
    boxes.forEach((box) => expect(box).not.toBeNull());
    expect(Math.max(...boxes.map((box) => Math.round(box!.x))) - Math.min(...boxes.map((box) => Math.round(box!.x)))).toBeLessThanOrEqual(1);
    expect(Math.max(...boxes.map((box) => Math.round(box!.width))) - Math.min(...boxes.map((box) => Math.round(box!.width)))).toBeLessThanOrEqual(1);

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.height).toBeLessThanOrEqual(760);

    const decisionChrome = canvas.getByTestId('curate-decision-control').locator('[data-decision-rail]').first();
    expect((await decisionChrome.boundingBox())!.height).toBeLessThanOrEqual(36);
    const decisionTargets = canvas.getByRole('radio');
    for (const target of await decisionTargets.all()) {
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('keeps every primary field and action in one workflow', async ({ page }) => {
    const workflow = page.getByTestId('curate-primary-workflow').filter({ visible: true });
    await expect(workflow).toBeVisible();
    await expect(workflow.getByPlaceholder('Tea name')).toBeVisible();
    await expect(workflow.getByRole('slider', { name: 'Grams' })).toBeVisible();
    await expect(workflow.getByRole('button', { name: /tasting profile/i })).toBeVisible();
    await expect(workflow.getByRole('textbox', { name: /notes/i })).toBeVisible();
    await expect(workflow.getByTestId('capture-action-footer')).toBeVisible();

    await expect(workflow.getByText('Intent · None detected', { exact: true })).toHaveCount(0);
  });

  test('uses restrained tonal zones instead of redundant object headings', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    await expect(canvas.getByRole('heading', { name: 'Tea', exact: true })).toHaveCount(0);

    const context = canvas.getByTestId('curate-context-band');
    const identity = canvas.getByTestId('curate-cluster-identity');
    const purchase = canvas.getByTestId('curate-cluster-buying');
    const taste = canvas.getByTestId('curate-cluster-tasting');
    const notes = canvas.getByTestId('curate-notes-band');

    await expect(context).toHaveAttribute('data-zone', 'context');
    await expect(identity).toHaveAttribute('data-zone', 'identity');
    await expect(purchase).toHaveAttribute('data-zone', 'purchase');
    await expect(taste).toHaveAttribute('data-zone', 'taste');
    await expect(notes).toHaveAttribute('data-zone', 'notes');
    await expect(purchase.getByText('Purchase', { exact: true })).toBeVisible();
    await expect(taste.getByText('Taste', { exact: true })).toBeVisible();
    await expect(notes.getByText('Notes', { exact: true })).toBeVisible();

    const surfaces = await Promise.all([context, identity, purchase, taste, notes].map((region) =>
      region.evaluate((element) => getComputedStyle(element).backgroundColor),
    ));
    expect(new Set(surfaces).size).toBeGreaterThanOrEqual(3);
  });

  test('lets Notes grow with writing and never creates a nested scrollbar', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const notes = canvas.getByRole('textbox', { name: 'Notes' });
    await expect(notes).toHaveAttribute('placeholder', 'Impressions or vendor story…');

    const initial = await notes.evaluate((element: HTMLTextAreaElement) => ({
      height: element.getBoundingClientRect().height,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(initial.height).toBeGreaterThanOrEqual(44);
    expect(initial.scrollHeight).toBeLessThanOrEqual(initial.clientHeight + 1);
    expect(initial.overflowY).toBe('hidden');

    await notes.fill('First impression\nVendor story and provenance\nA longer final observation that wraps naturally on a phone.');
    const expanded = await notes.evaluate((element: HTMLTextAreaElement) => ({
      height: element.getBoundingClientRect().height,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(expanded.height).toBeGreaterThan(initial.height);
    expect(expanded.scrollHeight).toBeLessThanOrEqual(expanded.clientHeight + 1);
    expect(expanded.overflowY).toBe('hidden');
  });

  test('anchors the capture actions to Taste and keeps the profile row touch-safe', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const taste = canvas.getByTestId('curate-cluster-tasting');
    const profile = taste.getByRole('button', { name: 'Add tasting profile' });
    const footer = taste.getByTestId('capture-action-footer');
    const notes = taste.getByTestId('curate-notes-band');

    expect((await profile.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(footer).toBeVisible();
    await expect(notes).toBeVisible();
    const [footerBox, notesBox] = await Promise.all([footer.boundingBox(), notes.boundingBox()]);
    expect(footerBox).not.toBeNull();
    expect(notesBox).not.toBeNull();
    expect(footerBox!.y).toBeLessThan(notesBox!.y);
  });

  test('communicates decision, measurement, and commit states without relying on color', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const done = canvas.getByRole('button', { name: /Done, commit this entry/ });
    await expect(done).toBeDisabled();
    await expect(done).toHaveAttribute('data-visual-state', 'disabled-neutral');

    await canvas.getByPlaceholder('Tea name').fill('Spring oolong');
    await expect(done).toBeEnabled();
    await expect(done).toHaveAttribute('data-visual-state', 'primary');

    const selectedDecision = canvas.getByRole('radio', { name: 'Considering' });
    await selectedDecision.click();
    await expect(selectedDecision.locator('[data-selected-marker]')).toBeVisible();
    await expect(canvas.getByTestId('gram-current-value')).toHaveCount(0);
  });

  test('fills the complete selected decision segment without inset gaps', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const decision = canvas.getByTestId('curate-decision-control');
    const considering = decision.getByRole('radio', { name: 'Considering' });
    await considering.click();

    const selectedSurface = considering.locator('[data-selected-surface]');
    await expect(selectedSurface).toBeVisible();
    const [controlBox, targetBox, surfaceBox] = await Promise.all([
      decision.boundingBox(),
      considering.boundingBox(),
      selectedSurface.boundingBox(),
    ]);
    expect(controlBox).not.toBeNull();
    expect(targetBox).not.toBeNull();
    expect(surfaceBox).not.toBeNull();
    expect(Math.abs(surfaceBox!.x - targetBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(surfaceBox!.y - targetBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(surfaceBox!.width - targetBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(surfaceBox!.height - targetBox!.height)).toBeLessThanOrEqual(1);
    expect(targetBox!.y - controlBox!.y).toBeLessThanOrEqual(1);
    expect(controlBox!.y + controlBox!.height - (targetBox!.y + targetBox!.height)).toBeLessThanOrEqual(1);
  });

  test('uses compact painted controls without shrinking touch targets', async ({ page }) => {
    const paintedControls = page.locator('[data-curate-compact-chrome]:visible');
    expect(await paintedControls.count()).toBeGreaterThan(5);
    const heights = await paintedControls.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().height)),
    );
    expect(Math.max(...heights)).toBeLessThanOrEqual(36);

    const touchTargets = page.locator('[data-curate-compact-target]:visible');
    expect(await touchTargets.count()).toBeGreaterThan(5);
    const targetHeights = await touchTargets.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().height)),
    );
    expect(Math.min(...targetHeights)).toBeGreaterThanOrEqual(44);
  });

  test('balances Type with Year and keeps actions inside their visual clusters', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const year = canvas.getByTestId('curate-year-control');
    const type = canvas.getByTestId('curate-type-control');
    const decision = canvas.getByTestId('curate-decision-control');
    const buying = canvas.getByTestId('curate-cluster-buying');
    const tasting = canvas.getByTestId('curate-cluster-tasting');

    const yearBox = await year.boundingBox();
    const typeBox = await type.boundingBox();
    expect(yearBox).not.toBeNull();
    expect(typeBox).not.toBeNull();
    expect(Math.round(typeBox!.width)).toBe(Math.round(yearBox!.width));
    expect(Math.round(typeBox!.height)).toBe(Math.round(yearBox!.height));
    expect(await year.evaluate((element) => getComputedStyle(element).borderRadius))
      .toBe(await type.evaluate((element) => getComputedStyle(element).borderRadius));

    await expect(decision).toHaveAttribute('data-visual-control', 'segmented');
    await expect(decision.locator('[aria-checked="false"]')).toHaveCount(3);
    await expect(buying.getByTestId('capture-action-footer')).toHaveCount(0);
    await expect(tasting.getByTestId('capture-action-footer')).toBeVisible();
  });

  test('reserves a stable photo position before and after capture', async ({ page }) => {
    const canvas = page.locator('[data-curate-source]:visible');
    const photoSlot = canvas.getByTestId('curate-photo-slot');
    const emptyBox = await photoSlot.boundingBox();
    expect(emptyBox).not.toBeNull();
    await expect(photoSlot.getByRole('button', { name: 'Add photo' })).toBeVisible();

    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, {
        photos: ['data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='],
      });
    });

    await expect(photoSlot.getByRole('button', { name: 'Photo actions' })).toBeVisible();
    await expect(photoSlot.getByRole('button', { name: 'Add another photo' })).toBeVisible();
    const filledBox = await photoSlot.boundingBox();
    expect(filledBox).not.toBeNull();
    expect(Math.round(filledBox!.width)).toBe(Math.round(emptyBox!.width));
    expect(Math.round(filledBox!.height)).toBe(Math.round(emptyBox!.height));
  });

  test('gives Teaware the same decision and continuous workflow contract as Tea', async ({ page }) => {
    const canvas = await openTeawareCanvas(page);

    await expect(canvas).toHaveAttribute('data-visual-layout', 'continuous-sheet');
    const workflow = canvas.getByTestId('curate-primary-workflow');
    await expect(workflow).toBeVisible();

    const decision = workflow.getByTestId('curate-decision-control');
    await expect(decision).toHaveAttribute('data-visual-control', 'segmented');
    await expect(decision.getByRole('radio', { name: 'Considering' })).toBeVisible();
    await expect(decision.getByRole('radio', { name: 'Selected' })).toBeVisible();
    await expect(decision.getByRole('radio', { name: 'Passed on' })).toBeVisible();
  });

  test('keeps Journey, Scan, and Photo in one compact Teaware context band', async ({ page }) => {
    const canvas = await openTeawareCanvas(page);
    const context = canvas.getByTestId('curate-teaware-context-band');
    await expect(context).toBeVisible();

    const journey = context.getByRole('button', { name: 'Add journey or visit context' });
    const scan = context.getByRole('button', { name: 'Scan label' });
    const photo = context.getByRole('button', { name: 'Add photo' });
    await expect(journey).toBeVisible();
    await expect(scan).toBeVisible();
    await expect(photo).toBeVisible();
    const [journeyBox, scanBox, photoBox] = await Promise.all([
      journey.boundingBox(),
      scan.boundingBox(),
      photo.boundingBox(),
    ]);
    expect(journeyBox).not.toBeNull();
    expect(scanBox).not.toBeNull();
    expect(photoBox).not.toBeNull();
    expect(Math.abs(journeyBox!.y - scanBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(scanBox!.y - photoBox!.y)).toBeLessThanOrEqual(1);
  });

  test('uses one concise Teaware identity heading and two aligned metadata rows', async ({ page }) => {
    const canvas = await openTeawareCanvas(page);

    await expect(canvas.getByRole('heading', { name: 'Teaware', exact: true })).toHaveCount(1);
    await expect(canvas.getByPlaceholder('Teaware name', { exact: true })).toBeVisible();
    await expect(canvas.getByPlaceholder(/Teaware name \(e\.g\./)).toHaveCount(0);

    const classification = canvas.getByTestId('curate-teaware-classification-row');
    const category = classification.getByRole('button', { name: /category/i });
    const material = classification.getByRole('button', { name: /material/i });
    await expect(category).toBeVisible();
    await expect(material).toBeVisible();
    const [categoryBox, materialBox] = await Promise.all([category.boundingBox(), material.boundingBox()]);
    expect(categoryBox).not.toBeNull();
    expect(materialBox).not.toBeNull();
    expect(Math.abs(categoryBox!.y - materialBox!.y)).toBeLessThanOrEqual(1);

    const provenance = canvas.getByTestId('curate-teaware-provenance-row');
    const origin = provenance.getByRole('textbox', { name: /origin/i });
    const era = provenance.getByRole('button', { name: /era/i });
    const [originBox, eraBox] = await Promise.all([origin.boundingBox(), era.boundingBox()]);
    expect(originBox).not.toBeNull();
    expect(eraBox).not.toBeNull();
    expect(Math.abs(originBox!.y - eraBox!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(originBox!.height - eraBox!.height)).toBeLessThanOrEqual(1);
  });

  test('exposes complete dialog semantics on every Teaware selector', async ({ page }) => {
    const canvas = await openTeawareCanvas(page);

    for (const selector of [
      canvas.getByRole('button', { name: /category/i }),
      canvas.getByRole('button', { name: /material/i }),
      canvas.getByRole('button', { name: /era/i }),
    ]) {
      await expect(selector).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(selector).toHaveAttribute('aria-expanded', 'false');
      await expect(selector).toHaveAttribute('aria-controls', /.+/);
    }
  });

  test('shows a touch-safe Capacity field when the Teaware category is a vessel', async ({ page }) => {
    const canvas = await openTeawareCanvas(page);

    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, { teawareCategory: 'Pot' });
    });

    const capacity = canvas.getByRole('spinbutton', { name: 'Capacity (ml)' });
    await expect(capacity).toBeVisible();
    expect((await capacity.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(parseFloat(await capacity.evaluate((element) => getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
  });

  test('keeps the empty Teaware notes field compact', async ({ page }) => {
    const canvas = await openTeawareCanvas(page);
    const notes = canvas.getByRole('textbox', { name: 'Notes' });
    const notesBox = await notes.boundingBox();
    expect(notesBox).not.toBeNull();
    expect(notesBox!.height).toBeLessThanOrEqual(64);
  });

  test('uses a two-action Buy and Done footer for Teaware without Sample', async ({ page }) => {
    const canvas = await openTeawareCanvas(page);
    const footer = canvas.getByTestId('capture-action-footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Buy', exact: true })).toBeVisible();
    await expect(footer.getByRole('button', { name: /Done, commit this entry/ })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Sample', exact: true })).toHaveCount(0);
    await expect(footer.locator(':scope > button')).toHaveCount(2);
  });

  test('keeps Teaware parity intact on the desktop canvas', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const canvas = await openTeawareCanvas(page);
    const canvasRegion = page.getByTestId('curate-desktop-canvas');

    await expect(canvasRegion.getByTestId('curate-decision-control')).toBeVisible();
    const footer = canvasRegion.getByTestId('capture-action-footer').filter({ visible: true });
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Buy', exact: true })).toBeVisible();
    await expect(footer.getByRole('button', { name: /Done, commit this entry/ })).toBeVisible();
    await expect(footer.getByRole('button', { name: 'Sample', exact: true })).toHaveCount(0);

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeLessThanOrEqual(768);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  });

  test('keeps the same visual system balanced on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const canvas = page.locator('[data-curate-source]:visible');
    await expect(canvas).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeLessThanOrEqual(768);
    await expect(canvas.getByTestId('curate-decision-control')).toBeVisible();
    await expect(canvas.getByTestId('curate-cluster-identity')).toBeVisible();
    await expect(canvas.getByTestId('curate-cluster-buying')).toBeVisible();
    await expect(canvas.getByTestId('curate-cluster-tasting')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  });

  test('uses desktop width for a working run rail and canvas-attached actions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const canvasRegion = page.getByTestId('curate-desktop-canvas');
    const runRail = page.getByTestId('curate-run-rail');
    await expect(canvasRegion).toBeVisible();
    await expect(runRail).toBeVisible();
    await expect(runRail.getByTestId('curate-active-draft')).toBeVisible();
    await expect(canvasRegion.getByTestId('capture-action-footer').filter({ visible: true })).toBeVisible();

    await page.evaluate(async () => {
      // @ts-expect-error Vite exposes source modules to the browser during Playwright runs.
      const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
      const state = useTeaCompassStore.getState();
      state.updateEntry(state.activeEntryId!, { name: 'First draft' });
      state.startNewCapture('tea');
    });
    const otherDraft = runRail.getByRole('button', { name: 'First draft', exact: true });
    const discard = runRail.getByRole('button', { name: 'Discard First draft' });
    await expect(otherDraft).toBeVisible();
    await expect(discard).toBeVisible();
    expect((await otherDraft.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect((await discard.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });

});
