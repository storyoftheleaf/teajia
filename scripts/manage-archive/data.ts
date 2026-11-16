// Sample fixtures for the archive. Not the shop's data: invented teas, vendors and people.
const now = new Date().toISOString();

export const VENDORS = [
  { id: 'vendor-chen', name: 'Chen Family', tags: ['vendor'] },
  { id: 'vendor-huang', name: 'Huang Wei', tags: ['vendor'] },
  { id: 'vendor-lin', name: 'Lin Mountain', tags: ['vendor'] },
];

const E = (o: Record<string, any>) => ({ category: 'tea', status: 'noted', notes: '', photos: '[]', audio_clips: '[]', created_at: now, updated_at: now, ...o });

export const ENTRIES = [
  E({ id: 'e1', name: 'Oil-Paper Tea Brick', type: 'Dark', year: '1980s', vendor_name: 'Huang Wei', vendor_id: 'vendor-huang', price_amount: 500, price_currency: 'Yuan', price_per_unit_grams: 500 }),
  E({ id: 'e2', name: 'Aged Palace Tea', type: 'Shou', year: '2009', vendor_name: 'Huang Wei', vendor_id: 'vendor-huang', price_amount: 380, price_currency: 'Yuan', price_per_unit_grams: 500, given_name: 'Night Palace' }),
  E({ id: 'e3', name: 'Yiwu Gushu Spring', type: 'Sheng', year: '2021', vendor_name: 'Huang Wei', vendor_id: 'vendor-huang', price_amount: 1800, price_currency: 'Yuan', price_per_unit_grams: 357, decision: 'chosen' }),
  E({ id: 'e4', name: 'Alishan High Mountain', type: 'Oolong', year: '2025', vendor_name: 'Chen Family', vendor_id: 'vendor-chen', price_amount: 3200, price_currency: 'NT', price_per_unit_grams: 600 }),
  E({ id: 'e5', name: 'Oriental Beauty', type: 'Oolong', year: '2024', vendor_name: 'Chen Family', vendor_id: 'vendor-chen' }),
  E({ id: 'e6', name: 'Red Jade No. 18', type: 'Red', year: '2025', vendor_name: 'Chen Family', vendor_id: 'vendor-chen', price_amount: 2400, price_currency: 'NT', price_per_unit_grams: 600, sample_state: 'received' }),
  E({ id: 'e7', name: 'Silver Needle', type: 'White', year: '2023', vendor_name: 'Lin Mountain', vendor_id: 'vendor-lin', price_amount: 90, price_currency: 'USD', price_per_unit_grams: 250 }),
  E({ id: 'e8', name: 'Shou Mei Cake', type: 'White', year: '2016', vendor_name: 'Lin Mountain', vendor_id: 'vendor-lin', price_amount: 260, price_currency: 'Yuan' }),
  E({ id: 'e9', name: 'Longjing Pre-Qingming', type: 'Green', year: '2026', vendor_name: '', price_amount: 0, price_currency: 'Yuan', price_per_unit_grams: 100 }),
];

export const PRODUCTS = [{ id: 'stock-e1', source_compass_entry_id: 'e1', product_name: 'Oil-Paper Tea Brick', type: 'Dark', stock_grams: 480, status: 'Active' }];

export const RATES = [
  { currency: 'USD', rate_to_usd: 1 }, { currency: 'Yuan', rate_to_usd: 7.1 }, { currency: 'NT', rate_to_usd: 32 }, { currency: 'IDR', rate_to_usd: 16000 },
];
