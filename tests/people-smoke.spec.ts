import { test, expect } from './fixtures';

const profileFixture = {
  id: 'publishing-fixture', account_id: 'acct', display_name: 'Publishing Fixture', role: 'Writer', is_published: 1,
  beginnings: 'Synthetic origin.', inspirations: 'Synthetic inspirations.', links: [], articles: [], featured_in: [], products: [], host_account: null, seasonal_line: null,
  pull_quotes: [
    { pull_quote: 'First synthetic quote.', author_id: 'writer-one', published_at: '2026-01-01', article_slug: 'first-source', article_title: 'First Source' },
    { pull_quote: 'Second synthetic quote.', author_id: 'writer-one', published_at: '2026-01-02', article_slug: 'second-source', article_title: 'Second Source' },
  ], created_at: '2026-01-01', updated_at: '2026-01-01',
};

test('profile weaves two distinct pull quotes into their editorial positions', async ({ page }) => {
  await page.route('**/api/people/publishing-fixture', route => route.fulfill({ json: profileFixture }));
  await page.goto('/people/publishing-fixture');
  const first = page.getByText('First synthetic quote.'); const second = page.getByText('Second synthetic quote.');
  await expect(first).toBeVisible(); await expect(second).toBeVisible();
  await expect(first.locator('xpath=ancestor::blockquote').getByRole('link')).toHaveAttribute('href', '/article/first-source');
  await expect(second.locator('xpath=ancestor::blockquote').getByRole('link')).toHaveAttribute('href', '/article/second-source');
  const text = await page.locator('article').innerText();
  expect(text.indexOf('Synthetic origin.')).toBeLessThan(text.indexOf('First synthetic quote.'));
  expect(text.indexOf('First synthetic quote.')).toBeLessThan(text.indexOf('Synthetic inspirations.'));
  expect(text.indexOf('Synthetic inspirations.')).toBeLessThan(text.indexOf('Second synthetic quote.'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
});

test('article contributor byline links while a legacy byline remains plain text', async ({ page }) => {
  const base = { id: 'article', account_id: 'acct', title: 'Byline Test', status: 'published', category: 'Field Notes', tags: [], blocks: [{ type: 'intro', text: 'Synthetic article.' }], layout_template: 'default', created_at: '2026-01-01', updated_at: '2026-01-01' };
  await page.route('**/api/articles/linked-article', route => route.fulfill({ json: { ...base, slug: 'linked-article', author_id: 'publishing-fixture', author_name: 'Publishing Fixture' } }));
  await page.goto('/article/linked-article');
  await expect(page.getByRole('link', { name: 'Publishing Fixture' }).first()).toHaveAttribute('href', '/people/publishing-fixture');
  await page.route('**/api/articles/legacy-article', route => route.fulfill({ json: { ...base, slug: 'legacy-article', author_id: 'legacy-writer', author_name: null } }));
  await page.goto('/article/legacy-article');
  await expect(page.getByText('Legacy Writer', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Legacy Writer' })).toHaveCount(0);
});

// Verification gate for the contributor profile pages. Ensures the new
// /people routes render without crashing, that the masthead picks up the
// seed data, and that there's no horizontal overflow at mobile width.

test('contributor profile page renders chen', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));

  await page.route('**/api/people/chen', route => route.fulfill({ json: { ...profileFixture, id: 'chen', display_name: 'Chen Wei', role: 'Tea Master', pull_quotes: [] } }));

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

  await page.route('**/api/people', route => route.fulfill({ json: { contributors: [{ id: 'chen', display_name: 'Chen Wei', role: 'Tea Master' }] } }));

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
