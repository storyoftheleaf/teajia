import { expect, test } from '@playwright/test';

test('a cold Tea Master product link loads the owning store and preserves its address', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (value: string) => { (window as any).__copiedProductLink = value; } },
      configurable: true,
    });
  });
  await page.route('**/api/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '[]',
  }));
  await page.route('**/api/s/rayi-selection/products', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'rayi-product',
      product_name: 'Rayi Mountain Oolong',
      given_name: 'Mountain Oolong',
      type: 'Oolong',
      status: 'Active',
      is_public: 1,
      shown_in_shop: 1,
      stock_grams: 100,
      retail_price_per_gram_usd: 0.4,
      tasting_notes: [],
      additional_images: [],
    }]),
  }));

  await page.goto('/shop/product/rayi-product?store=rayi-selection');

  await expect(page.getByRole('heading', { name: 'Mountain Oolong' })).toBeVisible();
  await expect(page).toHaveURL(/\/shop\/product\/rayi-product\?store=rayi-selection$/);
  await expect(page.getByRole('link', { name: /back to shop/i })).toHaveAttribute('href', '/shop?store=rayi-selection');
  await page.getByRole('button', { name: 'Share' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__copiedProductLink)).toContain(
    '/shop/product/rayi-product?store=rayi-selection',
  );
});

test('a hidden Wisdom node is absent from its public index and structured data', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));
  await page.route('**/api/public/wisdom/states', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      states: [{ node_type: 'cultivar', node_id: 'rou-gui', public_state: 'hidden', is_public: false }],
    }),
  }));

  await page.goto('/wisdom/cultivars');

  await expect(page.locator('a[href="/wisdom/cultivar/rou-gui"]')).toHaveCount(0);
  const structuredData = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(structuredData.join('\n')).not.toContain('/wisdom/cultivar/rou-gui');
  await expect(page.locator('a[href^="/wisdom/cultivar/"]').first()).toBeVisible();
});
