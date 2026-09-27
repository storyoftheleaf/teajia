// tests/read-index-articles.spec.ts
// Verifies the public Read index respects the curated publication boundary:
// explicitly live pieces are listed, while drafts and the retained article
// query are not accidentally exposed in the public register.
import { test, expect } from './fixtures';

const PUBLISHED = [
  { id: 'a1', slug: 'a-quiet-steep', title: 'A Quiet Steep', subtitle: 'On the patience of the second infusion.', category: 'Reflection', status: 'published', tags: [], blocks: [], cover_image_url: '', created_at: '2026-06-18', updated_at: '2026-06-18' },
  { id: 'a2', slug: 'the-water-matters', title: 'The Water Matters', subtitle: 'Why the spring you choose changes the cup.', category: 'Teaching', status: 'published', tags: [], blocks: [], cover_image_url: '', created_at: '2026-06-18', updated_at: '2026-06-18' },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/api/articles?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PUBLISHED) }),
  );
});

test('Read index lists live curated pieces without exposing drafts or queried articles', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/read');

  // The published pieces: the four the curated register marks live, and
  // From Leaf to Liquor, the flagship that is public by construction
  // (isUngatedReadPath) and so is listed for everyone.
  for (const href of ['/read/leaf-to-liquor', '/read/ritual', '/read/atlas', '/read/tasting', '/read/porcelain-and-tea']) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  }

  // Draft curated pieces remain owner-only, and the retained article query is
  // not a second publication path into this deliberately curated index.
  await expect(page.getByText('The Rock Remembers', { exact: true })).toHaveCount(0);
  await expect(page.getByText('A Quiet Steep', { exact: true })).toHaveCount(0);
  await expect(page.getByText('The Water Matters', { exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="/article/a-quiet-steep"]')).toHaveCount(0);

  await page.screenshot({ path: `test-results/read-index-${test.info().project.name}.png`, fullPage: true });

  expect(errors.filter((e) => !e.includes('favicon') && !/40[13]/.test(e))).toEqual([]);
});
