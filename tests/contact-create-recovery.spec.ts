import { test, expect } from './fixtures';

test('a new contact commits once with its relationships even if a separate relationship save would fail', async ({ page }, testInfo) => {
  const accountId = 'contact-recovery-account';
  const membership = { account_id: accountId, account_name: 'Contact Recovery', role: 'owner', slug: 'contact-recovery' };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'contact-owner', email: 'owner@example.invalid', role: 'owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: accountId, memberships: [membership] })}.sig`;

  await page.addInitScript(({ token, membership, accountId }) => {
    localStorage.clear();
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: accountId, activeUserId: 'contact-owner', memberships: [membership],
    } }));
  }, { token, membership, accountId });

  const contacts: Array<Record<string, unknown>> = [];
  const createBodies: Array<Record<string, unknown>> = [];
  let relationshipPuts = 0;
  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (pathname === '/api/auth/me') return route.fulfill({ json: { id: 'contact-owner', email: 'owner@example.invalid', role: 'owner', active_account_id: accountId, memberships: [membership] } });
    if (pathname === '/api/auth/refresh') return route.fulfill({ json: { token } });
    if (pathname === '/api/accounts/me') return route.fulfill({ json: { memberships: [membership] } });
    if (pathname === `/api/accounts/${accountId}`) return route.fulfill({ json: { id: accountId, name: 'Contact Recovery', slug: 'contact-recovery' } });
    if (pathname === '/api/customers' && method === 'GET') return route.fulfill({ json: contacts });
    if (pathname === '/api/customers' && method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      createBodies.push(body);
      contacts.push({ id: 'contact-1', ...body, relationship_kinds: body.relationship_kinds, created_at: '2026-09-27T00:00:00Z' });
      return route.fulfill({ status: 201, json: { id: 'contact-1' } });
    }
    if (pathname === '/api/customers/contact-1/relationships' && method === 'PUT') {
      relationshipPuts++;
      return route.fulfill({ status: 500, json: { error: 'Relationship service unavailable' } });
    }
    if (method === 'GET') return route.fulfill({ json: [] });
    return route.fulfill({ status: 501, json: { error: `Unhandled ${method} ${pathname}` } });
  });

  await page.goto('/admin/people?tab=customers');
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) < 768) await page.locator('button[title="Add customer"]').click();
  else await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add Customer' })).toBeVisible();
  await page.getByPlaceholder('Full name').fill('Lin Vendor');
  await page.getByRole('button', { name: 'Buyer', exact: true }).click();
  await page.getByRole('button', { name: 'Add Customer', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Add Customer' })).toHaveCount(0);
  await expect(page.getByText('Lin Vendor').filter({ visible: true })).toBeVisible();
  expect(createBodies).toHaveLength(1);
  expect(createBodies[0].relationship_kinds).toContain('buyer');
  expect(relationshipPuts).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('contact-created-once.png'), animations: 'disabled' });
});
