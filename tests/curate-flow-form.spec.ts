/** The default Source form ('flow'): what the owner asked of it, held on a phone.
 *  He captures a tea standing in a shop, so the decision must be on the first
 *  screen once a price is typed, and Buy and Sample must answer where he tapped. */
import { test, expect } from './fixtures';
import { expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

test.describe('Curate Source form, default layout', () => {
  test.beforeEach(async ({ page }) => {
    await installCompassHarness(page);
    await page.setViewportSize({ width: 390, height: 844 });
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  const fill = async (page: import('@playwright/test').Page) => {
    await openCompass(page);
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Dahongpao Reserve');
    await page.getByPlaceholder('Price').filter({ visible: true }).fill('420');
    await page.getByPlaceholder('Grams').filter({ visible: true }).fill('250');
  };
  const button = (page: import('@playwright/test').Page, name: string) =>
    page.getByRole('button', { name, exact: true }).filter({ visible: true }).first();

  // Considering, Selected and Passed on are one radio group.
  const status = (page: import('@playwright/test').Page, name: string) =>
    page.getByRole('radio', { name, exact: true }).filter({ visible: true }).first();

  test('with a price typed, capture and the decision are on the first screen', async ({ page }) => {
    await fill(page);
    for (const name of ['Considering', 'Selected', 'Passed on']) {
      await expect(status(page, name)).toBeInViewport({ ratio: 1 });
    }
    for (const name of ['Buy', 'Sample']) {
      await expect(button(page, name)).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByRole('button', { name: /^Done/ }).filter({ visible: true }).first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: /photo/i }).filter({ visible: true }).first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: /^Taste/ }).filter({ visible: true }).first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByPlaceholder('Impressions or vendor story…').filter({ visible: true })).toBeInViewport({ ratio: 1 });
  });

  test('the decision comes after the tea and its notes box, with Done last', async ({ page }) => {
    await fill(page);
    const y = async (locator: import('@playwright/test').Locator) => (await locator.boundingBox())!.y;
    const x = async (locator: import('@playwright/test').Locator) => (await locator.boundingBox())!.x;
    const name = await y(page.getByPlaceholder('Tea name').filter({ visible: true }));
    const notes = await y(page.getByPlaceholder('Impressions or vendor story…').filter({ visible: true }));
    const decision = await y(status(page, 'Considering'));
    const buy = button(page, 'Buy');
    const done = page.getByRole('button', { name: /^Done/ }).filter({ visible: true }).first();
    expect(name).toBeLessThan(notes);
    expect(notes).toBeLessThan(decision);
    expect(decision).toBeLessThan(await y(buy));
    expect(await x(buy)).toBeLessThan(await x(button(page, 'Sample')));
    expect(await x(button(page, 'Sample'))).toBeLessThan(await x(done));
  });

  test('Buy answers where it was tapped', async ({ page }) => {
    await fill(page);
    await button(page, 'Buy').click();
    await expect(page.getByLabel('Purchase quantity').filter({ visible: true })).toBeInViewport();
  });

  test('Sample opens the same panel set to the smallest amount', async ({ page }) => {
    await fill(page);
    await button(page, 'Sample').click();
    const quantity = page.getByLabel('Purchase quantity').filter({ visible: true });
    await expect(quantity).toBeInViewport();
    await expect(quantity).toHaveValue('50');
    await expect(page.getByLabel('Inventory purpose').filter({ visible: true })).toHaveValue('sample');
  });

  test('the where header is one row, and Share sits on the details row', async ({ page }) => {
    await openCompass(page);
    const header = page.getByTestId('curate-supplier-header').filter({ visible: true }).first();
    const parts = [
      header.getByRole('button', { name: /^Vendor/ }),
      header.getByRole('button', { name: /run/i }),
      header.getByRole('button', { name: /journey or visit/i }),
      header.getByRole('button', { name: 'Start a new entry', exact: true }),
    ];
    const middles: number[] = [];
    for (const part of parts) {
      const box = (await part.first().boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      middles.push(box.y + box.height / 2);
    }
    expect(Math.max(...middles) - Math.min(...middles)).toBeLessThanOrEqual(4);
    await expect(header.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0);
    const share = page.getByTestId('curate-details-row').filter({ visible: true }).getByRole('button', { name: 'Share', exact: true });
    await expect(share).toBeVisible();
  });

  test('a Library photo opens the photo viewer, with a control to add another', async ({ page }) => {
    const now = new Date().toISOString();
    await page.route('https://img.test/**', (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#8a6d4b"/></svg>' }));
    await installCompassHarness(page, { compassEntries: [{
      id: 'photo-tea', category: 'tea', status: 'noted', name: 'Yiwu Gushu Spring', type: 'Sheng', year: '2021', vendor_name: 'Huang Wei',
      notes: '', photos: JSON.stringify(['https://img.test/one.svg', 'https://img.test/two.svg']), audio_clips: '[]', created_at: now, updated_at: now,
    }] });
    await page.goto('/admin/compass?tab=library', { waitUntil: 'domcontentloaded' });
    const card = page.getByTestId('library-entry-photo-tea').filter({ visible: true }).first();
    await expect(card.getByTestId('library-photo-thumb')).toContainText('2', { timeout: 15_000 });
    await card.getByRole('button', { name: /^Photos for/ }).click();
    const viewer = page.getByRole('dialog', { name: 'Photo viewer' });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Add another photo' })).toBeVisible();
    await expect(viewer.getByRole('button', { name: 'Next photo' })).toBeVisible();
  });

  test('the earlier form is still there at its own address', async ({ page }) => {
    await openCompass(page, 'classic');
    await expect(page.getByRole('button', { name: 'Add tasting profile', exact: true })).toBeVisible();
  });
});
