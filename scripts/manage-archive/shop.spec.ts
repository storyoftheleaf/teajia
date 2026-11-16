import { test } from '../../tests/fixtures';
import { go, SIZES } from './lib';
import { room } from './steps';
import { RATES } from './data';

const SHOP = [
  { id: 'tea-1', type: 'White', product_name: 'Moonlight White', year: '2024', origin_country: 'China', origin_region: 'Fujian', retail_price_per_gram_usd: 0.15, stock_grams: 200, description: 'Soft florals with a clean finish.', status: 'Active', is_curated: 1, tasting: { flavor: ['floral'], body: ['silky'], feeling: ['calming'], quality: 8 }, tasting_source: 'owner' },
  { id: 'tea-2', type: 'Shou', product_name: 'Grounded Shou', year: '2018', origin_country: 'China', origin_region: 'Yunnan', retail_price_per_gram_usd: 0.32, stock_grams: 300, description: 'Deep and settled.', status: 'Active', tasting: { feeling: ['grounding'] }, tasting_source: 'owner' },
  { id: 'tea-3', type: 'Oolong', product_name: 'Alishan High Mountain', year: '2025', origin_country: 'Taiwan', origin_region: 'Alishan', retail_price_per_gram_usd: 0.48, stock_grams: 150, description: 'Cream and orchid.', status: 'Active' },
  { id: 'tea-4', type: 'Sheng', product_name: 'Yiwu Gushu Spring', year: '2021', origin_country: 'China', origin_region: 'Yunnan', retail_price_per_gram_usd: 0.9, stock_grams: 357, description: '', status: 'Active' },
  { id: 'tea-past', type: 'Green', product_name: 'Spring Green', year: '2023', origin_country: 'China', origin_region: 'Zhejiang', retail_price_per_gram_usd: 0.2, stock_grams: 0, description: 'A finished spring lot.', status: 'Active' },
];

for (const s of SIZES) {
  test(`shop ${s.n}`, async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/products/public')) return route.fulfill({ json: SHOP });
      if (url.includes('/api/auth/')) return route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      if (url.includes('/api/rates')) return route.fulfill({ json: RATES });
      return route.fulfill({ json: [] });
    });
    await page.setViewportSize({ width: s.w, height: s.h });
    await go(page, '/shop', 6000);
    const { at } = room(page, s, 'shop');
    await at('/shop', 'list', 'The public shop list.', undefined, true);
    await at('/shop/product/tea-1', 'tea-page', 'One tea\'s public page (with tasting profile).', undefined, true);
    await at('/shop/product/tea-4', 'tea-page-plain', 'A tea page with no description or tasting.', undefined, true);
    await at('/shop/product/tea-past', 'tea-page-finished', 'A finished tea (no stock) page.', undefined, true);
  });
}
