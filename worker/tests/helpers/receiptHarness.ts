import worker from '../../src/index';

const JWT_SECRET = 'test-secret';
const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();
type Row = Record<string, any>;

class ReceiptStatement {
  values: unknown[] = [];
  constructor(readonly sql: string, private db: ReceiptDb) {}
  bind(...values: unknown[]) { this.values = values; return this; }

  async first() {
    const sql = norm(this.sql);
    if (sql.includes('from account_members am join accounts a on a.id = am.account_id')) return { role: 'owner', permissions: '{}', kind: 'location', status: 'active' };
    if (sql.includes('select platform_role from users where id = ?')) return { platform_role: null };
    if (sql.includes('select id, email, platform_role from users where id = ?')) return { id: this.values[0], email: `${this.values[0]}@example.com`, platform_role: null };
    if (sql.includes('select status from accounts where id = ?')) return { status: 'active' };
    if (sql.includes('from tea_compass_entries where id = ?')) return scoped(this.db.entries, this.values[0], sql, this.values);
    if (sql.includes('from curate_receipt_proposals where account_id = ? and idempotency_key = ?')) {
      return [...this.db.proposals.values()].find(row => row.account_id === this.values[0] && row.idempotency_key === this.values[1]) ?? null;
    }
    if (sql.includes('from curate_receipt_proposals where id = ? and account_id = ?')) return scoped(this.db.proposals, this.values[0], sql, this.values);
    if (sql.includes('from products where id') && sql.includes('account_id')) return scoped(this.db.products, this.values[0], sql, this.values);
    if (sql.includes('from inventory_receipt_lines l join inventory_receipts r')) {
      const line = scoped(this.db.receiptLines, this.values[0], sql, this.values);
      const receipt = line && this.db.receipts.get(String(line.receipt_id));
      return line && receipt ? { ...line, receipt_state: receipt.state, vendor_name: receipt.vendor_name } : null;
    }
    if (sql.includes('select intake_batch_id from inventory_receipt_lines where receipt_id')) return [...this.db.receiptLines.values()].find(row => row.receipt_id === this.values[0] && row.account_id === this.values[1] && row.intake_batch_id)?.intake_batch_id ? { intake_batch_id: [...this.db.receiptLines.values()].find(row => row.receipt_id === this.values[0] && row.account_id === this.values[1] && row.intake_batch_id)!.intake_batch_id } : null;
    if (sql.includes('from inventory_receipts where id') && sql.includes('account_id')) return scoped(this.db.receipts, this.values[0], sql, this.values);
    if (sql.includes('from batches where id = ? and account_id = ?')) return scoped(this.db.batches, this.values[0], sql, this.values);
    if (sql.includes('from curate_import_items where id = ? and account_id = ?')) return scoped(this.db.importItems, this.values[0], sql, this.values);
    if (sql.includes('from curate_import_batches where id = ? and account_id = ?')) return scoped(this.db.imports, this.values[0], sql, this.values);
    if (sql.startsWith('update products set') && sql.includes('returning stock_grams')) {
      const result = await this.run();
      return (result as any).meta.changes ? { stock_grams: this.values[0] } : null;
    }
    return null;
  }
  async all() {
    const sql = norm(this.sql);
    if (sql.includes('from inventory_receipts where account_id = ?')) {
      const includeClosed = !sql.includes("state not in ('received','cancelled')");
      return { results: [...this.db.receipts.values()].filter(row => row.account_id === this.values[0] && (includeClosed || !['received', 'cancelled'].includes(row.state))) };
    }
    if (sql.includes('from inventory_receipt_lines l join products p')) return { results: [...this.db.receiptLines.values()].filter(row => row.receipt_id === this.values[0] && row.account_id === this.values[1]).map(row => { const product = this.db.products.get(String(row.product_id)); return { ...row, product_name: product?.given_name ?? product?.product_name ?? 'Unnamed item', current_on_hand: row.unit === 'g' ? Number(product?.stock_grams ?? 0) : Number(product?.quantity_units ?? 0) }; }) };
    if (sql.includes('from products where account_id=? and in_transit=1')) return { results: [...this.db.products.values()].filter(row => row.account_id === this.values[0] && row.in_transit === 1 && Number(row.in_transit_grams) > 0).map(row => ({ id: row.id, product_name: row.given_name ?? row.product_name ?? 'Unnamed item', expected_quantity: row.in_transit_grams, current_on_hand: Number(row.stock_grams ?? 0), eta: row.in_transit_eta, intended_purpose: row.inventory_purpose })) };
    return { results: [] };
  }
  async run() {
    const sql = norm(this.sql);
    if (sql.startsWith('insert into curate_receipt_proposals')) return insertColumns(this.db.proposals, this.sql, this.values);
    if (sql.startsWith('insert into products')) return insertColumns(this.db.products, this.sql, this.values);
    if (sql.startsWith('insert into tea_profiles')) return insertColumns(this.db.profiles, this.sql, this.values);
    if (sql.startsWith('insert into product_listings')) return insertColumns(this.db.listings, this.sql, this.values);
    if (sql.startsWith('insert into stock_ledger')) {
      if (sql.includes('inventory_receipt_line_id')) {
        const row = { id: this.values[0], product_id: this.values[1], delta: this.values[2], balance_after: this.values[3], movement_unit: this.values[4], reason: 'PURCHASE_RECEIPT', user_email: this.values[5], note: this.values[6], batch_id: this.values[7], account_id: this.values[8], inventory_receipt_line_id: this.values[9] };
        this.db.ledger.push(row); return { success: true, meta: { changes: 1 } };
      }
      const existing = sql.includes('(select stock_grams') || sql.includes('(select quantity_units');
      const offset = existing ? 2 : 1;
      const row = {
        id: this.values[0], product_id: this.values[1], delta: this.values[2],
        balance_after: existing ? (sql.includes('stock_grams') ? this.db.products.get(String(this.values[3]))?.stock_grams : this.db.products.get(String(this.values[3]))?.quantity_units) : this.values[3],
        movement_unit: this.values[3 + offset], reason: 'PURCHASE_RECEIPT', user_email: this.values[4 + offset], note: this.values[5 + offset],
        batch_id: this.values[6 + offset], account_id: this.values[7 + offset], receipt_proposal_id: this.values[8 + offset],
      };
      if (this.db.ledger.some(item => item.receipt_proposal_id === row.receipt_proposal_id)) throw new Error('UNIQUE receipt ledger');
      this.db.ledger.push(row); return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('insert into inventory_receipts')) return insertColumns(this.db.receipts, this.sql, this.values);
    if (sql.startsWith('insert into inventory_receipt_lines')) {
      const result = insertColumns(this.db.receiptLines, this.sql, this.values);
      const row = this.db.receiptLines.get(String(this.values[0]))!;
      Object.assign(row, { received_quantity: 0, cancelled_quantity: 0, intake_batch_id: null });
      return result;
    }
    if (sql.startsWith('insert into batches')) return insertColumns(this.db.batches, this.sql, this.values);
    if (sql.startsWith('update inventory_receipt_lines set')) {
      const row = this.db.receiptLines.get(String(this.values.at(-2)));
      if (!row || row.account_id !== this.values.at(-1)) return { success: true, meta: { changes: 0 } };
      if (sql.includes('received_quantity=received_quantity+?')) { row.received_quantity += Number(this.values[0]); row.intake_batch_id = this.values[1]; }
      else if (sql.includes('cancelled_quantity=cancelled_quantity+?')) row.cancelled_quantity += Number(this.values[0]);
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('update inventory_receipts set state=case')) {
      const receiptId = String(this.values.at(-2)); const accountId = this.values.at(-1);
      const receipt = this.db.receipts.get(receiptId);
      if (!receipt || receipt.account_id !== accountId) return { success: true, meta: { changes: 0 } };
      const lines = [...this.db.receiptLines.values()].filter(row => row.receipt_id === receiptId && row.account_id === accountId);
      const remaining = lines.reduce((sum, row) => sum + row.expected_quantity - row.received_quantity - row.cancelled_quantity, 0);
      const received = lines.reduce((sum, row) => sum + row.received_quantity, 0);
      if (remaining === 0) receipt.state = received > 0 ? 'received' : 'cancelled'; else if (received > 0) receipt.state = 'partially_received';
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('update inventory_receipts set state=?')) return updateRow(this.db.receipts, this.sql, this.values);
    if (sql.startsWith('update curate_receipt_proposals set')) return updateRow(this.db.proposals, this.sql, this.values);
    if (sql.startsWith('update products set') && sql.includes('coalesce(')) return incrementRow(this.db.products, this.sql, this.values, false);
    if (sql.startsWith('update products set')) return updateRow(this.db.products, this.sql, this.values);
    if (sql.startsWith('update product_listings set')) {
      if (sql.includes('exists (select 1 from products')) {
        const row = [...this.db.listings.values()].find(item => item.legacy_product_id === this.values[1] && item.account_id === this.values[2]);
        if (row) row.stock_grams = this.values[0];
        return { success: true, meta: { changes: row ? 1 : 0 } };
      }
      if (sql.includes('coalesce(')) return incrementRow(this.db.listings, this.sql, this.values, true);
      if (sql.includes('where legacy_product_id = ?')) return updateByLegacy(this.db.listings, this.sql, this.values);
      return updateRow(this.db.listings, this.sql, this.values);
    }
    if (sql.startsWith('update tea_compass_entries set')) return updateRow(this.db.entries, this.sql, this.values);
    return { success: true, meta: { changes: 1 } };
  }
}

function incrementRow(target: Map<string, Row>, sql: string, values: unknown[], legacy: boolean) {
  const row = legacy
    ? [...target.values()].find(item => item.legacy_product_id === values.at(-2) && item.account_id === values.at(-1))
    : target.get(String(values.at(-2)));
  if (!row || row.account_id !== values.at(-1)) return { success: true, meta: { changes: 0 } };
  const amountColumn = norm(sql).includes('quantity_units = coalesce') ? 'quantity_units' : 'stock_grams';
  Object.assign(row, { inventory_purpose: values[0], is_sample: values[1], is_personal: values[2], [amountColumn]: Number(row[amountColumn] ?? 0) + Number(values[3]), stock_known_at: values[4] });
  return { success: true, meta: { changes: 1 } };
}

function scoped(map: Map<string, Row>, id: unknown, sql: string, values: unknown[]) {
  const row = map.get(String(id));
  if (!row) return null;
  const accountIndex = 1;
  if (/account_id\s*=\s*\?/.test(sql) && row.account_id !== values[accountIndex]) return null;
  if (sql.includes('user_id = ?') && row.user_id !== values[2]) return null;
  return { ...row };
}

function insertColumns(target: Map<string, Row> | Row[], sql: string, values: unknown[]) {
  const table = norm(sql).match(/^insert into ([a-z_]+)/)![1];
  const match = sql.match(new RegExp(`${table}\\s*\\(([^)]+)\\)`, 'i'))!;
  const columns = match[1].split(',').map(v => v.trim());
  const valueMatch = sql.match(/values\s*\((.+)\)/is);
  const tokens = valueMatch ? valueMatch[1].split(',').map(value => value.trim()) : columns.map(() => '?');
  let bind = 0;
  const row = Object.fromEntries(columns.map((column, index) => {
    const token = tokens[index] ?? '?';
    if (token === '?') return [column, values[bind++]];
    if (/^'.*'$/.test(token)) return [column, token.slice(1, -1)];
    if (/^-?\d+(?:\.\d+)?$/.test(token)) return [column, Number(token)];
    return [column, null];
  }));
  if (table === 'curate_receipt_proposals') Object.assign(row, { status: 'pending', ledger_id: null, reviewed_by_user_id: null, reviewed_at: null });
  if (table === 'curate_receipt_proposals' && [...(target as Map<string, Row>).values()].some(existing => existing.account_id === row.account_id && existing.idempotency_key === row.idempotency_key)) throw new Error('UNIQUE account idempotency');
  if (table === 'stock_ledger' && (target as Row[]).some(existing => existing.receipt_proposal_id === row.receipt_proposal_id)) throw new Error('UNIQUE receipt ledger');
  if (target instanceof Map) target.set(String(row.id), row); else target.push(row);
  return { success: true, meta: { changes: 1 } };
}

function updateRow(target: Map<string, Row>, sql: string, values: unknown[]) {
  const normalized = norm(sql);
  const guarded = /where id = \? and account_id = \? and stock_grams = \?/.test(normalized);
  const accountScoped = /where id\s*=\s*\? and account_id\s*=\s*\?/.test(normalized);
  const id = String(values.at(guarded ? -3 : accountScoped ? -2 : -1));
  const accountId = accountScoped ? values.at(guarded ? -2 : -1) : undefined;
  const row = target.get(id);
  if (!row || (accountScoped && row.account_id !== accountId) || (guarded && row.stock_grams !== values.at(-1)) || (normalized.includes("status = 'pending'") && row.status !== 'pending')) return { success: true, meta: { changes: 0 } };
  const set = sql.match(/set\s+(.+?)\s+where/is)?.[1] ?? '';
  let bind = 0;
  for (const part of set.split(',')) {
    const column = part.trim().match(/^([a-z_]+)/i)?.[1]; if (!column) continue;
    if (/coalesce\s*\(/i.test(part) && part.includes('?')) row[column] = Number(row[column] ?? 0) + Number(values[bind++]);
    else if (part.includes('?')) row[column] = values[bind++];
    else if (/status\s*=\s*'accepted'/i.test(part)) row.status = 'accepted';
    else if (/status\s*=\s*'rejected'/i.test(part)) row.status = 'rejected';
  }
  return { success: true, meta: { changes: 1 } };
}

function updateByLegacy(target: Map<string, Row>, sql: string, values: unknown[]) {
  const productId = values.at(-2); const accountId = values.at(-1);
  const row = [...target.values()].find(value => value.legacy_product_id === productId && value.account_id === accountId);
  if (!row) return { success: true, meta: { changes: 0 } };
  const columns = [...(sql.match(/set\s+(.+?)\s+where/is)?.[1] ?? '').matchAll(/(?:^|,)\s*([a-z_]+)\s*=\s*\?/gi)].map(m => m[1]);
  columns.forEach((column, index) => { row[column] = /coalesce\s*\(/i.test(sql) && column === 'stock_grams' ? Number(row[column] ?? 0) + Number(values[index]) : values[index]; });
  return { success: true, meta: { changes: 1 } };
}

export class ReceiptDb {
  entries = new Map<string, Row>(); proposals = new Map<string, Row>(); products = new Map<string, Row>();
  profiles = new Map<string, Row>(); listings = new Map<string, Row>(); ledger: Row[] = [];
  batches = new Map<string, Row>(); imports = new Map<string, Row>(); importItems = new Map<string, Row>();
  receipts = new Map<string, Row>(); receiptLines = new Map<string, Row>(); teaSamples: Row[] = [];
  failBatchAt: number | null = null;
  static seeded() {
    const db = new ReceiptDb();
    for (const [id, category, type] of [['entry-a', 'tea', 'Oolong'], ['entry-work', 'tea', 'Red'], ['entry-pot', 'teaware', null]] as const) db.entries.set(id, { id, account_id: 'account-a', user_id: 'user-a', name: id, category, type, draft_product_id: null, import_item_id: null });
    db.products.set('product-b', { id: 'product-b', account_id: 'account-b' });
    db.batches.set('batch-a', { id: 'batch-a', account_id: 'account-a' }); db.batches.set('batch-b', { id: 'batch-b', account_id: 'account-b' });
    return db;
  }
  static seededWithReceipt(secondLine = false) {
    const db = ReceiptDb.seeded();
    db.products.set('product-a', { id: 'product-a', account_id: 'account-a', given_name: 'Spring Oolong', stock_grams: 5, quantity_units: 0 });
    db.receipts.set('receipt-a', { id: 'receipt-a', account_id: 'account-a', state: 'planned', vendor_name: 'Lin', source_kind: 'invoice', source_ref: 'INV-4' });
    db.receiptLines.set('line-a', { id: 'line-a', receipt_id: 'receipt-a', account_id: 'account-a', product_id: 'product-a', expected_quantity: 100, received_quantity: 0, cancelled_quantity: 0, unit: 'g', intended_purpose: 'working', source_kind: 'invoice', source_ref: 'INV-4', intake_batch_id: null });
    if (secondLine) db.receiptLines.set('line-b', { ...db.receiptLines.get('line-a'), id: 'line-b', expected_quantity: 20 });
    return db;
  }
  prepare(sql: string) { return new ReceiptStatement(sql, this); }
  async batch(statements: ReceiptStatement[]) {
    const snapshot = structuredClone({ entries: [...this.entries], proposals: [...this.proposals], products: [...this.products], profiles: [...this.profiles], listings: [...this.listings], ledger: this.ledger, batches: [...this.batches], receipts: [...this.receipts], receiptLines: [...this.receiptLines] });
    try {
      const results = [];
      for (let i = 0; i < statements.length; i++) { if (this.failBatchAt === i) throw new Error('Injected D1 batch failure'); results.push(await statements[i].run()); }
      return results;
    } catch (error) {
      this.entries = new Map(snapshot.entries); this.proposals = new Map(snapshot.proposals); this.products = new Map(snapshot.products); this.profiles = new Map(snapshot.profiles); this.listings = new Map(snapshot.listings); this.ledger = snapshot.ledger;
      this.batches = new Map(snapshot.batches); this.receipts = new Map(snapshot.receipts); this.receiptLines = new Map(snapshot.receiptLines);
      throw error;
    }
  }
}

function b64(input: string | Uint8Array) { const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input; let out = ''; for (const byte of bytes) out += String.fromCharCode(byte); return btoa(out); }
async function token(userId: string, accountId: string) { const now = Math.floor(Date.now() / 1000); const data = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: userId, email: `${userId}@example.com`, active_account_id: accountId, iat: now, exp: now + 3600 }))}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `${data}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))}`; }
export async function receiptRequest(db: ReceiptDb, path: string, options: RequestInit & { accountId?: string } = {}) { const accountId = options.accountId ?? 'account-a'; const headers = new Headers(options.headers); headers.set('Authorization', `Bearer ${await token('user-a', accountId)}`); headers.set('X-Teajia-Account', accountId); if (options.body) headers.set('Content-Type', 'application/json'); return worker.fetch(new Request(`https://worker.test${path}`, { ...options, headers }), { DB: db, JWT_SECRET } as any); }
