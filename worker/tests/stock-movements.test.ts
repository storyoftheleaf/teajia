import { describe, expect, it } from 'vitest';
import { decodeStockMovement, movementDelta } from '../src/inventoryDomain';
import worker from '../src/index';

describe('stock movement contract', () => {
  it.each([
    ['receipt', 10, 10], ['return', 4, 4], ['sale', 3, -3], ['sample_use', 2, -2],
    ['gift', 1, -1], ['waste', 5, -5],
  ] as const)('normalizes %s into the expected signed delta', (movement_type, quantity, delta) => {
    const input = decodeStockMovement({ movement_type, quantity, unit: 'g', expected_balance: 20, idempotency_key: `${movement_type}-1` });
    expect(movementDelta(input, 20)).toBe(delta);
  });

  it('uses an absolute target for recount', () => {
    const input = decodeStockMovement({ movement_type: 'recount', balance: 7, unit: 'g', expected_balance: 20, idempotency_key: 'count-1' });
    expect(movementDelta(input, 20)).toBe(-13);
  });

  it('requires a valid transfer destination reference', () => {
    expect(() => decodeStockMovement({ movement_type: 'transfer', quantity: 2, unit: 'g', expected_balance: 5, idempotency_key: 'x' })).toThrow(/destination/);
    expect(decodeStockMovement({ movement_type: 'transfer', quantity: 2, unit: 'g', expected_balance: 5, destination_product_id: 'destination', idempotency_key: 'x' }).destination_product_id).toBe('destination');
  });

  it.each([
    [{ movement_type: 'sale', quantity: 0, unit: 'g', expected_balance: 2, idempotency_key: 'x' }, /quantity/],
    [{ movement_type: 'receipt', quantity: 1.2, unit: 'unit', expected_balance: 2, idempotency_key: 'x' }, /whole/],
    [{ movement_type: 'sale', quantity: 1, unit: 'g', expected_balance: -1, idempotency_key: 'x' }, /expected_balance/],
    [{ movement_type: 'sale', quantity: 1, unit: 'g', expected_balance: 2 }, /idempotency_key/],
    [{ movement_type: 'vanish', quantity: 1, unit: 'g', expected_balance: 2, idempotency_key: 'x' }, /movement_type/],
  ])('rejects unsafe movement input %#', (body, error) => expect(() => decodeStockMovement(body as any)).toThrow(error));

  it('preserves audit and compatibility references', () => {
    expect(decodeStockMovement({
      movement_type: 'receipt', quantity: 10, unit: 'g', expected_balance: 0,
      idempotency_key: 'invoice-7', note: 'Vendor delivery', source_invoice_id: 'inv-7',
      source_invoice_number: 'INV-7', batch_id: 'batch-7', source_compass_entry_id: 'entry-7',
    })).toMatchObject({ note: 'Vendor delivery', source_invoice_id: 'inv-7', source_invoice_number: 'INV-7', batch_id: 'batch-7', source_compass_entry_id: 'entry-7' });
  });
});

type Row = Record<string, any>;
const normalize = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();
class MovementStatement {
  values: any[] = [];
  constructor(readonly sql: string, readonly db: MovementDb) {}
  bind(...values: any[]) { this.values = values; return this; }
  async first() {
    const sql = normalize(this.sql);
    if (sql.includes('from account_members am join accounts a')) return { role: 'owner', permissions: '{}', kind: 'location', status: 'active' };
    if (sql.includes('select platform_role from users')) return { platform_role: null };
    if (sql.includes('select id, email, platform_role from users')) return { id: this.values[0], email: 'actor@example.com', platform_role: null };
    if (sql.includes('select status from accounts')) return { status: 'active' };
    if (sql.includes('from stock_ledger where account_id = ? and idempotency_key = ?')) return this.db.ledger.find(row => row.account_id === this.values[0] && row.idempotency_key === this.values[1]) || null;
    if (sql.includes('from inventory_receipt_lines l join inventory_receipts r')) { const line = this.db.receiptLines.get(this.values[0]); return line?.account_id === this.values[1] ? { ...line } : null; }
    if (sql.includes('from products where id = ? and account_id = ?') || sql.includes('from products where id=? and account_id=?')) { const row = this.db.products.get(this.values[0]); const copy = row?.account_id === this.values[1] ? { ...row } : null; await this.db.waitForConcurrentProductRead(); return copy; }
    if (sql.includes('from batches where id = ? and account_id = ?')) return this.values[0] === 'batch' && this.values[1] === 'account-a' ? { id: 'batch' } : null;
    if (sql.includes('from tea_compass_entries where id = ? and account_id = ?')) return this.values[0] === 'entry' && this.values[1] === 'account-a' ? { id: 'entry' } : null;
    if (sql.includes('from invoices where id = ? and account_id = ?')) return this.values[0] === 'inv' && this.values[1] === 'account-a' ? { id: 'inv' } : null;
    return null;
  }
  async all() { return { results: [] }; }
  async run() {
    const sql = normalize(this.sql);
    if (sql.startsWith('update products set')) {
      if (this.db.forceStale) return { meta: { changes: 0 } };
      if (sql.includes('case when id = ?')) {
        const [sourceId, sourceAfter, destinationAfter, knownAt, movementGuard, account, , destinationId, , , sourceBefore, , , destinationBefore] = this.values;
        const source = this.db.products.get(sourceId); const destination = this.db.products.get(destinationId);
        const column = sql.includes('quantity_units') ? 'quantity_units' : 'stock_grams';
        if (!source || !destination || source.account_id !== account || destination.account_id !== account || Number(source[column] || 0) !== Number(sourceBefore) || Number(destination[column] || 0) !== Number(destinationBefore)) return { meta: { changes: 0 } };
        source[column] = sourceAfter; destination[column] = destinationAfter; source.stock_known_at = knownAt; destination.stock_known_at = knownAt; source.stock_movement_guard = movementGuard; destination.stock_movement_guard = movementGuard;
        return { meta: { changes: 2 } };
      }
      const [newBalance, knownAt, movementGuard, id, account, expected] = this.values;
      const row = this.db.products.get(id); if (!row || row.account_id !== account) return { meta: { changes: 0 } };
      const column = sql.includes('quantity_units') ? 'quantity_units' : 'stock_grams';
      if (Number(row[column] || 0) !== Number(expected)) return { meta: { changes: 0 } };
      row[column] = newBalance; row.stock_known_at = knownAt; row.stock_movement_guard = movementGuard; return { meta: { changes: 1 } };
    }
    if (sql.startsWith('update product_listings')) {
      const [newBalance, productId, account, guard] = this.values;
      const product = this.db.products.get(productId);
      if (product?.account_id === account && product.stock_movement_guard === guard) this.db.listings.set(productId, newBalance);
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('insert into stock_ledger')) {
      const guard = this.values.at(-1); if (!this.db.products.values().some(row => row.stock_movement_guard === guard)) return { meta: { changes: 0 } };
      const [id, product_id, delta, balance_after, movement_unit, reason, movement_type, idempotency_key, source_invoice_id, source_invoice_number, user_email, note, batch_id, account_id, source_compass_entry_id, , movement_fingerprint] = this.values;
      if (this.db.ledger.some(row => row.account_id === account_id && row.idempotency_key === idempotency_key)) throw new Error('UNIQUE idempotency');
      this.db.ledger.push({ id, product_id, delta, balance_after, movement_unit, reason, movement_type, idempotency_key, source_invoice_id, source_invoice_number, user_email, note, batch_id, account_id, source_compass_entry_id, movement_fingerprint });
      return { meta: { changes: 1 } };
    }
    if ((sql.startsWith('insert into batches') || sql.startsWith('update inventory_receipt')) && sql.includes('stock_movement_guard')) {
      const guard = this.values.at(-1); if (!this.db.products.values().some(row => row.stock_movement_guard === guard)) return { meta: { changes: 0 } };
      this.db.receiptSideEffects++; return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  }
}
class MovementDb {
  products = new Map<string, Row>([
    ['tea', { id: 'tea', account_id: 'account-a', stock_grams: 20, quantity_units: null }],
    ['destination', { id: 'destination', account_id: 'account-a', stock_grams: 5, quantity_units: null }],
    ['pot', { id: 'pot', account_id: 'account-a', stock_grams: 0, quantity_units: 4 }],
    ['other', { id: 'other', account_id: 'account-b', stock_grams: 10, quantity_units: null }],
  ]);
  ledger: Row[] = []; listings = new Map<string, number>([['tea', 20], ['destination', 5]]); failBatchAt: number | null = null;
  receiptLines = new Map<string, Row>(); receiptSideEffects = 0; forceStale = false;
  private productReadCount = 0; private productReadTarget = 0; private releaseProductReads: (() => void) | null = null; private productReads: Promise<void> | null = null;
  synchronizeProductReads(count: number) { this.productReadTarget=count; this.productReads=new Promise(resolve => { this.releaseProductReads=resolve; }); }
  async waitForConcurrentProductRead() { if (!this.productReads) return; this.productReadCount++; if (this.productReadCount >= this.productReadTarget) this.releaseProductReads?.(); await this.productReads; }
  prepare(sql: string) { return new MovementStatement(sql, this); }
  async batch(statements: MovementStatement[]) {
    const snapshot = structuredClone({ products: [...this.products], ledger: this.ledger, listings: [...this.listings] });
    try { const out = []; for (let i = 0; i < statements.length; i++) { if (i === this.failBatchAt) throw new Error('injected batch failure'); out.push(await statements[i].run()); } return out; }
    catch (error) { this.products = new Map(snapshot.products); this.ledger = snapshot.ledger; this.listings = new Map(snapshot.listings); throw error; }
  }
}
const SECRET = 'test-secret';
function b64(input: string | Uint8Array) { const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input; let out = ''; for (const byte of bytes) out += String.fromCharCode(byte); return btoa(out); }
async function jwt(account = 'account-a') { const now = Math.floor(Date.now() / 1000); const data = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: 'actor', email: 'actor@example.com', active_account_id: account, iat: now, exp: now + 3600 }))}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `${data}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))}`; }
async function movementRequest(db: MovementDb, product: string, body: Row, account = 'account-a') { return worker.fetch(new Request(`https://test/api/products/${product}/movements`, { method: 'POST', headers: { Authorization: `Bearer ${await jwt(account)}`, 'X-Teajia-Account': account, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { DB: db, JWT_SECRET: SECRET } as any); }
async function receiveRequest(db: MovementDb, lineId: string, requestBody: Row) { return worker.fetch(new Request(`https://test/api/inventory/receipt-lines/${lineId}/receive`, { method:'POST', headers:{ Authorization:`Bearer ${await jwt()}`, 'X-Teajia-Account':'account-a', 'Content-Type':'application/json' }, body:JSON.stringify(requestBody) }), { DB:db, JWT_SECRET:SECRET } as any); }
async function legacyStockRequest(db: MovementDb, productId: string, stock_grams: number) { return worker.fetch(new Request(`https://test/api/products/${productId}`, { method:'PUT', headers:{ Authorization:`Bearer ${await jwt()}`, 'X-Teajia-Account':'account-a', 'Content-Type':'application/json', 'Idempotency-Key':'legacy-recount' }, body:JSON.stringify({ stock_grams }) }), { DB:db, JWT_SECRET:SECRET } as any); }
const body = (movement_type: string, extra: Row = {}) => ({ movement_type, quantity: 3, unit: 'g', expected_balance: 20, idempotency_key: `${movement_type}-1`, note: 'field note', ...extra });

describe('POST product stock movements', () => {
  it.each([['receipt', 23], ['sale', 17], ['sample_use', 17], ['gift', 17], ['waste', 17], ['return', 23]])('atomically applies %s and records before/after, actor, and note', async (type, after) => {
    const db = new MovementDb(); const response = await movementRequest(db, 'tea', body(type));
    expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ before_balance: 20, after_balance: after, movement_type: type });
    expect(db.products.get('tea')?.stock_grams).toBe(after); expect(db.listings.get('tea')).toBe(after);
    expect(db.ledger[0]).toMatchObject({ delta: after - 20, balance_after: after, user_email: 'actor@example.com', note: 'field note' });
  });
  it('applies recount as an absolute edit', async () => { const db = new MovementDb(); const response = await movementRequest(db, 'tea', body('recount', { quantity: undefined, balance: 8 })); expect(response.status).toBe(201); expect(db.products.get('tea')?.stock_grams).toBe(8); });
  it('rejects negative and stale balances without a partial write', async () => {
    for (const requestBody of [body('sale', { quantity: 30 }), body('sale', { expected_balance: 19 })]) { const db = new MovementDb(); expect((await movementRequest(db, 'tea', requestBody)).status).toBe(409); expect(db.products.get('tea')?.stock_grams).toBe(20); expect(db.ledger).toHaveLength(0); }
  });
  it('returns an idempotent retry and rejects reuse with a different request', async () => {
    const db = new MovementDb(); const first = await movementRequest(db, 'tea', body('sale')); const retry = await movementRequest(db, 'tea', body('sale'));
    expect(first.status).toBe(201); expect(retry.status).toBe(200); expect(db.ledger).toHaveLength(1); expect(db.products.get('tea')?.stock_grams).toBe(17);
    expect((await movementRequest(db, 'tea', body('gift', { expected_balance: 17, idempotency_key: 'sale-1' }))).status).toBe(409);
  });
  it.each([
    { note: 'different note' }, { unit: 'unit', quantity: 3 }, { source_invoice_id: 'inv', source_invoice_number: 'INV-1' },
    { expected_balance: 19 }, { movement_type: 'transfer', destination_product_id: 'destination' },
  ])('rejects idempotency-key reuse when material fingerprint changes %#', async (change) => {
    const db = new MovementDb(); expect((await movementRequest(db, 'tea', body('sale'))).status).toBe(201);
    expect((await movementRequest(db, 'tea', { ...body('sale', { expected_balance: 17 }), ...change, idempotency_key: 'sale-1' })).status).toBe(409);
  });
  it('does not mirror unit movements into listing gram stock', async () => {
    const db = new MovementDb(); db.listings.set('pot', 99); const response = await movementRequest(db, 'pot', body('sale', { unit: 'unit', quantity: 1, expected_balance: 4, idempotency_key: 'pot-sale' }));
    expect(response.status).toBe(201); expect(db.products.get('pot')?.quantity_units).toBe(3); expect(db.listings.get('pot')).toBe(99);
  });
  it('records a zero-to-zero recount and marks stock known', async () => {
    const db = new MovementDb(); db.products.get('tea')!.stock_grams = 0;
    const response = await movementRequest(db, 'tea', body('recount', { quantity: undefined, balance: 0, expected_balance: 0, idempotency_key: 'zero-count' }));
    expect(response.status).toBe(201); expect(db.ledger).toHaveLength(1); expect(db.ledger[0]).toMatchObject({ delta: 0, movement_type: 'recount' }); expect(db.products.get('tea')?.stock_known_at).toBeTruthy();
  });
  it('enforces product, destination, and account scope', async () => {
    expect((await movementRequest(new MovementDb(), 'other', body('sale'))).status).toBe(404);
    expect((await movementRequest(new MovementDb(), 'tea', body('transfer', { destination_product_id: 'other' }))).status).toBe(404);
    expect((await movementRequest(new MovementDb(), 'tea', body('transfer', { destination_product_id: 'missing' }))).status).toBe(404);
    expect((await movementRequest(new MovementDb(), 'tea', body('receipt', { batch_id: 'foreign-batch' }))).status).toBe(404);
    expect((await movementRequest(new MovementDb(), 'tea', body('receipt', { source_compass_entry_id: 'foreign-entry' }))).status).toBe(404);
    expect((await movementRequest(new MovementDb(), 'tea', body('receipt', { source_invoice_id: 'foreign-invoice' }))).status).toBe(404);
  });
  it('transfers only to a valid destination without disappearance', async () => {
    const db = new MovementDb(); const response = await movementRequest(db, 'tea', body('transfer', { quantity: 4, destination_product_id: 'destination' }));
    expect(response.status).toBe(201); expect(db.products.get('tea')?.stock_grams).toBe(16); expect(db.products.get('destination')?.stock_grams).toBe(9); expect(db.ledger.map(row => row.delta)).toEqual([-4, 4]);
  });
  it('preserves invoice, batch, and compass provenance', async () => {
    const db = new MovementDb(); await movementRequest(db, 'tea', body('receipt', { source_invoice_id: 'inv', source_invoice_number: 'INV-1', batch_id: 'batch', source_compass_entry_id: 'entry' }));
    expect(db.ledger[0]).toMatchObject({ source_invoice_id: 'inv', source_invoice_number: 'INV-1', batch_id: 'batch', source_compass_entry_id: 'entry' });
  });
  it('rolls back product, listing, and ledger when any batched write fails', async () => {
    const db = new MovementDb(); db.failBatchAt = 1; expect((await movementRequest(db, 'tea', body('receipt'))).status).toBe(500); expect(db.products.get('tea')?.stock_grams).toBe(20); expect(db.listings.get('tea')).toBe(20); expect(db.ledger).toHaveLength(0);
  });
  it('allows only one concurrent request for the same expected balance', async () => {
    const db = new MovementDb(); const responses = await Promise.all([movementRequest(db, 'tea', body('sale', { idempotency_key: 'a' })), movementRequest(db, 'tea', body('gift', { idempotency_key: 'b' }))]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]); expect(db.ledger).toHaveLength(1); expect(db.products.get('tea')?.stock_grams).toBe(17);
  });
  it('returns a completed receipt retry before rejecting its zero remaining quantity', async () => {
    const db = new MovementDb(); db.receiptLines.set('line', { id:'line',receipt_id:'receipt',account_id:'account-a',product_id:'tea',expected_quantity:10,received_quantity:10,cancelled_quantity:0,unit:'g',intended_purpose:'working',intake_batch_id:'batch',receipt_state:'received' });
    db.ledger.push({ id:'ledger',account_id:'account-a',product_id:'tea',movement_type:'receipt',idempotency_key:'receipt-retry',inventory_receipt_line_id:'line',batch_id:'batch',movement_fingerprint:JSON.stringify({ quantity:10 }) });
    const response = await receiveRequest(db,'line',{ quantity:10,idempotency_key:'receipt-retry' });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ already_received:true,received_quantity:10,remaining_quantity:0,ledger_id:'ledger' });
  });
  it('does not apply receipt extras when the guarded movement loses a race', async () => {
    const db = new MovementDb(); db.receiptLines.set('line', { id:'line',receipt_id:'receipt',account_id:'account-a',product_id:'tea',expected_quantity:10,received_quantity:0,cancelled_quantity:0,unit:'g',intended_purpose:'working',intake_batch_id:'batch',receipt_state:'in_transit' }); db.forceStale=true;
    const response = await receiveRequest(db,'line',{ quantity:10,idempotency_key:'receipt-stale' });
    expect(response.status).toBe(409); expect(db.receiptSideEffects).toBe(0); expect(db.ledger).toHaveLength(0);
  });
  it('uses a stable initial intake batch so concurrent same-key receipt requests converge idempotently', async () => {
    const db = new MovementDb(); db.synchronizeProductReads(2); db.receiptLines.set('line', { id:'line',receipt_id:'receipt',account_id:'account-a',product_id:'tea',expected_quantity:10,received_quantity:0,cancelled_quantity:0,unit:'g',intended_purpose:'working',intake_batch_id:null,receipt_state:'in_transit' });
    const responses = await Promise.all([receiveRequest(db,'line',{ quantity:10,idempotency_key:'same-receipt' }),receiveRequest(db,'line',{ quantity:10,idempotency_key:'same-receipt' })]);
    expect(responses.map(response => response.status)).toEqual([200,200]);
    expect((await Promise.all(responses.map(response => response.json() as Promise<any>))).map(result => result.already_received).sort()).toEqual([false,true]);
    expect(db.ledger).toHaveLength(1); expect(db.ledger[0].batch_id).toBe('receipt-line-line');
  });
  it('routes legacy absolute stock editing through exactly one recount ledger movement', async () => {
    const db = new MovementDb(); const response = await legacyStockRequest(db,'tea',12);
    expect(response.status).toBe(200); expect(db.products.get('tea')?.stock_grams).toBe(12); expect(db.ledger).toHaveLength(1); expect(db.ledger[0]).toMatchObject({ movement_type:'recount',delta:-8,idempotency_key:'legacy-recount' });
  });
});
