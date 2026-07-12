import { test, expect, type Page } from '@playwright/test';

const LIVE_ARTICLE = {
  id: 'live-story',
  slug: 'live-story',
  title: 'Live Story',
  subtitle: 'A published story',
  status: 'published',
  tags: [],
  blocks: [{ type: 'paragraph', text: 'This story is publicly available.' }],
  cover_image_url: '',
  created_at: '2026-07-12T00:00:00.000Z',
  updated_at: '2026-07-12T00:00:00.000Z',
};

async function mockArticleApi(page: Page) {
  await page.route('**/api/articles/live-story', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIVE_ARTICLE) }),
  );
  await page.route('**/api/articles/draft-story', (route) => route.fulfill({ status: 404 }));
  await page.route('**/api/articles/missing-story', (route) => route.fulfill({ status: 404 }));
  await page.route('**/api/articles?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([LIVE_ARTICLE]) }),
  );
}

test.beforeEach(async ({ page }) => {
  await mockArticleApi(page);
});

test('archived magazine cards open the published article reader', async ({ page }) => {
  await page.goto('/magazine-archive');
  await page.getByRole('button', { name: /Live Story/ }).click();

  await expect(page).toHaveURL('/article/live-story');
  await expect(page.getByRole('heading', { name: 'Live Story' }).first()).toBeVisible();
});

test('legacy openArticle events route Article stories by slug', async ({ page }) => {
  await page.goto('/magazine-archive');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openArticle', {
    detail: {
      story: {
        id: 'legacy-id',
        slug: 'live-story',
        title: 'Live Story',
        type: 'Article',
      },
    },
  })));

  await expect(page).toHaveURL('/article/live-story');
  await expect(page.getByRole('heading', { name: 'Live Story' }).first()).toBeVisible();
});

test('retired article destinations stay absent from public entry points', async ({ page }) => {
  await page.goto('/read');

  await expect(page.locator('a[href="/article/draft-story"]')).toHaveCount(0);
  await expect(page.locator('a[href="/article/missing-story"]')).toHaveCount(0);

  await page.goto('/magazine-archive');
  await page.locator('#main-content').getByRole('button', { name: 'Your Table' }).click();
  await expect(page.getByRole('link', { name: 'Saved stories' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Reading history' })).toHaveCount(0);
});
