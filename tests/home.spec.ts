/**
 * The home page, as swapped in on 2026-09-22 (src/pages/HomeV2Page.tsx).
 *
 * Runs on every configured project (Desktop Chrome and Mobile Chrome), so the
 * four floor checks hold at 390 wide as well as 1280: no horizontal overflow,
 * no error boundary, no 404, no JS console errors. The catalogue and the
 * story-content reads are mocked so the page renders the same with or without
 * the API, and the mocks are what the plates and the frames actually consume.
 */

import { test, expect, type Page } from './fixtures';
import { findScreenEdgeOverruns } from './helpers/screenEdge';

const TEA = {
  id: 'tea-1', slug: 'bamboo-leaf-1990', type: 'Dark', form: 'Loose Leaf',
  given_name: '1990 Bamboo Leaf Old Tea', product_name: '1990 Bamboo Leaf Old Tea',
  year: 1990, origin_country: 'China', origin_region: 'Guangxi, Cangwu (liubao)',
  retail_price_per_gram_usd: 1.65, fixed_retail_price_usd: null, stock_grams: 100,
  description: '', tasting_notes: [], image_url: null, additional_images: [],
  status: 'Active', is_personal: 0, can_reorder: 0, is_featured: 0, is_curated: 0,
  lore: null, show_wisdom: 1, processing_notes: null, terroir: null, mood: null,
  experience: null, material: null, capacity_ml: null, teaware_category: null,
  quantity_units: null, tasting: {}, tasting_source: null, piece_weight_g: null, cultivar: null,
};

async function open(page: Page, consoleErrors: string[]) {
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(err.message));
  await page.route('**/api/products/public**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([TEA]) }));
  await page.route('**/api/story-content/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/rates**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: /Tea deepens with what/ })).toBeVisible();
}

test('home renders clean: no overflow, no crash, no 404, no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  await open(page, consoleErrors);

  const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(ov, `horizontal overflow +${ov}px`).toBeLessThanOrEqual(2);
  const worst = (await findScreenEdgeOverruns(page))[0] ?? null;
  expect(worst, worst ? `<${worst.tag}> reaches ${worst.past}px past the right edge, showing "${worst.text}"` : '').toBeNull();

  const body = await page.locator('body').innerText();
  expect(body).not.toContain('Something went wrong');
  expect(body).not.toMatch(/\b404\b/);
  expect(body.toLowerCase()).not.toContain('page not found');

  const real = consoleErrors.filter(e => !e.includes('net::ERR') && !e.includes('Failed to load resource') && !e.includes('favicon'));
  expect(real, 'JS console errors').toHaveLength(0);
});

test('home carries its three movements and the tea on the table', async ({ page }) => {
  await open(page, []);
  // The opener's four lines are links, and Start here goes to the Start Here page.
  for (const name of ['Source your tea.', 'Discover the stories.', 'Deepen your practice.', 'Create the spaces to share.']) {
    await expect(page.getByRole('link', { name })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'New here? Start here' })).toHaveAttribute('href', '/start');
  // The plates: the piece, the tea from the mocked catalogue with its price for 50 g, the consult.
  await expect(page.getByRole('heading', { name: 'Porcelain and Tea' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bamboo Leaf Old Tea', exact: true })).toBeVisible();
  // The year sits in the tea's own year slot, never in its name (splitNameYear).
  await expect(page.getByText('50 g ·')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Twenty years in tea culture.' })).toBeVisible();
  // The house: the name split into tea and jiā, three characters, three facets, the way to stay.
  await expect(page.getByText('one sound, three pillars')).toBeVisible();
  for (const zi of ['佳', '家', '嘉']) await expect(page.getByText(zi, { exact: true })).toBeVisible();
  for (const title of ['Excellence', 'Home', 'Celebration']) await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
});

test('home does not hijack a manual scroll', async ({ page }) => {
  await open(page, []);
  await page.mouse.move(400, 400);
  await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 2000 });
  await page.waitForTimeout(600);
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeGreaterThan(100);
  expect(scrollY).toBeLessThan(700);
});

/**
 * Several teas are featured at once, because Featured is the shop's own strip.
 * The one on the table is whichever Adrian put FIRST in the shop-published
 * collection, not whichever the catalogue happens to return first. This feeds
 * two featured teas in the wrong catalogue order and expects the lower
 * position to win; with the old "first featured" rule it would show the other.
 */
test('the tea on the table is the first in the collection, not the first in the catalogue', async ({ page }) => {
  const other = { ...TEA, id: 'tea-0', slug: 'not-this-one', given_name: 'Not This One', product_name: 'Not This One', is_featured: 1, featured_position: 7 };
  const chosen = { ...TEA, is_featured: 1, featured_position: 1 };
  await page.route('**/api/products/public**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    // "Not This One" comes first in the catalogue, and must still lose.
    body: JSON.stringify([other, chosen]),
  }));
  await page.route('**/api/story-content/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/rates**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Bamboo Leaf Old Tea', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not This One' })).toHaveCount(0);
});
