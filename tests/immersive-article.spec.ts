// tests/immersive-article.spec.ts
import { test, expect } from '@playwright/test';

const ARTICLE = {
  id: 'test-immersive', slug: 'the-rock-remembers', title: 'The Rock Remembers',
  status: 'published', tags: [], layout_template: 'immersive_scroll',
  created_at: '2026-06-16', updated_at: '2026-06-16',
  blocks: [
    { type: 'cover', title: 'The Rock Remembers', kicker: 'Origin · Wuyi', image: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&q=80' },
    { type: 'intro', text: 'Some teas taste of the place that made them. Wuyi is one of them, and it took me years to learn how to hear it.' },
    { type: 'section_heading', text: 'Then comes the fire.' },
    { type: 'paragraph', text: 'By the third pass the green has gone entirely, folded down into warm stone and dried longan and a faint mineral sweetness underneath.' },
    { type: 'quote', text: 'You do not drink the leaf. You drink the mountain.', attribution: 'Master Chen' },
    { type: 'chapter_divider', number: '二', title: 'The Roast' },
    { type: 'epilogue', text: 'The rock remembers.', signature: 'A.R.' },
  ],
};

test.beforeEach(async ({ page }) => {
  // Stub both possible API origins for the by-slug fetch.
  await page.route('**/api/**/articles/**', (route) => {
    if (route.request().url().includes(ARTICLE.slug) || route.request().url().includes('by-slug')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ARTICLE) });
    }
    return route.continue();
  });
});

test('immersive article renders the stack and does not error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/article/the-rock-remembers');
  await expect(page.getByTestId('immersive-article')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Rock Remembers' })).toBeVisible();
  await expect(page.getByText('You do not drink the leaf.')).toBeVisible();

  // New AR.1 narrative shapes. Scroll each into view first so the Reveal
  // IntersectionObserver fires (the epilogue starts at opacity:0).
  await page.getByText('The Roast').scrollIntoViewIfNeeded();
  await expect(page.getByText('The Roast')).toBeVisible();
  await page.getByText('The rock remembers.').scrollIntoViewIfNeeded();
  await expect(page.getByText('The rock remembers.')).toBeVisible();

  // No horizontal overflow.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  expect(overflow).toBe(false);

  // No error boundary / 404 text.
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('Article not found')).toHaveCount(0);

  // Scroll to the bottom; the highlight effect toggles class without crashing.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const lit = await page.locator('.shl-word.shl-on').count();
  expect(lit).toBeGreaterThan(0);

  // Capture for the human-eye check (measure / cover fill / no breakage).
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `test-results/immersive-${test.info().project.name}-cover.png` });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.clientHeight + 200));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `test-results/immersive-${test.info().project.name}-prose.png` });

  expect(errors.filter((e) => !e.includes('favicon') && !/40[13]/.test(e))).toEqual([]);
});
