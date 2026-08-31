// tests/immersive-article.spec.ts
import { test, expect } from '@playwright/test';
import { primaryNav } from './helpers/navigation';

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
    // AR.2 — visual family.
    { type: 'image', variant: 'caption_bottom', url: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=800&q=80', description: '', caption: 'Wuyi cliffs at dawn' },
    { type: 'image', variant: 'film_strip', images: ['https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=600&q=80', 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cce2?w=600&q=80'], description: 'gallery' },
    // AR.4 — interactive & data family.
    { type: 'comparison', before: 'https://images.unsplash.com/photo-1523920290228-4f321a939b4c?w=600&q=80', after: 'https://images.unsplash.com/photo-1564890369478-c89ca6d9cce2?w=600&q=80', beforeLabel: 'Steep 1', afterLabel: 'Steep 5', caption: 'The liquor deepens' },
    { type: 'stat', value: '1,200', label: 'years of roasting', context: 'The fire technique predates the leaf grade.' },
    { type: 'map', caption: 'From cliff to cup', locations: ['Cliff', 'Wither', 'Roast', 'Cup'] },
    { type: 'tasting_notes', items: [{ label: 'Stone', note: 'deep and lasting' }, { label: 'Char', note: 'bold' }, { label: 'Longan', note: 'soft' }, { label: 'Mineral', note: 'pronounced' }] },
    { type: 'recipe', title: 'How to brew', steps: ['Rinse the leaf once.', 'Steep 12 seconds, gongfu.', 'Add 5 seconds each pass.'], ingredients: ['8g leaf', '120ml water', '98C'] },
    // AR.3 — text-effect dials wired through block data (line-stagger, blur-focus).
    { type: 'poem', variant: 'centered', text: 'Stone holds the heat.\nThe leaf forgets the rain.\nThe cup remembers both.' },
    { type: 'definition', term: 'Yan yun', body: 'The rock rhyme. The mineral signature a Wuyi tea carries from its cliff.', etymology: 'From the Chinese for cliff and lingering resonance.' },
    { type: 'product_link', title: 'Da Hong Pao, Spring 2025', blurb: 'The tea this story is about.', href: '/shop/da-hong-pao' },
    { type: 'audio', title: 'Listen to this passage' },
    { type: 'epilogue', text: 'The rock remembers.', signature: 'A.R.' },
    { type: 'back_matter', variant: 'copyright', lines: ['Words and photographs by A.R.', 'Teajia, 2026'] },
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

  // AR.2 visual family — inline image caption renders.
  await page.getByText('Wuyi cliffs at dawn').scrollIntoViewIfNeeded();
  await expect(page.getByText('Wuyi cliffs at dawn')).toBeVisible();

  // AR.4 interactive family — comparison slider, count-up stat, brewing steps,
  // origin map labels, product cross-link, and the colophon all render.
  await page.getByText('Steep 1', { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText('Steep 1', { exact: true })).toBeVisible();
  await expect(page.getByText('Steep 5', { exact: true })).toBeVisible();

  await page.getByText('years of roasting').scrollIntoViewIfNeeded();
  await expect(page.getByText('years of roasting')).toBeVisible();

  await page.getByText('From cliff to cup').scrollIntoViewIfNeeded();
  await expect(page.getByText('From cliff to cup')).toBeVisible();

  await page.getByText('Rinse the leaf once.').scrollIntoViewIfNeeded();
  await expect(page.getByText('Rinse the leaf once.')).toBeVisible();

  await page.getByText('Da Hong Pao, Spring 2025').scrollIntoViewIfNeeded();
  await expect(page.getByText('Da Hong Pao, Spring 2025')).toBeVisible();

  // AR.3 text-effect dials reachable from data: poem (line-stagger) + definition (blur-focus).
  await page.getByText('Stone holds the heat.').scrollIntoViewIfNeeded();
  await expect(page.getByText('Stone holds the heat.')).toBeVisible();
  await page.getByText('Yan yun').scrollIntoViewIfNeeded();
  await expect(page.getByText('Yan yun')).toBeVisible();

  await page.getByRole('button', { name: 'Play read-aloud' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Play read-aloud' })).toBeVisible();

  await page.getByText('Words and photographs by A.R.').scrollIntoViewIfNeeded();
  await expect(page.getByText('Words and photographs by A.R.')).toBeVisible();

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

test('share — the magazine SharePanel opens from the colophon in the immersive reader', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('/article/the-rock-remembers');
  await expect(page.getByTestId('immersive-article')).toBeVisible();

  // Open the share sheet from the closing colophon pill. The immersive reader
  // now uses the mature magazine SharePanel (4:5 poster + full destination set),
  // ported in over the thinner AR.6 card.
  const shareBtn = page.getByTestId('colophon-share');
  await shareBtn.scrollIntoViewIfNeeded();
  await shareBtn.click();

  const panel = page.getByTestId('share-panel');
  await expect(panel).toBeVisible();

  // Article-scope poster preview renders, and the destination set is present.
  await expect(panel.getByText('The article', { exact: true })).toBeVisible();
  await expect(panel.getByText('Save image', { exact: true })).toBeVisible();
  await expect(panel.getByText('Instagram', { exact: true })).toBeVisible();
  await expect(panel.getByText('Copy link', { exact: true })).toBeVisible();

  await page.screenshot({ path: `test-results/share-card-${test.info().project.name}.png` });

  expect(errors.filter((e) => !e.includes('favicon') && !/40[13]/.test(e))).toEqual([]);
});

test('immersive reader keeps the app navigation and carries its own back control', async ({ page }) => {
  await page.goto('/article/the-rock-remembers');
  await expect(page.getByTestId('immersive-article')).toBeVisible();

  // The reader used to suppress the bottom bar. It deliberately does not any
  // more (see the note beside the BottomTabBar render in App, and the commit
  // that made the DB reader chrome-consistent with /read): a reader who has
  // finished an article should be able to go anywhere in the app without
  // first going back. The layout stays full-bleed either way.
  // Whichever navigation the width shows: the floating bar on a phone, the
  // sidebar on the desk.
  await expect(primaryNav(page)).toBeVisible();

  // And it still carries its own back control, so the read is never a trap.
  await expect(page.getByTestId('immersive-back')).toBeVisible();
});
