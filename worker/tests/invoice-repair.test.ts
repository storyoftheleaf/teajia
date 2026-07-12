import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'test-secret';
type Line = { account_id: string; invoice_id: string; line_item_id: string; quantity: number; price_at_sale: number; source_collection_id: string; recommended_quantity: number; recommended_price_usd: number; catalog_price: number };

class RepairDb {
  role: 'owner' | 'staff' = 'owner';
  mutateLineBeforeNextBatch = false;
  lines: Line[] = [
    { account_id: 'account-a', invoice_id: 'inv-a', line_item_id: 'line-a', quantity: 50, price_at_sale: 12, source_collection_id: 'collection-a', recommended_quantity: 50, recommended_price_usd: 12, catalog_price: 0.3 },
    { account_id: 'account-a', invoice_id: 'inv-b', line_item_id: 'line-b', quantity: 50, price_at_sale: 0.24, source_collection_id: 'collection-b', recommended_quantity: 50, recommended_price_usd: 12, catalog_price: 0.3 },
    { account_id: 'account-b', invoice_id: 'inv-other', line_item_id: 'line-other', quantity: 50, price_at_sale: 12, source_collection_id: 'collection-other', recommended_quantity: 50, recommended_price_usd: 12, catalog_price: 0.3 },
  ];
  repairs: Record<string, unknown>[] = [];
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase(); let values: unknown[] = [];
    const stmt = {
      bind: (...input: unknown[]) => { values = input; return stmt; },
      first: async () => {
        if (normalized.includes('select platform_role from users')) return { platform_role: null };
        if (normalized.includes('from account_members am join accounts')) return { role: this.role, permissions: '{}', kind: 'location' };
        return null;
      },
      all: async () => normalized.includes('from invoice_line_items') ? { results: this.lines.filter(line => line.account_id === values[0] && !this.repairs.some(repair => repair.line_item_id === line.line_item_id)).map(line => ({ ...line })) } : { results: [] },
      run: async () => {
        if (normalized.startsWith('update invoice_line_items')) {
          const [price, id, invoice, account, old] = values;
          const line = this.lines.find(row => row.line_item_id === id && row.invoice_id === invoice && row.account_id === account && row.price_at_sale === old);
          if (!line) return { success: true, meta: { changes: 0 } }; line.price_at_sale = Number(price); return { success: true, meta: { changes: 1 } };
        }
        if (normalized.startsWith('insert or ignore into invoice_line_repairs')) {
          const columns = sql.match(/\(([^)]+)\)\s*(?:values|select)/i)![1].split(',').map(v => v.trim());
          const row = Object.fromEntries(columns.map((column, i) => [column, values[i]]));
          if (normalized.includes('from invoice_line_items')) {
            const line = this.lines.find(candidate => candidate.line_item_id === values[10] && candidate.invoice_id === values[11] && candidate.account_id === values[12] && candidate.price_at_sale === values[13]);
            if (!line) return { success: true, meta: { changes: 0 } };
          }
          if (this.repairs.some(repair => repair.repair_key === row.repair_key)) return { success: true, meta: { changes: 0 } };
          this.repairs.push(row); return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 0 } };
      },
    }; return stmt;
  }
  async batch(statements: any[]) {
    if (this.mutateLineBeforeNextBatch) {
      this.mutateLineBeforeNextBatch = false;
      this.lines[0].price_at_sale = 11;
    }
    return Promise.all(statements.map(statement => statement.run()));
  }
}

function b64(input: string | Uint8Array) { const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input; return btoa(String.fromCharCode(...bytes)); }
async function token(userId: string, accountId: string) { const now = Math.floor(Date.now() / 1000); const payload = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: userId, email: `${userId}@test.dev`, active_account_id: accountId, iat: now, exp: now + 60 }))}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `${payload}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))))}`; }
async function request(db: RepairDb, method: string, accountId: string, body?: unknown) { return worker.fetch(new Request('https://test.dev/api/admin/repairs/invoice-lines', { method, headers: { Authorization: `Bearer ${await token(`user-${accountId}`, accountId)}`, 'X-Teajia-Account': accountId, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }), { DB: db, JWT_SECRET } as any); }

describe('invoice line repair', () => {
  it('previews without mutation, requires confirmation, applies once, and scopes accounts', async () => {
    const db = new RepairDb();
    const previewResponse = await request(db, 'GET', 'account-a');
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json() as any;
    expect(preview.candidates).toEqual([expect.objectContaining({ invoice_id: 'inv-a', line_item_id: 'line-a', current_total_usd: 600, corrected_total_usd: 12 })]);
    expect(db.lines[0].price_at_sale).toBe(12);
    expect((await request(db, 'POST', 'account-a', {})).status).toBe(400);
    expect((await request(db, 'POST', 'account-a', { confirm: true, preview_key: 'stale' })).status).toBe(409);
    const crossAccountAttempt = await request(db, 'POST', 'account-b', { confirm: true, preview_key: preview.preview_key });
    expect(crossAccountAttempt.status).toBe(409);
    expect(db.lines.find(line => line.line_item_id === 'line-a')?.price_at_sale).toBe(12);
    expect(db.repairs).toEqual([]);
    const applied = await request(db, 'POST', 'account-a', { confirm: true, preview_key: preview.preview_key });
    expect(await applied.json()).toMatchObject({ changed_lines: 1 }); expect(db.lines[0].price_at_sale).toBe(0.24); expect(db.repairs).toHaveLength(1);
    expect(db.repairs[0]).toMatchObject({
      account_id: 'account-a', invoice_id: 'inv-a', line_item_id: 'line-a',
      repair_key: 'line-a:12:0.24', old_price_at_sale: 12, new_price_at_sale: 0.24,
      old_line_total: 600, new_line_total: 12, repaired_by: 'user-account-a',
    });
    const repeated = await request(db, 'POST', 'account-a', { confirm: true, preview_key: preview.preview_key });
    expect(await repeated.json()).toMatchObject({ changed_lines: 0 });
    expect((await (await request(db, 'GET', 'account-b')).json() as any).candidates).toEqual([
      expect.objectContaining({ invoice_id: 'inv-other', line_item_id: 'line-other' }),
    ]);
  });

  it('requires owner tier', async () => { const db = new RepairDb(); db.role = 'staff'; expect((await request(db, 'GET', 'account-a')).status).toBe(403); });

  it('does not audit a line whose price changes after preview', async () => {
    const db = new RepairDb();
    const preview = await (await request(db, 'GET', 'account-a')).json() as any;
    db.mutateLineBeforeNextBatch = true;
    const applied = await request(db, 'POST', 'account-a', { confirm: true, preview_key: preview.preview_key });
    expect(applied.status).toBe(409);
    expect(await applied.json()).toMatchObject({ changed_lines: 0 });
    expect(db.lines[0].price_at_sale).toBe(11);
    expect(db.repairs).toEqual([]);
  });
});
