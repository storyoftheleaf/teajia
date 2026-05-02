import { test, expect } from '@playwright/test';

// Wave 2 verification gate. Ensures the new /people routes render without
// crashing, that the masthead picks up the seed data, and that there's no
// horizontal overflow at mobile width.

test('contributor profile page renders chen', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.goto('/people/chen');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const body = await page.locator('body').innerText();

  expect(body).not.toContain('Something went wrong');
  expect(body).not.toContain('not yet on file');
  expect(body).toContain('Chen Wei');
  expect(body.toLowerCase()).toContain('tea master');

  const filtered = errors.filter(e =>
    !e.includes('net::ERR') &&
    !e.includes('Failed to load resource') &&
    !e.includes('favicon') &&
    !e.includes('401') &&
    !e.includes('403')
  );
  expect(filtered, 'Console errors on /people/chen').toHaveLength(0);

  const overflow = await page.evaluate(() => ({
    s: document.documentElement.scrollWidth,
    w: window.innerWidth,
  }));
  expect(overflow.s, 'horizontal overflow').toBeLessThanOrEqual(overflow.w + 2);

  await page.screenshot({ path: 'test-results/people-chen.png', fullPage: true });
});

test('contributors directory page renders the list', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/people');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Something went wrong');
  expect(body).toContain('People');
  expect(body).toContain('Chen Wei');

  const filtered = errors.filter(e =>
    !e.includes('net::ERR') &&
    !e.includes('Failed to load resource') &&
    !e.includes('favicon') &&
    !e.includes('401') &&
    !e.includes('403')
  );
  expect(filtered, 'Console errors on /people').toHaveLength(0);

  await page.screenshot({ path: 'test-results/people-index.png', fullPage: true });
});
