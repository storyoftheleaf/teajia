import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'order-detail-secret';
const invoices = [
  { id: 'inv-a', account_id: 'acct-a', invoice_number: 'A-001', customer_id: 'customer-a', customer_whatsapp: null, status: 'Filled', display_currency: 'USD', shipping_cost_usd: 3, created_at: '2026-07-01', payment_date: '2026-07-02', deleted_at: null },
  { id: 'inv-other-user', account_id: 'acct-a', invoice_number: 'A-002', customer_id: 'customer-other', customer_whatsapp: null, status: 'Filled', display_currency: 'USD', shipping_cost_usd: 0, created_at: '2026-07-01', payment_date: null, deleted_at: null },
  { id: 'inv-other-account', account_id: 'acct-b', invoice_number: 'B-001', customer_id: 'customer-a-b', customer_whatsapp: null, status: 'Filled', display_currency: 'USD', shipping_cost_usd: 0, created_at: '2026-07-01', payment_date: null, deleted_at: null },
  { id: 'inv-draft', account_id: 'acct-a', invoice_number: 'A-D', customer_id: 'customer-a', customer_whatsapp: null, status: 'Draft', display_currency: 'USD', shipping_cost_usd: 0, created_at: '2026-07-01', payment_date: null, deleted_at: null },
  { id: 'inv-void', account_id: 'acct-a', invoice_number: 'A-V', customer_id: 'customer-a', customer_whatsapp: null, status: 'Void', display_currency: 'USD', shipping_cost_usd: 0, created_at: '2026-07-01', payment_date: null, deleted_at: null },
];
const customers = [
  { id: 'customer-a', account_id: 'acct-a', user_id: 'user-a', email: 'member@example.com' },
  { id: 'customer-other', account_id: 'acct-a', user_id: 'user-b', email: 'other@example.com' },
  { id: 'customer-a-b', account_id: 'acct-b', user_id: 'user-a', email: 'member@example.com' },
];
const lines = [
  { id: 'line-1', account_id: 'acct-a', invoice_id: 'inv-a', product_id: 'product-1', custom_name: null, product_name: 'Oolong', quantity: 2, price_at_sale: 4 },
  { id: 'line-2', account_id: 'acct-a', invoice_id: 'inv-a', product_id: null, custom_name: 'Tea tin', product_name: null, quantity: 1, price_at_sale: 5 },
];

class OrderDb {
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase(); let values: any[] = [];
    const statement = {
      bind: (...input: any[]) => { values = input; return statement; },
      first: async () => {
        if (normalized === 'select platform_role from users where id = ?') return { platform_role: null };
        if (normalized.includes('from account_members am')) return { role: 'owner', permissions: '{}', kind: 'location' };
        if (normalized.includes('select status from accounts')) return { status: 'active' };
        if (normalized.includes('select email, phone from users')) return { email: 'Member@Example.com', phone: '+123' };
        if (normalized.includes('select whatsapp_number, contact_email from accounts')) return { whatsapp_number: '+62800', contact_email: 'orders@store.test' };
        if (normalized.includes('from invoices i')) {
          const [id, accountId] = values;
          const invoice = invoices.find(row => row.id === id && row.account_id === accountId && !row.deleted_at && !['Draft', 'Void'].includes(row.status));
          if (!invoice) return null;
          const customer = customers.find(row => row.id === invoice.customer_id && row.account_id === accountId);
          return customer?.user_id === 'user-a' || customer?.email.toLowerCase() === 'member@example.com' || invoice.customer_whatsapp === '+123' ? { ...invoice } : null;
        }
        return null;
      },
      all: async () => {
        if (normalized.includes('from invoice_line_items ili')) return { results: lines.filter(row => row.invoice_id === values[0] && row.account_id === values[1]).map(row => ({ ...row })) };
        if (normalized.includes('from invoices i')) {
          const accountId = values[0];
          return { results: invoices.filter(row => row.account_id === accountId && row.customer_id === 'customer-a' && !['Draft', 'Void'].includes(row.status)).map(row => ({ ...row, line_total: 13, line_count: 2 })) };
        }
        return { results: [] };
      },
    }; return statement;
  }
}

function b64(value: string | Uint8Array) { const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value; return btoa(String.fromCharCode(...bytes)); }
async function token() { const now = Math.floor(Date.now() / 1000); const data = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: 'user-a', email: 'member@example.com', name: 'Member', active_account_id: 'acct-a', iat: now, exp: now + 60 }))}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `${data}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))}`; }
async function get(id?: string, account = 'acct-a') { return worker.fetch(new Request(`https://test.dev/api/me/orders${id ? `/${id}` : ''}`, { headers: { Authorization: `Bearer ${await token()}`, 'X-Teajia-Account': account } }), { DB: new OrderDb(), JWT_SECRET } as any); }

describe('customer order detail', () => {
  it('returns owned lines, lifecycle fields, totals, and available contact', async () => {
    const list = await (await get()).json() as any;
    const response = await get('inv-a'); expect(response.status).toBe(200);
    const detail = await response.json() as any;
    expect(detail).toMatchObject({ id: 'inv-a', invoice_number: 'A-001', status: 'Filled', created_at: '2026-07-01', payment_date: '2026-07-02', fulfilled_at: null, currency: 'USD', subtotal_amount_usd: 13, shipping_amount_usd: 3, total_amount_usd: 16, contact: { whatsapp: '+62800', email: 'orders@store.test' } });
    expect(detail.items).toEqual([
      { id: 'line-1', product_id: 'product-1', name: 'Oolong', quantity: 2, unit_price_usd: 4, line_total_usd: 8 },
      { id: 'line-2', product_id: null, name: 'Tea tin', quantity: 1, unit_price_usd: 5, line_total_usd: 5 },
    ]);
    expect(detail.total_amount_usd).toBe(list.orders[0].total_amount_usd);
  });

  it.each(['inv-other-user', 'inv-other-account', 'inv-draft', 'inv-void'])('hides unowned or unavailable invoice %s', async id => { expect((await get(id)).status).toBe(404); });
});
