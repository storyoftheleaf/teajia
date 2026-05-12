import { chromium } from '@playwright/test';
import fs from 'node:fs';

const FAKE_PRODUCT_API = {
  id: 'demo-1',
  product_name: 'Aged Sour Citrus Tea',
  given_name: 'Lao Suan Gan',
  chinese_name: '老酸柑仔茶',
  type: 'Dark', form: 'Other', year: 1983,
  origin_country: 'Taiwan', origin_region: '',
  vendor: 'Master Bo',
  cost_amount: 5000, cost_currency: 'NT',
  quantity_purchased: 300, shipping_rate_per_kg: 13,
  stock_grams: 230, low_stock_threshold: 100,
  retail_price_per_gram_usd: 1.55, cost_per_gram_usd: 0.51,
  status: 'Active',
  is_public: 1, is_featured: 0, is_curated: 1, is_sample: 0,
  can_reorder: 1, is_personal: 0,
  image_url: '', additional_images: '[]',
  description: '', experience: '', terroir: '', processing_notes: '', lore: '',
  is_custom_wisdom: 0, show_wisdom: 1,
  mood: '', mood_tags: '[]', flavor_tags: '[]', tasting_notes: '[]', tasting: null,
  recheck_stock: 0, stock_verified_at: null,
};

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
  let body = [];
  if (url.includes('/api/products')) body = [FAKE_PRODUCT_API];
  else if (url.includes('/api/accounts')) body = { id: 'demo-account', name: 'Demo' };
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});

const page = await ctx.newPage();
await page.goto('http://localhost:7777/admin/inventory', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3500);

const firstClickable = page.getByText(FAKE_PRODUCT_API.product_name).first();
if (await firstClickable.count() > 0) {
  await firstClickable.click().catch(() => {});
  await page.waitForTimeout(2000);
}

await page.screenshot({ path: '/tmp/full.png', fullPage: false });
const vp = page.viewportSize();
const clipPanel = { x: vp.width - 460, y: 0, width: 460, height: vp.height };
await page.screenshot({ path: '/tmp/panel.png', clip: clipPanel });

const dialogPresent = await page.locator('[role="dialog"]').count();
console.log('dialog count:', dialogPresent);
const scrollContainer = page.locator('[role="dialog"] .overflow-y-auto').first();
if (await scrollContainer.count() > 0) {
  await scrollContainer.evaluate((el) => { el.scrollTop = 600; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/panel-mid.png', clip: clipPanel });
}

console.log('saved /tmp/panel.png and /tmp/panel-mid.png');
await browser.close();
