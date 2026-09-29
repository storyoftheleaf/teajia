import { test, expect } from './fixtures';

const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/shop', label: 'Shop' },
  { path: '/read', label: 'Read' },
  { path: '/craft', label: 'Craft' },
  { path: '/about', label: 'About' },
];

for (const { path, label } of ROUTES) {
  test(`${label} page loads without console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    const filtered = errors.filter(e =>
      !e.includes('net::ERR') &&
      !e.includes('Failed to load resource') &&
      !e.includes('favicon')
    );
    expect(filtered, `Console errors on ${label}`).toHaveLength(0);
  });
}

test('no horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  const overflows = await page.evaluate(() =>
    document.documentElement.scrollWidth > window.innerWidth + 2
  );
  expect(overflows).toBe(false);
});

test('shop toolbar uses compact price controls with Saved beside the filters', async ({ page }) => {
  await page.setViewportSize({ width: 657, height: 734 });
  // The toolbar only renders once there is a catalogue to filter, and this
  // suite runs against a server whose API points at itself, so the real
  // request answers with the application shell and the shop stays empty. Two
  // teas are enough to bring the controls out, and mocking them also stops
  // this depending on whatever the live shop happens to be selling today.
  await page.route('**/api/products/public', route => route.fulfill({ json: [
    { id: 'smoke-1', product_name: 'Smoke Oolong', type: 'Oolong', category: 'tea', form: 'Loose',
      retail_price_per_gram_usd: 0.2, stock_grams: 120, is_public: 1, shown_in_shop: 1,
      origin_country: 'China', origin_region: 'Fujian', year: 2025 },
    { id: 'smoke-2', product_name: 'Smoke Sheng', type: 'Sheng', category: 'tea', form: 'Cake',
      retail_price_per_gram_usd: 0.3, stock_grams: 357, is_public: 1, shown_in_shop: 1,
      origin_country: 'China', origin_region: 'Yunnan', year: 2024 },
  ] }));
  await page.goto('/shop');
  await page.waitForLoadState('domcontentloaded');

  // Found by name, not by its classes: it stopped being `top-0` when it
  // moved under the page header (2026-09-03), and this test then found
  // nothing and failed on every run for weeks.
  const toolbar = page.getByTestId('shop-toolbar');
  await expect(toolbar).toBeVisible();

  await expect(toolbar.getByText('Price', { exact: true })).toBeVisible();
  await expect(toolbar.getByText('Price per', { exact: true })).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: '25g' })).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: '50g' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: '100g' })).toBeVisible();

  const toolbarBox = await toolbar.boundingBox();
  const likedBox = await toolbar.getByRole('button', { name: 'Saved', exact: true }).boundingBox();
  const sortBox = await toolbar.getByRole('button', { name: /^Featured$/ }).boundingBox();

  expect(toolbarBox).not.toBeNull();
  expect(likedBox).not.toBeNull();
  expect(sortBox).not.toBeNull();
  // The block sits in an even field rather than running to the glass, so check
  // the inset is small and equal on both sides instead of expecting edge to edge.
  const leftInset = toolbarBox!.x;
  const rightInset = 657 - (toolbarBox!.x + toolbarBox!.width);
  expect(leftInset).toBeLessThanOrEqual(24);
  expect(Math.abs(leftInset - rightInset)).toBeLessThanOrEqual(1);
  // Saved is the last of the filters, straight after the sort and on its
  // line (2026-09-28: the far-right heart became the word Saved there).
  expect(likedBox!.x).toBeGreaterThan(sortBox!.x + sortBox!.width);
  expect(likedBox!.x - (sortBox!.x + sortBox!.width)).toBeLessThanOrEqual(40);
  expect(Math.abs((likedBox!.y + likedBox!.height / 2) - (sortBox!.y + sortBox!.height / 2))).toBeLessThanOrEqual(2);
});

// The three home tests that stood here (the brand-story bridge, the section
// buttons, the scroll hijack) described the old home page, retired on
// 2026-09-22. The new page's own checks live in tests/home.spec.ts.
