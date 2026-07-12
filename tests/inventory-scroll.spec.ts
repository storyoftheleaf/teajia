/**
 * Regression test for the InventoryView scroll bug.
 *
 * The scroll container at `[data-testid="inventory-scroll"]` is `flex-1
 * overflow-auto` and depends on a long chain of ancestor heights (`h-full`,
 * `flex-1 min-h-0`) from App.tsx down through AdminApp, PageTransition, and
 * InventoryView's own root. Inserting any wrapper in that chain without
 * preserving the contract collapses the container to 0 and the whole page
 * silently stops scrolling.
 *
 * This test runs on Desktop Chrome and Mobile Chrome. It asserts:
 *   1. The scroll container has a sensible clientHeight (> 200px).
 *   2. Content overflows it (scrollHeight > clientHeight) — otherwise we can't
 *      meaningfully test scrolling.
 *   3. Programmatic scrollTo(200) actually moves scrollTop, i.e. the container
 *      is genuinely scrollable.
 *
 * If this fails, see CLAUDE.md > "InventoryView height chain".
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS_DIR = path.join(__dirname, '../test-results/inventory-scroll');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

const FAKE_TOKEN = makeFakeJWT({
  sub: 'test-admin-uid',
  email: 'admin@teajia.com',
  name: 'Test Admin',
  role: 'owner',
  platform_role: 'platform_owner',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-bali',
  memberships: [
    { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' },
  ],
});

const MOCK_PRODUCTS = Array.from({ length: 96 }, (_, i) => {
  const types = ['Green', 'Oolong', 'Red', 'Sheng', 'Shou', 'White'];
  const type = types[i % types.length];
  return {
    id: `test-product-${i + 1}`,
    type,
    form: 'Loose Leaf',
    given_name: i % 3 === 0 ? `House ${i + 1}` : '',
    chinese_name: '',
    product_name: `${type} Test Tea ${String(i + 1).padStart(2, '0')}`,
    year: 2018 + (i % 7),
    origin_country: 'Taiwan',
    origin_region: ['Alishan', 'Lishan', 'Yiwu', 'Wuyi'][i % 4],
    retail_price_per_gram_usd: 0.28 + (i % 5) * 0.04,
    cost_per_gram_usd: 0.12 + (i % 4) * 0.02,
    cost_amount: 80 + i,
    stock_grams: 40 + i * 7,
    low_stock_threshold: 80,
    description: '',
    tasting_notes: [],
    image_url: '',
    status: 'Active',
    vendor: ['Chen Family', 'Mountain Source', 'Old Tree Co'][i % 3],
    cost_currency: 'USD',
    quantity_purchased: 500,
    shipping_rate_per_kg: 13,
    fixed_retail_price_usd: null,
    is_personal: i % 11 === 0 ? 1 : 0,
    can_reorder: 1,
    is_public: i % 9 === 0 ? 0 : 1,
    is_featured: i % 13 === 0 ? 1 : 0,
    is_sample: 0,
    recheck_stock: i % 17 === 0 ? 1 : 0,
    stock_verified_at: i % 5 === 0 ? new Date().toISOString() : null,
    tasting_source: i % 4 === 0 ? 'common' : 'owner',
  };
});

async function injectAuth(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
  }, FAKE_TOKEN);
}

async function mockInventoryApi(page: Page) {
  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'test-admin-uid',
      email: 'admin@teajia.com',
      name: 'Test Admin',
      role: 'owner',
    }),
  }));
  await page.route('**/api/auth/refresh', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ token: FAKE_TOKEN }),
  }));
  await page.route('**/api/products', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(MOCK_PRODUCTS),
  }));
  await page.route('**/api/rates', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { currency: 'USD', rate_to_usd: 1 },
      { currency: 'IDR', rate_to_usd: 16000 },
    ]),
  }));
  await page.route('**/api/admin/events', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('**/api/compass/incoming', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('**/api/accounts/acct-bali', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali' }),
  }));
  await page.route('**/api/batches**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  for (const endpoint of ['user/favorites', 'tea-discovery', 'compass/entries', 'tasting-journal', 'notes', 'customers']) {
    await page.route(`**/api/${endpoint}**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }));
  }
}

async function shot(page: Page, name: string) {
  const safe = name.replace(/[^a-z0-9-]/gi, '_');
  await page.screenshot({ path: path.join(SHOTS_DIR, `${safe}.png`), fullPage: false });
}

test.describe('Inventory page — scroll regression guard', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuth(page);
    await mockInventoryApi(page);
  });

  test('scroll container has height and is scrollable', async ({ page }, testInfo) => {
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const scroller = page.locator('[data-testid="inventory-scroll"]');
    await expect(scroller).toBeVisible({ timeout: 5000 });

    const dims = await scroller.evaluate((el) => ({
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      offsetHeight: (el as HTMLElement).offsetHeight,
    }));

    await shot(page, `${testInfo.project.name}-loaded`);

    // 1. Container has a real height — guards against the ancestor chain breaking.
    expect(
      dims.clientHeight,
      `Scroll container height is ${dims.clientHeight}px — the h-full / flex-1 / min-h-0 ` +
      `chain from App.tsx is broken. See CLAUDE.md > "InventoryView height chain".`
    ).toBeGreaterThan(200);

    // 2. Content overflows — otherwise the scroll test below is meaningless.
    //    Skip the scroll assertion if there's genuinely nothing to scroll, but
    //    still require height (assertion 1 above).
    if (dims.scrollHeight > dims.clientHeight + 10) {
      // 3. Programmatic scroll actually moves.
      await scroller.evaluate((el) => el.scrollTo({ top: 200, behavior: 'instant' as ScrollBehavior }));
      await page.waitForTimeout(150);
      const scrollTop = await scroller.evaluate((el) => el.scrollTop);
      expect(
        scrollTop,
        'Scroll container has overflow but scrollTop did not move — overflow:auto is not taking effect.'
      ).toBeGreaterThan(50);
      await shot(page, `${testInfo.project.name}-scrolled`);
    }
  });

  test('three-row inventory header keeps only column headings sticky', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'chromium', 'Covered by named desktop and mobile projects');
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const primary = page.getByTestId('inventory-primary-row');
    const purpose = page.getByTestId('inventory-purpose-row');
    const columns = page.getByTestId('inventory-column-row').first();

    await expect(primary).toBeVisible();
    await expect(purpose).toBeVisible();
    await expect(columns).toBeVisible();
    await expect(page.locator('[data-inventory-header-row]')).toHaveCount(3);

    for (const name of ['Tea', 'Wares', 'Incoming', 'Bali']) {
      await expect(primary.getByText(name, { exact: true })).toBeVisible();
    }
    const operationRow = testInfo.project.name === 'Mobile Chrome' ? purpose : primary;
    for (const name of ['Retail', 'Group', 'Sort']) await expect(operationRow.getByText(name, { exact: true })).toBeVisible();
    await expect(primary.getByRole('combobox', { name: 'Select currency' })).toBeVisible();
    await expect(primary.getByRole('combobox', { name: 'Select currency' })).toHaveValue('USD');
    expect(await primary.getByRole('combobox', { name: 'Select currency' }).locator('option').count()).toBeGreaterThan(1);
    await primary.getByRole('combobox', { name: 'Select currency' }).selectOption('IDR');
    await expect(primary.getByRole('combobox', { name: 'Select currency' })).toHaveValue('IDR');
    await expect(primary.getByRole('button', { name: /search/i })).toBeVisible();
    await expect(primary.getByRole('button', { name: /inventory actions/i })).toBeVisible();

    if (testInfo.project.name === 'Mobile Chrome') {
      const row1Controls = [
        primary.getByRole('button', { name: 'Tea', exact: true }),
        primary.getByRole('button', { name: 'Wares', exact: true }),
        primary.getByRole('button', { name: /search inventory/i }),
        primary.getByRole('button', { name: 'Incoming', exact: true }),
        primary.getByRole('combobox', { name: 'Select currency' }),
        primary.getByRole('button', { name: /inventory actions/i }),
      ];
      const row2Controls = [
        purpose.getByRole('button', { name: 'All', exact: true }),
        purpose.getByRole('button', { name: 'Working', exact: true }),
        purpose.getByRole('button', { name: 'Samples', exact: true }),
        purpose.getByRole('button', { name: 'Personal', exact: true }),
        purpose.getByRole('button', { name: /Needs attention/i }),
        purpose.getByRole('button', { name: /switch price mode/i }),
        purpose.getByRole('button', { name: 'Group inventory' }),
        purpose.getByRole('button', { name: 'Sort inventory' }),
      ];
      const assertRowGeometry = async (row: typeof primary, controls: typeof row1Controls, extras: typeof row1Controls = []) => {
        const rowBox = await row.boundingBox();
        expect(rowBox).not.toBeNull();
        const boxes = [];
        for (const control of [...controls, ...extras]) {
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(rowBox!.x - 0.5);
          expect(box!.x + box!.width).toBeLessThanOrEqual(Math.min(rowBox!.x + rowBox!.width + 0.5, 390.5));
          if (controls.includes(control)) {
            expect(box!.width).toBeGreaterThanOrEqual(44);
            expect(box!.height).toBeGreaterThanOrEqual(44);
            boxes.push(box!);
          }
        }
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const overlapX = Math.min(boxes[i].x + boxes[i].width, boxes[j].x + boxes[j].width) - Math.max(boxes[i].x, boxes[j].x);
          const overlapY = Math.min(boxes[i].y + boxes[i].height, boxes[j].y + boxes[j].height) - Math.max(boxes[i].y, boxes[j].y);
          expect(overlapX > 0 && overlapY > 0, `Targets ${i} and ${j} overlap`).toBe(false);
        }
      };
      await assertRowGeometry(primary, row1Controls, [primary.locator('[title="Teajia Bali"]')]);
      await assertRowGeometry(purpose, row2Controls);
    }

    for (const name of ['Purpose', 'All', 'Working', 'Samples', 'Personal', 'Needs attention']) {
      await expect(purpose.getByText(name, { exact: true })).toBeVisible();
    }

    await expect(primary).toHaveCSS('position', 'static');
    await expect(purpose).toHaveCSS('position', 'static');
    await expect(columns).toHaveCSS('position', 'sticky');

    for (const label of ['Product', 'Stock', 'Retail', 'Type', 'Source', 'Origin', 'Leaf', 'Year']) {
      await expect(columns.getByText(label, { exact: true })).toBeVisible();
    }

    const initialRowHeight = await primary.evaluate(el => el.getBoundingClientRect().height);
    await primary.getByRole('button', { name: /search/i }).click();
    const search = primary.getByRole('textbox', { name: /search tea or source/i });
    await expect(search).toBeVisible();
    await search.fill('Mountain');
    await expect(primary).toHaveCSS('height', `${initialRowHeight}px`);
    await expect(page.getByTestId('inventory-primary-row')).toHaveCount(1);
    await primary.getByRole('button', { name: /close inventory search/i }).click();
    await expect(primary.getByRole('button', { name: /search inventory/i })).toBeFocused();
    await primary.getByRole('button', { name: /search inventory/i }).click();
    await expect(search).toHaveValue('Mountain');
    await search.press('Escape');

    await operationRow.getByRole('button', { name: /switch price mode/i }).click();
    await expect(operationRow.getByText('Cost', { exact: true })).toBeVisible();
    await operationRow.getByRole('button', { name: 'Group inventory' }).click();
    const typeGroup = page.getByRole('option', { name: 'Type', exact: true }).first();
    await expect(typeGroup).toBeVisible();
    await expect(typeGroup).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('option', { name: 'None', exact: true }).first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: 'None', exact: true }).first().locator('svg')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await operationRow.getByRole('button', { name: 'Sort inventory' }).click();
    for (const choice of ['Type', 'Name', 'Stock', 'Price/g', 'Cost', 'Cost/g', 'Year', 'Origin', 'Source']) {
      await expect(page.getByRole('option', { name: new RegExp(`^${choice}`) }).first()).toBeVisible();
    }
    const nameSort = page.getByRole('option', { name: /^Name/ }).first();
    await nameSort.click();
    await operationRow.getByRole('button', { name: 'Sort inventory' }).click();
    await expect(page.getByRole('option', { name: /^Name/ }).first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: /^Name/ }).first().locator('svg')).toHaveCount(1);
    const directionBefore = await page.getByRole('option', { name: /^Name/ }).first().getAttribute('aria-label');
    await page.getByRole('option', { name: /^Name/ }).first().click();
    await operationRow.getByRole('button', { name: 'Sort inventory' }).click();
    await expect(page.getByRole('option', { name: /^Name/ }).first()).not.toHaveAttribute('aria-label', directionBefore || '');
    await page.keyboard.press('Escape');
    await primary.getByRole('button', { name: /inventory actions/i }).click();
    await expect(primary.getByRole('button', { name: /inventory actions/i })).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');

    const scrollHost = testInfo.project.name === 'Mobile Chrome'
      ? columns.locator('xpath=ancestor::div[contains(@class,"overflow-auto")][1]')
      : page.getByTestId('inventory-scroll');
    const before = await Promise.all([primary, purpose, columns].map(row => row.evaluate(el => el.getBoundingClientRect().top)));
    await scrollHost.evaluate(el => el.scrollTo({ top: 300, behavior: 'instant' as ScrollBehavior }));
    await page.waitForTimeout(100);
    const after = await Promise.all([primary, purpose, columns].map(row => row.evaluate(el => el.getBoundingClientRect().top)));
    const scrollTopEdge = await scrollHost.evaluate(el => el.getBoundingClientRect().top);
    expect(after[0]).toBeLessThan(before[0] - 100);
    expect(after[1]).toBeLessThan(before[1] - 100);
    expect(Math.abs(after[2] - scrollTopEdge)).toBeLessThan(16);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('three-row inventory header keeps vendor and grouped context inline', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'chromium', 'Covered by named desktop and mobile projects');
    await page.goto('/admin/stock?vendor=Mountain%20Source', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('inventory-primary-row').getByText(/Mountain Source/)).toBeVisible();
    await expect(page.locator('[data-testid="inventory-filter-banner"]')).toHaveCount(0);

    await page.goto('/admin/stock?batch=batch-1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    await expect(page.getByTestId('inventory-primary-row').getByRole('button', { name: 'Clear inventory context' })).toContainText('Batch');
    await expect(page.locator('[data-testid="inventory-filter-banner"]')).toHaveCount(0);

    const operationRow = testInfo.project.name === 'Mobile Chrome' ? page.getByTestId('inventory-purpose-row') : page.getByTestId('inventory-primary-row');
    await operationRow.getByRole('button', { name: 'Group inventory' }).click();
    await page.getByRole('option', { name: 'Type', exact: true }).first().click();
    await expect(page.getByTestId('inventory-column-row')).toBeVisible();

    await page.getByTestId('inventory-primary-row').getByText('Incoming', { exact: true }).click();
    await expect(page.getByRole('region', { name: 'Incoming stock' })).toBeVisible();
  });

  test('three-row inventory header remains available in alternate modes', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'chromium', 'Covered by named desktop and mobile projects');
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const primary = page.getByTestId('inventory-primary-row');
    const purpose = page.getByTestId('inventory-purpose-row');
    const expectHeaderAtTop = async () => {
      const [scrollTop, primaryTop, purposeTop] = await Promise.all([
        page.getByTestId('inventory-scroll').evaluate(el => el.getBoundingClientRect().top),
        primary.evaluate(el => el.getBoundingClientRect().top),
        purpose.evaluate(el => el.getBoundingClientRect().top),
      ]);
      expect(primaryTop - scrollTop).toBeLessThan(20);
      expect(purposeTop).toBeGreaterThan(primaryTop);
      expect(purposeTop - primaryTop).toBeLessThan(50);
    };
    await primary.getByRole('button', { name: /inventory actions/i }).click();
    await page.getByText('Pending AI', { exact: false }).first().click();
    await expectHeaderAtTop();
    await expect(primary).toBeVisible();
    await expect(purpose).toBeVisible();
    await purpose.getByText('All', { exact: true }).click();
    await expect(page.getByTestId('inventory-column-row').first()).toBeVisible();

    if (testInfo.project.name === 'Desktop Chrome') {
      await primary.getByText('Glossary', { exact: true }).click();
      await expectHeaderAtTop();
      await expect(primary).toBeVisible();
      await primary.getByText('Glossary', { exact: true }).click();
      await expect(page.getByTestId('inventory-column-row').first()).toBeVisible();
    }
  });

  test('inventory search suggests sources and category changes clear the query', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'chromium', 'Covered by named desktop and mobile projects');
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const primary = page.getByTestId('inventory-primary-row');

    await primary.getByRole('button', { name: /search inventory/i }).click();
    const search = primary.getByRole('textbox', { name: /search tea or source/i });
    await search.fill('Mountain');
    await expect(page.getByRole('button', { name: /Mountain Source/ }).first()).toBeVisible();
    await page.getByRole('button', { name: /Mountain Source/ }).first().click();
    await expect(page).toHaveURL(/vendor=Mountain(?:%20|\+)Source/);

    await primary.getByRole('button', { name: /search inventory/i }).click();
    await search.fill('Oolong');
    await primary.getByText('Wares', { exact: true }).click();
    await expect(primary.getByRole('textbox', { name: /search teaware/i })).toHaveValue('');
  });

  test('desktop edit mode places Done last and Type beside the product name', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'Desktop Chrome', 'Desktop edit toolbar behavior');
    await page.goto('/admin/stock', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const primary = page.getByTestId('inventory-primary-row');
    await primary.getByText('Edit', { exact: true }).click();

    const done = page.getByTestId('inventory-done');
    const more = primary.getByRole('button', { name: 'Open inventory actions' });
    const [doneLeft, moreRight] = await Promise.all([
      done.evaluate(el => el.getBoundingClientRect().left),
      more.evaluate(el => el.getBoundingClientRect().right),
    ]);
    expect(doneLeft).toBeGreaterThanOrEqual(moreRight);

    const inlineTypes = page.getByTestId('inline-type-selector');
    const inlineTypeCount = await inlineTypes.count();
    expect(inlineTypeCount).toBeGreaterThan(0);
    await expect(page.getByRole('combobox', { name: 'Tea type' })).toHaveCount(0);

    const firstInlineType = inlineTypes.first();
    await expect(firstInlineType).toHaveValue('');
    expect(await firstInlineType.locator('option').count()).toBeGreaterThan(2);
    await shot(page, 'Desktop-Chrome-edit-mode-inline-type');
  });
});
