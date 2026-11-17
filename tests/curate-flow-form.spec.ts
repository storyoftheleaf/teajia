/** The default Source form ('flow'): what the owner asked of it, held on a phone.
 *  He captures a tea standing in a shop, so the decision must be on the first
 *  screen once a price is typed, and order and receipt actions open in context. */
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

  test('an unmatched tea name leaves the type control tappable', async ({ page }) => {
    await openCompass(page);
    await page.getByPlaceholder('Tea name').filter({ visible: true }).fill('Fixture New Tea 7029');
    const type = page.getByTestId('curate-type-control').filter({ visible: true });
    await type.click();
    await button(page, 'Oolong').click();
    await expect(type).toHaveText('Oolong');
  });

  test('with a price typed, capture and the decision are on the first screen', async ({ page }) => {
    await fill(page);
    for (const name of ['Considering', 'Selected', 'Passed on']) {
      await expect(status(page, name)).toBeInViewport({ ratio: 1 });
    }
    for (const name of ['Draft supplier order', 'Record received sample']) {
      await expect(button(page, name)).toBeInViewport({ ratio: 1 });
    }
    await expect(page.getByRole('button', { name: 'Save tea', exact: true }).filter({ visible: true }).first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: /photo/i }).filter({ visible: true }).first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: /^Taste/ }).filter({ visible: true }).first()).toBeInViewport({ ratio: 1 });
    await expect(page.getByPlaceholder('Impressions or vendor story…').filter({ visible: true })).toBeInViewport({ ratio: 1 });
  });

  test('the decision comes after the tea and its notes box, with Save tea last', async ({ page }) => {
    await fill(page);
    const y = async (locator: import('@playwright/test').Locator) => (await locator.boundingBox())!.y;
    const x = async (locator: import('@playwright/test').Locator) => (await locator.boundingBox())!.x;
    const name = await y(page.getByPlaceholder('Tea name').filter({ visible: true }));
    const notes = await y(page.getByPlaceholder('Impressions or vendor story…').filter({ visible: true }));
    const decision = await y(status(page, 'Considering'));
    const buy = button(page, 'Draft supplier order');
    const done = page.getByRole('button', { name: 'Save tea', exact: true }).filter({ visible: true }).first();
    expect(name).toBeLessThan(notes);
    expect(notes).toBeLessThan(decision);
    expect(decision).toBeLessThan(await y(buy));
    expect(await x(buy)).toBeLessThan(await x(button(page, 'Record received sample')));
    expect(await x(button(page, 'Record received sample'))).toBeLessThan(await x(done));
  });

  test('saving a tasting keeps the decision in place and the rating editable', async ({ page }) => {
    await fill(page);
    const decision = page.getByTestId('curate-cluster-decide').filter({ visible: true });
    const before = (await decision.boundingBox())!.y;

    await page.getByTestId('curate-taste-button').filter({ visible: true }).click();
    await page.getByRole('button', { name: 'Open your impression', exact: true }).click();
    await page.getByRole('button', { name: 'Love', exact: true }).click();
    await page.getByRole('button', { name: /^(Leave tasting|Close)$/ }).click();
    await page.getByRole('button', { name: 'Save and close', exact: true }).click();

    const rating = page.getByRole('radiogroup', { name: 'Quality rating' });
    await expect(rating).toBeVisible();
    expect((await decision.boundingBox())!.y).toBeCloseTo(before, 0);
    expect((await rating.boundingBox())!.y).toBeGreaterThan((await decision.boundingBox())!.y);
    const nine = rating.getByRole('radio', { name: '9', exact: true });
    await nine.click();
    await expect(nine).toHaveAttribute('aria-checked', 'true');
  });

  test('desktop keeps one compact tasting summary and edits its rating in the tasting screen', async ({ page }, info) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await fill(page);
    await page.getByTestId('curate-taste-button').filter({ visible: true }).click();
    await button(page, 'Open your impression').click();
    await button(page, 'Love').click();
    await button(page, 'Rate 8 out of 10').click();
    await page.getByRole('button', { name: /^(Leave tasting|Close)$/ }).filter({ visible: true }).click();
    await button(page, 'Save and close').click();

    const summary = page.getByTestId('curate-taste-button').filter({ visible: true });
    await expect(summary.getByText('Tasting · 8/10', { exact: true })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Quality rating' }).filter({ visible: true })).toHaveCount(0);
    await expect(button(page, 'Save tea')).toBeInViewport();
    await button(page, 'Choose preset weight').click();
    await page.getByRole('dialog', { name: 'Quoted weight' }).getByRole('button', { name: '300 g', exact: true }).click();
    await expect(page.getByLabel('Grams', { exact: true }).filter({ visible: true })).toHaveValue('300');
    await expect(page.getByRole('dialog', { name: 'Quoted weight' })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('desktop-source.png') });
  });

  test('Draft supplier order answers where it was tapped', async ({ page }) => {
    await fill(page);
    await button(page, 'Draft supplier order').click();
    await expect(page.getByLabel('Purchase quantity').filter({ visible: true })).toBeInViewport();
  });

  test('Record sample asks for the measured amount without a purchase form', async ({ page }) => {
    await fill(page);
    await button(page, 'Record received sample').click();
    const quantity = page.getByLabel('Received quantity').filter({ visible: true });
    await expect(quantity).toBeInViewport();
    await expect(quantity).toHaveValue('');
    await expect(page.getByLabel('Inventory purpose').filter({ visible: true })).toHaveCount(0);
  });

  test('adding a photo saves it independently of optional label scanning', async ({ page }) => {
    let scans = 0;
    await page.route('**/api/extract-from-image', async route => {
      scans++;
      await route.fulfill({ status: 503, json: { error: 'no_ai_provider' } });
    });
    await openCompass(page);
    const upload = { name: 'tea-label.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#8a6d4b"/></svg>') };
    const photo = page.waitForEvent('filechooser');
    await button(page, 'Add photo').click();
    await (await photo).setFiles(upload);
    await expect(page.getByText('1 photo saved', { exact: true }).filter({ visible: true })).toBeVisible();
    expect(scans).toBe(0);

    await button(page, 'Scan label').click();
    const labelPhoto = page.waitForEvent('filechooser');
    await button(page, 'Choose label photo').click();
    await (await labelPhoto).setFiles(upload);
    await expect(page.getByText('Label scan unavailable', { exact: true }).filter({ visible: true })).toBeVisible();
    expect(scans).toBe(1);
    await expect(page.getByText('2 photos saved', { exact: true }).filter({ visible: true })).toBeVisible();
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
    const nav = page.getByTestId('bottom-tab-bar');
    await expect(nav).toBeHidden();
    await viewer.getByRole('button', { name: 'Close photo viewer' }).click();
    if ((page.viewportSize()?.width ?? 0) < 1024) await expect(nav).toBeVisible();
  });

  test('the earlier form is still there at its own address', async ({ page }) => {
    await openCompass(page, 'classic');
    await expect(page.getByRole('button', { name: 'Add tasting profile', exact: true })).toBeVisible();
  });
});
