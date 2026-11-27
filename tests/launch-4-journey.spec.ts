// npx playwright test --config tests/launch-4-journey.config.ts
// Set K12_PORT to use another free local port. The config starts its own flagged Vite.
import { expect, test, type Page, type Route } from './fixtures';
import { openYourTable } from './helpers/navigation';

test.beforeEach(({}, info) => {
  test.skip(!info.config.metadata.launch4Journey,
    'Run with tests/launch-4-journey.config.ts to enable all four flags on a dedicated local Vite.');
});

const identities = {
  member: { sub: 'mei', username: 'mei', name: 'Mei', email: 'mei@example.test' },
  host: { sub: 'host', username: 'lin', name: 'Lin', email: 'lin@example.test' },
};

async function signIn(page: Page, actor: keyof typeof identities = 'member') {
  const membership = { account_id: 'journey-shop', account_name: 'Journey Shop', role: 'staff', bundles: ['gather', 'publish'] };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = {
    ...identities[actor], role: 'user', exp: Math.floor(Date.now() / 1000) + 86400,
    memberships: actor === 'host' ? [membership] : [], active_account_id: actor === 'host' ? membership.account_id : null,
  };
  const token = [encode({ alg: 'HS256', typ: 'JWT' }), encode(claims), 'fixture'].join('.');
  await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
}

// Every product request ends here. Only this checkout's resources can go to the network.
async function mockApi(page: Page, handle: (path: string, route: Route) => Promise<boolean>) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (await handle(path, route)) return;
    if (path.startsWith('/api/media/') || path === '/api/public/read/publish-state' || path === '/api/read/session') {
      return route.fallback(); // The shared fixture serves these locally.
    }
    if (path === '/api/auth/me') {
      const bearer = request.headers().authorization?.split('.')[1];
      const actor = bearer && JSON.parse(Buffer.from(bearer, 'base64url').toString());
      return actor ? route.fulfill({ json: { ...actor, id: actor.sub } }) : route.fulfill({ status: 401, json: {} });
    }
    if (request.method() === 'GET') {
      if (path === '/api/rates') return route.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }] });
      if (['/api/events', '/api/tea-reviews', '/api/products/public', '/api/network/stores'].includes(path)
        || /^\/api\/products\/[^/]+\/(?:events|impressions)$/.test(path)) return route.fulfill({ json: [] });
      if (path === '/api/user/favorites') return route.fulfill({ json: { favorites: [] } });
    }
    return route.fulfill({ status: 404, json: { error: 'No journey fixture for ' + path } });
  });
}

async function historyRoundTrip(page: Page, beforeURL: string, afterURL: string) {
  expect(afterURL, 'The new screen needs its own address').not.toBe(beforeURL);
  await page.goBack();
  await expect(page).toHaveURL(beforeURL);
  await page.goForward();
  await expect(page).toHaveURL(afterURL);
}

async function audit(page: Page, step: string) {
  const layout = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const horizontalScroll = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(el => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1)
      .map(el => el.getAttribute('aria-label') || el.id || el.tagName);
    return { viewport, width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), horizontalScroll };
  });
  expect.soft(layout.width, step + ' document width').toBeLessThanOrEqual(layout.viewport);
  expect.soft(layout.horizontalScroll, step + ' containers with horizontal scroll').toEqual([]);
  if (!new URL(page.url()).pathname.startsWith('/admin/')) {
    expect.soft(await page.locator('body').innerText(), step + ' guest wording').not.toMatch(/\b(?:curated|master)\b|\u2014/i);
  }
  if (!test.info().project.use.hasTouch) return;
  const buttons = page.getByRole('button').or(page.locator('button:visible, input[type="button"]:visible, input[type="submit"]:visible'));
  const undersized = await buttons.evaluateAll(nodes => nodes.flatMap(node => {
    const { width, height } = node.getBoundingClientRect();
    if (width >= 44 && height >= 44) return [];
    const label = node.getAttribute('aria-label') || node.textContent?.trim() || node.getAttribute('title')
      || node.getAttribute('data-testid') || node.outerHTML.slice(0, 100);
    return [`${label} (${width.toFixed(1)} x ${height.toFixed(1)})`];
  }));
  expect.soft(undersized, step + ' touch buttons smaller than 44 x 44').toEqual([]);
}

const memberTea = {
  id: 'river-oolong', slug: 'river-oolong', product_name: 'River Oolong', given_name: 'River Oolong',
  type: 'Oolong', status: 'Active', stock_grams: 200, retail_price_per_gram_usd: 0.4,
  tasting_notes: [], is_public: 1, shown_in_shop: 1,
};
const memberTeaPath = '/shop/product/river-oolong';
const memberArticle = {
  id: 'river-story', slug: 'by-the-river', title: 'By the River', status: 'published',
  tags: [], layout_template: 'immersive_scroll', created_at: '2026-11-01', updated_at: '2026-11-01',
  blocks: [{ type: 'paragraph', text: 'The leaves opened on the second pour.' }],
};
const chestTea = {
  id: 'chest-red', name: 'Hill Red', type: 'Red', year: null, grams: 50,
  placementStatus: 'private', linkedProductId: null, shelfPublished: false,
  createdAt: '2026-11-11', updatedAt: '2026-11-11',
};
const riverNote = 'A scent of pear remained in the cup.';
const riverDate = '2026-11-12T09:00:00Z';
const riverTasting = {
  kind: 'tasting', id: 'river-journal', at: riverDate, person: { name: 'Mei', path: '/people/mei' },
  tea: { name: memberTea.product_name, chinese_name: null, path: memberTeaPath, type: 'Oolong' },
  words: [{ date: riverDate, text: riverNote }], photographs: [],
};
const keptRecap = {
  kind: 'recap', id: 'clay-sit', at: riverDate, slug: 'clay-sit', title: 'An afternoon with clay',
  session_date: '2026-11-11', host: 'Jun', writing: 'We drank by the water.', teas: [], tea_type: null,
};

async function prepareMember(page: Page) {
  await signIn(page);
  const kept = { shop: [] as string[], chest: false, article: false, piece: false };
  let shared = false;
  let onTable = false;
  await mockApi(page, async (path, route) => {
    const method = route.request().method();
    let json: unknown;
    if (path === '/api/user/favorites') {
      if (method === 'PUT') kept.shop = route.request().postDataJSON().favorites;
      json = { favorites: kept.shop };
    } else if (path === '/api/me/favourites/articles/river-story' && method === 'PUT') {
      kept.article = true;
      json = { kept: true };
    } else if (path === '/api/me/cellar/chest-red/favourite' && method === 'PUT') {
      kept.chest = route.request().postDataJSON().favourite;
      json = { id: chestTea.id, favourite: kept.chest };
    } else if (path === '/api/tea-table/keeps/recap/clay-sit' && method === 'PUT') {
      kept.piece = true;
      json = { kind: 'recap', id: keptRecap.id, kept: true };
    } else if (path === '/api/me/favourites') {
      json = {
        shop_teas: kept.shop.includes(memberTea.id) ? [{ id: memberTea.id, name: memberTea.product_name, type: memberTea.type, path: memberTeaPath }] : [],
        articles: kept.article ? [{ ...memberArticle, path: '/article/by-the-river', is_public: false }] : [],
        chest_teas: kept.chest ? [{ ...chestTea, path: '/account/cellar' }] : [],
      };
    } else if (path === '/api/me/cellar') {
      json = { items: [{ ...chestTea, favourite: kept.chest }] };
    } else if (path === '/api/me/shelf') {
      json = { enabled: false, slug: null, title: null, whatsapp: null };
    } else if (path === '/api/articles/by-the-river') {
      json = memberArticle;
    } else if (/\/products(?:\/public)?\/river-oolong$/.test(path)) {
      json = memberTea;
    } else if (/\/products(?:\/public)?$/.test(path)) {
      json = [memberTea];
    } else if (path === '/api/family/teas/river-oolong/photographs') {
      json = { product_id: memberTea.id, lead: null, placed: [], family: [] };
    } else if (path === '/api/family/teas/river-oolong/share' && method === 'PUT') {
      const body = route.request().postDataJSON();
      if (!['page', 'private'].includes(body.share_state)) {
        await route.fulfill({ status: 400, json: { error: 'Expected an explicit sharing choice' } });
        return true;
      }
      shared = body.share_state === 'page';
      onTable = shared && body.tea_table === true;
      json = { product_id: memberTea.id, journal_entry_id: riverTasting.id, share_state: body.share_state,
        photographs_updated: 0, page_id: 'mei', page_path: '/people/mei', page_created: false, on_tea_table: onTable };
    } else if (path === '/api/family/teas/river-oolong/mine') {
      json = { product_id: memberTea.id, photographs: [], cover_photograph_id: null, remaining: 6, tasting_share_state: shared ? 'page' : 'private' };
    } else if (path === '/api/family/tasting-shares') {
      json = { shares: [{ product_id: memberTea.id, share_state: shared ? 'page' : 'private' }] };
    } else if (path === '/api/tasting-journal' && method === 'GET') {
      json = { entries: [{ id: riverTasting.id, product_id: memberTea.id, product_name: memberTea.product_name,
        product_type: memberTea.type, created_at: riverDate, personal_note: riverNote }] };
    } else if (path === '/api/tea-table') {
      json = { held: [], items: onTable ? [riverTasting, keptRecap] : [keptRecap], earlier: null };
    } else if (path === '/api/tea-table/me') {
      json = { mine: onTable ? ['tasting:river-journal'] : [], kept: kept.piece ? [keptRecap] : [] };
    } else if (path === '/api/people/mei') {
      json = { id: 'mei', display_name: 'Mei', role: null, page_tier: 'family', is_published: 1,
        beginnings: 'I began at the river.', links: [], articles: [], featured_in: [], products: [],
        pull_quotes: [], gallery_images: [], tea_selection: [], created_at: riverDate, updated_at: riverDate,
        tastings: shared ? [{ product_id: memberTea.id, name: memberTea.product_name, public_path: memberTeaPath,
          sold_out: false, words: riverTasting.words, photographs: [] }] : [] };
    } else {
      return false;
    }
    await route.fulfill({ json });
    return true;
  });
  return kept;
}

function memberJourneys() {
  test('member keeps teas, an article and a Tea Table piece together in Favourites', async ({ page }) => {
    const kept = await prepareMember(page);
    const sources = [
      { kind: 'shop tea', path: memberTeaPath, action: 'Add to collection', result: 'In your collection',
        group: 'Teas at the shop', title: memberTea.product_name, destination: memberTeaPath },
      { kind: 'chest tea', path: '/account/cellar', action: 'Mark Hill Red as a favourite', result: 'Hill Red is a favourite',
        group: 'Teas in my Tea Chest', title: chestTea.name, destination: '/account/cellar' },
      { kind: 'article', path: '/article/by-the-river', action: 'Keep', result: 'Kept',
        group: 'Articles', title: memberArticle.title, destination: '/article/by-the-river' },
      { kind: 'table piece', path: '/tea-table', action: 'Keep', result: 'Kept',
        group: 'From the Tea Table', title: keptRecap.title, destination: '/event/clay-sit/recap' },
    ];
    for (const source of sources) {
      await test.step('Keep the ' + source.kind, async () => {
        await page.goto(source.path);
        const control = page.getByRole('button', { name: source.action, exact: true });
        await expect.soft(control, 'Find the keep action for the ' + source.kind).toBeVisible();
        if (!await control.isVisible()) return;
        await audit(page, 'Keep the ' + source.kind);
        await control.click();
        await expect.soft(page.getByRole('button', { name: source.result, exact: true })).toBeVisible();
        // The shop synchronizes its list after a debounce.
        if (source.kind === 'shop tea') await expect.configure({ soft: true }).poll(() => kept.shop).toContain(memberTea.id);
      });
    }
    await test.step('Read all four items on the same Favourites page', async () => {
      await page.goto('/account/favourites');
      await expect(page.getByRole('heading', { name: 'Favourites', exact: true })).toBeVisible();
      for (const source of sources) {
        const row = page.getByRole('region', { name: source.group }).getByRole('link', { name: new RegExp(source.title) });
        await expect.soft(row, source.kind + ' in Favourites').toBeVisible();
        if (await row.count()) await expect.soft(row).toHaveAttribute('href', source.destination);
      }
      await audit(page, 'Member reads their Favourites');
    });
  });

  test('member follows Favorites from their journal to the full Favourites page', async ({ page }) => {
    await prepareMember(page);
    await page.goto('/account/journal');
    const nav = page.getByRole('navigation', { name: 'Your tea' });
    await nav.getByRole('link', { name: /favou?rites/i }).click();
    await expect(page.getByTestId('favourites-page'), 'Journal > Favorites should open all kept items').toBeVisible();
  });

  test('member shares a saved tasting to both places and takes it off both', async ({ page }) => {
    await prepareMember(page);
    const share = page.getByRole('dialog', { name: 'Share this tasting' });
    await test.step('Open the private tasting in the journal and share it', async () => {
      await page.goto('/account/journal');
      const change = page.getByRole('button', { name: /^River Oolong: Private\./ });
      await expect(change).toBeVisible();
      await audit(page, 'Member journal before sharing');
      const journalUrl = page.url();
      await change.click();
      await expect(page).toHaveURL(/[?&]share=river-oolong(?:&|$)/);
      await expect(share).toBeVisible();
      await historyRoundTrip(page, journalUrl, page.url());
      await expect(share).toBeVisible();
      await audit(page, 'Choose where to share the tasting');
      await share.getByRole('button', { name: 'On my page and the Tea Table', exact: true }).click();
      await expect(share.getByRole('status')).toHaveText('On your page and the Tea Table.');
      await audit(page, 'Member reads the share confirmation');
      await share.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(share).toBeHidden();
    });
    await test.step('Read the shared words on the Tea Table and follow the author to their page', async () => {
      await page.goto('/tea-table');
      const tasting = page.getByTestId('tea-table-piece').filter({ hasText: riverNote });
      await expect(tasting).toContainText(memberTea.product_name);
      await audit(page, 'Read the newly shared tasting on the Tea Table');
      await tasting.getByRole('link', { name: 'Mei', exact: true }).click();
      await expect(page).toHaveURL(/\/people\/mei$/);
      await expect(page.getByTestId('profile-tasting')).toContainText(riverNote);
      await audit(page, 'Read the newly shared tasting on the member page');
    });
    await test.step('Make the tasting private and revisit both public surfaces', async () => {
      await page.goto('/account/journal');
      const published = page.getByRole('button', { name: /^River Oolong: On your page/ });
      await expect.soft(published, 'The journal should identify both current audiences').toContainText(/Tea Table/i);
      await published.click();
      await audit(page, 'Member reopens the share choices');
      await share.getByRole('button', { name: 'Keep private', exact: true }).click();
      await expect(page.getByRole('button', { name: /^River Oolong: Private\./ })).toBeVisible();
      await page.goto('/people/mei');
      await expect(page.getByTestId('profile-cover')).toContainText('Mei');
      await expect(page.getByText(riverNote, { exact: true })).toHaveCount(0);
      await page.goto('/tea-table');
      await expect(page.getByTestId('tea-table-piece').filter({ hasText: keptRecap.title })).toBeVisible();
      await expect(page.getByText(riverNote, { exact: true })).toHaveCount(0);
    });
  });
}

function hostJourneys() {
  test('host puts a published recap on the Tea Table and takes it off', async ({ page }) => {
    const eventId = 'k12-window-sit';
    const eventPath = '/api/admin/events/' + eventId;
    const recap = {
      kind: 'recap', id: eventId, slug: eventId, title: 'Tea by the window',
      at: '2026-11-24 12:00:00', session_date: '2026-11-23T08:00:00Z',
      host: 'Lin', writing: 'We poured the last leaves while it rained.',
      teas: ['Winter oolong'], tea_type: 'Oolong',
    };
    let onTable = false;
    const changes: string[] = [];
    const reads: Record<string, unknown> = {
      [eventPath]: {
        id: eventId, slug: recap.slug, title: recap.title, event_date: recap.session_date,
        status: 'closed', lifecycle_status: 'completed', recap_status: 'published',
        public_visibility: 'public', network_discovery: 1, total_capacity: 6,
      },
      [eventPath + '/post-session']: { session_notes: recap.writing },
      [eventPath + '/recap-credits']: { people: [], credits: [] },
      [eventPath + '/attendees']: [],
      [eventPath + '/tasting-notes']: [],
      [eventPath + '/interest']: { signups: [] },
      [eventPath + '/guest-book']: { entries: [] },
      [eventPath + '/guest-book/photos']: { photos: [] },
      [eventPath + '/recap-photo-review']: { published: true, permissions: [] },
      '/api/events': [],
      '/api/tea-table/me': { mine: [], kept: [] },
    };
    await signIn(page, 'host');
    await mockApi(page, async (path, route) => {
      const method = route.request().method();
      if (path === '/api/admin/tea-table/recaps/' + eventId && ['GET', 'PUT', 'DELETE'].includes(method)) {
        if (method !== 'GET') {
          changes.push(method);
          onTable = method === 'PUT';
        }
        await route.fulfill({ json: { eligible: true, on_table: onTable, held_until: null } });
      } else if (path === '/api/tea-table' && method === 'GET') {
        await route.fulfill({ json: { held: [], items: onTable ? [recap] : [], earlier: null } });
      } else if (method === 'GET' && Object.hasOwn(reads, path)) {
        await route.fulfill({ json: reads[path] });
      } else {
        return false;
      }
      return true;
    });

    const share = page.getByRole('button', { name: 'Put on the Tea Table' });
    const remove = page.getByRole('button', { name: 'Take it off', exact: true });
    const piece = page.getByTestId('tea-table-piece').filter({ hasText: recap.title });
    await test.step('Host finds Post-Session under More tabs and reopens it with browser history', async () => {
      await page.goto('/admin/events/' + eventId);
      await expect(page.getByRole('heading', { name: recap.title })).toBeVisible();
      await audit(page, 'Host: open completed session');
      await page.getByRole('button', { name: 'More tabs' }).click();
      const postSession = page.getByRole('menuitem', { name: 'Post-Session' });
      await expect(postSession).toBeVisible();
      await audit(page, 'Host: choose a session tab');
      await postSession.click();
      await expect(page).toHaveURL(/\?tab=post-session$/);
      await expect(share).toBeVisible();
      await page.goBack();
      await expect(page.getByText('No pending requests', { exact: true })).toBeVisible();
      await expect(share).toHaveCount(0);
      await page.goForward();
      await expect(page).toHaveURL(/\?tab=post-session$/);
      await expect(share).toBeVisible();
      await audit(page, 'Host: find the published recap controls');
    });

    await test.step('Host puts the recap on the table and reads it from the public listing', async () => {
      await share.click();
      await expect(remove).toBeVisible();
      expect(changes).toEqual(['PUT']);
      await audit(page, 'Host: recap shared');
      await page.getByTestId('tea-table-recap-control').getByRole('link', { name: 'Tea Table' }).click();
      await expect(page).toHaveURL(/\/tea-table$/);
      await expect(piece).toContainText(recap.writing);
      await expect(piece.getByRole('link', { name: recap.title })).toHaveAttribute('href', '/event/' + recap.slug + '/recap');
      await audit(page, 'Host: read the shared recap on the Tea Table');
    });

    await test.step('Host returns to Post-Session and takes the recap off, then checks the public listing', async () => {
      await page.goBack();
      await expect(page).toHaveURL(/\?tab=post-session$/);
      await remove.click();
      await expect(share).toBeVisible();
      expect(changes).toEqual(['PUT', 'DELETE']);
      await page.goForward();
      await expect(page).toHaveURL(/\/tea-table$/);
      await expect(page.getByTestId('tea-table-empty')).toBeVisible();
      await expect(piece).toHaveCount(0);
      await audit(page, 'Host: read the Tea Table after withdrawal');
    });
  });
}

async function visitorTable(page: Page) {
  const product = {
    id: 'k12-green', type: 'Green', form: 'Loose', given_name: 'Spring Orchard', product_name: 'Spring Orchard',
    tea_key: 'green:spring-orchard', stock_grams: 250, retail_price_per_gram_usd: 0.4,
    tasting_notes: [], status: 'Active', is_public: 1, shown_in_shop: 1, can_reorder: 1,
  };
  const teaPath = '/shop/product/k12-green';
  const tasting = {
    kind: 'tasting', id: 'k12-orchard-note', at: '2026-11-22T12:00:00Z',
    person: { name: 'Lin', path: '/people/k12-lin' },
    tea: { name: product.given_name, chinese_name: null, type: product.type, path: teaPath },
    words: [{ date: null, text: 'A fresh pear finish.' }], photographs: [],
  };
  const recap = {
    kind: 'recap', id: 'k12-garden', slug: 'k12-garden', at: '2026-11-20T12:00:00Z',
    title: 'Tea in the garden', session_date: '2026-11-19T12:00:00Z', host: 'Garden House',
    writing: 'We finished the last pot outside.', teas: [product.given_name], tea_type: product.type,
  };
  // Use the same consent-projected first name or null as the public family tea photographs.
  const photo = (id: string, photograph_by: string | null) => ({
    id, photograph_by, shape: 'square', small_width: 480, small_height: 480,
    small_url: '/api/media/' + id + '-small.jpg', full_url: '/api/media/' + id + '-full.jpg',
  });
  const profile = {
    id: 'k12-lin', display_name: 'Lin An', account_id: 'garden-house', is_published: 1, page_tier: 'family',
    links: [], articles: [], featured_in: [], products: [], pull_quotes: [], gallery_images: [], tea_selection: [],
    tastings: [{ product_id: product.id, name: product.given_name, public_path: teaPath, words: tasting.words,
      photographs: [photo('first-pot', 'Lin'), photo('last-pot', null)], chinese_name: null, sold_out: false }],
  };
  const answers: Record<string, unknown> = {
    '/api/tea-table': { items: [tasting, recap], held: [], earlier: recap.at },
    '/api/events': [], '/api/people/k12-lin': profile,
    '/api/products/public': [product], '/api/products/public/k12-green': product,
    '/api/products/k12-green/events': [], '/api/products/k12-green/selected-by': { selected_by: [] },
    '/api/family/teas/k12-green/photographs': { product_id: product.id, lead: null, placed: [], family: [] },
    // A legacy score beside real words makes an accidentally rendered bare number detectable.
    '/api/products/k12-green/impressions': [{ id: 'k12-quote', productId: product.id,
      attributionName: 'Lin', attributionDetail: null, text: 'Orchard blossom on the lid.',
      publishedAt: '2026-11-22T12:00:00Z', rating: 8.7 }],
    '/api/tea-reviews': [{ id: 'k12-review', tea_key: product.tea_key, visibility: 'network',
      notes: 'Clear and soft.', author_name: 'Lin', created_at: '2026-11-22T12:00:00Z', rating: 8.7 }],
  };
  await mockApi(page, async (path, route) => {
    if (path === '/api/tea-table' && new URL(route.request().url()).searchParams.get('before') === recap.at) {
      await route.fulfill({ json: { held: [], items: [{ ...recap, id: 'early-sit', slug: 'early-sit', title: 'First garden sit', at: '2026-10-05T12:00:00Z' }], earlier: null } });
      return true;
    }
    if (!(path in answers) || route.request().method() !== 'GET') return false;
    await route.fulfill({ json: answers[path] });
    return true;
  });
  await page.goto('/tea-table');
  await expect(page.getByRole('heading', { level: 1, name: 'The Tea Table' })).toBeVisible();
  await expect(page.getByText(tasting.words[0].text, { exact: true })).toBeVisible();
}

function visitorJourneys() {
  test('visitor reads the table in date order and opens the tea without seeing a score', async ({ page }) => {
    await visitorTable(page);
    const pieces = page.getByTestId('tea-table-piece');
    await test.step('Read the tasting and the older recap', async () => {
      await expect(pieces).toHaveCount(2);
      await expect(pieces.nth(0)).toContainText('Spring Orchard');
      await expect(pieces.nth(1)).toContainText('We finished the last pot outside.');
      await expect.soft(page.getByTestId('tea-table-page')).not.toContainText(
        /\b(likes?|repl(?:y|ies)|comments?|follow(?:s|ers|ing)?|rank(?:s|ings?)?|scores?|trending|feed)\b|\d+\s*(?:views?|keeps?|tastings?)\b/i,
        { useInnerText: true },
      );
      await audit(page, 'Visitor reads the Tea Table');
    });
    await test.step('Read an earlier day, then use Back and Forward', async () => {
      await expect(page.getByTestId('tea-table-day')).toHaveCount(2);
      const latest = page.url();
      await page.getByRole('button', { name: 'Earlier' }).click();
      await expect(pieces).toHaveCount(1);
      await expect(pieces).toContainText('First garden sit');
      await audit(page, 'Visitor reads an earlier day');
      await historyRoundTrip(page, latest, page.url());
      await expect(pieces).toContainText('First garden sit');
      await page.goBack();
      await expect(pieces).toHaveCount(2);
    });
    await test.step('Follow the tea and read its tasting journal', async () => {
      const tableURL = page.url();
      await pieces.first().getByRole('link', { name: 'Spring Orchard' }).click();
      await expect(page).toHaveURL(/\/shop\/product\/k12-green(?:\?|$)/);
      const quote = page.getByText(/Orchard blossom on the lid/).first();
      await expect(quote).toBeVisible();
      const scored = /\b(?:scores?|ratings?|rated|stars?|8\.7)\b|[★☆⭐]|\d+(?:\.\d+)?\s*(?:\/|out of)\s*(?:5|10|100)\b/i;
      await expect.soft(page.locator('body')).not.toContainText(scored, { useInnerText: true });
      expect.soft(await page.locator('body').ariaSnapshot(), 'Accessible names must not disclose a score').not.toMatch(scored);
      await audit(page, 'Visitor reads Spring Orchard');
      await historyRoundTrip(page, tableURL, page.url());
      await expect(quote).toBeVisible();
    });
  });

  test('visitor opens both person-page photographs and sees only the permitted credit', async ({ page }) => {
    await visitorTable(page);
    const tableURL = page.url();
    await page.getByTestId('tea-table-piece').getByRole('link', { name: 'Lin', exact: true }).click();
    await expect(page.getByTestId('profile-cover')).toContainText('Lin');
    const profileURL = page.url();
    await historyRoundTrip(page, tableURL, profileURL);
    const row = page.getByRole('list', { name: 'Photographs of Spring Orchard' });
    const thumbnails = row.getByRole('button');
    await expect(thumbnails).toHaveCount(2);
    await expect.soft(page.locator('body')).not.toContainText(/photograph by/i, { useInnerText: true });
    await audit(page, 'Visitor reads Lin’s page');

    for (const [index, credit] of ['Lin', null].entries()) {
      await test.step(credit ? 'Open the photograph with permission to name Lin' : 'Open the photograph without permission to name Lin', async () => {
        await thumbnails.nth(index).click();
        const zoom = page.getByTestId('photograph-zoom');
        await expect(zoom).toBeVisible();
        const byline = zoom.getByText(/photograph by/i);
        if (credit) await expect.soft(byline).toHaveText('Photograph by Lin', { ignoreCase: true, timeout: 1500 });
        else {
          await expect.soft(byline).toHaveCount(0);
          expect.soft(await zoom.ariaSnapshot(), 'Anonymous image accessible description').not.toMatch(/photographed by|photograph by/i);
        }
        await audit(page, credit ? 'Named photograph on Lin’s page' : 'Unnamed photograph on Lin’s page');
        const zoomURL = page.url();
        expect.soft(zoomURL, 'Opening a photograph should create a history step').not.toBe(profileURL);
        if (zoomURL !== profileURL) {
          await page.goBack();
          await expect(page).toHaveURL(profileURL);
          await expect(zoom).toBeHidden();
          await page.goForward();
          await expect(page).toHaveURL(zoomURL);
          await expect(zoom).toBeVisible();
        }
        await zoom.getByRole('button', { name: 'Close' }).click();
        await expect(zoom).toBeHidden();
        await expect(page).toHaveURL(profileURL);
      });
    }
  });

  test('visitor opens Your Table from the site navigation and returns to the table', async ({ page }) => {
    await visitorTable(page);
    const tableURL = page.url();
    await openYourTable(page);
    await expect(page).toHaveURL(/\/account$/);
    const yourTable = page.getByTestId('your-table-page');
    await expect(yourTable.getByRole('heading', { level: 1, name: 'Your Table' })).toBeVisible();
    await audit(page, 'Visitor opens Your Table');
    await page.goBack();
    await expect(page).toHaveURL(tableURL);
    await expect(page.getByText('A fresh pear finish.', { exact: true })).toBeVisible();
    await page.goForward();
    await expect(yourTable.getByRole('heading', { level: 1, name: 'Your Table' })).toBeVisible();
  });
}

memberJourneys();
hostJourneys();
visitorJourneys();
