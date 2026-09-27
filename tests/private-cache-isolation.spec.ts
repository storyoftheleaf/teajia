import { test, expect, type Route } from './fixtures';

function token(account: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: 'cache-operator', name: 'Cache operator', role: 'owner', platform_role: 'platform_owner',
    exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: account,
    memberships: ['store-a', 'store-b'].map(id => ({ account_id: id, account_name: id, slug: id, role: 'owner' })),
  })}.fixture`;
}

test('pending data disappears across a store switch, failed read, late response, and logout', async ({ page }) => {
  let delayedAttendees: Route | undefined;
  let bRequests = 0;
  await page.addInitScript(value => {
    if (!localStorage.getItem('teajia_token')) localStorage.setItem('teajia_token', value);
    localStorage.setItem('teajia-query-cache', JSON.stringify({ stale: 'Legacy private customer' }));
  }, token('store-a'));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const account = route.request().headers()['x-teajia-account'];
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/me') return json({ id: 'cache-operator', name: 'Cache operator', role: 'owner' });
    if (path === '/api/invoices') {
      if (account === 'store-b') { bRequests++; return json({ error: 'Fixture unavailable' }, 500); }
      return json([{ id: 'a-order', invoice_number: 'A-001', customer_name: 'Private store A customer', status: 'Pending', created_at: '2026-09-27', computed_total: 20 }]);
    }
    if (path === '/api/admin/pending-attendees' && account === 'store-a') { delayedAttendees = route; return; }
    if (path.startsWith('/api/accounts/store-')) return json({ id: account, name: account, status: 'active', public_enabled: 1 });
    if (path === '/api/accounts/me') return json({ memberships: ['store-a', 'store-b'].map(id => ({ account_id: id, account_name: id, slug: id, role: 'owner' })), active_account_id: account });
    if (path.includes('/inquiries')) return json({ inquiries: [] });
    if (path === '/api/rates') return json([{ currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() }]);
    return json([]);
  });
  await page.goto('/admin/activity');
  await expect(page.getByText('Private store A customer', { exact: true })).toBeVisible();
  await expect.poll(() => Boolean(delayedAttendees)).toBe(true);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('teajia-query-cache'))).toBeNull();
  await page.evaluate(async value => {
    const auth = await import('/src/lib/api.ts');
    auth.setToken(value);
    auth.hydrateAccountStateFromToken();
  }, token('store-b'));
  await expect.poll(() => bRequests).toBeGreaterThan(0);
  await expect(page.getByText('Private store A customer', { exact: true })).toHaveCount(0);
  await delayedAttendees!.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'a-guest', event_id: 'a-event', event_title: 'Private store A event', full_name: 'Late private A guest', status: 'requested' }]) });
  await expect(page.getByText('Late private A guest', { exact: true })).toHaveCount(0);
  await page.evaluate(async () => {
    const auth = await import('/src/lib/api.ts');
    auth.clearToken();
  });
  await expect(page.getByText('Private store A customer', { exact: true })).toHaveCount(0);
  const disk = await page.evaluate(() => localStorage.getItem('teajia-public-query-cache') || '');
  expect(disk).not.toContain('Private store A');
  expect(disk).not.toContain('Late private A');
});
