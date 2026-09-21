import { expect, test, type Page } from './fixtures';
import { PIXEL, collectErrors, meaningfulErrors, noHorizontalOverflow } from './helpers/creatorFixtures';

// A tea master's presence beyond their own page (2026-09-21), at 390 wide:
// the people at a store's table, the hosts of an event, "Selected by" on a
// tea in the profile's own row, and the tea master's own page gaining the
// two words the public page reads plus the name of their collection.
// No backend: the API is mocked the way the worker answers it.

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const TOKEN = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'sbx-user-kenji-tanaka', email: 'kenji@sandbox.local', name: 'Kenji Tanaka', role: 'user', platform_role: null,
  active_account_id: 'acct-bali', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.sig`;

const kenji = { slug: 'kenji-tanaka', display_name: 'Kenji Tanaka', business_name: 'Tanaka Tea House', role: 'Tea master · host', portrait_url: PIXEL, own_line: 'I pour on Saturday evenings at Tanaka Tea House, four guests at most.', is_host: true };
const mika = { slug: 'mika-sato', display_name: 'Mika Sato', business_name: null, role: 'Tea master', portrait_url: null, own_line: 'I weigh, I steep, I keep the kettle honest.', is_host: false };

const store = {
  id: 'acc-sbx-tanaka-tea-house', slug: 'tanaka-tea-house', name: 'Tanaka Tea House', tagline: 'Small sessions, four guests at most.',
  location_city: 'Kyoto', location_country: 'Japan', currency_default: 'USD', can_be_paid: true, people: [kenji, mika],
};

const event = {
  id: 'evt-sbx', slug: 'sbx-kyoto-tasting-fixture', title: 'Gongfu evening', subtitle: 'Four places at the table', description: 'Aged oolongs in a kyusu.',
  event_date: '2026-10-10T19:00:00', location_name: 'Tanaka Tea House', status: 'active', lifecycle_status: 'published', public_visibility: 'public',
  total_capacity: 4, confirmed_count: 1, offered_count: 0, confirmed_names: [], seats_remaining: 3, venue_photos: [], account_name: 'Teajia Bali',
  hosts: [{ ...kenji, role: 'lead_host' }, { ...mika, role: 'co_host' }],
};

const product = {
  id: 'product-1', slug: 'call-of-grace', type: 'Oolong', form: 'Loose', given_name: 'Call of Grace', product_name: 'Call of Grace', chinese_name: '铁观音',
  origin_country: 'China', origin_region: 'Anxi', retail_price_per_gram_usd: 0.4, stock_grams: 250, description: 'Orchid on the nose.',
  tasting_notes: [], image_url: '', status: 'Active', is_public: 1, shown_in_shop: 1, can_reorder: 1, tasting_source: 'owner',
};

const selfProfile = {
  id: 'kenji-tanaka', slug: 'kenji-tanaka', display_name: 'Kenji Tanaka', business_name: 'Tanaka Tea House', chinese_name: null,
  beginnings: 'I trained under a sencha teacher for six years.', now_text: 'This year is about aged oolongs.',
  inspirations: 'A visiting Taiwanese tea master.', closing: 'Come for the tea. Stay for the second steep.',
  location_line: 'Kyoto, Japan', languages: ['English'], avatar_url: null, portrait_url: null, links: [], gallery_images: [],
  publication_state: 'published', approval_state: 'approved', is_published: true,
  associations: [{ account_id: 'acct-bali', account_slug: 'teajia-bali', account_name: 'Teajia Bali', public_role: 'Tea Master', is_host: true }],
  collection: null,
};

const favorites = {
  favorites: [{ tea_profile_id: 'prof-a', note: 'Soft enough for a first guest.', position: 0, is_public: true, tea: { id: 'prof-a', name: 'Call of Grace', type: 'Oolong', is_public: true, public_path: '/shop/product/product-1' } }],
  available_teas: [],
};

async function mock(page: Page) {
  const puts: Array<{ path: string; body: unknown }> = [];
  await page.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'PUT') puts.push({ path, body: request.postDataJSON() });
    if (path === '/api/s/tanaka-tea-house') return route.fulfill({ json: store });
    if (path === '/api/s/tanaka-tea-house/products' || path === '/api/s/tanaka-tea-house/events') return route.fulfill({ json: [] });
    if (path === '/api/events/sbx-kyoto-tasting-fixture/public') return route.fulfill({ json: event });
    if (path === '/api/events/sbx-kyoto-tasting-fixture/tea-menu') return route.fulfill({ json: [] });
    if (path === '/api/products/public') return route.fulfill({ json: [product] });
    if (path.endsWith('/impressions') || path === '/api/tasting-journal') return route.fulfill({ json: [] });
    if (path === '/api/products/public/product-1/selected-by') return route.fulfill({ json: { selected_by: [
      { slug: 'kenji-tanaka', display_name: 'Kenji Tanaka', business_name: 'Tanaka Tea House', why: 'Soft enough for a first guest, deep enough for the last.' },
      { slug: 'amara-osei', display_name: 'Amara Osei', business_name: 'Osei Tea Imports', why: null },
    ] } });
    if (path === '/api/me/public-profile' && request.method() === 'GET') return route.fulfill({ json: { profile: selfProfile } });
    if (path === '/api/me/public-profile' && request.method() === 'PUT') return route.fulfill({ json: { contributor: selfProfile } });
    if (path === '/api/me/public-profile/collection') return route.fulfill({ json: { collection: { slug: 'kenji-tanaka', title: 'Saturday at the house', item_count: 1 } } });
    if (path === '/api/me/profile/favorites') return route.fulfill({ json: favorites });
    if (path === '/api/me/profile/payment-methods') return route.fulfill({ json: { methods: [] } });
    if (path === '/api/me/profile/pay-access') return route.fulfill({ json: { pending: [], approved: [], share_link: null } });
    if (path === '/api/auth/me') return route.fulfill({ json: { id: 'sbx-user-kenji-tanaka', email: 'kenji@sandbox.local', name: 'Kenji Tanaka', role: 'user' } });
    if (path === '/api/rates') return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  return puts;
}

async function signIn(page: Page) {
  await page.addInitScript(token => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'sbx-user-kenji-tanaka', memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner' }] } }));
  }, TOKEN);
}

test.describe('the people at a store', () => {
  test('the host is the portrait cover, the others are rows, each in their own words', async ({ page }) => {
    const errors = collectErrors(page);
    await mock(page);
    await page.goto('/store/tanaka-tea-house');
    const section = page.getByTestId('store-people');
    await expect(section).toBeVisible();
    await expect(section.getByText('At this table')).toBeVisible();

    const host = page.getByTestId('store-people-host');
    await expect(host).toHaveAttribute('href', '/people/kenji-tanaka');
    await expect(host.locator('img')).toHaveAttribute('alt', 'Portrait of Kenji Tanaka');
    await expect(host).toContainText('Tea master · host');
    await expect(host.locator('.italic').first()).toHaveText('Tanaka');
    await expect(host).toContainText('I pour on Saturday evenings at Tanaka Tea House, four guests at most.');
    const hostBox = await host.boundingBox();
    expect(Math.round(hostBox!.height)).toBe(200);

    const rows = page.getByTestId('store-people-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toHaveAttribute('href', '/people/mika-sato');
    await expect(rows.first()).toContainText('Tea master. I weigh, I steep, I keep the kettle honest.');
    await expect(section.getByRole('link', { name: 'All people' })).toHaveAttribute('href', '/people');
    expect(await section.innerText()).not.toContain('→');
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors)).toHaveLength(0);
    await page.screenshot({ path: 'test-results/tea-master-presence-store.png', fullPage: true });
  });

  test('a table nobody published is linked to shows no people section at all', async ({ page }) => {
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/s/tanaka-tea-house') return route.fulfill({ json: { ...store, people: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto('/store/tanaka-tea-house');
    await expect(page.getByRole('heading', { name: 'Tanaka Tea House' })).toBeVisible();
    await expect(page.getByTestId('store-people')).toHaveCount(0);
  });
});

test.describe('the hosts of an event', () => {
  test('lead first, the role said in the first person, then their own line', async ({ page }) => {
    const errors = collectErrors(page);
    await mock(page);
    await page.goto('/event/sbx-kyoto-tasting-fixture');
    const section = page.getByTestId('event-hosts');
    await expect(section).toBeVisible();
    await expect(section.getByText('Hosted by', { exact: true })).toBeVisible();
    const rows = page.getByTestId('event-host-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('href', '/people/kenji-tanaka');
    await expect(rows.nth(0)).toContainText('I lead the session. I pour on Saturday evenings at Tanaka Tea House, four guests at most.');
    await expect(rows.nth(1)).toHaveAttribute('href', '/people/mika-sato');
    await expect(rows.nth(1)).toContainText('I pour alongside. I weigh, I steep, I keep the kettle honest.');
    await expect(section).not.toContainText('lead_host');
    await expect(section).not.toContainText('co_host');
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors)).toHaveLength(0);
    await page.screenshot({ path: 'test-results/tea-master-presence-event.png', fullPage: true });
  });
});

test.describe('selected by, on the tea', () => {
  test('each person is the profile row: name with the italic surname, their own note as the dek', async ({ page }) => {
    const errors = collectErrors(page);
    await mock(page);
    await page.goto('/shop/product/product-1');
    const section = page.getByTestId('product-selected-by');
    await expect(section).toBeVisible();
    await expect(section.getByText('Selected by')).toBeVisible();
    const rows = page.getByTestId('product-selected-by-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('href', '/people/kenji-tanaka');
    await expect(rows.nth(0).locator('.italic').first()).toHaveText('Tanaka');
    await expect(rows.nth(0)).toContainText('Soft enough for a first guest, deep enough for the last.');
    // No note: the business name stands in, so the row never reads as a bare name.
    await expect(rows.nth(1)).toContainText('At Osei Tea Imports.');
    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors)).toHaveLength(0);
    await page.screenshot({ path: 'test-results/tea-master-presence-product.png', fullPage: true });
  });
});

test.describe('the tea master\'s own page', () => {
  test('carries who taught me, the last line, and the name of the collection, and saves each', async ({ page }) => {
    const errors = collectErrors(page);
    await signIn(page);
    const puts = await mock(page);
    await page.goto('/account/profile');
    await expect(page.getByRole('heading', { name: 'Your public profile' })).toBeVisible();

    const taught = page.getByLabel('Who taught me');
    await expect(taught).toHaveValue('A visiting Taiwanese tea master.');
    const last = page.getByLabel(/The last line/);
    await expect(last).toHaveValue('Come for the tea. Stay for the second steep.');
    await expect(page.getByText('44/200')).toBeVisible();
    await last.fill('Stay for the second steep.');
    await page.getByRole('button', { name: /^Save/ }).first().click();
    await expect.poll(() => puts.find(put => put.path === '/api/me/public-profile')).toBeTruthy();
    const saved = puts.find(put => put.path === '/api/me/public-profile')!.body as Record<string, unknown>;
    expect(saved.closing).toBe('Stay for the second steep.');
    expect(saved.inspirations).toBe('A visiting Taiwanese tea master.');

    const naming = page.getByTestId('favorites-collection');
    await expect(naming.getByText('What I call it')).toBeVisible();
    await expect(naming).toContainText('Unnamed, your profile still lists them.');
    const nameButton = naming.getByRole('button', { name: 'Save name' });
    await expect(nameButton).toBeDisabled();
    await page.getByLabel('What I call it').fill('Saturday at the house');
    await expect(nameButton).toBeEnabled();
    await nameButton.click();
    await expect.poll(() => puts.find(put => put.path === '/api/me/public-profile/collection')).toBeTruthy();
    expect(puts.find(put => put.path === '/api/me/public-profile/collection')!.body).toEqual({ title: 'Saturday at the house' });

    expect(await noHorizontalOverflow(page)).toBe(true);
    expect(meaningfulErrors(errors)).toHaveLength(0);
    await page.screenshot({ path: 'test-results/tea-master-presence-editor.png', fullPage: true });
  });
});
