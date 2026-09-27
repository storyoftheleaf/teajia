import { expect, test } from './fixtures';

const json = (body: unknown, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

test('a product link offers retry when its inventory request fails', async ({ page }) => {
  let attempts = 0;
  let healthy = false;
  await page.route('**/api/**', route => route.fulfill(json([])));
  await page.route('**/api/s/rayi-selection/products', route => {
    attempts += 1;
    return healthy
      ? route.fulfill(json([{
        id: 'rayi-product', product_name: 'Mountain Oolong', given_name: 'Mountain Oolong',
        type: 'Oolong', status: 'Active', is_public: 1, shown_in_shop: 1,
        stock_grams: 100, retail_price_per_gram_usd: 0.4, tasting_notes: [], additional_images: [],
      }]))
      : route.fulfill(json({ error: 'temporarily unavailable' }, 503));
  });

  await page.goto('/shop/product/rayi-product?store=rayi-selection');
  await expect(page.getByRole('heading', { name: 'Product unavailable' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Not Found' })).toHaveCount(0);
  const failedAttempts = attempts;
  healthy = true;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Mountain Oolong' })).toBeVisible();
  expect(attempts).toBeGreaterThan(failedAttempts);
});

test('a storefront distinguishes catalog failure from an empty store and can retry', async ({ page }) => {
  let attempts = 0;
  let healthy = false;
  let reviewRequests = 0;
  await page.route('**/api/**', route => {
    if (new URL(route.request().url()).pathname === '/api/tea-reviews') reviewRequests += 1;
    return route.fulfill(json([]));
  });
  await page.route('**/api/s/demo-table', route => route.fulfill(json({ id: 'store-1', slug: 'demo-table', name: 'Demo Table' })));
  await page.route('**/api/s/demo-table/products', route => {
    attempts += 1;
    return healthy
      ? route.fulfill(json([]))
      : route.fulfill(json({ error: 'temporarily unavailable' }, 503));
  });

  await page.goto('/store/demo-table');
  await expect(page.getByRole('heading', { name: 'Products could not be loaded' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Stock is being prepared' })).toHaveCount(0);
  const failedAttempts = attempts;
  healthy = true;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Stock is being prepared' })).toBeVisible();
  expect(attempts).toBeGreaterThan(failedAttempts);
  expect(reviewRequests).toBe(0);
});

test('Find a Table does not request unsupported review totals or show a verification claim', async ({ page }) => {
  let reviewRequests = 0;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/tea-reviews') reviewRequests += 1;
    if (path === '/api/network/stores') return route.fulfill(json([{ id: 'store-1', slug: 'demo-table', name: 'Demo Table', location_city: 'Ubud', location_country: 'Indonesia' }]));
    return route.fulfill(json([]));
  });

  await page.goto('/find-a-table');
  await expect(page.getByRole('link', { name: /Demo Table/ })).toBeVisible();
  await expect(page.getByText('Verified', { exact: true })).toHaveCount(0);
  expect(reviewRequests).toBe(0);
});
