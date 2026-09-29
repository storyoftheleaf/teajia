// tests/story-term-cards.spec.ts
// A tea term in a story is a tappable word that opens its glossary definition,
// on its first mention only. Checked on the hand-built Porcelain and Tea page
// (a live story, public to a visitor) and on a block-rendered story, at phone
// width, with the four standard page checks. Photos on Porcelain ship with the
// site; the block story's images are answered locally by the fixture.

import { test, expect, type Page } from './fixtures';

async function standardChecks(page: Page, name: string, errors: string[]) {
  await expect(page.getByText('Something went wrong', { exact: false }), `${name}: error boundary`).toHaveCount(0);
  await expect(page.getByText('Page not found', { exact: true }), `${name}: not-found page`).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${name}: horizontal overflow ${overflow}px`).toBeLessThanOrEqual(2);
  const real = errors.filter((e) => !/favicon|fonts\.g|woff|manifest|Failed to load resource/i.test(e));
  expect(real, `${name}: console errors: ${real.join(' | ')}`).toHaveLength(0);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('Porcelain and Tea: "gaiwan" opens its definition and closes again', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/read/porcelain-and-tea', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle('Shangyin Qiwu · Porcelain and Tea · Teajia');

  const term = page.locator('[data-term-link="gaiwan"]');
  await expect(term, 'first mention is linked, and only once').toHaveCount(1);
  await term.scrollIntoViewIfNeeded();
  await term.click();

  const card = page.getByTestId('term-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Gaiwan');
  await expect(card).toContainText('蓋碗');
  await expect(term).toHaveAttribute('aria-expanded', 'true');

  // The card stays inside the phone's width.
  const box = await card.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(vw);
  await page.screenshot({ path: 'test-results/story-term-cards/porcelain-gaiwan.png' });
  await standardChecks(page, 'porcelain open', errors);

  // Escape closes it and hands focus back to the word.
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
  await expect(term).toBeFocused();

  // Keyboard alone opens it again.
  await page.keyboard.press('Enter');
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Close' }).click();
  await expect(card).toHaveCount(0);
  await standardChecks(page, 'porcelain closed', errors);
});

const ARTICLE = {
  id: 'test-terms', slug: 'terms-story', title: 'Terms Story',
  status: 'published', tags: [], layout_template: 'immersive_scroll',
  created_at: '2026-09-29', updated_at: '2026-09-29',
  blocks: [
    { type: 'cover', title: 'Terms Story', kicker: 'Craft' },
    { type: 'paragraph', text: 'The surface has been vitrified in the kiln, and the ash glaze ran green.' },
    { type: 'paragraph', text: 'Later the ash glaze cracked, and we drank rootless water.', noTerms: true },
    { type: 'quote', text: 'Pour it from a gaiwan, then pour it from the gaiwan again.', attribution: 'The potter' },
  ],
};

test('a block story links first mentions, honours an opted-out block, and opens a card', async ({ page }) => {
  const errors = collectErrors(page);
  await page.route('**/api/**/articles/**', (route) => {
    const url = route.request().url();
    if (url.includes(ARTICLE.slug) || url.includes('by-slug')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ARTICLE) });
    }
    return route.continue();
  });
  await page.goto(`/article/${ARTICLE.slug}`);
  await expect(page.getByTestId('immersive-article')).toBeVisible();

  await expect(page.locator('[data-term-link="vitrification"]')).toHaveCount(1);
  await expect(page.locator('[data-term-link="ash-glaze"]'), 'second mention is plain').toHaveCount(1);
  await expect(page.locator('[data-term-link="rootless-water"]'), 'opted-out block is plain').toHaveCount(0);
  await expect(page.locator('[data-term-link="gaiwan"]'), 'quote links once').toHaveCount(1);

  const term = page.locator('[data-term-link="ash-glaze"]');
  await term.scrollIntoViewIfNeeded();
  await term.click();
  const card = page.getByTestId('term-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('灰釉');
  await expect(card).toContainText('huī yòu');
  await page.screenshot({ path: 'test-results/story-term-cards/block-ash-glaze.png' });
  await standardChecks(page, 'block story', errors);

  // Tapping outside closes it.
  await page.mouse.click(5, 5);
  await expect(card).toHaveCount(0);
});
