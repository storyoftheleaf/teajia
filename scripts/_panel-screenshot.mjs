// Headless screenshot of the inventory ProductEditPanel for visual iteration.
// Bypasses worker API entirely by mocking /api/* responses, and bypasses auth
// by seeding zustand's persisted state with isDevAdmin: true.
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const out = process.argv[2] || '/tmp/panel.png';

// API returns snake_case — useAdminData converts to camelCase.
const FAKE_PRODUCT_API = {
  id: 'demo-1',
  product_name: 'Aged Sour Citrus Tea',
  given_name: 'Lao Suan Gan',
  chinese_name: '老酸柑仔茶',
  type: 'Dark',
  form: 'Other',
  year: 1983,
  origin_country: 'Taiwan',
  origin_region: '',
  vendor: 'Master Bo',
  cost_amount: 5000,
  cost_currency: 'NT',
  quantity_purchased: 300,
  shipping_rate_per_kg: 13,
  stock_grams: 230,
  low_stock_threshold: 100,
  fixed_retail_price_usd: null,
  retail_price_per_gram_usd: 1.55,
  cost_per_gram_usd: 0.51,
  status: 'Active',
  is_public: 1,
  is_featured: 0,
  is_curated: 1,
  is_sample: 0,
  can_reorder: 1,
  is_personal: 0,
  in_transit: 0,
  image_url: '',
  additional_images: '[]',
  description: '',
  experience: '',
  terroir: '',
  processing_notes: '',
  lore: '',
  is_custom_wisdom: 0,
  show_wisdom: 1,
  mood: '',
  mood_tags: '[]',
  flavor_tags: '[]',
  tasting_notes: '[]',
  tasting: null,
  recheck_stock: 0,
  stock_verified_at: null,
};
const FAKE_PRODUCTS = [FAKE_PRODUCT_API];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
  ignoreHTTPSErrors: true,
});

await ctx.addInitScript(() => {
  const seed = { state: { isDevAdmin: true, activeAccountId: 'demo-account' }, version: 0 };
  try { localStorage.setItem('teajia-storage', JSON.stringify(seed)); } catch {}
});

await ctx.route('**/api/**', (route) => {
  const url = route.request().url();
  const method = route.request().method();
  let body = {};
  if (url.includes('/api/products') && method === 'GET') {
    body = FAKE_PRODUCTS;
  } else if (url.includes('/api/exchange-rates')) {
    body = [{ from: 'NT', to: 'USD', rate: 0.031 }, { from: 'USD', to: 'USD', rate: 1 }];
  } else if (url.includes('/api/accounts')) {
    body = { id: 'demo-account', name: 'Demo', currency_default: 'USD' };
  } else if (url.includes('/api/customers')) {
    body = [];
  } else {
    body = [];
  }
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 250)); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));

await page.goto('http://localhost:7777/admin/inventory', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
});
await page.waitForTimeout(4000);
console.log('url:', page.url());

// Click first product row to open the panel
await page.waitForTimeout(1000);
const firstClickable = page.getByText(FAKE_PRODUCT_API.product_name).first();
const found = await firstClickable.count() > 0;
console.log('found product link:', found);
if (found) {
  await firstClickable.click().catch(() => {});
  await page.waitForTimeout(2000);
}

const vp = page.viewportSize();
const clipPanel = { x: vp.width - 460, y: 0, width: 460, height: vp.height };

// Top half of panel
await page.screenshot({ path: out, clip: clipPanel });
console.log('saved panel screenshot:', out);

// Scroll the panel's inner scroll container to see pills + image slots
const scrollContainer = page.locator('[role="dialog"] .overflow-y-auto').first();
if (await scrollContainer.count() > 0) {
  await scrollContainer.evaluate((el) => { el.scrollTop = 600; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out.replace('.png', '-mid.png'), clip: clipPanel });
  await scrollContainer.evaluate((el) => { el.scrollTop = 1200; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out.replace('.png', '-low.png'), clip: clipPanel });
  console.log('saved scrolled panels');
}

if (errs.length) errs.slice(0, 8).forEach(e => console.log('err:', e));
await browser.close();
