/**
 * Launch 5, M1: the tea credit screens, with mocked routes, at phone and
 * desktop size. The host's own view, asking at checkout, the owner approving
 * in Sales > Waiting, and with the switch off nothing anywhere.
 *
 * Two sites, named here so one run covers both states:
 *   on   http://127.0.0.1:7895  (VITE_HOST_CREDIT_OPEN=true)
 *   off  http://127.0.0.1:7896  (VITE_HOST_CREDIT_OPEN=false)
 * Both are `vite` with VITE_API_URL pointed at an unused port; every /api call
 * is answered here and nothing reaches a real shop. To run:
 *   VITE_API_URL=http://127.0.0.1:7897 VITE_HOST_CREDIT_OPEN=true  npx vite --port 7895 --strictPort --host 127.0.0.1
 *   VITE_API_URL=http://127.0.0.1:7897 VITE_HOST_CREDIT_OPEN=false npx vite --port 7896 --strictPort --host 127.0.0.1
 *   HOST_CREDIT_SCREENS=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:7895 npx playwright test tests/host-credit-screens.spec.ts --project=chromium --workers=1 --trace off
 */
import type { Page, Route } from '@playwright/test';
import { expect as baseExpect, test } from './fixtures';
import { FAKE_TOKEN, mockInventoryApi } from './helpers/inventoryMocks';

// A cold dev server compiles Manage on first visit; give it time.
const expect = baseExpect.configure({ timeout: 20_000 });

const ON_URL = process.env.HOST_CREDIT_ON_URL ?? 'http://127.0.0.1:7895';
const OFF_URL = process.env.HOST_CREDIT_OFF_URL ?? 'http://127.0.0.1:7896';

test.skip(!process.env.HOST_CREDIT_SCREENS, 'Needs the two sites above; set HOST_CREDIT_SCREENS=1 to run');
test.setTimeout(120_000);
// A machine whose Chromium is not where Playwright looks names it here.
if (process.env.L5_CHROMIUM) test.use({ launchOptions: { executablePath: process.env.L5_CHROMIUM } });

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const hostToken = [encode({ alg: 'HS256', typ: 'JWT' }), encode({
  sub: 'host', email: 'rayi@example.test', name: 'Rayi', role: 'user', memberships: [],
  active_account_id: null, exp: Math.floor(Date.now() / 1000) + 3600,
}), 'signature'].join('.');

function ownerToken() {
  const [header, payload, signature] = FAKE_TOKEN.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  const membership = { ...claims.memberships[0], account_id: 'acct-bali', role: 'owner', bundles: ['catalog', 'gather', 'stock', 'sell'] };
  return {
    claims,
    token: [header, encode({ ...claims, role: 'owner', active_account_id: 'acct-bali', platform_role: null, memberships: [membership] }), signature].join('.'),
  };
}

const MINE = {
  balances: [{ account_id: 'bali-account', shop_name: 'Teajia Bali', currency: 'USD', pending: 2.5, earned: 12, reversed: 0, spent: 0, held: 0, debt: 0, available: 12 }],
  lines: [{
    id: 'line-1', account_id: 'bali-account', shop_name: 'Teajia Bali', event_id: 'event', event_title: 'Evening tea at the river',
    tea_name: 'Moonlight White', basis_amount: 120, basis_currency: 'USD', credit_amount: 12, credit_currency: 'USD',
    status: 'earned', earned_at: '2026-11-20T10:00:00Z', reversed_at: null, created_at: '2026-11-19T10:00:00Z',
  }],
  requests: [] as unknown[],
  orders: [] as unknown[],
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

const CART_ITEM = {
  id: 'checkout-tea', name: 'Moonlight White', variant: '', category: 'tea',
  storeSlug: 'teajia-bali', storeName: 'Teajia Bali', quantityGrams: 50,
  packGrams: 25, packs: 2, lineKey: 'checkout-tea:25', pricePerGram: 0.15, totalPrice: 16,
};
const PRODUCT = {
  id: 'checkout-tea', type: 'White', product_name: 'Moonlight White', year: '2024',
  origin_country: 'China', origin_region: 'Fujian', retail_price_per_gram_usd: 0.15,
  stock_grams: 500, status: 'Active', description: 'Soft florals.',
};

/** A signed-in host with a cart in Teajia Bali. Returns what checkout sent. */
async function asHost(page: Page) {
  const sent: Array<Record<string, unknown>> = [];
  const reads: string[] = [];
  const uses: string[] = [];
  await page.addInitScript(({ token, item }) => {
    if (!localStorage.getItem('credit-fixture-seeded')) {
      localStorage.setItem('teajia_token', token);
      localStorage.setItem('teajia-storage', JSON.stringify({ version: 5, state: {
        publicCart: [item], currency: 'USD', shopStoreSlug: 'teajia-bali', activeUserId: 'host',
      } }));
      localStorage.setItem('credit-fixture-seeded', 'true');
    }
  }, { token: hostToken, item: CART_ITEM });
  await page.context().route('https://wa.me/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>captured</p>' }));
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/api/me/tea-credit') {
      reads.push(url.search);
      return json(route, url.searchParams.get('store') === 'teajia-bali' ? { ...MINE, store_available: 12 } : MINE);
    }
    if (path === '/api/inquiries' && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      sent.push(body);
      return json(route, {
        success: true, id: 'request-1', invoice_id: 'invoice-1', invoice_number: 'TJB-0042', tracking_token: body.tracking_token,
        ref_number: body.ref_number, source: 'website', email_sent: false,
      }, 201);
    }
    if (path === '/api/me/tea-credit/orders/invoice-1/use' && request.method() === 'POST') {
      uses.push(request.postData() ?? '');
      return json(route, { success: true, request: { id: 'hcs_1', amount: 12, currency: 'USD' } }, 201);
    }
    if (path === '/api/s/teajia-bali') return json(route, {
      id: 'bali-account', slug: 'teajia-bali', name: 'Teajia Bali', public_enabled: true, can_be_paid: true,
      whatsapp_number: '6281234567890', contact_email: 'shop@example.com',
    });
    if (path === '/api/products/public' || path === '/api/s/teajia-bali/products') return json(route, [PRODUCT]);
    if (path === '/api/rates') return json(route, [{ currency: 'USD', rate_to_usd: 1 }]);
    if (path === '/api/auth/me') return json(route, { id: 'host', name: 'Rayi', email: 'rayi@example.test', role: 'user' });
    if (path === '/api/auth/refresh') return json(route, { token: hostToken });
    if (path === '/api/network/stores') return json(route, { stores: [] });
    if (path === '/api/me/memberships') return json(route, []);
    return json(route, []);
  });
  return { sent, reads, uses };
}

async function openCart(page: Page) {
  await page.locator('button[aria-label="Open shopping cart"]:visible, button[aria-label="Cart"]:visible, button[aria-label^="Cart,"]:visible').first().click();
  await expect(page.getByRole('button', { name: 'Close cart', exact: true })).toBeVisible();
}

async function fillOrder(page: Page) {
  await page.getByLabel('City', { exact: true }).fill('Los Angeles');
  await page.getByLabel('State (two-letter code)', { exact: true }).fill('CA');
  await page.getByLabel('ZIP code', { exact: true }).fill('90012');
  await page.getByLabel('Street address and apartment', { exact: true }).fill('12 Test Lane');
  await page.getByLabel('Your name', { exact: true }).fill('Rayi');
}

/** The owner in Sales > Waiting, with one held use of credit and one order over the ceiling. */
async function asOwner(page: Page) {
  const { claims, token } = ownerToken();
  const decisions: string[] = [];
  const shop = {
    terms: { percent: 10, ceilingUsd: 5 },
    hosts: [{ ...MINE.balances[0], account_id: 'acct-bali', host_user_id: 'host', host_name: 'Rayi', held: 4, available: 8 }],
    lines: [{ ...MINE.lines[0], account_id: 'acct-bali', host_user_id: 'host', host_name: 'Rayi', invoice_id: 'sale', invoice_number: 'TJB-0009', invoice_status: 'Filled' }],
    spend_requests: [{ id: 'hcs_1', host_user_id: 'host', host_name: 'Rayi', invoice_id: 'inv', invoice_number: 'TJB-0042', amount: 4, currency: 'USD', status: 'held', requested_at: '2026-11-25T10:00:00Z', decided_at: null, over_ceiling: false }],
    second_look: [{ invoice_id: 'big', invoice_number: 'TJB-0030', host_user_id: 'host', host_name: 'Rayi', event_title: 'Evening tea at the river', credit_amount: 9, currency: 'USD', ceiling_usd: 5 }],
  };
  await page.route('**/api/**', route => json(route, {}));
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await mockInventoryApi(page);
  await page.route('**/api/auth/refresh', route => json(route, { token }));
  await page.route('**/api/auth/me', route => json(route, { id: claims.sub, name: claims.name, email: claims.email, role: 'owner' }));
  await page.route('**/api/invoices?**', route => json(route, []));
  await page.route('**/api/admin/inquiries**', route => json(route, { inquiries: [] }));
  await page.route('**/api/admin/events/pending-attendees', route => json(route, []));
  await page.route('**/api/host-credit**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'GET' && path === '/api/host-credit') return json(route, shop);
    decisions.push(`${request.method()} ${path}`);
    if (path === '/api/host-credit/spend-requests/hcs_1/approve') {
      shop.spend_requests = shop.spend_requests.map(row => ({ ...row, status: 'approved' }));
      return json(route, { ok: true, status: 'approved' });
    }
    if (path === '/api/host-credit/invoices/big/approve') {
      shop.second_look = [];
      return json(route, { success: true, earned: 1 });
    }
    return json(route, { error: 'Not found' }, 404);
  });
  return decisions;
}

for (const size of SIZES) {
  test.describe(`tea credit at ${size.name} ${size.width}x${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test("the host's own view shows earned, waiting, held and ready, and where it came from", async ({ page }) => {
      await asHost(page);
      await page.goto(`${ON_URL}/account/tea-credit`);
      await expect(page.getByRole('heading', { name: 'Tea credit', level: 1 })).toBeVisible();
      const card = page.getByRole('region', { name: 'Your tea credit' });
      for (const word of ['Ready to use', 'Earned', 'Waiting', 'Held']) await expect(card.getByText(word, { exact: true })).toBeVisible();
      await expect(card.getByText('$12.00').first()).toBeVisible();
      const from = page.getByRole('region', { name: 'Where your credit came from' });
      await expect(from.getByText('Moonlight White')).toBeVisible();
      await expect(from.getByText(/From Evening tea at the river/)).toBeVisible();
      await assertNoOverflow(page);
    });

    test('checkout offers one plain choice, sends no amount, and the WhatsApp message says credit was asked for', async ({ page }) => {
      const { sent, reads, uses } = await asHost(page);
      await page.goto(`${ON_URL}/shop`, { waitUntil: 'domcontentloaded' });
      await openCart(page);
      const choice = page.getByRole('checkbox', { name: /Use my tea credit on this order/ });
      await expect(choice).toBeVisible();
      await expect(page.getByText('You have $12.00. The shop approves it by hand.')).toBeVisible();
      expect(reads).toContain('?store=teajia-bali');
      await fillOrder(page);
      await choice.check();
      await assertNoOverflow(page);
      await page.getByRole('button', { name: 'Place order request', exact: true }).click();
      await expect.poll(() => sent.length).toBe(1);
      // The order carries nothing about credit; the ask is its own call, with no amount.
      expect(Object.keys(sent[0]).filter(key => /credit/.test(key))).toEqual([]);
      await expect.poll(() => uses.length).toBe(1);
      expect(uses[0]).toBe('');
      await expect(page.getByText('You asked to use $12.00 of your tea credit. The shop will look it over and confirm it with you.')).toBeVisible();
      const whatsapp = page.getByRole('link', { name: 'Discuss this order on WhatsApp' });
      await expect(whatsapp).toHaveAttribute('href', /I%20asked%20to%20use%20%2412\.00%20of%20my%20tea%20credit/);
      await assertNoOverflow(page);
    });

    test('the owner approves a use of credit and an order over the ceiling, in Sales > Waiting', async ({ page }) => {
      const decisions = await asOwner(page);
      await page.goto(`${ON_URL}/admin/activity?tab=waiting`);
      const section = page.getByRole('region', { name: 'Tea credit' });
      await expect(section).toBeVisible();
      const ask = section.getByRole('listitem', { name: /Rayi asks to use \$4\.00/ });
      await expect(ask).toContainText('On order TJB-0042');
      await expect(ask.getByRole('button', { name: 'Decline' })).toBeVisible();
      await assertNoOverflow(page);
      await ask.getByRole('button', { name: 'Approve' }).click();
      await expect(section.getByText('No credit waiting for you.')).toBeVisible();
      const look = section.getByRole('listitem', { name: /Order TJB-0030/ });
      await look.getByRole('button', { name: 'Approve' }).click();
      await expect(section.getByText('Waiting on a second look')).toHaveCount(0);
      expect(decisions).toEqual(['POST /api/host-credit/spend-requests/hcs_1/approve', 'POST /api/host-credit/invoices/big/approve']);

      // One host's lines are a step: back closes them.
      await section.getByRole('button', { name: /Rayi/ }).click();
      await expect(page).toHaveURL(/credit=host/);
      await expect(section.getByText('Where it came from')).toBeVisible();
      await expect(section.getByText(/Order TJB-0009/)).toBeVisible();
      await assertNoOverflow(page);
      await page.goBack();
      await expect(page).not.toHaveURL(/credit=host/);
      await expect(section.getByText('Asked to use')).toBeVisible();
    });

    test('with the switch off, nothing about credit shows anywhere', async ({ page }) => {
      const { sent, reads, uses } = await asHost(page);
      await page.goto(`${OFF_URL}/shop`, { waitUntil: 'domcontentloaded' });
      await openCart(page);
      await expect(page.getByLabel('Your name', { exact: true })).toBeVisible();
      await expect(page.getByText(/tea credit/i)).toHaveCount(0);
      await fillOrder(page);
      await page.getByRole('button', { name: 'Place order request', exact: true }).click();
      await expect.poll(() => sent.length).toBe(1);
      expect(uses).toEqual([]);
      await assertNoOverflow(page);

      await page.goto(`${OFF_URL}/account/tea-credit`);
      await expect(page.getByRole('heading', { name: 'Tea credit' })).toHaveCount(0);
      expect(reads).toEqual([]);

      const owner = await page.context().newPage();
      await asOwner(owner);
      await owner.goto(`${OFF_URL}/admin/activity?tab=waiting`);
      await expect(owner.getByText('Pending Orders', { exact: true })).toBeVisible();
      await expect(owner.getByRole('region', { name: 'Tea credit' })).toHaveCount(0);
      await assertNoOverflow(owner);
    });
  });
}
