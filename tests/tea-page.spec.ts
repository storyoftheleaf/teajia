import { expect, test, type Page } from './fixtures';

// The open tea is one long page in editing order (Adrian, 2026-11-26), and Next
// opens the next tea at the part last jumped to: a pass through every tea's
// price is one press per tea.

function token() {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin', email: 'admin@test', role: 'owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }] })}.sig`;
}

const base = {
  form: 'Loose', given_name: '', chinese_name: '', origin_country: 'China', cost_per_gram_usd: 0.1,
  cost_amount: 50, low_stock_threshold: 20, tasting_notes: [], image_url: '', status: 'Active', vendor: 'Lin',
  cost_currency: 'USD', quantity_purchased: 100, shipping_rate_per_kg: null, fixed_retail_price_usd: null, can_reorder: 0,
  is_public: 0, shown_in_shop: 0, is_featured: 0, is_sample: 0, is_personal: 0, stock_verified_at: null,
  inventory_purpose: 'working', tasting_source: 'owner',
};
const products = [
  { ...base, id: 'liu-bao', type: 'Dark', product_name: 'Liu Bao', given_name: 'Velvet Earth', chinese_name: '六堡茶', year: 1990, origin_region: 'Guangxi', description: '', retail_price_per_gram_usd: 0, stock_grams: 2100 },
  { ...base, id: 'yiwu', type: 'Sheng', product_name: 'Yiwu', given_name: 'Forest Gate', year: 2006, form: 'Cake', origin_region: 'Yunnan', description: 'Honey and pine.', retail_price_per_gram_usd: .5, stock_grams: 357 },
];

async function install(page: Page) {
  const jwt = token();
  await page.route('**/api/**', route => route.fulfill({ status: 501, json: { error: 'Unhandled test API route' } }));
  await page.addInitScript(value => {
    if (localStorage.getItem('tea-page-test-seeded')) return;
    localStorage.clear();
    localStorage.setItem('tea-page-test-seeded', '1');
    localStorage.setItem('teajia_token', value);
    localStorage.setItem('teajia-stock-layout', 'table');
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      activeAccountId: 'acct', activeUserId: 'admin', memberships: [{ account_id: 'acct', account_name: 'Test', role: 'owner' }],
    } }));
  }, jwt);
  await page.route('**/api/auth/me', r => r.fulfill({ json: { id: 'admin', email: 'admin@test', role: 'owner' } }));
  await page.route('**/api/auth/refresh', r => r.fulfill({ json: { token: jwt } }));
  await page.route('**/api/products', r => r.fulfill({ json: products }));
  await page.route('**/api/products/*/events', r => r.fulfill({ json: [] }));
  await page.route('**/api/rates', r => r.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }] }));
  await page.route('**/api/accounts/acct', r => r.fulfill({ json: { id: 'acct', name: 'Test', slug: 'test' } }));
  await page.route('**/api/inventory/summaries', r => r.fulfill({ json: { summaries: [] } }));
  for (const endpoint of ['batches', 'inventory/receipts', 'admin/events', 'compass/incoming', 'user/favorites', 'tea-discovery', 'tasting-journal', 'notes', 'customers']) {
    await page.route(`**/api/${endpoint}**`, r => r.fulfill({ json: [] }));
  }
  await page.route('**/api/compass/entries**', r => r.fulfill({ json: { entries: [] } }));
  // Freight rates live with the logistics companies' services, not on the tea.
  await page.route('**/api/logistics', r => r.fulfill({ json: { orders: [], addresses: [], shipments: [
    { id: 'ship-1', service_id: 'air', logistics_company_id: 'co', logistics_company_name: 'Guangzhou', mode: 'air', state: 'in_transit', eta: '2026-12-04', created_at: '2026-11-25', lines: [{ id: 'sl1', product_id: 'liu-bao' }] },
  ], services: [
    { id: 'air', logistics_company_id: 'co', logistics_company_name: 'Guangzhou', name: 'Airmail', mode: 'air', basis: 'kg', rate: 2, currency: 'USD', active: true },
  ] } }));
}

test.beforeEach(async ({ isMobile }) => {
  test.skip(isMobile, 'Opens the tea from the laptop ledger; the page itself is the same at every width');
});

test('the tea page reads in editing order and Next keeps the part you are on', async ({ page }, testInfo) => {
  await install(page);
  await page.goto('/admin/stock');
  await page.locator('tr[data-product-id="liu-bao"]').dispatchEvent('click', { metaKey: true });
  await page.getByRole('toolbar', { name: 'Selection actions' }).getByRole('button', { name: 'Edit', exact: true }).click();

  const tea = page.getByTestId('tea-page');
  await expect(tea).toBeVisible();
  // Editing order: the tea, price, stock, where it is listed, then the later work.
  const order = await tea.locator('section[id^="tea-page-"], #tea-page-later').evaluateAll(nodes => nodes.map(n => n.id));
  expect(order).toEqual(['tea-page-tea', 'tea-page-price', 'tea-page-stock', 'tea-page-listed', 'tea-page-later']);
  // What is missing names the gaps and each one jumps to its part.
  const missing = page.getByRole('group', { name: "What's missing" });
  await expect(missing.getByRole('button', { name: /Set a price/ })).toBeVisible();
  // Type and form are one row of two drop-downs, not a grid of buttons.
  await expect(tea.getByRole('combobox', { name: 'Type' })).toHaveValue('Dark');
  await expect(tea.getByRole('combobox', { name: 'Form' })).toHaveValue('Loose');
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('tea-page-top.png') });

  // Shipping is one line on the tea, and it is a link to the shipment (Adrian, 2026-11-27):
  // when it arrives, what shipping adds to a gram, and by what. Nothing on the tea edits freight.
  const shipping = tea.getByTestId('tea-shipping');
  await expect(shipping).toHaveText(/^Arrives 4 Dec · .* · shop default$/);
  await expect(shipping).toHaveAttribute('href', '/admin/purchase-orders?shipmentId=ship-1');
  await expect(tea.getByRole('combobox', { name: 'Travels by' })).toHaveCount(0);
  await expect(tea.getByRole('spinbutton', { name: /freight/i })).toHaveCount(0);
  await shipping.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('tea-page-journey.png') });

  await page.getByRole('navigation', { name: 'Parts of this tea' }).getByRole('button', { name: 'Price' }).click();
  await expect(page.getByTestId('tea-page-next-at')).toHaveText('Next opens at Price');
  await page.getByRole('button', { name: 'Next product' }).click();

  // The next tea opens on its price, just under the jump bar.
  await expect(tea.getByRole('textbox').first()).toHaveValue('Yiwu');
  await expect.poll(async () => {
    const bar = await page.getByTestId('tea-page-jump').boundingBox();
    const price = await page.locator('#tea-page-price').boundingBox();
    return bar && price ? Math.round(price.y - (bar.y + bar.height)) : 999;
  }).toBeLessThan(8);
  await page.screenshot({ path: testInfo.outputPath('tea-page-next-at-price.png') });

  // At phone width the page fills the screen and never scrolls sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('navigation', { name: 'Parts of this tea' }).getByRole('button', { name: 'The tea' }).click();
  await expect.poll(() => tea.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: testInfo.outputPath('tea-page-phone.png') });
});

test('a tea that kept its own older freight rate shows it read-only, with Clear and the new price first', async ({ page }, testInfo) => {
  await install(page);
  // Liu Bao still carries 6 dollars a kilo from before rates moved to Logistics; the shop default is 70 yuan.
  await page.route('**/api/products', r => r.fulfill({ json: [{ ...products[0], shipping_rate_per_kg: 6 }, products[1]] }));
  await page.route('**/api/rates', r => r.fulfill({ json: [{ currency: 'USD', rate_to_usd: 1 }, { currency: 'Yuan', rate_to_usd: 7 }] }));
  await page.route('**/api/accounts/acct', r => r.fulfill({ json: { id: 'acct', name: 'Test', slug: 'test', default_shipping_rate_per_kg: 70, default_shipping_rate_currency: 'Yuan' } }));
  await page.goto('/admin/stock');
  await page.locator('tr[data-product-id="liu-bao"]').dispatchEvent('click', { metaKey: true });
  await page.getByRole('toolbar', { name: 'Selection actions' }).getByRole('button', { name: 'Edit', exact: true }).click();
  const tea = page.getByTestId('tea-page');
  // $6.00 a kilo is $0.006 a gram, and the line says it is the tea's own rate.
  await expect(tea.getByTestId('tea-shipping')).toHaveText('Arrives 4 Dec · $0.006/g shipping · its own rate');
  await expect(tea.getByRole('spinbutton', { name: /freight/i })).toHaveCount(0);
  const sheet = tea;
  // 0.50 a gram of tea: 0.50 × 3 + 0.006 now, and 0.50 × 3 + 0.01 once it follows 70 yuan (freight at cost).
  await expect(sheet.getByTestId('tea-freight-clear-preview')).toHaveText('Clear → $1.51/g');
  await tea.getByTestId('tea-shipping').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: testInfo.outputPath('tea-page-freight-clear.png') });
  const saved = page.waitForRequest(r => r.url().includes('/api/products/liu-bao/commercial') && r.method() === 'PUT');
  await page.route('**/api/products/liu-bao/commercial', r => r.fulfill({ json: { success: true } }));
  await sheet.getByRole('button', { name: /^Clear this tea's rate/ }).click();
  expect((await saved).postDataJSON()).toEqual({ shipping_rate_per_kg: null });
});
