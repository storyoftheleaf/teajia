import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'test-secret';
type Row = Record<string, unknown> & { id: string };

class ImportStatement {
  values: unknown[] = [];
  constructor(readonly sql: string, private db: ImportDb) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  private normalized() { return this.sql.replace(/\s+/g, ' ').trim().toLowerCase(); }
  async first() {
    const sql = this.normalized();
    if (sql.includes('select platform_role from users')) return { platform_role: null };
    if (sql.includes('from account_members am join accounts')) return { role: 'owner', permissions: '{}', kind: 'location' };
    if (sql.includes('select status from accounts')) return { status: 'active' };
    const table = this.db.tableFor(sql);
    if (table && sql.includes('where id = ?')) {
      const row = table.get(String(this.values[0]));
      if (!row) return null;
      if (sql.includes('batch_id = ?') && row.batch_id !== this.values[1]) return null;
      if (sql.includes('user_id = ?') && row.user_id !== this.values.at(-2)) return null;
      const accountIndex = sql.includes('account_id = ?') ? this.values.length - 1 : -1;
      if (accountIndex >= 0 && row.account_id !== this.values[accountIndex]) return null;
      return { ...row };
    }
    return null;
  }
  async all() {
    const sql = this.normalized();
    const table = this.db.tableFor(sql);
    if (!table) return { results: [] };
    let rows = [...table.values()];
    if (sql.includes('batch_id = ?')) rows = rows.filter(row => row.batch_id === this.values[0]);
    if (sql.includes('account_id = ?')) rows = rows.filter(row => row.account_id === this.values.at(-1));
    if (sql.includes('order by position')) rows.sort((a, b) => Number(a.position) - Number(b.position));
    return { results: rows.map(row => ({ ...row })) };
  }
  async run() {
    const sql = this.normalized();
    const table = this.db.tableFor(sql);
    if (table && sql.startsWith('insert')) {
      const columns = this.sql.match(/\(([^)]+)\)\s*values/i)?.[1].split(',').map(value => value.trim()) ?? [];
      const row = Object.fromEntries(columns.map((column, index) => [column, this.values[index]])) as Row;
      if (table.has(String(row.id))) {
        if (sql.startsWith('insert or ignore')) return { success: true, meta: { changes: 0 } };
        throw new Error('UNIQUE constraint failed');
      }
      table.set(String(row.id), row);
      return { success: true, meta: { changes: 1 } };
    }
    if (table && sql.startsWith('update')) {
      const verifiesCompassOwnership = sql.includes('exists (select 1 from tea_compass_entries');
      const id = String(verifiesCompassOwnership ? this.values[3] : this.values.at(-2));
      const accountId = verifiesCompassOwnership ? this.values[4] : this.values.at(-1);
      const row = table.get(id);
      if (!row || row.account_id !== accountId) return { success: true, meta: { changes: 0 } };
      if (sql.includes('compass_entry_id is null') && row.compass_entry_id != null) return { success: true, meta: { changes: 0 } };
      if (verifiesCompassOwnership) {
        const compass = this.db.compass.get(String(this.values[5]));
        if (!compass || compass.user_id !== this.values[6] || compass.account_id !== this.values[7] || compass.import_item_id !== this.values[8]) {
          return { success: true, meta: { changes: 0 } };
        }
      }
      const set = this.sql.match(/set\s+(.+?)\s+where/is)?.[1] ?? '';
      const columns = [...set.matchAll(/(?:^|,)\s*([a-z_]+)\s*=\s*\?/gi)].map(match => match[1]);
      columns.forEach((column, index) => { row[column] = this.values[index]; });
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
}

class ImportDb {
  batches = new Map<string, Row>();
  sources = new Map<string, Row>();
  items = new Map<string, Row>();
  compass = new Map<string, Row>();
  journeys = new Map<string, Row>();
  visits = new Map<string, Row>();
  tableFor(sql: string) {
    if (sql.includes('curate_import_batches')) return this.batches;
    if (sql.includes('curate_import_sources')) return this.sources;
    if (sql.includes('curate_import_items')) return this.items;
    if (sql.includes('tea_compass_entries')) return this.compass;
    if (sql.includes('curate_journeys')) return this.journeys;
    if (sql.includes('curate_visits')) return this.visits;
    return null;
  }
  prepare(sql: string) { return new ImportStatement(sql, this); }
  async batch(statements: ImportStatement[]) {
    const snapshots = [this.batches, this.sources, this.items, this.compass, this.journeys, this.visits].map(table => new Map([...table].map(([id, row]) => [id, { ...row }])));
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    }
    catch (error) {
      [this.batches, this.sources, this.items, this.compass, this.journeys, this.visits] = snapshots;
      throw error;
    }
  }
}

function b64(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes));
}
async function token(userId: string, accountId: string) {
  const now = Math.floor(Date.now() / 1000);
  const payload = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: accountId, iat: now, exp: now + 60 }))}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${payload}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))))}`;
}
async function request(db: ImportDb, path: string, init: RequestInit = {}, accountId = 'account-a', userId = 'user-a') {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await token(userId, accountId)}`);
  headers.set('X-Teajia-Account', accountId);
  if (init.body) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://test.dev${path}`, { ...init, headers }), { DB: db, JWT_SECRET } as any);
}

describe('Curate import provenance API', () => {
  it('preserves pasted evidence byte-for-byte and parsed item order across refreshes', async () => {
    const db = new ImportDb();
    const pasted = '  2019 老班章\r\nNT$ 800 / 25g\n\n备注: 蜜香  ';
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({
      title: 'WeChat July 12', source_kind: 'wechat', pasted_text: pasted,
      items: [
        { position: 1, category: 'tea', name: 'Lao Ban Zhang', raw_text: '2019 老班章', confidence: 0.72, uncertainty: { year: ['2018', '2019'] } },
        { position: 0, category: 'tea', name: 'Unknown tea', raw_text: 'NT$ 800 / 25g', confidence: 0.31, uncertainty: { name: true } },
      ],
    }) });
    expect(created.status).toBe(201);
    const body = await created.json() as any;
    const refreshed = await request(db, `/api/curate/imports/${body.batch.id}`);
    expect(refreshed.status).toBe(200);
    expect(await refreshed.json()).toMatchObject({
      batch: { title: 'WeChat July 12', created_by_user_id: 'user-a' },
      sources: [{ kind: 'wechat', pasted_text: pasted }],
      items: [
        { position: 0, source_id: body.sources[0].id, raw_text: 'NT$ 800 / 25g', confidence: 0.31, uncertainty: { name: true } },
        { position: 1, source_id: body.sources[0].id, raw_text: '2019 老班章', confidence: 0.72, uncertainty: { year: ['2018', '2019'] } },
      ],
    });
  });

  it('links an item only to a source in the same account and batch', async () => {
    const db = new ImportDb();
    const first = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'First', source_kind: 'paste', pasted_text: 'one', items: [{ name: 'One' }] }) });
    const second = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Second', source_kind: 'paste', pasted_text: 'two', items: [{ name: 'Two' }] }) });
    const a = await first.json() as any;
    const b = await second.json() as any;
    const crossBatch = await request(db, `/api/curate/imports/${a.batch.id}/items/${a.items[0].id}`, { method: 'PUT', body: JSON.stringify({ source_id: b.sources[0].id }) });
    expect(crossBatch.status).toBe(400);

    const foreign = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Foreign', source_kind: 'paste', pasted_text: 'private', items: [{ name: 'Private' }] }) }, 'account-b', 'user-b');
    const foreignBody = await foreign.json() as any;
    const crossAccount = await request(db, `/api/curate/imports/${a.batch.id}/items/${a.items[0].id}`, { method: 'PUT', body: JSON.stringify({ source_id: foreignBody.sources[0].id }) });
    expect(crossAccount.status).toBe(400);
  });

  it.each(['wechat', 'invoice', 'vendor_list', 'photo', 'file', 'paste'])('accepts %s sources while storing object keys instead of file bytes', async kind => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: kind }) });
    const { batch } = await created.json() as any;
    const key = `curate/account-a/${batch.id}/scan.jpg`;
    const response = await request(db, `/api/curate/imports/${batch.id}/sources`, { method: 'POST', body: JSON.stringify({ kind, r2_object_key: key, metadata: { page: 1, data: 'ordinary metadata' } }) });
    expect(response.status).toBe(201);
    expect(JSON.stringify([...db.sources.values()])).not.toContain('base64');
    expect(await response.json()).toMatchObject({ kind, r2_object_key: key, metadata: { page: 1, data: 'ordinary metadata' } });
  });

  it.each([
    '../escape.jpg',
    'curate/account-b/BATCH/scan.jpg',
    'curate/account-a/BATCH/../scan.jpg',
    'curate/account-a/BATCH/%2e%2e/scan.jpg',
    'curate/account-a/BATCH//scan.jpg',
    'curate/account-a/BATCH/scan\u0000.jpg',
  ])('rejects an unsafe or out-of-tenant R2 key: %s', async template => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'R2' }) });
    const { batch } = await created.json() as any;
    const key = template.replace('BATCH', batch.id);
    const response = await request(db, `/api/curate/imports/${batch.id}/sources`, { method: 'POST', body: JSON.stringify({ kind: 'file', r2_object_key: key }) });
    expect(response.status).toBe(400);
  });

  it.each([
    { metadata: { attachment: { base64: 'aGVsbG8=' } } },
    { metadata: { pages: [{ preview: 'data:image/png;base64,aGVsbG8=' }] } },
    { metadata: { pages: [{ preview: 'A'.repeat(128) }] } },
    { metadata: { nested: { file_bytes: [1, 2, 3] } } },
    { metadata: { nested: [{ data: 'aGVsbG8=' }] } },
  ])('recursively rejects embedded binary payloads: %j', async unsafe => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Unsafe' }) });
    const { batch } = await created.json() as any;
    const response = await request(db, `/api/curate/imports/${batch.id}/sources`, { method: 'POST', body: JSON.stringify({ kind: 'file', r2_object_key: `curate/account-a/${batch.id}/safe-key`, ...unsafe }) });
    expect(response.status).toBe(400);
    expect(db.sources.size).toBe(0);
  });

  it('returns 400 for source structures beyond traversal limits instead of overflowing or returning 500', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Deep' }) });
    const { batch } = await created.json() as any;
    let metadata: Record<string, unknown> = { leaf: true };
    for (let index = 0; index < 40; index++) metadata = { child: metadata };
    const response = await request(db, `/api/curate/imports/${batch.id}/sources`, { method: 'POST', body: JSON.stringify({ kind: 'file', r2_object_key: `curate/account-a/${batch.id}/deep`, metadata }) });
    expect(response.status).toBe(400);
  });

  it('accepts once, creates exactly one Compass entry, and never creates product or stock', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'List', items: [{ position: 0, category: 'tea', name: 'Ruby 18', raw_text: 'Ruby 18 — 600' }] }) });
    const { batch, items } = await created.json() as any;
    const path = `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`;
    const first = await request(db, path, { method: 'POST' });
    const second = await request(db, path, { method: 'POST' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ already_accepted: true });
    expect(db.compass.size).toBe(1);
    expect([...db.compass.values()][0]).toMatchObject({ name: 'Ruby 18', category: 'tea', account_id: 'account-a', user_id: 'user-a' });
    expect((db as any).products).toBeUndefined();
  });

  it('does not link an item when its deterministic Compass id collides with another owner', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Collision', items: [{ name: 'Protected' }] }) });
    const { batch, items } = await created.json() as any;
    const compassId = items[0].reserved_compass_entry_id;
    db.compass.set(compassId, { id: compassId, account_id: 'account-b', user_id: 'user-b', name: 'Foreign' });
    const accepted = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' });
    expect(accepted.status).toBe(409);
    expect(db.items.get(items[0].id)).toMatchObject({ compass_entry_id: null, review_state: 'pending' });
    expect(db.compass.get(compassId)).toMatchObject({ account_id: 'account-b', user_id: 'user-b', name: 'Foreign' });
  });

  it('does not link a same-owner Compass row that predates the import reservation', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Owned collision', items: [{ name: 'Imported tea' }] }) });
    const { batch, items } = await created.json() as any;
    const reservedId = items[0].reserved_compass_entry_id;
    db.compass.set(reservedId, { id: reservedId, account_id: 'account-a', user_id: 'user-a', name: 'Unrelated owned tea', import_item_id: null });
    const accepted = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' });
    expect(accepted.status).toBe(409);
    expect(db.items.get(items[0].id)).toMatchObject({ compass_entry_id: null, review_state: 'pending' });
    expect(db.compass.get(reservedId)).toMatchObject({ name: 'Unrelated owned tea', import_item_id: null });
  });

  it('makes concurrent accepts converge on one owned Compass link', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Concurrent', items: [{ name: 'One tea' }] }) });
    const { batch, items } = await created.json() as any;
    const path = `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`;
    const responses = await Promise.all([request(db, path, { method: 'POST' }), request(db, path, { method: 'POST' })]);
    expect(responses.map(result => result.status).sort()).toEqual([200, 201]);
    expect(db.compass.size).toBe(1);
    expect(db.items.get(items[0].id)).toMatchObject({ compass_entry_id: items[0].reserved_compass_entry_id, review_state: 'accepted' });
  });

  it('preserves long base64-alphabet evidence text byte-for-byte without treating it as an attachment', async () => {
    const db = new ImportDb();
    const evidence = 'A'.repeat(256);
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({
      title: 'Long evidence',
      source_kind: 'paste',
      pasted_text: evidence,
      items: [{ name: evidence, raw_text: evidence, parsed_data: { notes_from_parser: evidence } }],
    }) });
    expect(created.status).toBe(201);
    const body = await created.json() as any;
    expect(body.batch.title).toBe('Long evidence');
    expect(body.sources[0].pasted_text).toBe(evidence);
    expect(body.items[0]).toMatchObject({ name: evidence, raw_text: evidence, parsed_data: { notes_from_parser: evidence } });
  });

  it('rejects foreign or mismatched journey/visit context on import creation', async () => {
    const db = new ImportDb();
    (db as any).journeys = new Map([['journey-a', { id: 'journey-a', account_id: 'account-a' }]]);
    (db as any).visits = new Map([
      ['visit-a', { id: 'visit-a', account_id: 'account-a', journey_id: 'journey-a' }],
      ['visit-other', { id: 'visit-other', account_id: 'account-a', journey_id: 'journey-other' }],
      ['visit-foreign', { id: 'visit-foreign', account_id: 'account-b', journey_id: null }],
    ]);
    expect((await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Bad', journey_id: 'missing' }) })).status).toBe(400);
    expect((await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Bad', visit_id: 'visit-foreign' }) })).status).toBe(400);
    expect((await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Bad', journey_id: 'journey-a', visit_id: 'visit-other' }) })).status).toBe(400);
    expect((await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Good', journey_id: 'journey-a', visit_id: 'visit-a' }) })).status).toBe(201);
  });

  it('maps corrected structured fields through the Compass allowlist without accepting ownership or stock fields', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({
      title: 'Corrected invoice', source_kind: 'invoice', pasted_text: '春 2021, 25g, NT$800',
      items: [{
        name: 'Spring Shan Lin Xi', raw_text: '春 2021, 25g, NT$800', category: 'tea',
        parsed_data: {
          chinese_name: '杉林溪', type: 'oolong', year: 2021, season: 'spring', origin_region: 'Nantou',
          price_amount: 800, price_currency: 'TWD', price_per_unit_grams: 25,
          vendor_id: 'vendor-1', vendor_name: 'Lin Tea', buy_quantity_grams: 25, buy_total: 800,
          account_id: 'account-b', user_id: 'user-b', id: 'attacker', stock_grams: 999, draft_product_id: 'product-x',
        },
      }],
    }) });
    const { batch, items } = await created.json() as any;
    const accepted = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' });
    expect(accepted.status).toBe(201);
    expect([...db.compass.values()][0]).toMatchObject({
      account_id: 'account-a', user_id: 'user-a', name: 'Spring Shan Lin Xi', chinese_name: '杉林溪',
      type: 'oolong', year: 2021, season: 'spring', origin_region: 'Nantou', price_amount: 800,
      price_currency: 'TWD', price_per_unit_grams: 25, vendor_id: 'vendor-1', vendor_name: 'Lin Tea',
      buy_quantity_grams: 25, buy_total: 800, category: 'tea', notes: '春 2021, 25g, NT$800',
    });
    expect([...db.compass.values()][0]).not.toHaveProperty('stock_grams');
    expect([...db.compass.values()][0]).not.toMatchObject({ draft_product_id: 'product-x' });
  });

  it('merges into an owned Compass entry without creating another and rejects abandoned items', async () => {
    const db = new ImportDb();
    db.compass.set('existing', { id: 'existing', account_id: 'account-a', user_id: 'user-a', name: 'Existing' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Invoice', items: [{ position: 0, category: 'tea', name: 'Line one' }, { position: 1, category: 'tea', name: 'No tea' }] }) });
    const { batch, items } = await created.json() as any;
    const merged = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/merge`, { method: 'POST', body: JSON.stringify({ compass_entry_id: 'existing' }) });
    expect(merged.status).toBe(200);
    expect(await merged.json()).toMatchObject({ compass_entry_id: 'existing', review_state: 'merged' });
    expect(db.compass.size).toBe(1);
    await request(db, `/api/curate/imports/${batch.id}/items/${items[1].id}`, { method: 'PUT', body: JSON.stringify({ review_state: 'abandoned' }) });
    const rejected = await request(db, `/api/curate/imports/${batch.id}/items/${items[1].id}/accept`, { method: 'POST' });
    expect(rejected.status).toBe(409);
    expect(db.compass.size).toBe(1);
  });

  it('returns 404 for every foreign-account batch or item operation', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Private', items: [{ position: 0, name: 'Secret' }] }) });
    const { batch, items } = await created.json() as any;
    const paths: Array<[string, string, unknown?]> = [
      ['GET', `/api/curate/imports/${batch.id}`],
      ['POST', `/api/curate/imports/${batch.id}/sources`, { kind: 'paste', pasted_text: 'steal' }],
      ['PUT', `/api/curate/imports/${batch.id}/items/${items[0].id}`, { name: 'stolen' }],
      ['POST', `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`],
      ['POST', `/api/curate/imports/${batch.id}/items/${items[0].id}/merge`, { compass_entry_id: 'x' }],
    ];
    for (const [method, path, body] of paths) {
      const response = await request(db, path, { method, body: body ? JSON.stringify(body) : undefined }, 'account-b', 'user-b');
      expect(response.status, `${method} ${path}`).toBe(404);
    }
  });
});
