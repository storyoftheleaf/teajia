import { expect, test } from './fixtures';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Shipping routes in Settings (plan samples-to-orders.md, build 3). Every API
// request, writes included, is answered here; no live account is touched.
const SHOTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '../test-results/shipping-routes');

test('a route is added, its figures are tapped and typed, and an emptied rate stays unknown', async ({ page, context }) => {
  const accountId = 'fixture-routes-store';
  const memberships = [{ account_id: accountId, account_name: 'Routes test store', role: 'owner', slug: 'routes-test' }];
  const user = { id: 'fixture-routes-owner', email: 'owner@example.invalid', name: 'Fixture Owner', role: 'owner', platform_role: null, active_account_id: accountId, memberships };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...user, sub: user.id, exp: Math.floor(Date.now() / 1000) + 86400 * 30 })}.fixture-signature`;
  const account = { id: accountId, name: 'Routes test store', slug: 'routes-test', location_city: '', location_country: '', timezone: 'Asia/Makassar', currency_default: 'IDR', whatsapp_number: '', contact_email: '', public_enabled: false, default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Yuan' };
  const routes: Array<Record<string, unknown>> = [];
  const writes: Array<{ method: string; body: Record<string, unknown> | null }> = [];
  await page.addInitScript(({ token, accountId, memberships }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 6, state: { activeAccountId: accountId, memberships } }));
  }, { token, accountId, memberships });
  await context.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body: unknown = [];
    if (pathname === '/api/auth/me') body = user;
    else if (pathname === '/api/accounts/me') body = { memberships, active_account_id: accountId };
    else if (pathname === `/api/accounts/${accountId}`) body = account;
    else if (pathname === '/api/me/public-profile') body = { profile: null };
    else if (pathname.endsWith('/features')) body = { features: {} };
    else if (pathname.startsWith('/api/shipping-routes')) {
      const id = pathname.split('/')[3];
      const payload = request.method() === 'GET' || request.method() === 'DELETE' ? null : request.postDataJSON() as Record<string, unknown>;
      if (request.method() !== 'GET') writes.push({ method: request.method(), body: payload });
      // A stand-in that keeps what was saved, empty text as unknown, as the worker does.
      const clean = (p: Record<string, unknown>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v === '' ? null : (typeof v === 'string' && !Number.isNaN(Number(v)) && k !== 'carrier' && k !== 'destination' ? Number(v) : v)]));
      if (request.method() === 'POST') routes.push({ id: `r${routes.length + 1}`, carrier: null, destination: null, rate_per_kg: null, rate_currency: null, packing_percent: null, billing_step_kg: null, minimum_kg: null, learned: null, ...clean(payload!) });
      if (request.method() === 'PUT') { const i = routes.findIndex(r => r.id === id); routes[i] = { ...routes[i], ...clean(payload!) }; if (routes[i].rate_per_kg == null) routes[i].rate_currency = null; }
      body = request.method() === 'GET' ? routes : { ok: true };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/admin/account-settings', { waitUntil: 'domcontentloaded' });
  const section = page.getByRole('region', { name: 'Shipping routes' });
  await expect(section).toContainText('No routes yet');
  await section.getByRole('button', { name: '+ Air route' }).click();
  const air = section.getByTestId('shipping-route').filter({ hasText: 'Air' });
  await expect(air).toBeVisible();

  const type = async (name: string, text: string) => {
    await air.getByRole('button', { name }).click();
    await air.getByRole('textbox', { name }).fill(text);
    await air.getByRole('textbox', { name }).press('Enter');
  };
  await type('Air carrier', 'Bali Air Cargo');
  await type('Air rate per kilo', '85');
  await type('Air packing percent', '35');
  await type('Air billing step in kilos', '1');
  await type('Air received at', 'Teajia Bali');
  await expect(air).toContainText('Bali Air Cargo');
  await expect(air).toContainText('Teajia Bali');
  await expect(air.getByRole('button', { name: 'Air rate per kilo' })).toHaveText('85');
  await expect(air.getByRole('button', { name: 'Air rate currency' })).toHaveText('Yuan');
  expect(writes.find(w => w.body && 'rate_per_kg' in w.body)?.body).toMatchObject({ rate_per_kg: '85', rate_currency: 'Yuan' });
  await section.screenshot({ path: path.join(SHOTS, 'settings-routes.png') });

  await type('Air rate per kilo', '');
  await expect(air.getByRole('button', { name: 'Air rate per kilo' })).toHaveText('rate');
  await expect(air).toContainText('the shop freight rate applies');
});
