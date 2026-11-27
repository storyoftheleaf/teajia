// npx playwright test --config tests/home-and-bar.config.ts
//
// Home and the bar (Launch 4, K7 and K10), with the new bar off and on, at
// 320 by 700, 390 by 844 and 1280 by 800. Off, the bar, the rail, the phone
// menu, the keys and Home are exactly today's. On, they carry the four words
// from src/components/navSections.ts. Every API answer is mocked.
import { expect, test, type Page, type Route } from './fixtures';

test.beforeEach(({}, info) => {
  test.skip(!info.config.metadata.homeAndBar, 'Run with tests/home-and-bar.config.ts, which starts the two local sites.');
});

const barOn = () => test.info().project.metadata.bar === 'on';
const isPhone = () => (test.info().project.use.viewport?.width ?? 1280) < 1024;

const TODAY = ['Read', 'Craft', 'Advise', 'Shop'];
const LAUNCH_FOUR = ['Read', 'Tea table', 'Tea house', 'Shop'];
const words = () => (barOn() ? LAUNCH_FOUR : TODAY);

/** Where each word leads. The Tea Table and the Tea Houses portfolio are shut on both sites, so their words take their open doors. */
const DOORS: Record<string, string> = {
  Read: '/read', Craft: '/craft', Advise: '/advise', Shop: '/shop',
  'Tea table': '/events', 'Tea house': '/advise',
};

async function mockApi(page: Page) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path.startsWith('/api/media/') || path === '/api/public/read/publish-state' || path === '/api/read/session') return route.fallback();
    if (path === '/api/auth/me') return route.fulfill({ status: 401, json: {} });
    if (path === '/api/rates') return route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }] });
    if (['/api/events', '/api/tea-reviews', '/api/products/public', '/api/network/stores'].includes(path)
      || /^\/api\/products\/[^/]+\/(?:events|impressions)$/.test(path)
      || /impressions/.test(path)) return route.fulfill({ json: [] });
    if (path === '/api/user/favorites') return route.fulfill({ json: { favorites: [] } });
    return route.fulfill({ status: 404, json: { error: 'No fixture for ' + path } });
  });
}

async function noHorizontalOverflow(page: Page, where: string) {
  const layout = await page.evaluate(() => ({
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    client: document.documentElement.clientWidth,
  }));
  expect.soft(layout.scroll, `${where}: page width`).toBeLessThanOrEqual(layout.client);
}

/** The words on whichever navigation this size shows, in order. */
async function shownWords(page: Page): Promise<string[]> {
  if (isPhone()) {
    const bar = page.getByTestId('bottom-tab-bar');
    await expect(bar).toBeVisible();
    return bar.locator('.bottom-nav-label').allInnerTexts();
  }
  const rail = page.getByRole('navigation', { name: 'Browse' });
  await expect(rail).toBeVisible();
  return rail.locator('.nav-rail-word').allInnerTexts();
}

function wordLink(page: Page, word: string) {
  return isPhone()
    ? page.getByTestId('bottom-tab-bar').getByRole('button', { name: word, exact: true })
    : page.getByRole('navigation', { name: 'Browse' }).getByText(word, { exact: true });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('the four words, in order, with nothing spilling sideways', async ({ page }) => {
  await page.goto('/');
  const shown = await shownWords(page);
  expect(shown.map(w => w.toLowerCase())).toEqual(words().map(w => w.toLowerCase()));
  await noHorizontalOverflow(page, 'home');

  if (isPhone()) {
    // Every word sits whole inside the capsule, and no two words overlap.
    const bar = await page.getByTestId('bottom-tab-bar').boundingBox();
    const labels = page.getByTestId('bottom-tab-bar').locator('.bottom-nav-label');
    const boxes = [];
    for (let i = 0; i < await labels.count(); i++) boxes.push(await labels.nth(i).boundingBox());
    for (const box of boxes) {
      expect(box!.x).toBeGreaterThanOrEqual(bar!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(bar!.x + bar!.width);
    }
    for (let i = 1; i < boxes.length; i++) {
      if (i === 2) continue; // the emblem sits between the second and third
      expect(boxes[i]!.x, `word ${i} overlaps the one before`).toBeGreaterThanOrEqual(boxes[i - 1]!.x + boxes[i - 1]!.width);
    }
    const size = await labels.first().evaluate(el => getComputedStyle(el).fontSize);
    const width = test.info().project.use.viewport!.width;
    const expected = barOn() && width < 340 ? '13px' : width >= 400 ? '15px' : '14px';
    expect(size, 'one size smaller under 340px, with the new words only').toBe(expected);
  }
});

test('every word leads to a page that exists, and lights there', async ({ page }) => {
  // One load, then word to word: the bar and the rail stay on every page.
  await page.goto('/');
  for (const word of words()) {
    await wordLink(page, word).click();
    await expect(page).toHaveURL(new RegExp(`${DOORS[word].replace(/\//g, '\\/')}(\\?.*)?$`));
    await expect(page.getByRole('heading', { name: '404', exact: true })).toHaveCount(0);
    await noHorizontalOverflow(page, word);
    if (isPhone()) {
      await expect(page.getByTestId('bottom-tab-bar').getByRole('button', { name: word, exact: true })).toHaveAttribute('aria-current', 'page');
    }
  }
});

test('keys 1 to 5 follow the words', async ({ page }) => {
  test.skip(isPhone(), 'Keys are a desktop shortcut.');
  const paths = ['/', ...words().map(w => DOORS[w])];
  await page.goto('/shop');
  for (const [index, path] of paths.entries()) {
    await page.locator('body').press(String(index + 1));
    await expect(page).toHaveURL(new RegExp(`127\\.0\\.0\\.1:\\d+${path === '/' ? '\\/$' : path.replace(/\//g, '\\/')}`));
  }
});

test('the phone menu: today\'s rows, or the short list with the new bar', async ({ page }) => {
  test.skip(!isPhone(), 'The phone menu is a phone control.');
  await page.goto('/');
  await page.getByTestId('bottom-tab-bar').getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByTestId('site-menu');
  await expect(menu).toBeVisible();
  const rows = barOn() ? ['Work with Adrian', 'Cart', 'About'] : ['Sessions', 'People', 'Places', 'Tea Wisdom', 'Cart', 'About'];
  for (const row of rows) await expect(menu.getByText(row, { exact: true })).toBeVisible();
  if (barOn()) for (const gone of ['Sessions', 'People', 'Places', 'Tea Wisdom']) await expect(menu.getByText(gone, { exact: true })).toHaveCount(0);
  await noHorizontalOverflow(page, 'menu');
});

test('Home: today\'s lines, or the four doors and "Come to a table"', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tea deepens with what you bring to the table and what you leave behind.');
  const lines = page.getByRole('navigation', { name: 'Homepage destinations' });
  if (barOn()) {
    const doors = lines.getByRole('link');
    await expect(doors).toHaveText([
      'Discover stories, craft and tea wisdom',
      'Deepen sit at a table, taste, share what you found',
      'Create a tea house, or a table of your own',
      'Source fine tea and teaware, found by hand',
    ]);
    // Each door goes where its bar word goes.
    const bar = [DOORS.Read, DOORS['Tea table'], DOORS['Tea house'], DOORS.Shop];
    for (const [index, href] of bar.entries()) await expect(doors.nth(index)).toHaveAttribute('href', href);
    for (let index = 0; index < 4; index++) {
      const box = await doors.nth(index).boundingBox();
      expect(box!.height, 'a door is at least 44 tall').toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByTestId('home-four-doors').locator('xpath=following::*[@data-testid="home-come-to-a-table"]')).toHaveCount(1);
    for (const [index, href] of bar.entries()) {
      await doors.nth(index).click();
      await expect(page).toHaveURL(new RegExp(`${href.replace(/\//g, '\\/')}(\\?.*)?$`));
      // Every door lands, Create included: it goes to Advise until Tea Houses opens (4.20).
      await expect(page.getByRole('heading', { name: '404', exact: true })).toHaveCount(0);
      await page.goto('/');
    }
    const door = page.getByTestId('home-come-to-a-table').getByRole('link');
    await expect(door).toHaveAttribute('href', '/events');
    await door.click();
    await expect(page).toHaveURL(/\/events$/);
  } else {
    await expect(lines.getByRole('link')).toHaveText(['Source your tea.', 'Discover the stories.', 'Deepen your practice.', 'Create the spaces to share.']);
    await expect(page.getByTestId('home-come-to-a-table')).toHaveCount(0);
    await expect(page.getByTestId('home-four-doors')).toHaveCount(0);
  }
  // The strips need the Tea Table and the portfolio open; both are shut here, so neither shows.
  await expect(page.getByTestId('home-tea-table')).toHaveCount(0);
  await expect(page.getByTestId('home-tea-houses')).toHaveCount(0);
  await noHorizontalOverflow(page, 'home');
});

test('Read\'s three shelves on /read, /craft and /wisdom, only with the new bar', async ({ page }) => {
  for (const path of ['/read', '/craft', '/wisdom']) {
    await page.goto(path);
    const shelves = page.getByTestId('read-shelves');
    if (!barOn()) {
      await expect(page.locator('main, article, body').first()).toBeVisible();
      await expect(shelves).toHaveCount(0);
      continue;
    }
    await expect(shelves.getByRole('link')).toHaveText(['Stories', 'Craft', 'Wisdom']);
    await expect(shelves.locator('[aria-current="page"]')).toHaveAttribute('href', path);
    await noHorizontalOverflow(page, path);
    if (isPhone()) await expect(page.getByTestId('bottom-tab-bar').getByRole('button', { name: 'Read', exact: true })).toHaveAttribute('aria-current', 'page');
  }
  if (barOn()) {
    await page.getByTestId('read-shelves').getByRole('link', { name: 'Stories' }).click();
    await expect(page).toHaveURL(/\/read$/);
  }
});

test('old addresses keep working', async ({ page }) => {
  for (const path of ['/craft', '/advise', '/spaces', '/find-a-table', '/people', '/events', '/wisdom']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}(\\?.*)?$`));
    await expect(page.getByRole('heading', { name: '404', exact: true })).toHaveCount(0);
  }
});
