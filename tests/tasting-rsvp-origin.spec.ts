import { expect, test, type Page } from './fixtures';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const memberships = [{ account_id: 'fixture-shop', account_name: 'Fixture Shop', role: 'owner', bundles: ['gather'] }];
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'fixture-host', email: 'host@test.invalid', role: 'owner', active_account_id: 'fixture-shop', memberships,
  exp: Math.floor(Date.now() / 1000) + 86400,
})}.fixture-signature`;

async function install(page: Page, origin: string) {
  let payload: Record<string, unknown> | undefined;
  await page.addInitScript(jwt => localStorage.setItem('teajia_token', jwt), token);
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    if (path === '/api/admin/events') return route.fulfill({ json: [{
      id: 'rsvp-event', account_id: 'fixture-shop', title: 'Saturday Tea Table', slug: 'saturday-tea',
      event_date: '2026-11-19T10:00:00Z', status: 'active', lifecycle_status: 'published',
    }] });
    if (path === '/api/products') return route.fulfill({ json: [{
      id: 'fixture-tea', product_name: 'Fixture Oolong', type: 'Oolong', stock_grams: 200,
    }] });
    const session = {
      id: 'structured-fixture', title: 'Fixture tasting', status: 'active', created_by_user_id: 'fixture-host',
      event_id: payload?.event_id ?? null, event_title: payload?.event_id ? 'Saturday Tea Table' : null,
    };
    if (path === '/api/sessions' && route.request().method() === 'POST') {
      payload = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { session: { id: 'structured-fixture' } } });
    }
    if (path === '/api/sessions/structured-fixture') return route.fulfill({ json: { session } });
    if (path === '/api/sessions/structured-fixture/host-live') return route.fulfill({ json: { session, teas: [], members: [], verdicts: [], progress: [] } });
    if (path === '/api/auth/join-code/issue') return route.fulfill({ json: { code: 'FIXX42', expires_at: '2099-01-01' } });
    return route.fulfill({ json: [] });
  });
  return () => payload;
}

async function chooseTea(page: Page) {
  await page.getByRole('button', { name: 'Fixture Oolong Oolong', exact: true }).click();
}

test('a standalone structured tasting omits the RSVP origin', async ({ page, baseURL }) => {
  const payload = await install(page, new URL(baseURL!).origin);
  await page.goto('/admin/tasting-events/new', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('combobox', { name: 'RSVP event (optional)' })).toHaveValue('', { timeout: 30000 });
  await chooseTea(page);
  await page.getByRole('button', { name: 'Create group tasting' }).click();
  await expect(page).toHaveURL(/\/admin\/tasting-events\/structured-fixture$/);
  expect(payload()).toEqual({ product_ids: ['fixture-tea'] });
  await expect(page.getByText('RSVP event · Saturday Tea Table')).toHaveCount(0);
});

test('an event-derived tasting carries the chosen RSVP and shows its title', async ({ page, baseURL }, info) => {
  const payload = await install(page, new URL(baseURL!).origin);
  await page.goto('/admin/tasting-events/new?eventId=rsvp-event', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('combobox', { name: 'RSVP event (optional)' })).toHaveValue('rsvp-event', { timeout: 30000 });
  await expect(page.getByRole('option', { name: 'Saturday Tea Table' })).toHaveCount(1);
  await chooseTea(page);
  await page.screenshot({ path: info.outputPath('linked-tasting-form.png'), animations: 'disabled', scale: 'css' });
  await page.getByRole('button', { name: 'Create group tasting' }).click();
  await expect(page.getByText('RSVP event · Saturday Tea Table')).toBeVisible();
  expect(payload()).toEqual({ product_ids: ['fixture-tea'], event_id: 'rsvp-event' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('linked-tasting-room.png'), animations: 'disabled', scale: 'css' });
});

test('an unavailable requested RSVP is never silently replaced with standalone', async ({ page, baseURL }) => {
  const payload = await install(page, new URL(baseURL!).origin);
  await page.goto('/admin/tasting-events/new?eventId=other-account-event', { waitUntil: 'domcontentloaded' });
  await chooseTea(page);
  await expect(page.getByRole('option', { name: 'RSVP event unavailable' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Create group tasting' })).toBeDisabled();
  expect(payload()).toBeUndefined();
  await page.getByRole('combobox', { name: 'RSVP event (optional)' }).selectOption('');
  await expect(page.getByRole('button', { name: 'Create group tasting' })).toBeEnabled();
});
