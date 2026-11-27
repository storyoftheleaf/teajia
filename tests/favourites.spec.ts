import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

// Launch 4, favourites in three kinds (todo/plans/guests-and-tea-masters-launch-4-run.md, K3).
// At 390 by 844 with mocked routes. Favourites are closed until Adrian ships
// Launch 4; with VITE_FAVOURITES_OPEN=true on the site these walk the open
// page, and without it they prove nothing of it appears.

const favouritesOpen = process.env.VITE_FAVOURITES_OPEN !== 'false';

function fakeJWT(payload: object): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const token = fakeJWT({
  sub: 'reader', email: 'reader@example.test', name: 'Reader', role: 'member',
  exp: Math.floor(Date.now() / 1000) + 86_400,
});

const ARTICLE = {
  id: 'art-water', slug: 'water-and-stone', title: 'Water and Stone',
  status: 'published', tags: [], layout_template: 'immersive_scroll',
  created_at: '2026-11-01', updated_at: '2026-11-01',
  blocks: [
    { type: 'intro', text: 'The water came down off the stone and we waited for it.' },
    { type: 'paragraph', text: 'By the third pour the room had gone quiet.' },
  ],
};

type State = {
  articles: string[];
  shopTeas: string[];
  chest: Record<string, boolean>;
};

const CHEST = [
  { id: 'chest-1', name: 'Old Liu Bao', type: 'Liu Bao', year: 2012 },
  { id: 'chest-2', name: 'Spring Dancong', type: 'Oolong', year: null },
];

async function prepare(page: Page, state: State, { signedIn = true } = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  if (signedIn) {
    await page.addInitScript(({ value, favourites }) => {
      localStorage.setItem('teajia_token', value);
      localStorage.setItem('teajia-storage', JSON.stringify({ version: 6, state: { favoriteTeas: favourites } }));
    }, { value: token, favourites: state.shopTeas });
  }
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    if (pathname === `/api/articles/${ARTICLE.slug}`) return route.fulfill({ json: ARTICLE });
    if (pathname === '/api/articles/paged-story') {
      return route.fulfill({ json: { ...ARTICLE, id: 'art-paged', slug: 'paged-story', layout_template: null } });
    }
    if (pathname === '/api/me/favourites' && method === 'GET') {
      if (!favouritesOpen) return route.fulfill({ status: 404, json: { error: 'Not found' } });
      return route.fulfill({ json: {
        articles: state.articles.map(id => ({
          id, slug: ARTICLE.slug, title: ARTICLE.title, subtitle: null, cover_image_url: null,
          path: `/article/${ARTICLE.slug}`, is_public: false,
        })),
        shop_teas: state.shopTeas.map(id => ({ id, name: 'Old Tree Red', type: 'Red', image_url: null, path: '/shop/product/old-tree-red' })),
        chest_teas: CHEST.filter(tea => state.chest[tea.id]).map(tea => ({ ...tea, image_url: null, path: '/account/cellar' })),
      } });
    }
    const article = pathname.match(/^\/api\/me\/favourites\/articles\/([^/]+)$/);
    if (article) {
      if (method === 'PUT' && !state.articles.includes(article[1])) state.articles.push(article[1]);
      if (method === 'DELETE') state.articles = state.articles.filter(id => id !== article[1]);
      return route.fulfill({ json: { kept: method === 'PUT' } });
    }
    const chest = pathname.match(/^\/api\/me\/cellar\/([^/]+)\/favourite$/);
    if (chest) {
      const { favourite } = request.postDataJSON() as { favourite: boolean };
      state.chest[chest[1]] = favourite;
      return route.fulfill({ json: { id: chest[1], favourite } });
    }
    if (pathname === '/api/me/cellar') {
      return route.fulfill({ json: { items: CHEST.map(tea => ({
        ...tea, origin: null, grams: 100, placementStatus: 'private', placementAccountId: null,
        linkedProductId: null, shelfPublished: false, favourite: !!state.chest[tea.id],
        createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z',
      })) } });
    }
    if (pathname === '/api/me/shelf') return route.fulfill({ json: { enabled: false, slug: null, title: null, whatsapp: null } });
    if (pathname === '/api/user/favorites') {
      if (method === 'PUT') state.shopTeas = (request.postDataJSON() as { favorites: string[] }).favorites;
      return route.fulfill({ json: { favorites: state.shopTeas } });
    }
    return route.fulfill({ json: {} });
  });
}

async function expectNoCountsOrOverflow(page: Page) {
  const main = await page.getByTestId('favourites-page').innerText();
  expect(main).not.toMatch(/\d/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe('favourites, open', () => {
  test.skip(!favouritesOpen, 'Favourites are closed; run with VITE_FAVOURITES_OPEN=true');

  test('an empty page says one plain sentence and links to Read and the shop', async ({ page }) => {
    await prepare(page, { articles: [], shopTeas: [], chest: {} });
    await page.goto('/account/favourites');
    await expect(page.getByRole('heading', { level: 1, name: 'Favourites' })).toBeVisible();
    await expect(page.getByText('Nothing kept yet.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read' }).first()).toHaveAttribute('href', '/read');
    await expect(page.getByRole('link', { name: 'the shop' })).toHaveAttribute('href', '/shop');
    for (const heading of ['Articles', 'Teas at the shop', 'Teas in my Tea Chest']) {
      await expect(page.getByRole('heading', { name: heading })).toHaveCount(0);
    }
    await expectNoCountsOrOverflow(page);
  });

  test('each heading appears only when it has something', async ({ page }) => {
    await prepare(page, { articles: [], shopTeas: ['tea-red'], chest: {} });
    await page.goto('/account/favourites');
    await expect(page.getByRole('heading', { name: 'Teas at the shop' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Old Tree Red/ })).toHaveAttribute('href', '/shop/product/old-tree-red');
    await expect(page.getByRole('heading', { name: 'Articles' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Teas in my Tea Chest' })).toHaveCount(0);
    await expect(page.getByText('Nothing kept yet.')).toHaveCount(0);
  });

  test('a shop tea is taken off through the heart\'s own list', async ({ page }) => {
    const state: State = { articles: [], shopTeas: ['tea-red', 'tea-other'], chest: {} };
    await prepare(page, state);
    await page.goto('/account/favourites');
    const shop = page.getByRole('region', { name: 'Teas at the shop' });
    await shop.getByRole('button', { name: 'Take Old Tree Red off' }).first().click();
    await expect.poll(() => state.shopTeas.length < 2, { timeout: 5000 }).toBe(true);
    expect(state.shopTeas).not.toContain('tea-red');
  });

  test('an article is kept on its page and taken off from Favourites', async ({ page }) => {
    const state: State = { articles: [], shopTeas: [], chest: {} };
    await prepare(page, state);
    await page.goto(`/article/${ARTICLE.slug}`);
    const keep = page.getByTestId('keep-article');
    await expect(keep).toHaveText('Keep');
    const box = await keep.boundingBox();
    // The site's own tap floor: 44px on a touch screen, smaller under a mouse (tokens.css).
    const floor = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tap-min')));
    expect(box && box.width >= floor && box.height >= floor).toBe(true);
    await keep.click();
    await expect(keep).toHaveText('Kept');
    expect(state.articles).toEqual([ARTICLE.id]);

    await page.goto('/account/favourites');
    const articles = page.getByRole('region', { name: 'Articles' });
    await expect(articles.getByRole('link', { name: ARTICLE.title })).toHaveAttribute('href', `/article/${ARTICLE.slug}`);
    await expectNoCountsOrOverflow(page);
    await articles.getByRole('button', { name: `Take ${ARTICLE.title} off` }).click();
    await expect(page.getByRole('heading', { name: 'Articles' })).toHaveCount(0);
    expect(state.articles).toEqual([]);
    await expect(page.getByText('Nothing kept yet.')).toBeVisible();
  });

  test('the paged reader carries Keep in its top bar too', async ({ page }) => {
    const state: State = { articles: [], shopTeas: [], chest: {} };
    await prepare(page, state);
    await page.goto('/article/paged-story');
    const keep = page.getByTestId('keep-article');
    await expect(keep).toHaveText('Keep');
    await keep.click();
    await expect(keep).toHaveText('Kept');
    expect(state.articles).toEqual(['art-paged']);
  });

  test('signed out, Keep leads to sign in and back to the article', async ({ page }) => {
    await prepare(page, { articles: [], shopTeas: [], chest: {} }, { signedIn: false });
    await page.goto(`/article/${ARTICLE.slug}`);
    await page.getByTestId('keep-article').click();
    await expect(page).toHaveURL(new RegExp(`/signin\\?returnTo=${encodeURIComponent(`/article/${ARTICLE.slug}`)}`));
  });

  test('a chest tea is marked a favourite and its state reads Kept', async ({ page }) => {
    const state: State = { articles: [], shopTeas: [], chest: {} };
    await prepare(page, state);
    await page.goto('/account/cellar');
    await expect(page.getByText('Old Liu Bao')).toBeVisible();
    await expect(page.getByText('Kept', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Private', { exact: true })).toHaveCount(0);
    const mark = page.getByRole('button', { name: 'Mark Old Liu Bao as a favourite' });
    await mark.click();
    await expect(page.getByRole('button', { name: 'Old Liu Bao is a favourite' })).toHaveAttribute('aria-pressed', 'true');
    expect(state.chest).toEqual({ 'chest-1': true });

    await page.goto('/account/favourites');
    const chest = page.getByRole('region', { name: 'Teas in my Tea Chest' });
    await expect(chest.getByRole('link', { name: /Old Liu Bao/ })).toHaveAttribute('href', '/account/cellar');
    await expect(chest.getByRole('link', { name: /Spring Dancong/ })).toHaveCount(0);
    await chest.getByRole('button', { name: 'Take Old Liu Bao off' }).click();
    await expect(page.getByRole('heading', { name: 'Teas in my Tea Chest' })).toHaveCount(0);
    expect(state.chest).toEqual({ 'chest-1': false });
  });

  test('all three kinds together, with no counts anywhere', async ({ page }) => {
    await prepare(page, { articles: [ARTICLE.id], shopTeas: ['tea-red'], chest: { 'chest-2': true } });
    await page.goto('/account/favourites');
    for (const heading of ['Articles', 'Teas at the shop', 'Teas in my Tea Chest']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
    await expectNoCountsOrOverflow(page);
  });
});

test.describe('favourites, closed', () => {
  test.skip(favouritesOpen, 'Favourites are open in this run');

  test('no page, no Keep and no favourite mark appear', async ({ page }) => {
    await prepare(page, { articles: [], shopTeas: [], chest: {} });
    await page.goto('/account/favourites');
    await expect(page.getByRole('heading', { level: 1, name: 'Favourites' })).toHaveCount(0);

    await page.goto(`/article/${ARTICLE.slug}`);
    await expect(page.getByTestId('immersive-article')).toBeVisible();
    await expect(page.getByTestId('keep-article')).toHaveCount(0);

    await page.goto('/account/cellar');
    await expect(page.getByText('Old Liu Bao')).toBeVisible();
    await expect(page.getByRole('button', { name: /favourite/i })).toHaveCount(0);
    await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  });
});
