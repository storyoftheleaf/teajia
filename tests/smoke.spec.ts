import { test, expect } from '@playwright/test';

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

test('shop toolbar uses compact price controls with liked on the far right', async ({ page }) => {
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

  const toolbar = page.locator('div.sticky.top-0').filter({
    has: page.getByLabel('Search teas'),
  });
  await expect(toolbar).toBeVisible();

  await expect(toolbar.getByText('Price', { exact: true })).toBeVisible();
  await expect(toolbar.getByText('Price per', { exact: true })).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: '25g' })).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: '50g' })).toBeVisible();
  await expect(toolbar.getByRole('button', { name: '100g' })).toBeVisible();

  const toolbarBox = await toolbar.boundingBox();
  const likedBox = await toolbar.getByRole('button', { name: /show only liked teas/i }).boundingBox();
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
  expect(likedBox!.x).toBeGreaterThan(sortBox!.x);
  expect(likedBox!.x + likedBox!.width).toBeGreaterThan(toolbarBox!.x + toolbarBox!.width - 72);
});

test('home keeps visible content during the first scroll into the brand story', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.scrollTo(0, 320));
  await page.waitForTimeout(100);

  const bridgeState = await page.getByRole('heading', {
    name: 'Tea deepens with what you bring to the table and what you leave behind.',
  }).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    let opacity = 1;
    let node: HTMLElement | null = el as HTMLElement;
    while (node) {
      opacity *= Number.parseFloat(getComputedStyle(node).opacity || '1');
      node = node.parentElement;
    }

    return {
      bottom: rect.bottom,
      opacity,
      top: rect.top,
      viewportHeight: window.innerHeight,
    };
  });

  expect(bridgeState.bottom).toBeGreaterThan(80);
  expect(bridgeState.top).toBeLessThan(bridgeState.viewportHeight - 160);
  expect(bridgeState.opacity).toBeGreaterThan(0.25);
});

test('home section links navigate to their matching sections', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const links = [
    { name: 'Source your tea.', path: '/shop' },
    { name: 'Discover the stories.', path: '/read' },
    { name: 'Deepen your practice.', path: '/craft' },
    { name: 'Create the spaces to share.', path: '/advise' },
  ];

  for (const link of links) {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: link.name }).click();
    await expect(page).toHaveURL(new RegExp(`${link.path}$`));
  }
});

test('home manual scroll is not hijacked into the brand story footer', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);

  const targetY = await page.evaluate(() => {
    const el = document.getElementById('brand-story');
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return window.scrollY + rect.top + el.offsetHeight - window.innerHeight;
  });

  await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 1000 });
  await page.waitForTimeout(800);

  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeLessThan(targetY - 120);
});
