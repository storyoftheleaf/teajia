import { expect, test } from './fixtures';
import { collectErrors, kenjiTanaka, meaningfulErrors, mockCreatorApi, noHorizontalOverflow, setTheme } from './helpers/creatorFixtures';

// The full spread. Kenji has every section: the hub names each one, the
// words land on the passage, the teas point at his collection, and no arrow
// appears anywhere on the page.

test.describe('creator profile, full (Kenji Tanaka)', () => {
  test('lays out every section in order, each pointing where it should', async ({ page }) => {
    const errors = collectErrors(page);
    await mockCreatorApi(page);
    await page.goto('/people/kenji-tanaka');
    await expect(page.getByRole('heading', { level: 1, name: 'Kenji Tanaka' })).toBeVisible();

    // Masthead: issue line, name, business and place over the fade.
    const header = page.locator('header').first();
    await expect(header).toContainText('Tea Master · Host');
    await expect(header).toContainText('Tanaka Tea House · Kyoto, Japan');

    // The hub: one cell per section, counts on words and teas, marks in the last cell.
    const hub = page.getByTestId('profile-hub');
    await expect(hub.getByRole('link', { name: 'Words · 2' })).toHaveAttribute('href', '#words');
    await expect(hub.getByRole('link', { name: 'Teas · 6' })).toHaveAttribute('href', '#teas');
    await expect(hub.getByRole('link', { name: 'Hosting' })).toHaveAttribute('href', '#hosting');
    await expect(hub.getByRole('link', { name: 'His house' })).toHaveAttribute('href', '#house');
    await expect(hub.getByRole('link', { name: 'Pay' })).toHaveAttribute('href', '/people/kenji-tanaka/pay');
    await expect(hub.getByRole('link', { name: 'WeChat: tanaka_tea_kyoto' })).toHaveAttribute('href', '#reach');
    await expect(hub.getByRole('link', { name: 'Instagram: @tanakateahouse' })).toBeVisible();
    await expect(hub.getByRole('link', { name: 'Website: https://example.com' })).toBeVisible();
    // 44px tap targets on the marks.
    const markBox = await hub.getByRole('link', { name: 'WeChat: tanaka_tea_kyoto' }).boundingBox();
    expect(markBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    // His way with tea: the quote, then now, then one origin paragraph.
    await expect(page.getByTestId('profile-quote')).toContainText('Tea is not a performance.');
    const way = page.locator('#way');
    await expect(way).toContainText('Focused this year on teaching');
    await expect(way).toContainText('Trained for six years under a sencha producer');
    await expect(way).not.toContainText('The first tea he ever served a stranger');
    await expect(way).toContainText('Autumn 2026');

    // The photos: five, two columns, edge to edge.
    const gallery = page.getByTestId('profile-gallery');
    await expect(gallery.locator('img')).toHaveCount(5);
    const galleryBox = await gallery.locator('ul').boundingBox();
    expect(galleryBox?.x ?? 99).toBeLessThanOrEqual(1);

    // Words: the lead with its cover above the title, then the quoted-in row landing on the passage.
    const words = page.getByTestId('profile-words');
    const lead = words.getByRole('link', { name: /What Three Steeps Taught Me/ });
    await expect(lead).toHaveAttribute('href', '/article/kenji-tanaka-words-fixture');
    await expect(lead).toContainText('Wrote · Autumn 2026');
    await expect(lead).toContainText('6 min read');
    const quoted = words.getByRole('link', { name: /Four Houses, One Kettle/ });
    await expect(quoted).toHaveAttribute('href', '/article/four-houses-one-kettle-fixture#quote-kenji-tanaka');
    await expect(quoted).toContainText('Quoted in');
    await expect(quoted).toContainText('Opens at the passage');
    const quotedCover = await quoted.locator('img').boundingBox();
    expect(quotedCover?.width).toBe(72);
    expect(quotedCover?.height).toBe(72);

    // The teas: the collection as the destination, a full-width gold button, three rows, then the rest.
    const teas = page.getByTestId('profile-teas');
    await expect(teas).toContainText('Collection · 6 teas');
    await expect(teas).toContainText('Saturday at the house');
    const open = teas.getByRole('link', { name: 'Open the collection' });
    await expect(open).toHaveAttribute('href', '/c/saturday-at-the-house-fixture');
    const openBox = await open.boundingBox();
    const teasBox = await teas.boundingBox();
    expect((openBox?.width ?? 0)).toBeGreaterThan((teasBox?.width ?? 999) - 40);
    await expect(teas.locator('ol > li')).toHaveCount(3);
    await expect(teas.locator('ol')).toContainText('Call of Grace');
    await expect(teas.locator('ol')).toContainText('1988');
    await expect(teas.locator('ol')).toContainText('Anxi, Fujian');
    await expect(teas.getByRole('link', { name: 'And 3 more, in the collection' })).toHaveAttribute('href', '/c/saturday-at-the-house-fixture');

    // Hosting: a 120px flyer beside the words, linking to the event.
    const hosting = page.getByTestId('profile-hosting');
    const hostingLink = hosting.getByRole('link', { name: /Gongfu evening/ });
    await expect(hostingLink).toHaveAttribute('href', '/event/sbx-kyoto-tasting-fixture');
    expect((await hostingLink.locator('img').boundingBox())?.width).toBe(120);
    await expect(hosting).toContainText('19:00');

    // His house: 72px square beside the store name, linking to the store.
    const house = page.getByTestId('profile-house');
    await expect(house.getByRole('link', { name: /Tanaka Tea House/ })).toHaveAttribute('href', '/store/tanaka-tea-house');

    // Reach: WeChat with its QR inline, Instagram and website beside it.
    const reach = page.getByTestId('profile-reach');
    await expect(reach.getByRole('button', { name: 'Copy WeChat id tanaka_tea_kyoto' }).locator('img')).toHaveAttribute('alt', 'WeChat QR code');
    await expect(reach.getByRole('link', { name: '@tanakateahouse' })).toHaveAttribute('href', 'https://www.instagram.com/tanakateahouse/');
    await expect(reach.getByRole('link', { name: 'example.com' })).toHaveAttribute('href', 'https://example.com');

    // The closing line, then the way out. And no arrows anywhere on the page.
    const body = await page.locator('body').innerText();
    expect(body).toContain('let it be how the third steep tasted');
    await expect(page.getByRole('link', { name: 'All people' })).toHaveAttribute('href', '/people');
    expect(body).not.toContain('→');
    expect(body).not.toContain('←');

    // Order, top to bottom.
    const order = ['His way with tea', 'Words', 'The teas', 'Hosting', 'His house', 'Reach him'];
    const positions = order.map(label => body.indexOf(label));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors), 'console errors on /people/kenji-tanaka').toHaveLength(0);
    await page.screenshot({ path: 'test-results/creator-profile-kenji-dark.png', fullPage: true });
  });

  test('reads the same in light mode', async ({ page }) => {
    await mockCreatorApi(page);
    await setTheme(page, 'light');
    await page.goto('/people/kenji-tanaka');
    await expect(page.getByRole('heading', { level: 1, name: 'Kenji Tanaka' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.classList.contains('light'))).toBe(true);
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.screenshot({ path: 'test-results/creator-profile-kenji-light.png', fullPage: true });
  });

  test('with no person collection the teas fall back to the favorites page', async ({ page }) => {
    // Playwright tries the most recently registered route first, so the catch-all goes in first.
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/api/people/kenji-tanaka', route => route.fulfill({ json: { ...kenjiTanaka, collection: null } }));
    await page.goto('/people/kenji-tanaka');
    const teas = page.getByTestId('profile-teas');
    await expect(teas.getByRole('link', { name: 'See the full selection' })).toHaveAttribute('href', '/people/kenji-tanaka/favorites');
    await expect(teas.getByRole('link', { name: 'And 3 more, in the selection' })).toHaveAttribute('href', '/people/kenji-tanaka/favorites');
    await expect(page.getByTestId('profile-hub').getByRole('link', { name: 'Teas · 6' })).toBeVisible();
  });

  test('the quoted-in link lands on the passage inside the article, lit with a flat wash', async ({ page }) => {
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/api/articles/four-houses-one-kettle-fixture', route => route.fulfill({ json: {
      id: 'art-featuring', account_id: 'acct', title: 'Four Houses, One Kettle', slug: 'four-houses-one-kettle-fixture', status: 'published',
      author_id: 'amara-osei', author_name: 'Amara Osei', tags: [], layout_template: 'default',
      pull_quote: 'The second steep is the honest one. The first is what the leaf wants you to think.', pull_quote_subject: 'kenji-tanaka',
      blocks: [{ type: 'intro', text: 'Four tea houses, one afternoon.' }, { type: 'paragraph', text: 'Kenji poured first.' }],
      created_at: '2026-09-10', updated_at: '2026-09-10',
    } }));
    await page.goto('/article/four-houses-one-kettle-fixture#quote-kenji-tanaka');
    const quote = page.locator('#quote-kenji-tanaka');
    await expect(quote).toBeVisible();
    await expect(quote).toContainText('The second steep is the honest one.');
    // The page holding the anchor is the one in view, not the cover.
    const inView = await quote.evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.left >= -2 && box.right <= window.innerWidth + 2;
    });
    expect(inView).toBe(true);
    // Lit with the flat accent wash, and no shadow or glow.
    await expect(quote).toHaveAttribute('data-quote-highlight', 'true');
    const styles = await quote.evaluate(element => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, shadow: computed.boxShadow, filter: computed.filter };
    });
    expect(styles.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.shadow).toBe('none');
    expect(styles.filter).toBe('none');
  });
});
