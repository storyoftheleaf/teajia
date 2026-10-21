import { test, expect, type Page } from './fixtures';
import { compassCreatedProducts, expectNoUnhandledCompassApi, installCompassHarness, openCompass } from './helpers/compassHarness';

const entryId = 'workspace-source-record';
const photo = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="120" height="120"%3E%3Crect width="120" height="120" fill="%23728b63"/%3E%3C/svg%3E';
const sourceEntry = {
  id: entryId, name: 'Cloud Peak', chinese_name: '云峰', category: 'tea', type: 'Sheng', form: 'Loose',
  year: 2024, origin_region: 'Yunnan', vendor_name: 'Chen Family', status: 'noted',
  notes: 'Source notebook: smoky apricot and a long finish.', description: 'A spring tea from a mountain garden.',
  photos: JSON.stringify([photo]), audio_clips: '[]', price_amount: 70, price_currency: 'Yuan', price_per_unit_grams: 100,
  created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z',
};
const unfinishedImport = { batch: { id: 'unfinished-source', title: 'Chen unfinished invoice', review_state: 'pending', state: 'review', created_at: '2026-10-01T00:00:00.000Z' }, sources: [], vendor_groups: [], items: [] };
const visible = (page: Page, testId: string) => page.getByTestId(testId).filter({ visible: true });
const row = (page: Page) => visible(page, `library-entry-${entryId}`);
const record = (page: Page) => visible(page, 'library-entry-detail');

async function openRecordSection(page: Page, name: string) {
  const section = record(page).locator(`details[data-record-section="${name}"]`);
  if (!(await section.evaluate(element => (element as HTMLDetailsElement).open))) await section.locator(':scope > summary').click();
  return section;
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function openLibrary(page: Page) {
  await openCompass(page);
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await expect(row(page)).toBeVisible();
}
async function sourceState(page: Page) {
  return page.evaluate(async id => {
    // @ts-expect-error Vite browser fixture source import.
    const { useTeaCompassStore } = await import('/src/lib/teaCompassStore.ts');
    return useTeaCompassStore.getState().entries.find((entry: any) => entry.id === id);
  }, entryId);
}

test.describe('Library workspace handoffs', () => {
  test.beforeEach(async ({ page }, info) => {
    if (info.project.name.includes('Mobile')) await page.setViewportSize({ width: 393, height: 851 });
    await installCompassHarness(page, { compassEntries: [{ ...sourceEntry, decision: 'selected' }, { ...sourceEntry, id: 'workspace-white', name: 'Silver Needle', type: 'White', origin_region: 'Fuding' }, { ...sourceEntry, id: 'workspace-oolong', name: 'Mountain Oolong', type: 'Oolong', origin_region: 'Alishan' }], purchaseOrders: [{ id: 'workspace-white-order', vendor_name: 'Chen Family', status: 'ordered', display_currency: 'Yuan', items_json: JSON.stringify([{ compass_entry_id: 'workspace-white', name: 'Silver Needle', quantity: 500, priceIsPerGram: true, pricePerUnit: 0.7, currency: 'Yuan' }]) }, { id: 'workspace-oolong-order', vendor_name: 'Chen Family', status: 'ordered', display_currency: 'Yuan', items_json: JSON.stringify([{ compass_entry_id: 'workspace-oolong', name: 'Mountain Oolong', quantity: 100, priceIsPerGram: true, pricePerUnit: 0.7, currency: 'Yuan' }]) }], pendingReceipts: [{ id: 'workspace-accepted-arrival', compass_entry_id: 'workspace-oolong', acquisition_kind: 'purchase', quantity: 60, unit: 'g', status: 'accepted', ledger_id: 'workspace-ledger-arrival', idempotency_key: 'order:workspace-oolong-order:workspace-oolong' }], imports: [unfinishedImport], rates: [{ currency: 'USD', rate_to_usd: 1 }, { currency: 'Yuan', rate_to_usd: 7 }] });
  });
  test.afterEach(async ({ page }) => expectNoUnhandledCompassApi(page));

  test('opens More directly into the same editable record and saves description separately from notes', async ({ page }, info) => {
    await openLibrary(page);
    await expect(row(page)).toContainText('$0.10/g');
    await expect(row(page)).toContainText('Chosen');
    await expect(visible(page, 'library-entry-workspace-white')).toContainText('Ordered · 500g ordered');
    await expect(visible(page, 'library-entry-workspace-oolong')).toContainText('Part received · 40g due');
    await expect(row(page).getByRole('button', { name: /Save|Carry|Pass|Add to/ })).toHaveCount(0);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => localStorage.setItem('teajia_theme', value), theme);
      await page.goto('/admin/compass?tab=library', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('tab', { name: 'Library', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(row(page)).toBeVisible();
      await noOverflow(page);
      await page.screenshot({ path: `/private/tmp/library-workspace-${info.project.name.includes('Mobile') ? 'phone393' : 'desktop'}-${theme}.png`, fullPage: true, animations: 'disabled' });
    }
    await row(page).getByRole('button', { name: 'More about Cloud Peak' }).click();
    await expect(record(page)).toBeVisible();
    const header = record(page).getByTestId('tea-record-header');
    const headerBox = await header.boundingBox();
    expect(headerBox!.height).toBeLessThanOrEqual(80);
    await expect(record(page).getByRole('textbox', { name: 'Add a note', exact: true })).toBeVisible();
    await expect(record(page).getByRole('textbox', { name: 'Notes', exact: true })).toBeHidden();
    await expect(record(page).getByTestId('tea-record-scroll').getByRole('button', { name: 'Taste', exact: true })).toBeVisible();
    await expect(record(page).getByTestId('tea-record-scroll').getByRole('region', { name: 'Inventory handoff' })).toHaveCount(1);
    await page.screenshot({ path: `/private/tmp/library-workspace-${info.project.name.includes('Mobile') ? 'phone393' : 'desktop'}-record-top.png`, fullPage: false, animations: 'disabled' });
    await record(page).getByRole('textbox', { name: 'Add a note', exact: true }).fill('The farmer picked this before the spring rain.');
    await record(page).getByRole('button', { name: 'Add note', exact: true }).click();
    await expect(record(page).getByText('Note added to this tea.', { exact: true })).toBeVisible();
    await openRecordSection(page, 'Source material');
    await expect(record(page).getByRole('textbox', { name: 'Note from You', exact: true })).toHaveValue('The farmer picked this before the spring rain.');
    await expect(record(page).getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(sourceEntry.notes);
    await expect(record(page).getByRole('region', { name: 'Tea photos' }).getByAltText('Photo 1')).toBeVisible();
    await openRecordSection(page, 'Story & description');
    await record(page).getByRole('textbox', { name: 'Description', exact: true }).fill('Edited description with a clear origin and harvest.');
    await record(page).getByRole('textbox', { name: 'Description', exact: true }).press('Tab');
    await expect.poll(async () => (await sourceState(page))?.description).toBe('Edited description with a clear origin and harvest.');
    expect((await sourceState(page))?.notes).toBe(sourceEntry.notes);
    expect((await sourceState(page))?.photos).toEqual([photo]);
    await record(page).getByRole('textbox', { name: 'Notes', exact: true }).fill('Updated field notes, independent of the public description.');
    await record(page).getByRole('textbox', { name: 'Notes', exact: true }).press('Tab');
    await expect.poll(async () => (await sourceState(page))?.notes).toBe('Updated field notes, independent of the public description.');
    expect((await sourceState(page))?.description).toBe('Edited description with a clear origin and harvest.');
    await noOverflow(page);
    await record(page).getByTestId('tea-record-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await record(page).getByRole('button', { name: 'Create Inventory record', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/private/tmp/library-workspace-${info.project.name.includes('Mobile') ? 'phone393' : 'desktop'}-record-footer.png`, fullPage: false, animations: 'disabled' });
    expect((await header.boundingBox())!.y).toBeCloseTo(headerBox!.y, 0);
    await expect(record(page).getByRole('textbox', { name: 'Add a note', exact: true })).not.toBeInViewport();
    if (info.project.name.includes('Mobile')) {
      const footerAction = await record(page).getByRole('button', { name: 'Create Inventory record', exact: true }).boundingBox();
      const bottomNav = await page.getByRole('navigation', { name: 'Main navigation', exact: true }).boundingBox();
      expect(footerAction).not.toBeNull();
      expect(bottomNav).not.toBeNull();
      expect(footerAction!.y + footerAction!.height).toBeLessThanOrEqual(bottomNav!.y + 1);
    }
    await record(page).getByRole('button', { name: 'Close detail panel' }).click();
    await expect(row(page)).toBeVisible();
  });

  test('keeps import work under Add and remembers the display currency and weight basis', async ({ page }) => {
    await openLibrary(page);
    await expect(page.getByRole('button', { name: 'Open Chen unfinished invoice' })).toBeHidden();
    await page.getByRole('button', { name: 'Add to Library' }).filter({ visible: true }).click();
    await expect(page.getByRole('button', { name: 'Open Chen unfinished invoice' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Import files/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Price display settings' }).filter({ visible: true }).click();
    await page.getByLabel('Price display currency', { exact: true }).selectOption('Yuan');
    await page.getByLabel('Price quantity basis', { exact: true }).selectOption('100g');
    await page.keyboard.press('Escape');
    await expect(row(page)).toContainText('CN¥70.00/100g');
    await page.goto('/admin/compass?tab=library', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Library', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(row(page)).toContainText('CN¥70.00/100g');
    await noOverflow(page);
  });

  test('explicit promotion leaves the active Library and retains its same shared record under Transferred', async ({ page }) => {
    await openLibrary(page);
    await row(page).getByRole('button', { name: 'More about Cloud Peak' }).click();
    await record(page).getByRole('button', { name: 'Create Inventory record', exact: true }).click();
    await expect.poll(() => compassCreatedProducts(page).length).toBe(1);
    await expect.poll(async () => (await sourceState(page))?.draftProductId).toBe(`product-${entryId}`);
    await record(page).getByRole('button', { name: 'Close detail panel' }).click();
    await expect(row(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Transferred · 1', exact: true }).filter({ visible: true }).click();
    await expect(row(page)).toBeVisible();
    await row(page).getByRole('button', { name: 'More about Cloud Peak' }).click();
    await openRecordSection(page, 'Source material');
    await expect(record(page).getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(sourceEntry.notes);
    await expect(record(page).getByRole('button', { name: /View in Inventory/ })).toBeVisible();
    await expect(record(page).getByRole('region', { name: 'Tea photos' }).getByAltText('Photo 1')).toBeVisible();
    await noOverflow(page);
  });
});

test('Inventory opens the same source record through the Library route', async ({ page }, info) => {
  if (info.project.name.includes('Mobile')) await page.setViewportSize({ width: 393, height: 851 });
  const productId = 'inventory-cloud';
  await installCompassHarness(page, { compassEntries: [{ ...sourceEntry, draft_product_id: productId }], products: [{
    id: productId, source_compass_entry_id: entryId, product_name: 'Cloud Peak', given_name: 'Cloud Peak', type: 'Sheng', form: 'Loose', year: 2024,
    origin_country: 'China', origin_region: 'Yunnan', stock_grams: 100, stock_known_at: '2026-10-01T00:00:00.000Z',
    cost_amount: 70, cost_currency: 'Yuan', cost_per_gram_usd: 0.1, retail_price_per_gram_usd: 0.3,
    status: 'Draft', inventory_purpose: 'working', tasting_source: 'common', description: sourceEntry.description,
    vendor: 'Chen Family', is_public: 0, shown_in_shop: 0, can_reorder: 1, shipping_rate_per_kg: null,
  }] });
  await page.goto(`/admin/stock?panel=${productId}`, { waitUntil: 'domcontentloaded' });
  const sourceAction = page.getByTestId('inventory-open-tea-record').filter({ visible: true });
  await expect(sourceAction).toBeVisible({ timeout: 15_000 });
  await expect(sourceAction).toHaveAttribute('data-compass-entry-id', entryId);
  await sourceAction.click();
  await expect(page).toHaveURL(new RegExp(`tab=library&entry=${entryId}`));
  await expect(record(page)).toBeVisible();
  await openRecordSection(page, 'Source material');
  await expect(record(page).getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(sourceEntry.notes);
  await openRecordSection(page, 'Story & description');
  await expect(record(page).getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(sourceEntry.description);
  await noOverflow(page);
  await expectNoUnhandledCompassApi(page);
});
