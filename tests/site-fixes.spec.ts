import { expect, test, type Page } from './fixtures';

// Problems on the live site go to the builder, not onto the page. The owner
// reads them on /account/fixes, reached from Your Table; nobody else can open
// it. The ledger is mocked: these are seeded shapes, not the live shop's rows.

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const membership = { account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', bundles: ['members'] };
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'owner-1', email: 'owner@example.test', role: 'owner', platform_role: 'owner', active_account_id: 'acct-bali',
  memberships: [membership],
  exp: Math.floor(Date.now() / 1000) + 86_400,
})}.signature`;

const sqlTime = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().replace('T', ' ').slice(0, 19);

const incidents = [
  {
    id: 'inc-rates', signature: 'rates_stale', category: 'server', severity: 'high', status: 'open',
    first_seen: sqlTime(2), last_seen: sqlTime(0.1), occurrence_count: 3, route: '/api/rates', method: 'CRON',
    http_status: null, error_code: 'rates_stale',
    safe_message: 'Exchange rates last refreshed 5 days ago. Last attempt: open.er-api answered 429; backup feed answered 404.',
  },
  {
    id: 'inc-products', signature: 'server:get:api-products:503:http_503', category: 'server', severity: 'high', status: 'open',
    first_seen: sqlTime(4), last_seen: sqlTime(1), occurrence_count: 2, route: '/api/products', method: 'GET',
    http_status: 503, error_code: 'http_503', safe_message: 'The service could not complete this request.',
  },
  {
    id: 'inc-old', signature: 'server:get:api-customers:503:http_503', category: 'server', severity: 'high', status: 'open',
    first_seen: sqlTime(70), last_seen: sqlTime(70), occurrence_count: 1, route: '/api/customers', method: 'GET',
    http_status: 503, error_code: 'http_503', safe_message: 'The service could not complete this request.',
  },
];

async function signIn(page: Page) {
  await page.addInitScript(({ jwt, m }) => {
    localStorage.setItem('teajia_token', jwt);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: { activeAccountId: 'acct-bali', activeUserId: 'owner-1', memberships: [m] } }));
  }, { jwt: token, m: membership });
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/platform/incidents') return route.fulfill({ json: { incidents } });
    if (path === '/api/auth/me') {
      return route.fulfill({ json: { email: 'owner@example.test', name: 'Owner', role: 'owner', platform_role: 'owner' } });
    }
    return route.fulfill({ json: {} });
  });
}

test('the owner sees what needs fixing, in words, with the rates linked', async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto('/account/fixes');
  await expect(page.getByText('Exchange rates last refreshed 5 days ago', { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Check rates' })).toHaveAttribute('href', '/admin/currency');
  await expect(page.getByRole('button', { name: 'Mark fixed' }).first()).toBeVisible();
  // The July-shaped row is quiet: tucked away, not in the active list.
  await expect(page.getByText(/customer/i)).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('site-fixes.png'), fullPage: true });
});

test('the Your Table door turns terracotta while something needs fixing', async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto('/read');
  const door = page.getByRole('button', { name: /^Your Table, 2 site problems to fix$/ }).first();
  await expect(door).toBeVisible({ timeout: 15_000 });
  const terracotta = await page.evaluate(() => {
    const probe = document.createElement('span');
    probe.className = 'text-tea-error';
    document.body.appendChild(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  // Polled: the glyph fades its colour over 300ms, so an immediate read is mid-fade.
  await expect.poll(() => door.locator('svg').evaluate(el => getComputedStyle(el).color)).toBe(terracotta);
  await page.screenshot({ path: testInfo.outputPath('door.png') });
});
