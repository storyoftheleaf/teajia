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

async function mockPublicShop(page: Page, products = PRODUCTS, rates = [
  { currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() },
]) {
  await page.route('**/api/**', async route => {
    const url = route.request().url();
    if (url.includes('/api/media/')) return route.fallback();
    if (url.includes('/api/products/public')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(products) });
      return;
    }
    if (url.includes('/api/auth/')) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
      return;
    }
    const body = url.includes('/api/network/stores') ? { stores: [] }
      : url.includes('/api/rates') ? rates
        : [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('loads stored product photos in the gallery and enlarged viewer', async ({ page }) => {
  const galleryImages: Record<string, { image_url: string; additional_images?: string[] }> = {
    'tea-1': {
      image_url: 'https://media.teajia.co/gallery/moonlight.jpg',
      additional_images: ['https://media.teajia.co/gallery/moonlight-side.jpg?v=2'],
    },
    'ware-1': { image_url: 'https://media.teajia.co/gallery/gaiwan.jpg' },
  };
  await mockPublicShop(page, PRODUCTS.map(product => ({ ...product, ...galleryImages[product.id] })));
  await page.route('https://media.teajia.co/gallery/**', route => route.fulfill({ status: 404 }));

  const photos = [
    { id: 'tea-1', name: 'Moonlight White', label: 'View Moonlight White image 1 larger', path: '/api/media/gallery/moonlight.jpg' },
    { id: 'tea-1', name: 'Moonlight White', label: 'View Moonlight White image 2 larger', path: '/api/media/gallery/moonlight-side.jpg?v=2' },
    { id: 'ware-1', name: 'Field Gaiwan', label: 'View Field Gaiwan larger', path: '/api/media/gallery/gaiwan.jpg' },
  ];
  for (const photo of photos) {
    await page.goto(`/shop/product/${photo.id}`);
    const thumbnail = page.getByRole('button', { name: photo.label });
    const source = new URL(photo.path, page.url()).href;
    const image = thumbnail.getByRole('img');
    await thumbnail.scrollIntoViewIfNeeded();
    await expect(image).toHaveJSProperty('currentSrc', source);
    await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await thumbnail.click();
    const enlarged = page.getByRole('dialog', { name: `Image of ${photo.name}` }).getByRole('img');
    await expect(enlarged).toHaveJSProperty('src', source);
    await expect.poll(() => enlarged.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
});

test('shows the product price with lining figures in IDR', async ({ page }) => {
  const updatedAt = new Date().toISOString();
  await mockPublicShop(page, PRODUCTS, [
    { currency: 'USD', rate_to_usd: 1, last_updated: updatedAt },
    { currency: 'IDR', rate_to_usd: 16000, last_updated: updatedAt },
  ]);
  await page.addInitScript(() => {
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 6, state: { currency: 'IDR' } }));
  });

  await page.goto('/shop/product/tea-1');
  const dockTotal = page.locator('.alcove-dock-cta-total').first();
  await expect(dockTotal).toHaveText(/IDR\s+\d+k/);
  await page.getByRole('button', { name: /Change amount, currently/ }).click();
  for (const total of [dockTotal, page.getByTestId('amount-total-50')]) {
    await expect(total).toHaveCSS('font-variant-numeric', /lining-nums/);
    await expect(total).toHaveCSS('font-family', /Plus Jakarta Sans/);
    await expect(total).toHaveCSS('font-size', '13px');
  }
});

test.describe('refined public shop', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicShop(page);
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Search teas' })).toBeVisible();
  });

  test('keeps one tab row and a compact search trigger without horizontal overflow', async ({ page }) => {
    await expect(page.getByRole('group', { name: 'Tea shop views' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Find a tea', exact: true })).toHaveCount(0);
    for (const name of ['Tea', 'Liked', 'Search teas']) {
      const control = page.getByRole('button', { name, exact: true });
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
    }
    await expect(page.getByRole('searchbox', { name: 'Search teas' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('expands the search prompt before focusing and filters the existing menu', async ({ page }) => {
    const status = page.locator('p[role="status"][aria-live="polite"]');
    await status.evaluate(element => element.setAttribute('data-regression-probe', 'same-node'));
    await page.getByRole('button', { name: 'Search teas', exact: true }).click();
    const field = page.getByTestId('tea-shop-search');
    const prompt = field.getByText('Search teas', { exact: true });
    const input = field.getByRole('searchbox', { name: 'Search teas' });
    await expect(prompt).toBeVisible();
    await expect(input).not.toBeFocused();

    await input.click();
    await expect(input).toBeFocused();
    await expect(prompt).toBeHidden();
    await input.fill('Moonlight');
    await expect(page.getByRole('button', { name: 'View Grounded Shou' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'View Moonlight White' })).toBeVisible();
    await expect(status).toHaveAttribute('data-regression-probe', 'same-node');
    await expect(status).toHaveText('1 tea shown');

    await field.getByRole('button', { name: 'Close tea search' }).click();
    await expect(page.getByRole('button', { name: 'Search teas', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'View Grounded Shou' })).toBeVisible();
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
    const selectionTotal = page.locator('.alcove-dock-strip .alcove-dock-cta-total').first();
    await expect(amount).toBeVisible();
    // Grams stay in the amount control; the dollar total lives beside it so the
    // two never concatenate into something like "50g0.19/g".
    await expect(amount).toContainText('50g');
    await expect(amount).not.toContainText('/g');
    // The figure comes off the pricing curve, which folds handling into the
    // total: 50 g of a $0.15/g tea is $7.50 of leaf plus $2, so $9.50 shown as
    // $10.
    await expect(selectionTotal).toContainText('$10');
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
    const shownTotal = ((await selectionTotal.textContent()) ?? '').match(/\$[\d,]+/)?.[0] ?? '';
    await page.locator('.alcove-dock-add').click();
    await expect(page.locator('.alcove-dock-cta .alcove-dock-cta-total')).toContainText(shownTotal);
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
    // Each row leads its price with the currency's short symbol, touching,
    // not the code: "$10", not "USD 10" or "10 $".
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
