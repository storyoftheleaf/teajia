import { expect, test, type Page } from '@playwright/test';

const PRODUCTS = [
  {
    id: 'tea-1',
    type: 'White',
    product_name: 'Moonlight White',
    year: '2024',
    origin_country: 'China',
    origin_region: 'Fujian',
    retail_price_per_gram_usd: 0.15,
    stock_grams: 200,
    description: 'Soft florals with a clean finish.',
    status: 'Active',
    is_curated: 1,
    tasting: { flavor: ['floral'] },
    tasting_source: 'owner',
  },
  {
    id: 'tea-2',
    type: 'Shou',
    product_name: 'Grounded Shou',
    year: '2018',
    origin_country: 'China',
    origin_region: 'Yunnan',
    retail_price_per_gram_usd: 0.32,
    stock_grams: 300,
    description: 'Deep and settled.',
    status: 'Active',
    tasting: { feeling: ['grounding'] },
    tasting_source: 'owner',
  },
  {
    id: 'tea-past',
    type: 'Green',
    product_name: 'Spring Green',
    year: '2023',
    origin_country: 'China',
    origin_region: 'Zhejiang',
    retail_price_per_gram_usd: 0.2,
    stock_grams: 0,
    description: 'A finished spring lot.',
    status: 'Active',
  },
  {
    id: 'ware-1',
    type: 'Teaware',
    product_name: 'Field Gaiwan',
    retail_price_per_gram_usd: 0,
    fixed_retail_price_usd: 28,
    stock_grams: 0,
    quantity_units: 3,
    description: 'A quiet porcelain brewing vessel.',
    material: 'Porcelain',
    teaware_category: 'pot',
    status: 'Active',
  },
];

async function mockPublicShop(page: Page) {
  await page.route('**/api/**', async route => {
    const url = route.request().url();
    if (url.includes('/api/products/public')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) });
      return;
    }
    if (url.includes('/api/auth/')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
      return;
    }
    const body = url.includes('/api/network/stores') ? { stores: [] }
      : url.includes('/api/rates') ? [{ currency: 'USD', rate_to_usd: 1 }]
        : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('refined public shop', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicShop(page);
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'All teas' })).toBeVisible();
  });

  test('keeps both navigation levels visible without horizontal overflow', async ({ page }) => {
    for (const name of ['Tea', 'Teaware', 'Sets', 'Liked', 'All teas', 'My selection', 'Find a tea']) {
      const control = page.getByRole('button', { name, exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('moves through Finder using one persistent result status', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'All teas' })).toHaveAttribute('aria-pressed', 'true');
    const status = page.locator('p[role="status"][aria-live="polite"]');
    await status.evaluate(element => element.setAttribute('data-regression-probe', 'same-node'));

    await page.getByRole('button', { name: 'Find a tea' }).click();
    await expect(status).toHaveText('Choose a direction to find a tea.');
    await page.getByRole('button', { name: 'Light and fragrant' }).click();

    await expect(page.getByRole('button', { name: 'All teas' })).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toHaveAttribute('data-regression-probe', 'same-node');
    await expect(status).toContainText('tea shown');
    await expect(page).toHaveURL(/(?:\?|&)flavor=floral(?:&|$)/);
    await expect(page.getByRole('button', { name: 'View Moonlight White' })).toBeVisible();
  });

  test('opens a tea and keeps truthful rate and order access on a cold product page', async ({ page }) => {
    await page.getByRole('button', { name: 'View Moonlight White' }).click();
    await expect(page).toHaveURL(/\/shop\/product\/tea-1$/);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The button always carries the total. The per-gram rate beside it is a
    // footnote the design hides once the button's container drops under 220px,
    // which it does at this width, so assert it in the markup rather than on
    // screen.
    const modalOrder = dialog.getByRole('button', { name: /Add to order/i });
    await expect(modalOrder).toBeVisible();
    await expect(modalOrder).toContainText('$8');
    await expect(modalOrder.locator('.alcove-order-rate')).toHaveText('$0.15/g');
    await modalOrder.click();

    await page.goto('/shop/product/tea-1', { waitUntil: 'domcontentloaded' });
    const orderAccess = page.getByRole('button', { name: /Open order with 1 item/ });
    const coldOrder = page.getByRole('button', { name: /Add to order/i });
    await expect(orderAccess).toBeVisible();
    await expect(coldOrder).toBeVisible();
    await expect(coldOrder).toContainText('$8');
    await expect(coldOrder.locator('.alcove-order-rate')).toHaveText('$0.15/g');
    expect(await coldOrder.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    if ((await page.viewportSize())!.width < 1024) {
      const [orderBox, navBox] = await Promise.all([
        orderAccess.boundingBox(),
        page.getByTestId('bottom-tab-bar').boundingBox(),
      ]);
      expect(orderBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(orderBox!.y + orderBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('opens teaware as a modal and closes it with browser Back', async ({ page }) => {
    await page.getByRole('button', { name: 'Teaware', exact: true }).click();
    await page.getByRole('heading', { name: 'Field Gaiwan', exact: true }).click();

    await expect(page).toHaveURL(/\/shop\/product\/ware-1$/);
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Field Gaiwan', exact: true })).toBeVisible();
  });
});
