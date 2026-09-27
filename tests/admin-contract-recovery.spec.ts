import { test, expect, type Page } from './fixtures';

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'admin-1', email: 'admin@teajia.com', role: 'owner', platform_role: 'platform_owner',
  active_account_id: 'acct-bali', exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  memberships: [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' }],
})}.fake`;

async function prepare(page: Page) {
  await page.addInitScript(value => localStorage.setItem('teajia_token', value), token);
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    let body: unknown = [];
    if (pathname === '/api/auth/me') body = { id: 'admin-1', email: 'admin@teajia.com', role: 'owner' };
    if (pathname === '/api/auth/refresh') body = { token };
    if (pathname === '/api/accounts/acct-bali') body = { id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali' };
    if (pathname === '/api/products') body = [{
      id: 'tea-1', product_name: 'Raw Worker Tea', given_name: 'Story Tea', type: 'Puer',
      stock_grams: 120, retail_price_per_gram_usd: 0.25, cost_amount: 88, cost_currency: 'CNY', status: 'Active',
    }];
    if (pathname === '/api/customers/vendor-1') body = { id: 'vendor-1', name: 'Target Vendor', tags: [], contacts: [] };
    if (pathname === '/api/customers/vendor-1/products') body = [{
      id: 'tea-1', product_name: 'Raw Worker Tea', given_name: 'Vendor Tea', type: 'Puer',
      image_url: null, origin_country: 'China', origin_region: 'Yunnan', stock_grams: 500,
      status: 'Active', cost_amount: 88, cost_currency: 'CNY',
    }];
    if (pathname === '/api/purchase-orders') body = [
      { id: 'po-1', vendor_id: 'vendor-1', vendor_name: 'Target Vendor', total_usd: 50, status: 'pending', created_at: '2026-09-01' },
      { id: 'po-2', vendor_id: 'vendor-2', vendor_name: 'Target Vendor', total_usd: 90, status: 'pending', created_at: '2026-09-01' },
    ];
    if (pathname === '/api/inventory/receipts') body = [
      { id: 'r-1', vendor_name: 'Target Vendor', state: 'ordered', source_kind: 'purchase', lines: [] },
    ];
    if (pathname === '/api/invoices') body = [{ id: 'sale-1', customer_name: 'Target Vendor', invoice_number: 'SALE-1' }];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

for (const viewport of ['Desktop Chrome', 'Mobile Chrome']) {
  test.describe(`admin contract recovery — ${viewport}`, () => {
    test.use({ viewport: viewport === 'Mobile Chrome' ? { width: 393, height: 852 } : { width: 1280, height: 800 } });

    test('product story renders a raw Worker row', async ({ page }) => {
      await prepare(page);
      await page.goto('/admin/products/tea-1/story');
      await expect(page.getByText('Story Tea').first()).toBeVisible();
      await expect(page.getByText('0.250', { exact: false })).toBeVisible();
      await expect(page.getByText('Tea not found')).toHaveCount(0);
    });

    test('vendor profile shows recorded CNY cost and purchases, not sales invoices', async ({ page }) => {
      await prepare(page);
      await page.goto('/admin/vendors/vendor-1');
      await expect(page.getByText('Vendor Tea')).toBeVisible();
      await expect(page.getByText('88 CNY')).toBeVisible();
      await expect(page.getByText('Purchase order · Target Vendor')).toBeVisible();
      await expect(page.getByText('Inventory receipt')).toBeVisible();
      await expect(page.getByText('SALE-1')).toHaveCount(0);
      await expect(page.getByText('$90.00 USD')).toHaveCount(0);
    });
  });
}
