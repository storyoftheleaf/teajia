import { expect, test, type Page } from '@playwright/test';

function token() {
  const enc = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: 'admin', email: 'admin@test', role: 'owner', exp: Math.floor(Date.now() / 1000) + 86400, active_account_id: 'acct', memberships: [{ account_id: 'acct', role: 'owner' }] })}.sig`;
}

const base = {
  form: 'Loose', given_name: '', chinese_name: '', year: 2024,
  origin_country: 'China', origin_region: 'Yunnan', cost_per_gram_usd: 0.1,
  cost_amount: 50, low_stock_threshold: 20, tasting_notes: [], image_url: '',
  status: 'Active', vendor: 'Lin', cost_currency: 'USD', quantity_purchased: 100,
  shipping_rate_per_kg: 0, fixed_retail_price_usd: null, can_reorder: 0,
  is_public: 0, shown_in_shop: 0, is_featured: 0, is_sample: 0, is_personal: 0,
  stock_verified_at: null,
};

const products = [
  { ...base, id: 'ready-hidden', type: 'Oolong', product_name: 'Ready Hidden Tea', description: 'A floral high mountain oolong.', retail_price_per_gram_usd: .4, stock_grams: 80, stock_known_at: '2026-07-12', inventory_purpose: 'working', tasting_source: 'owner', source_compass_entry_id: 'entry-ready' },
  { ...base, id: 'needs', type: 'Misc', product_name: 'Needs Four Things', description: '', retail_price_per_gram_usd: 0, stock_grams: 0, stock_known_at: null, inventory_purpose: 'working', tasting_source: 'common', source_compass_entry_id: 'entry-needs' },
  { ...base, id: 'sample', type: 'Green', product_name: 'Field Sample', description: '', retail_price_per_gram_usd: 0, stock_grams: 10, stock_known_at: '2026-07-12', inventory_purpose: 'sample', tasting_source: 'common' },
  { ...base, id: 'personal', type: 'Sheng', product_name: 'Personal Cake', description: '', retail_price_per_gram_usd: 0, stock_grams: 357, stock_known_at: '2026-07-12', inventory_purpose: 'personal', tasting_source: 'owner' },
  { ...base, id: 'legacy-working', type: 'Red', product_name: 'Legacy Selling Tea', description: 'Ready', retail_price_per_gram_usd: .2, stock_grams: 5, stock_known_at: '2026-07-12', inventory_purpose: null, is_public: 1, shown_in_shop: 1, can_reorder: 1, storage_location: 'Shelf A', tasting_source: 'owner' },
  { ...base, id: 'legacy-sample', type: 'White', product_name: 'Legacy Sample', description: '', retail_price_per_gram_usd: 0, stock_grams: 5, inventory_purpose: null, is_sample: 1, tasting_source: 'common' },
  { ...base, id: 'missing-location', type: 'Oolong', product_name: 'Unplaced Working Tea', description: 'Ready', retail_price_per_gram_usd: .3, stock_grams: 50, stock_known_at: '2026-07-12', inventory_purpose: 'working', storage_location: '', tasting_source: 'owner' },
];

async function install(page: Page) {
  const jwt = token();
  await page.addInitScript(value => {
    localStorage.clear();
    localStorage.setItem('teajia_token', value);
    localStorage.setItem('teajia-storage', JSON.stringify({ version: 2, state: {
      savedViews: [{ id: 'custom-legacy-selling', name: 'My selling list', columns: ['productName', 'stockGrams'], sortConfig: [{ key: 'productName', direction: 'asc' }], filterType: 'ForSale', groupBy: null }],
      activeViewId: 'custom-legacy-selling',
      activeAccountId: 'acct', activeUserId: 'admin', memberships: [{ account_id: 'acct', account_name: 'Test', role: 'owner' }],
    } }));
  }, jwt);
  await page.route('**/api/auth/me', r => r.fulfill({ json: { id: 'admin', email: 'admin@test', role: 'owner' } }));
  await page.route('**/api/auth/refresh', r => r.fulfill({ json: { token: jwt } }));
  await page.route('**/api/products', r => r.fulfill({ json: products }));
  await page.route('**/api/products/*/events', r => r.fulfill({ json: [] }));
  await page.route('**/api/rates', r => r.fulfill({ json: [] }));
  await page.route('**/api/accounts/acct', r => r.fulfill({ json: { id: 'acct', name: 'Test', slug: 'test' } }));
  await page.route('**/api/batches**', r => r.fulfill({ json: [] }));
  await page.route('**/api/inventory/receipts**', r => r.fulfill({ json: [] }));
  for (const endpoint of ['admin/events', 'compass/incoming', 'user/favorites', 'tea-discovery', 'tasting-journal', 'notes', 'customers']) {
    await page.route(`**/api/${endpoint}**`, r => r.fulfill({ json: [] }));
  }
  await page.route('**/api/compass/entries**', r => r.fulfill({ json: { entries: [] } }));
}

async function openMore(page: Page) {
  await page.getByLabel('More views').click();
}

async function selectView(page: Page, label: string) {
  if ((page.viewportSize()?.width || 0) < 768) {
    const button = page.getByRole('button', { name: `Show ${label} view` });
    if (!(await button.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: 'Show all inventory views' }).click();
    }
    await button.click();
    return;
  }
  const primary = page.getByRole('button', { name: `Show ${label} view` });
  if (await primary.isVisible().catch(() => false)) {
    await primary.click();
  } else {
    await openMore(page);
    await page.getByRole('menuitem', { name: label }).click();
  }
}

test.beforeEach(async ({ page }) => {
  await install(page);
  await page.goto('/admin/stock');
});

test('purpose and action views remain separate and preserve legacy mappings', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Show Working view' })).toBeVisible();
  if ((page.viewportSize()?.width || 0) < 768) {
    await page.getByRole('button', { name: 'Show all inventory views' }).click();
  }
  await expect(page.getByRole('button', { name: 'Show Selling view' })).toContainText('My selling list');
  await selectView(page, 'Working');
  await expect(page.getByText('Ready Hidden Tea')).toBeVisible();
  await expect(page.getByText('Field Sample')).toHaveCount(0);

  await selectView(page, 'Samples');
  await expect(page.getByText('Field Sample')).toBeVisible();
  await expect(page.getByText('Legacy Sample')).toBeVisible();

  await selectView(page, 'Personal');
  await expect(page.getByText('Personal Cake')).toBeVisible();

  await selectView(page, 'Needs development');
  await expect(page.getByText('Needs Four Things')).toBeVisible();
  await expect(page.getByText('Field Sample')).toHaveCount(0);

  await selectView(page, 'Low stock');
  await expect(page.getByText('Legacy Selling Tea')).toBeVisible();
});

test('readiness names omissions and publication remains an independent dual gate', async ({ page }) => {
  await selectView(page, 'Needs development');
  await page.getByText('Needs Four Things').click();
  await page.getByRole('toolbar', { name: 'Selection actions' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByText('Missing description, retail price, classification, and stock amount')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Develop in Curate' })).toHaveAttribute('data-compass-entry-id', 'entry-needs');
  await expect(page.getByText('Publication: Hidden — listing off; location held')).toBeVisible();
  await expect(page.getByText(/\d+%/)).toHaveCount(0);
});

test('purpose control replaces holding classification while sample-size offering stays separate', async ({ page }) => {
  await page.getByText('Ready Hidden Tea').click();
  await page.getByRole('toolbar', { name: 'Selection actions' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('group', { name: 'Inventory purpose' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Working purpose' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Sample-size offering' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mine' })).toHaveCount(0);
  await expect(page.getByText('Readiness: Ready')).toBeVisible();
  await expect(page.getByText('Publication: Hidden — listing off; location held')).toBeVisible();
});

test('action views include tasting, reorder, and missing location', async ({ page }) => {
  for (const [view, product] of [['To taste', 'Field Sample'], ['Reorder', 'Legacy Selling Tea'], ['Missing location', 'Unplaced Working Tea']] as const) {
    await selectView(page, view);
    await expect(page.getByText(product)).toBeVisible();
  }
  await page.getByRole('button', { name: 'Incoming' }).click();
  await expect(page.getByRole('heading', { name: 'Incoming stock' })).toBeVisible();
});
