import { expect, test } from './fixtures';
import { collectErrors, kenjiTanaka, meaningfulErrors, mockCreatorApi, noHorizontalOverflow, setTheme } from './helpers/creatorFixtures';

// The full spread, in the Read section's language and in Kenji's own words.
// The nav sticks with its progress line; the portrait is a lead cover; the
// hub under it is three bordered cells; every section is a divider and plain
// rows; the words land on the passage; the teas point at the collection; no
// arrow appears anywhere on the page.

test.describe('creator profile, full (Kenji Tanaka)', () => {
  test('lays out every section in order, each pointing where it should', async ({ page }) => {
    const errors = collectErrors(page);
    await mockCreatorApi(page);
    await page.goto('/people/kenji-tanaka');
    await expect(page.getByRole('heading', { level: 1, name: 'Kenji Tanaka' })).toBeVisible();

    // The nav: back to all people, the wordmark, the issue eyebrow, sticky at the top.
    const nav = page.getByRole('navigation', { name: 'Site' });
    await expect(nav.getByRole('link', { name: 'Back to all people' })).toHaveAttribute('href', '/people');
    await expect(nav).toContainText(/People · N°\d\d/);
    expect(await nav.locator('..').evaluate(element => getComputedStyle(element).position)).toBe('sticky');

    // The cover: kicker, the name with an italic gold surname, one line in his own words.
    const cover = page.getByTestId('profile-cover');
    await expect(cover).toContainText('Tea master · host · Kyoto');
    await expect(cover.locator('h1 .italic')).toHaveText('Tanaka');
    await expect(cover).toContainText('I pour on Saturday evenings at Tanaka Tea House, four guests at most.');
    expect(await cover.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('1px');

    // The hub: exactly Words, Teas, Pay, side by side, no counts, each 48px tall.
    const hub = page.getByTestId('profile-hub');
    await expect(hub.getByRole('link')).toHaveCount(3);
    await expect(hub.getByRole('link', { name: 'Words' })).toHaveAttribute('href', '#words');
    await expect(hub.getByRole('link', { name: 'Teas' })).toHaveAttribute('href', '#teas');
    await expect(hub.getByRole('link', { name: 'Pay' })).toHaveAttribute('href', '/people/kenji-tanaka/pay');
    const [words, teasCell, payCell] = await Promise.all([hub.getByRole('link', { name: 'Words' }).boundingBox(), hub.getByRole('link', { name: 'Teas' }).boundingBox(), hub.getByRole('link', { name: 'Pay' }).boundingBox()]);
    expect(Math.round(words!.height)).toBe(48);
    expect(Math.abs(words!.width - teasCell!.width)).toBeLessThan(2);
    expect(Math.abs(teasCell!.width - payCell!.width)).toBeLessThan(2);
    expect(words!.y).toBe(teasCell!.y);
    expect(await hub.innerText()).not.toMatch(/\d/);

    // In my words: the quote, then two paragraphs, all first person.
    await expect(page.getByTestId('profile-quote')).toContainText('Tea is not a performance.');
    const mine = page.getByTestId('profile-words-of-mine');
    await expect(mine).toContainText('In my words');
    await expect(mine).toContainText('I pour on Saturday evenings');
    await expect(mine).toContainText('I still source most of my sencha');
    await expect(mine).not.toContainText('I trained for six years');

    // Hands on: five photos, two columns.
    const gallery = page.getByTestId('profile-gallery');
    await expect(gallery).toContainText('Hands on');
    await expect(gallery.locator('img')).toHaveCount(5);

    // Words: plain rows, title and subtitle, no rubric; the piece where he is quoted says so in its line and lands on the passage.
    const wordsSection = page.getByTestId('profile-words');
    const rows = wordsSection.getByTestId('profile-word-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('href', '/article/kenji-tanaka-words-fixture');
    await expect(rows.nth(0)).toHaveText('What Three Steeps Taught MeNotes from the tea room');
    await expect(rows.nth(1)).toHaveAttribute('href', '/article/four-houses-one-kettle-fixture#quote-kenji-tanaka');
    await expect(rows.nth(1)).toHaveText('Four Houses, One KettleA room full of new drinkers I am quoted in it; it opens at the passage.');
    expect(await wordsSection.innerText()).not.toMatch(/N°|Wrote|Quoted in/);

    // The teas: the collection cover first, then three plain rows with a tinted type and year rubric, then the rest.
    const teas = page.getByTestId('profile-teas');
    const collection = teas.getByTestId('profile-collection');
    await expect(collection).toHaveAttribute('href', '/c/saturday-at-the-house-fixture');
    await expect(collection).toContainText('My collection · six teas');
    await expect(collection).toContainText('Saturday at the house');
    const teaRows = teas.getByTestId('profile-tea-row');
    await expect(teaRows).toHaveCount(3);
    await expect(teaRows.nth(0)).toContainText('Call of Grace');
    await expect(teaRows.nth(0)).toContainText('A red tea I pour for guests');
    await expect(teaRows.nth(0)).toContainText('Oolong · 1988');
    const rubricColor = await teaRows.nth(0).locator('span[style*="color"]').first().evaluate(element => getComputedStyle(element).color);
    const dimColor = await page.getByTestId('profile-hosting').getByText('Session').evaluate(element => getComputedStyle(element).color);
    expect(rubricColor).not.toBe(dimColor);
    await expect(teas.getByRole('link', { name: 'And three more, in the collection' })).toHaveAttribute('href', '/c/saturday-at-the-house-fixture');

    // Hosting: one row, linking to the event, dated in words.
    const hosting = page.getByTestId('profile-hosting');
    await expect(hosting.getByRole('link', { name: /Gongfu evening/ })).toHaveAttribute('href', '/event/sbx-kyoto-tasting-fixture');
    await expect(hosting).toContainText('Saturday 10 October, 19:00, at Tanaka Tea House.');
    await expect(hosting).toContainText('Session');

    // My table: one row, linking to the store, in his words.
    const house = page.getByTestId('profile-house');
    await expect(house).toContainText('My table');
    await expect(house.getByRole('link', { name: /Tanaka Tea House/ })).toHaveAttribute('href', '/store/tanaka-tea-house');
    await expect(house).toContainText('My shop and sessions in Kyoto, and how to find the door.');

    // Reach me: three plain rows, handle on the left, platform as the rubric, no image and no icon.
    const reach = page.getByTestId('profile-reach');
    const reachRows = reach.getByTestId('profile-reach-row');
    await expect(reachRows).toHaveCount(3);
    await expect(reachRows.nth(0)).toContainText('tanaka_tea_kyoto');
    await expect(reachRows.nth(0)).toContainText('WeChat');
    await expect(reachRows.nth(1)).toHaveAttribute('href', 'https://www.instagram.com/tanakateahouse/');
    await expect(reachRows.nth(1)).toContainText('Instagram');
    await expect(reachRows.nth(2)).toHaveAttribute('href', 'https://example.com');
    await expect(reachRows.nth(2)).toContainText('Website');
    await expect(reach.locator('img')).toHaveCount(0);
    await expect(reach.locator('svg')).toHaveCount(0);

    // The closing line, then the way out. No arrows, and nothing about him in the third person.
    const body = await page.locator('body').innerText();
    expect(body).toContain('let it be how the third steep tasted');
    await expect(page.getByRole('link', { name: 'All people', exact: true })).toHaveAttribute('href', '/people');
    expect(body).not.toContain('→');
    expect(body).not.toContain('←');
    expect(body).not.toMatch(/\bHis (way|house)\b/);

    // Order, top to bottom.
    // Dividers carry a caps text-transform, so innerText reads them in upper case.
    // Each divider is searched for after the one before it (the hub's own
    // "Words" cell comes first on the page), so a hit for every label is the
    // order itself.
    const order = ['in my words', 'hands on', 'words', 'the teas', 'hosting', 'my table', 'reach me'];
    const lower = body.toLowerCase();
    let cursor = lower.indexOf('in my words');
    const positions = order.map(label => { const at = lower.indexOf(label, cursor); if (at >= 0) cursor = at + label.length; return at; });
    expect(positions.every(position => position >= 0)).toBe(true);

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

  test('with no person collection the teas fall back to the favorites page and the hub keeps its Teas cell', async ({ page }) => {
    // Playwright tries the most recently registered route first, so the catch-all goes in first.
    await page.route('**/api/**', route => route.fulfill({ json: {} }));
    await page.route('**/api/people/kenji-tanaka', route => route.fulfill({ json: { ...kenjiTanaka, collection: null } }));
    await page.goto('/people/kenji-tanaka');
    const teas = page.getByTestId('profile-teas');
    await expect(teas.getByTestId('profile-collection')).toHaveCount(0);
    await expect(teas.getByTestId('profile-tea-row')).toHaveCount(3);
    await expect(teas.getByRole('link', { name: 'And three more, in the selection' })).toHaveAttribute('href', '/people/kenji-tanaka/favorites');
    await expect(page.getByTestId('profile-hub').getByRole('link', { name: 'Teas' })).toBeVisible();
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
    const inView = await quote.evaluate(element => {
      const box = element.getBoundingClientRect();
      return box.left >= -2 && box.right <= window.innerWidth + 2;
    });
    expect(inView).toBe(true);
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
