import { expect as playwrightExpect, test, type Page, type Route } from './fixtures';
import { FAKE_TOKEN, mockInventoryApi, MOCK_PRODUCTS } from './helpers/inventoryMocks';

const expect = playwrightExpect.configure({ timeout: 15_000 });
const title = 'Oolong & friends';
const product = { ...MOCK_PRODUCTS[1], status: 'Sold Out', stock_grams: 0 };
const sessionPath = '/admin/events?search=' + encodeURIComponent(title);
const stockPath = '/admin/stock?panel=' + product.id;

test.setTimeout(45_000);

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'Mobile Chrome') await page.setViewportSize({ width: 390, height: 844 });
});

async function seedRecords(page: Page, role: 'owner' | 'staff' = 'owner', accountId = 'acct-bali') {
  const [header, payload, signature] = FAKE_TOKEN.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  const membership = { ...claims.memberships[0], account_id: accountId, role, bundles: role === 'owner'
    ? ['catalog', 'gather', 'stock', 'sell']
    : ['sell'] };
  const token = [header, Buffer.from(JSON.stringify({
    ...claims, role, active_account_id: accountId, platform_role: null, memberships: [membership],
  })).toString('base64url'), signature].join('.');

  await page.route('**/api/**', route => route.fulfill({ json: {} }));
  await page.addInitScript(token => localStorage.setItem('teajia_token', token), token);
  await mockInventoryApi(page);
  await page.route('**/api/auth/refresh', route => route.fulfill({ json: { token } }));
  await page.route('**/api/auth/me', route => route.fulfill({ json: {
    id: claims.sub, name: claims.name, email: claims.email, role,
  } }));
  await page.route('**/api/invoices?**', route => route.fulfill({ json: [{
    id: 'prior-sale', invoice_number: 'SALE-101', customer_name: 'Tea guest',
    status: 'Filled', created_at: '2024-10-15T12:00:00Z',
    source_event_title: title, source_event_id: null,
  }] }));
  const inOwningShop = (route: Route) => route.request().headers()['x-teajia-account'] === 'acct-bali';
  await page.route('**/api/admin/events', route => route.fulfill({ json: inOwningShop(route) ? [
    { id: 'past', slug: 'past', title, event_date: '2024-10-15T12:00:00Z', status: 'completed' },
    { id: 'upcoming', slug: 'upcoming', title: 'Unrelated tea', event_date: '2099-10-15T12:00:00Z', status: 'active' },
  ] : [{ id: 'other', slug: 'other', title: 'Another shop’s session', event_date: '2099-11-15T12:00:00Z', status: 'active' }] }));
  await page.route('**/api/products', route => route.fulfill({ json: inOwningShop(route) ? [product] : [] }));
  await page.route('**/api/stock-ledger?**', route => route.fulfill({ json: { total: 2, entries: [
    { id: 'movement', product_id: product.id, product_name: 'Previous tea name', delta: -40, reason: 'FULFILLMENT', balance_after: 0 },
    { id: 'old', product_id: 'outside-current-stock', product_name: 'Unavailable tea', delta: -30, balance_after: 0 },
  ] } }));
  await page.route('**/api/sales/grants?**', route => route.fulfill({ json: [] }));
  await page.route('**/api/admin/events/pending-attendees', route => route.fulfill({ json: [] }));
}

test('a saved sale finds a past session by title on click and fresh entry', async ({ page }) => {
  await seedRecords(page);
  await page.goto('/admin/activity?tab=orders');
  await page.getByTitle('Attributed to: ' + title).filter({ visible: true }).first().click();
  await expect(page.getByRole('textbox', { name: 'Search events' })).toHaveValue(title);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText('Unrelated tea', { exact: true })).toHaveCount(0);

  await page.goto(sessionPath);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(page.getByText('Unrelated tea', { exact: true })).toBeVisible();
});

test('the sales ledger opens the exact Stock record across renamed products and reload', async ({ page }) => {
  await seedRecords(page);
  await page.goto('/admin/activity?tab=ledger');
  await expect(page.getByText('Unavailable tea', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Unavailable tea', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Previous tea name', exact: true }).click();

  const record = page.getByRole('dialog', { name: product.product_name, exact: true });
  await expect(record).toBeVisible();
  await expect(page).toHaveURL(url => url.pathname + url.search === stockPath);
  await page.reload();
  await expect(record).toBeVisible();
  await record.getByRole('button', { name: 'Close product panel' }).click();
  await expect(page).toHaveURL(url => !url.searchParams.has('panel'));
  await expect(record).toHaveCount(0);

  await page.goto('/admin/stock?panel=outside-current-stock');
  await expect(page.getByRole('button', { name: 'View options', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('the Sold Items archive opens the same Stock record', async ({ page }) => {
  await seedRecords(page);
  await page.goto('/admin/activity?tab=ledger');
  await page.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.getByRole('link', { name: product.product_name, exact: true }).click();
  await expect(page.getByRole('dialog', { name: product.product_name, exact: true })).toBeVisible();
});

test('a sales-only member cannot open linked Stock or Sessions records', async ({ page }) => {
  await seedRecords(page, 'staff');
  await page.goto('/admin/activity?tab=ledger');
  await expect(page.getByText('Previous tea name', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Previous tea name', exact: true })).toHaveCount(0);
  for (const path of [stockPath, sessionPath]) {
    await page.goto(path);
    await expect(page.getByText('Access Restricted', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: product.product_name, exact: true })).toHaveCount(0);
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  }
});

test('a second shop opening the addresses only sees its own records', async ({ page }) => {
  await seedRecords(page, 'owner', 'acct-other');
  await page.goto(sessionPath);
  await expect(page.getByRole('textbox', { name: 'Search events' })).toHaveValue(title);
  await expect(page.getByText('Nothing matched. Try different words.')).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  const products = page.waitForResponse(response => new URL(response.url()).pathname === '/api/products');
  await page.goto(stockPath);
  expect((await products).request().headers()['x-teajia-account']).toBe('acct-other');
  await expect(page.getByRole('button', { name: 'View options', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog', { name: product.product_name, exact: true })).toHaveCount(0);
});
