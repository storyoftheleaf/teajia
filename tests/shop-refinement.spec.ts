import { expect, test, type Page } from './fixtures';

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
      : url.includes('/api/rates') ? [{ currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() }]
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

  test('opens a tea into the product page, with one rendering per address', async ({ page }) => {
    // Tapping a tea used to push the same address with a background location,
    // which rendered a swipeable card over the grid; only a cold load got the
    // real page. One address now has one rendering, so there is no dialog and
    // no second Add button: choosing an amount in the list IS adding it, and
    // the order itself is reached from the bar at the top.
    await page.getByRole('button', { name: 'View Moonlight White' }).click();
    await expect(page).toHaveURL(/\/shop\/product\/tea-1$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.label-plate')).toBeVisible();
    await expect(page.getByRole('button', { name: /Add to order/i })).toHaveCount(0);

    const amount = page.locator('.alcove-dock-strip button[aria-expanded]:not(.alcove-dock-cta)');
    await expect(amount).toBeVisible();
    // The figure comes off the pricing curve, which folds handling into the
    // total: 50 g of a $0.15/g tea is $7.50 of leaf plus $2, so $9.50 shown as
    // $10. The rate the buyer actually pays is $0.19 a gram, not the shelf
    // $0.15, and the list quotes that same effective rate.
    await expect(amount).toContainText('$10');
    expect(await amount.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);

    // Choosing an amount chooses it; Add commits it. Both controls are in the
    // bar at every width. Nothing is in the order yet, so there is nothing to
    // open and the order block is correctly absent.
    await expect(page.locator('.alcove-dock-add')).toBeVisible();
    await expect(page.locator('.alcove-dock-cta')).toHaveCount(0);

    // Changing the amount must not buy anything. This bought a bag every time.
    await amount.click();
    await page.locator('[role="group"] button').nth(3).click();
    await expect(page.locator('.alcove-dock-cta')).toHaveCount(0);

    // Add commits once, and the order then carries exactly what the bar showed.
    const shown = (await amount.textContent()) ?? '';
    const shownTotal = shown.match(/\$[\d,]+/)?.[0] ?? '';
    await page.locator('.alcove-dock-add').click();
    await expect(page.locator('.alcove-dock-cta')).toContainText(shownTotal);
    if ((await page.viewportSize())!.width < 1024) {
      const [barBox, navBox] = await Promise.all([
        page.locator('.alcove-dock-strip').boundingBox(),
        page.getByTestId('bottom-tab-bar').boundingBox(),
      ]);
      expect(barBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(barBox!.y + barBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('opens teaware into the product page and returns with browser Back', async ({ page }) => {
    await page.getByRole('button', { name: 'Teaware', exact: true }).click();
    await page.getByRole('heading', { name: 'Field Gaiwan', exact: true }).click();

    await expect(page).toHaveURL(/\/shop\/product\/ware-1$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.label-plate')).toBeVisible();

    // Back is a real history step now rather than a modal dismissal, and it
    // still has to land on the shop with the right tab showing. The tab is in
    // the address for exactly this: the shop no longer stays mounted under a
    // modal, so without it Back would drop a teaware browser onto Tea.
    await page.goBack();
    await expect(page).toHaveURL(/\/shop\?tab=teaware$/);
    await expect(page.getByRole('heading', { name: 'Field Gaiwan', exact: true })).toBeVisible();
  });

  test('quotes the same total on the grid and the product page', async ({ page }) => {
    // The grid used to multiply price per gram by weight directly, leaving
    // out the $2 handling fee the product page's own ladder, the cart and
    // the order total all charge through quoteGrams. A reader saw one price
    // in the grid and a higher one two taps later. The grid's default
    // weight is 50 g (the store's own default), so that is the weight
    // compared on both sides: Moonlight White at $0.15/g comes to
    // 0.15 * 50 + 2 = $9.50, shown as $10, whichever surface names it.
    const row = page.getByRole('button', { name: 'View Moonlight White' });
    const gridPrice = (await row.getByTestId('grid-price').textContent())?.trim();
    expect(gridPrice).toBe('$10');

    await row.click();
    await expect(page).toHaveURL(/\/shop\/product\/tea-1$/);

    const amountButton = page.locator('.alcove-dock-strip button[aria-expanded]:not(.alcove-dock-cta)');
    await amountButton.click();
    const pageTotal = (await page.getByTestId('amount-total-50').textContent())?.trim();

    expect(gridPrice).toBe(`$${pageTotal}`);
  });
});
