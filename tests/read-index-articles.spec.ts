// tests/read-index-articles.spec.ts
// Verifies the Read index lists editor-authored articles alongside the four
// hand-built showcases, in the same card register.
import { test, expect } from '@playwright/test';

const PUBLISHED = [
  { id: 'a1', slug: 'a-quiet-steep', title: 'A Quiet Steep', subtitle: 'On the patience of the second infusion.', category: 'Reflection', status: 'published', tags: [], blocks: [], cover_image_url: '', created_at: '2026-06-18', updated_at: '2026-06-18' },
  { id: 'a2', slug: 'the-water-matters', title: 'The Water Matters', subtitle: 'Why the spring you choose changes the cup.', category: 'Teaching', status: 'published', tags: [], blocks: [], cover_image_url: '', created_at: '2026-06-18', updated_at: '2026-06-18' },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/articles?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PUBLISHED) }),
  );
});

test('Read index lists the four showcases AND editor articles together', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/read');

  // The four hand-built showcases.
  await expect(page.getByText('From Leaf to Liquor', { exact: true })).toBeVisible();
  await expect(page.getByText('The Rock Remembers', { exact: true })).toBeVisible();

  // The editor-authored articles, in the same grid, linking to /article/:slug.
  await expect(page.getByText('A Quiet Steep', { exact: true })).toBeVisible();
  await expect(page.getByText('The Water Matters', { exact: true })).toBeVisible();
  await expect(page.locator('a[href="/article/a-quiet-steep"]')).toBeVisible();

  await page.screenshot({ path: `test-results/read-index-${test.info().project.name}.png`, fullPage: true });

  expect(errors.filter((e) => !e.includes('favicon') && !/40[13]/.test(e))).toEqual([]);
});
