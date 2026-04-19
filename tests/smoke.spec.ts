import { test, expect } from '@playwright/test';

const ROUTES = [
  { path: '/', label: 'Home' },
  { path: '/shop', label: 'Shop' },
  { path: '/magazine', label: 'Magazine' },
  { path: '/learn', label: 'Learn' },
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
