import { expect, test } from './fixtures';

const route = '/shop/product/winter-frost?store=cloud-garden';
const item = {
  id: 'winter-frost', slug: 'winter-frost', given_name: 'Winter Frost', product_name: 'Winter Qingxin',
  type: 'Oolong', form: 'Loose Leaf', origin_country: 'Taiwan', origin_region: 'Alishan',
  year: 2025, status: 'Sold Out', stock_grams: 10, is_public: 1, shown_in_shop: 1,
  price_per_gram_usd: 0.4, retail_price_per_gram_usd: 0.4, image_url: '', additional_images: [], tasting_notes: [], description: 'A winter-picked mountain oolong with a soft floral finish.',
};
const store = {
  id: 'cloud-acct', slug: 'cloud-garden', name: 'Cloud Garden Tea',
  whatsapp_number: '+12025550143', contact_email: 'store@example.test',
};

test('the restock request fits the dock and drafts the selected tea', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let whatsapp = true;
  await page.route('**/api/**', intercepted => {
    switch (new URL(intercepted.request().url()).pathname) {
      case '/api/s/cloud-garden/products/winter-frost': return intercepted.fulfill({ json: item });
      case '/api/s/cloud-garden': return intercepted.fulfill({ json: { ...store, whatsapp_number: whatsapp ? store.whatsapp_number : null } });
      default: return intercepted.fulfill({ json: [] });
    }
  });
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Winter Frost' })).toBeVisible({ timeout: 45_000 });
  const dock = page.locator('.alcove-dock-strip[data-sold-out=true]');
  const status = dock.getByText('Sold out', { exact: true });
  const link = dock.getByRole('link', { name: 'Notify me when it’s back in stock', exact: true });
  await expect(status).toBeVisible();
  await expect(link).toHaveText('Notify me');
  await expect(link.locator('span')).toHaveCSS('height', '28px');
  await expect(dock.getByRole('button', { name: 'Add', exact: true })).toHaveCount(0);
  const url = new URL((await link.getAttribute('href'))!);
  const text = 'Hello Cloud Garden Tea, please let me know when Winter Frost is back in stock.\n' + new URL(page.url()).origin + route;
  expect(url.origin).toBe('https://wa.me');
  expect(url.pathname).toBe('/12025550143');
  expect(url.searchParams.get('text')).toBe(text);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const [bar, control, label] = await Promise.all([dock.boundingBox(), link.boundingBox(), status.boundingBox()]);
    expect(control!.height).toBeGreaterThanOrEqual(44);
    expect(control!.x + control!.width).toBeLessThanOrEqual(bar!.x + bar!.width);
    expect(label!.x + label!.width).toBeLessThan(control!.x);
  }
  whatsapp = false;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(link).toHaveAttribute('href', /^mailto:store@example\.test\?/);
  const email = new URL((await link.getAttribute('href'))!);
  expect(email.searchParams.get('subject')).toBe('Restock alert for Winter Frost');
  expect(email.searchParams.get('body')).toBe(text);
});
