import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const memberships = [{ account_id: 'acct-bali', account_name: 'Teajia Bali', role: 'owner', slug: 'teajia-bali' }];
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
  sub: 'preview-admin',
  email: 'preview@teajia.local',
  name: 'Preview',
  role: 'owner',
  platform_role: 'platform_owner',
  exp: Math.floor(Date.now() / 1000) + 86400,
  active_account_id: 'acct-bali',
  memberships,
})}.preview`;

const previewProducts = Array.from({ length: 24 }, (_, index) => {
  const types = ['Sheng', 'Oolong', 'White', 'Red', 'Green', 'Shou'];
  const regions = ['Yiwu', 'Alishan', 'Fuding', 'Wuyi', 'Uji', 'Menghai'];
  const type = types[index % types.length];
  return {
    id: `preview-product-${index + 1}`,
    type,
    form: 'Loose Leaf',
    given_name: ['Cloud Path', 'Orchid Ridge', 'Old Grove', 'Amber Spring'][index % 4],
    product_name: `${regions[index % regions.length]} ${type} ${2020 + (index % 6)}`,
    year: 2020 + (index % 6),
    origin_country: index % 4 === 0 ? 'Taiwan' : 'China',
    origin_region: regions[index % regions.length],
    retail_price_per_gram_usd: 0.22 + (index % 8) * 0.05,
    cost_per_gram_usd: 0.12 + (index % 6) * 0.03,
    stock_grams: 45 + index * 23,
    low_stock_threshold: 80,
    status: 'Active',
    vendor: ['Chen Family', 'Mountain Source', 'Lin Tea'][index % 3],
    quantity_purchased: 500,
    is_public: 1,
    shown_in_shop: index % 3 === 0 ? 1 : 0,
    inventory_purpose: index % 7 === 0 ? 'sample' : 'working',
    source_compass_entry_id: index < 8 ? `preview-entry-${index + 1}` : null,
  };
});

const previewEntries = Array.from({ length: 8 }, (_, index) => ({
  id: `preview-entry-${index + 1}`,
  category: 'tea',
  name: previewProducts[index].product_name,
  type: previewProducts[index].type,
  year: previewProducts[index].year,
  vendor_name: previewProducts[index].vendor,
  origin_region: previewProducts[index].origin_region,
  decision: index % 4 === 0 ? 'selected' : index % 4 === 1 ? 'passed_on' : 'considering',
  status: 'noted',
  notes: index % 2 === 0 ? 'Floral lift, clean structure, long finish.' : 'Review the second steep before deciding.',
  photos: '[]',
  audio_clips: '[]',
  tasting: index % 3 === 0 ? JSON.stringify({ quality: 8 - (index % 2), body: ['medium'] }) : null,
  created_at: new Date(Date.UTC(2026, 5, 18 - index)).toISOString(),
  updated_at: new Date(Date.UTC(2026, 5, 19 - index)).toISOString(),
}));

const json = (res: import('node:http').ServerResponse, body: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

function previewSession(): Plugin {
  return {
    name: 'teajia-local-curate-preview',
    transformIndexHtml() {
      return [{
        tag: 'script',
        injectTo: 'head-prepend',
        children: `localStorage.setItem('teajia_token', ${JSON.stringify(token)});`,
      }];
    },
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        const path = new URL(req.url ?? '/', 'http://preview.local').pathname;
        const method = req.method ?? 'GET';

        if (path === '/auth/me') return json(res, { id: 'preview-admin', email: 'preview@teajia.local', name: 'Preview', role: 'owner', memberships, active_account_id: 'acct-bali' });
        if (path === '/auth/refresh' && method === 'POST') return json(res, { token });
        if (path === '/accounts/me') return json(res, { memberships, active_account_id: 'acct-bali' });
        if (path === '/accounts/acct-bali') return json(res, { id: 'acct-bali', name: 'Teajia Bali', slug: 'teajia-bali', default_currency: 'USD' });
        if (path === '/compass/entries') return json(res, { entries: previewEntries });
        if (path === '/compass/sync' && method === 'POST') return json(res, { syncedIds: [] });
        if (path === '/curate/journeys') return json(res, { journeys: [] });
        if (path === '/curate/visits') return json(res, { visits: [] });
        if (path === '/curate/imports') return json(res, { imports: [] });
        if (path === '/notes') return json(res, { notes: [] });
        if (path === '/user/favorites') return json(res, { favorites: [] });
        if (path === '/tasting-journal') return json(res, { entries: [] });
        if (path === '/tea-discovery') return json(res, { profile: null });
        if (path === '/compass/incoming') return json(res, []);
        if (path === '/rates') return json(res, [{ currency: 'USD', rate_to_usd: 1 }]);
        if (path === '/products' || path === '/products/public') return json(res, previewProducts);
        if (['/batches', '/customers', '/vendors', '/sources', '/admin/events', '/admin/samples', '/admin/sample-sets'].includes(path)) return json(res, []);
        return json(res, {});
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), previewSession()],
});
