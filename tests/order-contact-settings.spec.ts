import { expect, test } from './fixtures';

// The default Playwright dev:test server sets VITE_API_URL. An external
// PLAYWRIGHT_BASE_URL must also use an API-configured Vite server so the admin
// setup gate can mount; every API response and write remains intercepted below.
test('opens order contacts directly and saves an email inbox with WhatsApp still pending', async ({ page, context }, testInfo) => {
  const accountId = 'fixture-order-contact-store';
  const memberships = [{ account_id: accountId, account_name: 'Order contact test store', role: 'owner', slug: 'order-contact-test' }];
  const user = { id: 'fixture-order-contact-owner', email: 'owner@example.invalid', name: 'Fixture Owner', role: 'owner', platform_role: null, active_account_id: accountId, memberships };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...user, sub: user.id, exp: Math.floor(Date.now() / 1000) + 86400 * 30 })}.fixture-signature`;
  let account = {
    id: accountId, name: 'Order contact test store', slug: 'order-contact-test',
    location_city: '', location_country: '', timezone: 'Asia/Makassar', currency_default: 'IDR',
    whatsapp_number: '', contact_email: 'orders@example.invalid', public_enabled: false,
    default_shipping_rate_per_kg: null, default_shipping_rate_currency: null,
  };
  const saves: Array<Record<string, unknown>> = [];
  await page.addInitScript(({ token, accountId, memberships }) => {
    localStorage.setItem('teajia_token', token);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 6, state: { activeAccountId: accountId, memberships } }));
  }, { token, accountId, memberships });
  // Every API request, including writes, is fulfilled here. No live account is touched.
  await context.route('**/api/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    let body: unknown = [];
    if (pathname === '/api/auth/me') body = user;
    else if (pathname === '/api/accounts/me') body = { memberships, active_account_id: accountId };
    else if (pathname === `/api/accounts/${accountId}`) {
      if (request.method() === 'PUT') {
        const payload = request.postDataJSON();
        saves.push(payload);
        account = { ...account, ...payload };
      }
      body = account;
    } else if (pathname === '/api/me/public-profile') body = { profile: null };
    else if (pathname === '/api/rates') body = [{ currency: 'USD', rate_to_usd: 1, last_updated: new Date().toISOString() }, { currency: 'IDR', rate_to_usd: 16000, last_updated: new Date().toISOString() }];
    else if (pathname.endsWith('/features')) body = { features: {} };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/admin/account-settings#order-contacts', { waitUntil: 'domcontentloaded' });
  const heading = page.getByRole('heading', { name: 'Order contacts', exact: true });
  await expect(heading).toBeVisible();
  // No test scroll: the hash itself must bring the section into view.
  await expect(heading).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel('Business WhatsApp (optional)', { exact: true })).toHaveValue('');
  await expect(page.getByText('WhatsApp not set', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Order email', { exact: true })).toHaveValue('orders@example.invalid');
  await expect(page.getByRole('button', { name: 'Save contacts and settings', exact: true })).toBeEnabled();
  await expect.poll(() => heading.evaluate(element => {
    let opacity = 1;
    for (let node: Element | null = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    return opacity;
  })).toBeGreaterThan(0.99);
  await page.screenshot({ path: testInfo.outputPath('order-contacts-viewport.png'), animations: 'disabled' });

  await page.getByLabel('Order email', { exact: true }).fill('order-replies@example.invalid');
  await page.getByRole('button', { name: 'Save contacts and settings', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved\.$/ }).first()).toBeVisible();
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({ whatsapp_number: '', contact_email: 'order-replies@example.invalid', public_enabled: false, default_shipping_rate_per_kg: null });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(heading).toBeInViewport({ ratio: 1 });
  await expect(page.getByLabel('Business WhatsApp (optional)', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Order email', { exact: true })).toHaveValue('order-replies@example.invalid');
});
