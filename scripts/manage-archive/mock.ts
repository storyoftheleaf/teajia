import type { Page } from '@playwright/test';
import { injectAuth, mockInventoryApi } from '../../tests/helpers/inventoryMocks';
import { RATES } from './data';

type Handler = (url: URL, method: string, body: any) => unknown | undefined;

/**
 * The admin shell with sample data. Order matters in Playwright (later routes win),
 * so: catch-all first, then the repo's inventory mocks, then this archive's own handlers.
 * A handler returns a JSON body, or undefined to fall through to the empty-list default.
 */
export async function installAdmin(page: Page, handlers: Handler[] = []) {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await injectAuth(page);
  await mockInventoryApi(page);
  await page.route('**/api/rates', route => route.fulfill({ json: RATES.map((r) => ({ ...r, last_updated: new Date().toISOString() })) }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    let body: any = null;
    try { body = req.postDataJSON(); } catch { body = null; }
    for (const h of handlers) {
      const out = h(url, req.method(), body);
      if (out !== undefined) return route.fulfill({ json: out as any });
    }
    return route.fallback();
  });
}

const now = '2026-11-05T09:00:00Z';
const line = (id: string, pid: string, name: string, q: number, cost: number, cur: string, recv = 0) => ({ id, receipt_id: 'r', product_id: pid, product_name: name, expected_quantity: q, received_quantity: recv, cancelled_quantity: 0, available_quantity: q - recv, current_on_hand: recv, unit: 'g', intended_purpose: 'working', original_cost_amount: cost, original_cost_currency: cur, image_url: null, source_url: null });
export const poA = { id: 'po-a', account_id: 'acct-bali', vendor_name: 'Huang Wei', vendor_id: 'vendor-huang', items_json: '[]', total_usd: 194.37, display_currency: 'Yuan', status: 'ordered', receipt_id: 'rec-a', ship_mode: 'air', tracking_number: null, created_at: now, updated_at: now };
export const poB = { id: 'po-b', account_id: 'acct-bali', vendor_name: 'Chen Family', vendor_id: 'vendor-chen', items_json: '[]', total_usd: 100, display_currency: 'NT', status: 'ordered', receipt_id: 'rec-b', ship_mode: 'air', tracking_number: null, created_at: now, updated_at: now };
export const poC = { id: 'po-c', account_id: 'acct-bali', vendor_name: 'Lin Mountain', vendor_id: 'vendor-lin', items_json: JSON.stringify([{ name: 'Silver Needle', quantity: 250, priceIsPerGram: true, pricePerUnit: 0.36, currency: 'USD', compassEntryId: 'e7' }]), total_usd: 90, display_currency: 'USD', status: 'confirmed', receipt_id: null, ship_mode: 'air', tracking_number: null, created_at: now, updated_at: now };
const linesA = [line('la1', 'p-oil', 'Oil-Paper Tea Brick', 1000, 1000, 'Yuan'), line('la2', 'p-aged', 'Night Palace', 500, 380, 'Yuan')];
const linesB = [line('lb1', 'p-ali', 'Alishan High Mountain', 600, 3200, 'NT')];
export const TRACKING = { rows: [
  { id: 'po-a', purchase: poA, receipt: { id: 'rec-a', state: 'expected', vendor_name: 'Huang Wei', source_kind: 'curate_import', eta: '2026-11-20', lines: linesA }, attention: [], history: [], source_document: { import_id: 'imp-1', title: 'Huang Wei invoice, October' }, arrival_proposal: null, invoice_draft: null },
  { id: 'po-b', purchase: poB, receipt: { id: 'rec-b', state: 'expected', vendor_name: 'Chen Family', source_kind: 'purchase_order', eta: null, lines: linesB }, attention: [], history: [], source_document: null, arrival_proposal: null, invoice_draft: null },
  { id: 'po-c', purchase: poC, receipt: null, attention: [{ code: 'missing_receipt', message: 'Items need matching before this purchase can be tracked.' }], history: [], source_document: null, arrival_proposal: { id: 'prop-1', vendor_name: 'Lin Mountain', product_name: 'Silver Needle', quantity: 250, unit: 'g', status: 'pending' }, invoice_draft: null },
] };
const service = { id: 'svc-air', logistics_company_id: 'co-gz', logistics_company_name: 'Guangzhou Forwarding', name: 'Airmail', mode: 'air', basis: 'kg', rate: 60, currency: 'Yuan', active: true };
export const LOGISTICS = {
  services: [service, { ...service, id: 'svc-sea', name: 'Sea cargo', mode: 'sea', basis: 'm3', rate: 900 }],
  addresses: [],
  orders: [
    { purchase_id: 'po-a', receipt_id: 'rec-a', vendor_name: 'Huang Wei', logistics_company_id: 'co-gz', logistics_company_name: 'Guangzhou Forwarding', inbound_courier: 'SF Express', inbound_tracking_number: 'SF1029384756', logistics_arrived_at: '2026-11-03T04:00:00Z', lines: linesA, tracking_update: null },
    { purchase_id: 'po-b', receipt_id: 'rec-b', vendor_name: 'Chen Family', logistics_company_id: 'co-gz', logistics_company_name: 'Guangzhou Forwarding', inbound_courier: 'Black Cat', inbound_tracking_number: 'BC55667788', logistics_arrived_at: null, lines: linesB, tracking_update: null },
  ],
  shipments: [
    { id: 'ship-1', service_id: 'svc-air', service_quote: service, logistics_company_id: 'co-gz', logistics_company_name: 'Guangzhou Forwarding', mode: 'air', state: 'draft', outbound_courier: null, tracking_number: null, eta: '2026-11-20', created_at: now, dispatched_at: null,
      freight: { basis: 'kg', rate: 60, billed_quantity: 1.8, total_amount: null, currency: 'Yuan', confirmed: false }, freight_total: 108, freight_estimated: true, freight_issue: null, studio_receipts: [],
      lines: [
        { id: 'sl1', shipment_id: 'ship-1', purchase_id: 'po-a', receipt_line_id: 'la1', product_id: 'p-oil', product_name: 'Oil-Paper Tea Brick', unit: 'g', quantity: 1000, received_quantity: 0, weight_kg: 1.2, weight_estimated: true, volume_m3: 0.003, volume_estimated: true, image_url: null, source_url: null, original_cost_amount: 1000, original_cost_currency: 'Yuan', allocated_freight: 72 },
        { id: 'sl2', shipment_id: 'ship-1', purchase_id: 'po-a', receipt_line_id: 'la2', product_id: 'p-aged', product_name: 'Night Palace', unit: 'g', quantity: 500, received_quantity: 0, weight_kg: 0.6, weight_estimated: true, volume_m3: 0.0015, volume_estimated: true, image_url: null, source_url: null, original_cost_amount: 380, original_cost_currency: 'Yuan', allocated_freight: 36 },
      ] },
  ],
};
export const purchaseHandlers: Handler[] = [
  (u) => (u.pathname === '/api/purchase-orders/tracking' ? TRACKING : undefined),
  (u, m) => (u.pathname === '/api/purchase-orders' && m === 'GET' ? [poA, poB, poC] : undefined),
  (u) => (u.pathname === '/api/logistics' ? LOGISTICS : undefined),
];
