import type { Page } from '../fixtures';

// The Stock screen's API mocks, shared by inventory-scroll.spec.ts (laptop
// ledger) and stock-phone.spec.ts (phone list), so both read the same shelf.

function makeFakeJWT(payload: object): string {
  const enc = (s: string) => Buffer.from(s).toString('base64url');
  const h = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = enc(JSON.stringify(payload));
  return `${h}.${p}.fakesig`;
}

export const FAKE_TOKEN = makeFakeJWT({
  sub: 'test-admin-uid',
  email: 'admin@teajia.com',
  name: 'Test Admin',
  role: 'owner',
  platform_role: 'platform_owner',
  exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  active_account_id: 'acct-bali',
  memberships: [
    { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' },
  ],
});

export const MOCK_PRODUCTS = Array.from({ length: 96 }, (_, i) => {
  const types = ['Green', 'Oolong', 'Red', 'Sheng', 'Shou', 'White'];
  const type = types[i % types.length];
  return {
    id: `test-product-${i + 1}`,
    type,
    form: 'Loose Leaf',
    given_name: i % 3 === 0 ? `House ${i + 1}` : '',
    chinese_name: '',
    product_name: `${type} Test Tea ${String(i + 1).padStart(2, '0')}`,
    year: 2018 + (i % 7),
    origin_country: 'Taiwan',
    origin_region: ['Alishan', 'Lishan', 'Yiwu', 'Wuyi'][i % 4],
    retail_price_per_gram_usd: 0.28 + (i % 5) * 0.04,
    cost_per_gram_usd: 0.12 + (i % 4) * 0.02,
    cost_amount: 80 + i,
    stock_grams: i === 2 ? 0 : 40 + i * 7,
    low_stock_threshold: 80,
    description: i === 3 ? '' : 'Ready for the public catalog.',
    tasting_notes: [],
    image_url: '',
    status: 'Active',
    vendor: ['Chen Family', 'Mountain Source', 'Old Tree Co'][i % 3],
    cost_currency: 'USD',
    quantity_purchased: 500,
    shipping_rate_per_kg: 13,
    fixed_retail_price_usd: null,
    is_personal: i % 11 === 0 ? 1 : 0,
    can_reorder: 1,
    is_public: i === 0 || i === 2 || i === 3 ? 0 : 1,
    shown_in_shop: i === 0 || i === 2 || i === 3 ? 0 : 1,
    in_transit: i === 2 ? 1 : 0,
    in_transit_grams: i === 2 ? 180 : 0,
    is_featured: i % 13 === 0 ? 1 : 0,
    is_sample: 0,
    recheck_stock: i % 17 === 0 ? 1 : 0,
    stock_verified_at: i % 5 === 0 ? new Date().toISOString() : null,
    tasting_source: i % 4 === 0 ? 'common' : 'owner',
  };
});

export async function injectAuth(page: Page) {
  await page.addInitScript((token) => {
    localStorage.setItem('teajia_token', token);
  }, FAKE_TOKEN);
}

export async function mockInventoryApi(page: Page) {
  await page.route('**/api/auth/me', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      id: 'test-admin-uid',
      email: 'admin@teajia.com',
      name: 'Test Admin',
      role: 'owner',
    }),
  }));
  await page.route('**/api/auth/refresh', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ token: FAKE_TOKEN }),
  }));
  await page.route('**/api/products', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(MOCK_PRODUCTS),
  }));
  await page.route('**/api/inventory/summaries', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      summaries: MOCK_PRODUCTS.map((product, index) => ({
        product_id: product.id,
        incoming_quantity: index === 2 || index === 4 ? 180 : 0,
        has_open_incoming: index === 2 || index === 4,
        writing_count: index % 3 === 0 && index !== 3 ? 1 : 0,
        published_writing_count: index % 3 === 0 && index !== 3 ? 1 : 0,
        has_writing: index % 3 === 0 && index !== 3,
        personal_tasting_count: index === 1 ? 2 : 0,
        personally_tasted: index === 1,
      })),
    }),
  }));
  await page.route('**/api/rates', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() },
      { currency: 'IDR', rate_to_usd: 16000, last_updated: new Date().toISOString() },
    ]),
  }));
  await page.route('**/api/admin/events', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('**/api/compass/incoming', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([]),
  }));
  await page.route('**/api/accounts/acct-bali', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali' }),
  }));
  await page.route('**/api/batches**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }));
  // Admin sample surfaces load alongside the ledger. Left unmocked they reach
  // the real worker, come back 401, and the app clears the session, so every
  // assertion below fails on a signed-out shell rather than on the ledger.
  for (const endpoint of ['admin/samples', 'admin/sample-sets', 'user/favorites', 'tea-discovery', 'compass/entries', 'tasting-journal', 'notes', 'customers']) {
    await page.route(`**/api/${endpoint}**`, route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }));
  }
}

