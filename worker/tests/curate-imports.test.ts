import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { holdingMatchesImportIdentity } from '../src/curateImports';
import { validateImportForFinalization } from '../src/curateImportFinalize';
import { buildImportCorrectionParsedData } from '../../src/components/TeaCompass/import/importReviewDomain';

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
    if (sql.includes('from account_members am join accounts')) return { role: this.db.role, permissions: this.db.role === 'staff' ? JSON.stringify({ bundles: ['catalog'] }) : '{}', kind: 'location' };
    if (sql.includes('select status from accounts')) return { status: 'active' };
    if (sql.includes('from curate_import_batches') && sql.includes('client_idempotency_key = ?')) return [...this.db.batches.values()].find(row => row.account_id === this.values[0] && row.client_idempotency_key === this.values[1]) ?? null;
    if (sql.includes('from curate_import_sources') && sql.includes('client_idempotency_key = ?')) return [...this.db.sources.values()].find(row => row.account_id === this.values[0] && row.client_idempotency_key === this.values[1]) ?? null;
    if (sql.includes('from curate_import_sources') && sql.includes('client_evidence_id = ?')) {
      return [...this.db.sources.values()].find(row => row.batch_id === this.values[0] && row.account_id === this.values[1] && row.client_evidence_id === this.values[2]) ?? null;
    }
    if (sql.includes('from products') && sql.includes('source_compass_entry_id = ?')) {
      return [...this.db.products.values()].find(row => row.account_id === this.values[0] && row.source_compass_entry_id === this.values[1]) ?? null;
    }
    const table = this.db.tableFor(sql);
    if (table && sql.includes('where id = ?')) {
      const row = table.get(String(this.values[0]));
      if (!row) return null;
      if (sql.includes('batch_id = ?') && row.batch_id !== this.values[1]) return null;
      if (sql.includes('user_id = ?') && !this.values.includes(row.user_id)) return null;
      if (sql.includes('account_id = ?') && !this.values.includes(row.account_id)) return null;
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
    if (sql.includes('batch_id = ?') && sql.includes('account_id = ?')) rows = rows.filter(row => row.account_id === this.values[1]);
    else if (sql.includes('account_id = ?') && sql.includes('user_id = ?')) rows = rows.filter(row => row.account_id === this.values[0] && row.user_id === this.values[1]);
    else if (sql.includes('account_id = ?')) rows = rows.filter(row => row.account_id === this.values.at(-1));
    if (sql.includes('json_each') && sql.includes("value = 'vendor'")) rows = rows.filter(row => {
      const tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : [];
      return Array.isArray(tags) && tags.includes('vendor');
    });
    if (sql.includes("review_state != 'completed'")) rows = rows.filter(row => row.review_state !== 'completed' && row.review_state !== 'abandoned');
    if (sql.includes('order by position')) rows.sort((a, b) => Number(a.position) - Number(b.position));
    const limit = sql.match(/\blimit (\d+)/)?.[1];
    if (limit) rows = rows.slice(0, Number(limit));
    return { results: rows.map(row => ({ ...row })) };
  }
  async run() {
    const sql = this.normalized();
    if (sql.includes("review_state not in ('completed', 'abandoned')") && this.db.terminalizeNextGuardedWrite) {
      this.db.terminalizeNextGuardedWrite = false;
      const batch = this.db.batches.get(String(this.values.at(-2)));
      if (batch) batch.review_state = 'abandoned';
    }
    if (sql.includes("review_state not in ('completed', 'abandoned')") && sql.includes('finalize_idempotency_key is null') && this.db.reserveNextGuardedWrite) {
      this.db.reserveNextGuardedWrite = false;
      const batch = this.db.batches.get(String(this.values.at(-2)));
      if (batch) batch.finalize_idempotency_key = 'finish-key';
    }
    const table = this.db.tableFor(sql);
    if (table && sql.startsWith('insert')) {
      if (table === this.db.customers && this.db.vendorWinnerBeforeInsert) {
        const winner = this.db.vendorWinnerBeforeInsert;
        this.db.vendorWinnerBeforeInsert = null;
        table.set(winner.id, { ...winner });
      }
      if (table === this.db.sources && this.db.evidenceWinnerBeforeGuard) {
        this.db.evidenceWinnerBeforeGuard = false;
        table.set('source-winner', {
          id: 'source-winner', batch_id: this.values[1], account_id: this.values[2], created_by_user_id: 'user-race', kind: this.values[4],
          pasted_text: null, r2_object_key: this.values[6], client_evidence_id: this.values[7], metadata_json: this.values[8],
        });
        const batch = this.db.batches.get(String(this.values.at(-2)));
        if (batch) batch.finalize_idempotency_key = 'finish-key';
      }
      const columns = this.sql.match(/\(([^)]+)\)\s*(?:values|select)/i)?.[1].split(',').map(value => value.trim()) ?? [];
      if (sql.includes("review_state not in ('completed', 'abandoned')")) {
        const guardedBatch = this.db.batches.get(String(this.values.at(-2)));
        if (!guardedBatch || guardedBatch.account_id !== this.values.at(-1) || ['completed', 'abandoned'].includes(String(guardedBatch.review_state)) || (sql.includes('finalize_idempotency_key is null') && guardedBatch.finalize_idempotency_key != null)) return { success: true, meta: { changes: 0 } };
        if (sql.includes('where analysis_attempt_token = ?') && guardedBatch.analysis_attempt_token !== this.values.at(-3)) return { success: true, meta: { changes: 0 } };
      }
      const valueTokens = (this.sql.match(/\bvalues\s*\(([^)]+)\)/i)?.[1]
        ?? this.sql.match(/\bselect\s+(.+?)\s+where\s+exists/is)?.[1])?.split(',').map(value => value.trim());
      let bindIndex = 0;
      const row = Object.fromEntries(columns.map((column, index) => {
        const token = valueTokens?.[index];
        if (!token || token === '?') return [column, this.values[bindIndex++]];
        if (/^null$/i.test(token)) return [column, null];
        const quoted = token.match(/^'([^']*)'$/); if (quoted) return [column, quoted[1]];
        return [column, this.values[bindIndex++]];
      })) as Row;
      if (table.has(String(row.id))) {
        if (sql.startsWith('insert or ignore')) return { success: true, meta: { changes: 0 } };
        throw new Error('UNIQUE constraint failed');
      }
      if (table === this.db.sources && row.client_evidence_id != null && [...table.values()].some(existing => existing.account_id === row.account_id && existing.batch_id === row.batch_id && existing.client_evidence_id === row.client_evidence_id)) throw new Error('UNIQUE constraint failed');
      table.set(String(row.id), row);
      if (table === this.db.customers && this.db.terminalizeAfterVendorInsert) {
        this.db.terminalizeAfterVendorInsert = false;
        const batchId = String(this.values.at(-2));
        if (this.db.inBatch) this.db.pendingVendorTerminalization = batchId;
        else {
          const batch = this.db.batches.get(batchId);
          if (batch) batch.finalize_idempotency_key = 'finish-key';
        }
      }
      return { success: true, meta: { changes: 1 } };
    }
    if (table && sql.startsWith('update')) {
      if (table === this.db.items && sql.includes('json_remove') && sql.includes('where vendor_group_id = ?')) {
        if (this.db.moveVendorItemBeforePatch) {
          const moved = this.db.items.get(this.db.moveVendorItemBeforePatch.itemId);
          if (moved) moved.vendor_group_id = this.db.moveVendorItemBeforePatch.groupId;
          this.db.moveVendorItemBeforePatch = null;
        }
        if (this.db.rewriteVendorItemBeforePatch) {
          const rewritten = this.db.items.get(this.db.rewriteVendorItemBeforePatch.itemId);
          if (rewritten) rewritten.parsed_data_json = JSON.stringify(this.db.rewriteVendorItemBeforePatch.parsedData);
          this.db.rewriteVendorItemBeforePatch = null;
        }
        const [groupId, accountId, guardedGroupId, guardedAccountId, vendorId, batchId, batchAccountId] = this.values;
        const group = this.db.groups.get(String(guardedGroupId));
        const batch = this.db.batches.get(String(batchId));
        if (!group || group.account_id !== guardedAccountId || group.resolved_vendor_customer_id !== vendorId
          || !batch || batch.account_id !== batchAccountId || ['completed', 'abandoned'].includes(String(batch.review_state)) || batch.finalize_idempotency_key != null) return { success: true, meta: { changes: 0 } };
        let changes = 0;
        for (const row of table.values()) if (row.vendor_group_id === groupId && row.account_id === accountId) {
          const parsed = JSON.parse(String(row.parsed_data_json || '{}'));
          if (parsed.confidence && typeof parsed.confidence === 'object') delete parsed.confidence.vendor;
          if (parsed.uncertainty && typeof parsed.uncertainty === 'object') delete parsed.uncertainty.vendor;
          parsed.blockingFields = Array.isArray(parsed.blockingFields) ? parsed.blockingFields.filter((field: unknown) => field !== 'vendor') : [];
          row.parsed_data_json = JSON.stringify(parsed);
          changes += 1;
        }
        return { success: true, meta: { changes } };
      }
      if (table === this.db.items && sql.includes('where batch_id = ?') && sql.includes("review_state in ('pending', 'reviewing')")) {
        const guardedBatch = this.db.batches.get(String(this.values.at(-2)));
        if (!guardedBatch || ['completed', 'abandoned'].includes(String(guardedBatch.review_state)) || (sql.includes('finalize_idempotency_key is null') && guardedBatch.finalize_idempotency_key != null)) return { success: true, meta: { changes: 0 } };
        let changes = 0;
        for (const row of table.values()) if (row.batch_id === this.values[0] && row.account_id === this.values[1] && (row.review_state === 'pending' || row.review_state === 'reviewing')) { row.review_state = 'abandoned'; changes += 1; }
        return { success: true, meta: { changes } };
      }
      const verifiesCompassOwnership = sql.includes('exists (select 1 from tea_compass_entries');
      const set = this.sql.match(/set\s+(.+?)\s+where/is)?.[1] ?? '';
      const columns = [...set.matchAll(/(?:^|,)\s*([a-z_]+)\s*=\s*\?/gi)].map(match => match[1]);
      const guardedAnalysisBatch = table === this.db.batches && sql.includes('where analysis_attempt_token = ?');
      const id = String(verifiesCompassOwnership ? this.values[3] : guardedAnalysisBatch ? this.values.at(-2) : this.values[columns.length]);
      const accountId = verifiesCompassOwnership ? this.values[4] : guardedAnalysisBatch ? this.values.at(-1) : this.values[columns.length + 1];
      const row = table.get(id);
      if (!row || row.account_id !== accountId) return { success: true, meta: { changes: 0 } };
      if (table === this.db.groups && sql.includes('exists (select 1 from customers')) {
        const vendor = this.db.customers.get(String(this.values[3]));
        const exactNameMismatch = sql.includes('and name = ?') && vendor?.name !== this.values[5];
        const normalizedNameMismatch = sql.includes('lower(trim(name))') && String(vendor?.name).trim().toLowerCase() !== String(this.values[5]).trim().toLowerCase();
        if (!vendor || vendor.account_id !== this.values[4] || exactNameMismatch || normalizedNameMismatch) return { success: true, meta: { changes: 0 } };
      }
      if (sql.includes("review_state not in ('completed', 'abandoned')")) {
        const guardedBatch = table === this.db.batches ? row : this.db.batches.get(String(this.values.at(-2)));
        if (!guardedBatch || ['completed', 'abandoned'].includes(String(guardedBatch.review_state)) || (sql.includes('finalize_idempotency_key is null') && guardedBatch.finalize_idempotency_key != null)) return { success: true, meta: { changes: 0 } };
        if (sql.includes('where analysis_attempt_token = ?') && guardedBatch.analysis_attempt_token !== this.values.at(-3)) return { success: true, meta: { changes: 0 } };
      }
      if (table === this.db.batches && sql.includes('where analysis_attempt_token = ?') && row.analysis_attempt_token !== this.values.at(-3)) return { success: true, meta: { changes: 0 } };
      if (sql.includes('compass_entry_id is null') && row.compass_entry_id != null) return { success: true, meta: { changes: 0 } };
      if (verifiesCompassOwnership) {
        const compass = this.db.compass.get(String(this.values[5]));
        if (!compass || compass.user_id !== this.values[6] || compass.account_id !== this.values[7] || compass.import_item_id !== this.values[8]) {
          return { success: true, meta: { changes: 0 } };
        }
      }
      columns.forEach((column, index) => { row[column] = this.values[index]; });
      if (sql.includes("analysis_state = 'analyzing'")) row.analysis_state = 'analyzing';
      if (sql.includes("analysis_state = 'complete'")) { row.analysis_state = 'complete'; row.analysis_version = Number(row.analysis_version ?? 0) + 1; }
      if (sql.includes("analysis_state = 'failed'")) row.analysis_state = 'failed';
      if (sql.includes("review_state = 'reviewing'")) row.review_state = 'reviewing';
      if (sql.includes("review_state = 'completed'")) row.review_state = 'completed';
      if (sql.includes("set review_state = 'abandoned'")) row.review_state = 'abandoned';
      if (sql.includes('analysis_attempt_token = null')) row.analysis_attempt_token = null;
      if (sql.includes("analysis_state = case when analysis_state = 'analyzing' then 'complete'")) row.analysis_state = row.analysis_state === 'analyzing' ? 'complete' : row.analysis_state;
      return { success: true, meta: { changes: 1 } };
    }
    if (table && sql.startsWith('delete')) {
      const row = table.get(String(this.values[0]));
      if (!row || row.account_id !== this.values[1]) return { success: true, meta: { changes: 0 } };
      if (table === this.db.customers && sql.includes('not exists (select 1 from curate_import_vendor_groups')) {
        const referenced = [...this.db.groups.values()].some(group => group.account_id === this.values[2] && group.resolved_vendor_customer_id === this.values[3]);
        if (referenced) return { success: true, meta: { changes: 0 } };
      }
      table.delete(String(this.values[0]));
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }
}

class ImportDb {
  role: 'owner' | 'staff' | 'viewer' = 'owner';
  terminalizeNextGuardedWrite = false;
  reserveNextGuardedWrite = false;
  vendorWinnerBeforeInsert: Row | null = null;
  evidenceWinnerBeforeGuard = false;
  terminalizeAfterVendorInsert = false;
  moveVendorItemBeforePatch: { itemId: string; groupId: string } | null = null;
  rewriteVendorItemBeforePatch: { itemId: string; parsedData: Record<string, unknown> } | null = null;
  inBatch = false;
  pendingVendorTerminalization: string | null = null;
  batches = new Map<string, Row>();
  sources = new Map<string, Row>();
  items = new Map<string, Row>();
  compass = new Map<string, Row>();
  products = new Map<string, Row>();
  groups = new Map<string, Row>();
  customers = new Map<string, Row>();
  journeys = new Map<string, Row>();
  visits = new Map<string, Row>();
  tableFor(sql: string) {
    if (sql.trimStart().startsWith('delete from customers')) return this.customers;
    if (sql.includes('curate_import_sources')) return this.sources;
    if (sql.includes('curate_import_items')) return this.items;
    if (sql.includes('curate_import_vendor_groups')) return this.groups;
    if (sql.includes('customers')) return this.customers;
    if (sql.includes('tea_compass_entries')) return this.compass;
    if (sql.includes('products')) return this.products;
    if (sql.includes('curate_import_batches')) return this.batches;
    if (sql.includes('curate_journeys')) return this.journeys;
    if (sql.includes('curate_visits')) return this.visits;
    return null;
  }
  prepare(sql: string) { return new ImportStatement(sql, this); }
  async batch(statements: ImportStatement[]) {
    const snapshots = [this.batches, this.sources, this.items, this.compass, this.products, this.groups, this.customers, this.journeys, this.visits].map(table => new Map([...table].map(([id, row]) => [id, { ...row }])));
    try {
      this.inBatch = true;
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.inBatch = false;
      if (this.pendingVendorTerminalization) {
        const batch = this.batches.get(this.pendingVendorTerminalization);
        if (batch) batch.finalize_idempotency_key = 'finish-key';
        this.pendingVendorTerminalization = null;
      }
      return results;
    }
    catch (error) {
      this.inBatch = false;
      this.pendingVendorTerminalization = null;
      [this.batches, this.sources, this.items, this.compass, this.products, this.groups, this.customers, this.journeys, this.visits] = snapshots;
      throw error;
    }
  }
}

async function reserveImportFinalization(db: ImportDb, batchId: string, key = 'finish-key') {
  return db.prepare("UPDATE curate_import_batches SET finalize_idempotency_key = ?, analysis_attempt_token = NULL, analysis_state = CASE WHEN analysis_state = 'analyzing' THEN 'complete' ELSE analysis_state END WHERE id = ? AND account_id = ? AND review_state NOT IN ('completed', 'abandoned') AND (finalize_idempotency_key IS NULL OR finalize_idempotency_key = ?)")
    .bind(key, batchId, 'account-a', key).run();
}

async function completeImportFinalization(db: ImportDb, batchId: string, key = 'finish-key') {
  return db.prepare("UPDATE curate_import_batches SET review_state = 'completed', finalize_idempotency_key = ?, finalize_result_json = ?, analysis_state = CASE WHEN analysis_state = 'analyzing' THEN 'complete' ELSE analysis_state END, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND account_id = ? AND (finalize_idempotency_key IS NULL OR finalize_idempotency_key = ?)")
    .bind(key, '{"receipts":[]}', batchId, 'account-a', key).run();
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
let legacyIdempotencySequence = 0;
async function request(db: ImportDb, path: string, init: RequestInit = {}, accountId = 'account-a', userId = 'user-a', bucket?: R2Bucket) {
  if (init.body && typeof init.body === 'string' && init.method === 'POST' && (path === '/api/curate/imports' || /\/sources$/.test(path))) {
    const body = JSON.parse(init.body);
    if (!body.idempotency_key) init = { ...init, body: JSON.stringify({ ...body, idempotency_key: `legacy-test-${++legacyIdempotencySequence}` }) };
  }
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await token(userId, accountId)}`);
  headers.set('X-Teajia-Account', accountId);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://test.dev${path}`, { ...init, headers }), { DB: db, JWT_SECRET, MEDIA_BUCKET: bucket, ANTHROPIC_API_KEY: 'test-anthropic-key' } as any);
}

function itemProposal(sourceItemId: string, evidenceRef = 'source') {
  return {
    sourceItemId, category: 'tea', originalName: '台灣茶', englishName: 'Taiwan Tea', packWeight: 100,
    weightUnit: 'g', packCount: 1, priceAmount: 20, currency: 'USD', priceBasis: 'line_total',
    confidence: {}, uncertainty: {}, evidenceRefs: [evidenceRef],
    acquired: true, duplicateResolution: 'unresolved',
  };
}

describe('Curate import provenance API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns the finalized Journey through the HTTP response', async () => {
    const db = new ImportDb();
    db.batches.set('batch-finalized', {
      id: 'batch-finalized', account_id: 'account-a', created_by_user_id: 'user-a', review_state: 'completed',
      finalize_idempotency_key: 'finish-key', finalize_result_json: JSON.stringify({
        batchId: 'batch-finalized', idempotencyKey: 'finish-key',
        journey: { id: 'journey-a', name: 'Taiwan · Spring · 2026' }, receipts: [], items: [],
      }),
    });

    const result = await request(db, '/api/curate/imports/batch-finalized/finalize', {
      method: 'POST', body: JSON.stringify({ idempotency_key: 'finish-key' }),
    });

    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ journey: { id: 'journey-a', name: 'Taiwan · Spring · 2026' } });
  });

  it('leaves a batch editable after recoverable holding validation fails before reservation', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Correct stale holding', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    const item = db.items.get(items[0].id)!;
    Object.assign(db.batches.get(batch.id)!, { review_state: 'reviewing', analysis_state: 'complete' });
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a', resolved_vendor_customer_id: 'vendor-a', vendor_name: 'Vendor A', vendor_tags: '["vendor"]' });
    Object.assign(item, {
      vendor_group_id: 'group-a',
      parsed_data_json: JSON.stringify({ duplicateResolution: 'matched', proposedCompassEntryId: 'entry-a', proposedProductId: 'holding-stale', totalQuantityGrams: 100, packCount: 1, lineCost: 20, currency: 'USD', unitCost: 0.2, inventoryPurpose: 'working', blockingFields: [] }),
    });
    db.compass.set('entry-a', { id: 'entry-a', account_id: 'account-a', user_id: 'user-a', category: 'tea', name: 'Tea' });
    db.products.set('holding-stale', { id: 'holding-stale', account_id: 'account-a', type: 'Oolong', inventory_purpose: 'working', source_compass_entry_id: 'entry-other' });

    const failed = await request(db, `/api/curate/imports/${batch.id}/finalize`, { method: 'POST', body: JSON.stringify({ idempotency_key: 'finish-stale' }) });

    expect(failed.status).toBe(409);
    expect(await failed.json()).toMatchObject({ code: 'validation_failed', issues: [expect.objectContaining({ field: 'product', itemId: item.id })] });
    expect(db.batches.get(batch.id)?.finalize_idempotency_key).toBeUndefined();
    const correction = await request(db, `/api/curate/imports/${batch.id}/items/${item.id}`, { method: 'PUT', body: JSON.stringify({ name: 'Corrected tea' }) });
    expect(correction.status).toBe(200);
  });

  it('analyzes account-scoped evidence into ordered vendor groups and normalized items', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({
      title: 'Chen list', journey_id: null, source_kind: 'paste', pasted_text: '云南古树生普 500g ×2 ¥380',
    }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: '1 tea found', language: 'zh', groups: [{ key: 'chen', proposedVendorName: 'Chen Family Tea', items: [{
        sourceItemId: 'line-1', category: 'tea', originalName: '云南古树生普', englishName: 'Yunnan Ancient Tree Raw Pu’er',
        packWeight: 500, weightUnit: 'g', packCount: 2, priceAmount: 380, currency: 'CNY', priceBasis: 'per_pack',
        confidence: { originalName: 0.99 }, uncertainty: {}, evidenceRefs: [`${sources[0].id}:0-15`],
      }]}],
    }) }] }), { status: 200 }));
    const analyzed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' });
    expect(analyzed.status).toBe(200);
    expect(await analyzed.json()).toMatchObject({
      batch: { id: batch.id, analysis_state: 'complete', analysis_language: 'zh' },
      groups: [{ position: 0, proposed_vendor_name: 'Chen Family Tea' }],
      items: [{ parsed_data: { totalQuantityGrams: 1000, lineCost: 760, currency: 'CNY' } }],
    });
  });

  it('ingests an unrepresentable provider decimal as exact string provenance', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Exact price', pasted_text: 'Collector lot' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [{ ...itemProposal('exact-money', sources[0].id), priceAmount: '999999999999999.99' }] }],
    }) }] }), { status: 200 }));
    const analyzed = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    expect(analyzed.items[0].parsed_data).toMatchObject({ priceAmountExact: '999999999999999.99', lineCostExact: '999999999999999.99', priceAmount: null, lineCost: null });
  });

  it('sends only account vendor candidates and auto-resolves exact but not weak matches', async () => {
    const db = new ImportDb();
    db.customers.set('vendor-a', { id: 'vendor-a', account_id: 'account-a', name: 'Chen Family Tea', company: 'Chen', tags: '["vendor"]' });
    db.customers.set('vendor-b', { id: 'vendor-b', account_id: 'account-b', name: 'Foreign Vendor', tags: '["vendor"]' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Vendors', pasted_text: 'two lists' }) });
    const { batch, sources } = await created.json() as any;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: '2 teas', language: 'en', groups: [
        { key: 'exact', proposedVendorName: 'Chen Family Tea', items: [{ ...itemProposal('one', sources[0].id), sourceItemId: 'one' }] },
        { key: 'weak', proposedVendorName: 'Chen Family', items: [{ ...itemProposal('two', sources[0].id), sourceItemId: 'two' }] },
      ],
    }) }] }), { status: 200 }));
    const analyzed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' });
    expect(analyzed.status).toBe(200);
    const body = await analyzed.json() as any;
    expect(body.groups[0]).toMatchObject({ resolved_vendor_customer_id: 'vendor-a', vendor_confidence: 1 });
    expect(body.groups[1]).toMatchObject({ resolved_vendor_customer_id: null, vendor_confidence: 0.72 });
    const aiRequest = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const prompt = aiRequest.messages[0].content.at(-1).text;
    expect(prompt).toContain('vendor-a');
    expect(prompt).not.toContain('vendor-b');
  });

  it('reuses an exact account-scoped Compass identity and holding', async () => {
    const db = new ImportDb();
    db.compass.set('entry-exact', { id: 'entry-exact', account_id: 'account-a', user_id: 'user-a', name: 'Taiwan Tea', chinese_name: '台灣茶', category: 'tea', type: 'Oolong', form: 'loose', year: 2025, origin_region: 'Nantou', vendor_name: 'V', draft_product_id: 'product-exact' });
    db.products.set('product-exact', { id: 'product-exact', account_id: 'account-a', source_compass_entry_id: 'entry-exact', type: 'Oolong', inventory_purpose: 'working' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Identity', pasted_text: 'Taiwan Tea' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [{ ...itemProposal('identity-source', sources[0].id), chineseName: '台灣茶', type: 'Oolong', form: 'loose', year: 2025, originRegion: 'Nantou' }] }],
    }) }] }), { status: 200 }));
    const analyzed = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    expect(analyzed.items[0].parsed_data).toMatchObject({ duplicateResolution: 'matched', proposedCompassEntryId: 'entry-exact', proposedProductId: 'product-exact' });
    expect(analyzed.items[0].parsed_data.blockingFields).not.toContain('duplicateResolution');
  });

  it('reuses a draft holding only when account, category, purpose, and identity all match', () => {
    const item = { category: 'tea', purpose: 'working' } as const;
    const valid = { account_id: 'account-a', type: 'Oolong', inventory_purpose: 'working', source_compass_entry_id: 'entry-a' };
    expect(holdingMatchesImportIdentity(valid, item, 'entry-a', 'account-a')).toBe(true);
    expect(holdingMatchesImportIdentity({ ...valid, account_id: 'account-b' }, item, 'entry-a', 'account-a')).toBe(false);
    expect(holdingMatchesImportIdentity({ ...valid, type: 'Teaware' }, item, 'entry-a', 'account-a')).toBe(false);
    expect(holdingMatchesImportIdentity({ ...valid, inventory_purpose: 'sample' }, item, 'entry-a', 'account-a')).toBe(false);
    expect(holdingMatchesImportIdentity({ ...valid, source_compass_entry_id: 'entry-stale' }, item, 'entry-a', 'account-a')).toBe(false);
  });

  it('does not auto-match a generic-name tie', async () => {
    const db = new ImportDb();
    db.compass.set('entry-a', { id: 'entry-a', account_id: 'account-a', user_id: 'user-a', name: 'Green Tea', category: 'tea', year: 2024, origin_region: 'Zhejiang' });
    db.compass.set('entry-b', { id: 'entry-b', account_id: 'account-a', user_id: 'user-a', name: 'Green Tea', category: 'tea', year: 2024, origin_region: 'Zhejiang' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Tie', pasted_text: 'Green Tea' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [{ ...itemProposal('tie', sources[0].id), originalName: 'Green Tea', englishName: 'Green Tea', year: 2024, originRegion: 'Zhejiang' }] }],
    }) }] }), { status: 200 }));
    const analyzed = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    expect(analyzed.items[0].parsed_data).toMatchObject({ duplicateResolution: 'unresolved' });
  });

  it('auto-matches only the unique composite winner and links its holding through source_compass_entry_id', async () => {
    const db = new ImportDb();
    db.compass.set('entry-winner', { id: 'entry-winner', account_id: 'account-a', user_id: 'user-a', name: 'Spring Jade', chinese_name: '春玉', category: 'tea', type: 'Green', form: 'loose', year: 2025, origin_region: 'Zhejiang', vendor_name: 'Lin Tea' });
    db.compass.set('entry-other', { id: 'entry-other', account_id: 'account-a', user_id: 'user-a', name: 'Spring Jade', chinese_name: '春玉', category: 'tea', type: 'White', form: 'cake', year: 2021, origin_region: 'Fujian', vendor_name: 'Other' });
    db.products.set('product-linked', { id: 'product-linked', account_id: 'account-a', source_compass_entry_id: 'entry-winner', type: 'Green', inventory_purpose: 'working' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Composite', pasted_text: 'Spring Jade' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'lin', proposedVendorName: 'Lin Tea', items: [{ ...itemProposal('winner', sources[0].id), originalName: '春玉', englishName: 'Spring Jade', chineseName: '春玉', type: 'Green', form: 'loose', year: 2025, originRegion: 'Zhejiang' }] }],
    }) }] }), { status: 200 }));
    const analyzed = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    expect(analyzed.items[0].parsed_data).toMatchObject({ duplicateResolution: 'matched', proposedCompassEntryId: 'entry-winner', proposedProductId: 'product-linked' });
  });

  it('does not merge an exact-name candidate that contradicts material tea attributes', async () => {
    const db = new ImportDb();
    db.compass.set('entry-conflict', { id: 'entry-conflict', account_id: 'account-a', user_id: 'user-a', name: 'Spring Jade', chinese_name: '春玉', category: 'tea', type: 'White', form: 'cake', year: 2020, origin_region: 'Zhejiang', vendor_name: 'Lin Tea' });
    db.products.set('product-conflict', { id: 'product-conflict', account_id: 'account-a', source_compass_entry_id: 'entry-conflict', given_name: 'Spring Jade', chinese_name: '春玉', type: 'White', form: 'cake', year: '2020', origin_country: 'China', origin_region: 'Zhejiang', vendor: 'Lin Tea', inventory_purpose: 'working' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Contradiction', pasted_text: 'Spring Jade' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'lin', proposedVendorName: 'Lin Tea', items: [{ ...itemProposal('conflict', sources[0].id), originalName: '春玉', englishName: 'Spring Jade', chineseName: '春玉', type: 'Green', form: 'loose', year: 2025, originCountry: 'China', originRegion: 'Zhejiang' }] }],
    }) }] }), { status: 200 }));
    const analyzed = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    expect(analyzed.items[0].parsed_data).toMatchObject({ duplicateResolution: 'unresolved', proposedCompassEntryId: 'entry-conflict', proposedProductId: null });
  });

  it('bounds locally-selected candidates and excludes vendor contact details from the provider prompt', async () => {
    const db = new ImportDb();
    for (let index = 0; index < 80; index++) {
      db.customers.set(`vendor-${index}`, { id: `vendor-${index}`, account_id: 'account-a', name: `Vendor ${index}`, email: `private${index}@example.com`, phone: `+62812${index}`, whatsapp: `wa-${index}`, tags: '["vendor"]' });
      db.compass.set(`entry-${index}`, { id: `entry-${index}`, account_id: 'account-a', user_id: 'user-a', name: `Tea ${index}`, category: 'tea' });
    }
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Private', pasted_text: 'Tea 0' }) });
    const { batch, sources } = await created.json() as any;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'Vendor 0', items: [itemProposal('private', sources[0].id)] }] }) }] }), { status: 200 }));
    expect((await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).status).toBe(200);
    const prompt = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).messages[0].content.at(-1).text;
    expect(prompt).not.toMatch(/private\d+@example\.com|\+62812|wa-\d+/);
    expect((prompt.match(/"id":"vendor-/g) ?? [])).toHaveLength(50);
    expect((prompt.match(/"id":"entry-/g) ?? [])).toHaveLength(50);
  });

  it('sends stored text files as extracted text rather than only an R2 key', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Text file' }) });
    const { batch, sources } = await created.json() as any;
    db.sources.set('source-text', { id: 'source-text', batch_id: batch.id, account_id: 'account-a', created_by_user_id: 'user-a', kind: 'file', pasted_text: null, r2_object_key: `curate/account-a/${batch.id}/vendor.csv`, metadata_json: '{"content_type":"text/csv"}' });
    const bucket = { get: async () => ({ body: new Response('name,weight\nTaiwan Tea,500g').body }) } as unknown as R2Bucket;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('csv-1', 'source-text')] }] }) }] }), { status: 200 }));
    expect((await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' }, 'account-a', 'user-a', bucket)).status).toBe(200);
    const aiBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(aiBody.messages[0].content.at(-1).text).toContain('name,weight\\nTaiwan Tea,500g');
  });

  it('rejects analysis when the batch has no usable evidence', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Empty' }) });
    const { batch, sources } = await created.json() as any;
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const analyzed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' });
    expect(analyzed.status).toBe(422);
    expect(await analyzed.json()).toMatchObject({ code: 'analysis_no_usable_evidence' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists guarded per-source outcomes when no source is usable', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Only unusable sources' }) });
    const { batch } = await created.json() as any;
    db.sources.set('word', { id: 'word', batch_id: batch.id, account_id: 'account-a', kind: 'file', pasted_text: null, r2_object_key: `curate/account-a/${batch.id}/word`, analysis_status: 'pending', analysis_error: null, metadata_json: JSON.stringify({ content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) });
    db.sources.set('missing', { id: 'missing', batch_id: batch.id, account_id: 'account-a', kind: 'file', pasted_text: null, r2_object_key: `curate/account-a/${batch.id}/missing`, analysis_status: 'pending', analysis_error: null, metadata_json: JSON.stringify({ content_type: 'application/pdf' }) });
    const bucket = { get: async () => null } as unknown as R2Bucket;

    const analyzed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' }, 'account-a', 'user-a', bucket);

    expect(analyzed.status).toBe(422);
    expect(db.sources.get('word')).toMatchObject({ analysis_status: 'reference_only', analysis_error: null });
    expect(db.sources.get('missing')).toMatchObject({ analysis_status: 'failed', analysis_error: 'analysis_evidence_unavailable' });
  });

  it('keeps DOC and DOCX reference-only while analyzing usable pasted and PDF evidence', async () => {
    for (const contentType of ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']) {
      const db = new ImportDb();
      const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Mixed evidence', pasted_text: 'Shan Lin Xi' }) });
      const { batch, sources } = await created.json() as any;
      db.sources.set('word', { id: 'word', batch_id: batch.id, account_id: 'account-a', kind: 'file', pasted_text: null, r2_object_key: `curate/account-a/${batch.id}/word`, analysis_status: 'pending', metadata_json: JSON.stringify({ content_type: contentType, filename: 'notes.docx' }) });
      db.sources.set('pdf', { id: 'pdf', batch_id: batch.id, account_id: 'account-a', kind: 'invoice', pasted_text: null, r2_object_key: `curate/account-a/${batch.id}/pdf`, analysis_status: 'pending', metadata_json: JSON.stringify({ content_type: 'application/pdf', filename: 'invoice.pdf', page_count: 2 }) });
      const bucket = { get: async (key: string) => ({ body: new Response(key.endsWith('/pdf') ? '%PDF-useful' : 'word-binary').body }) } as unknown as R2Bucket;
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
        overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('one', `${sources[0].id}:0-10`)] }],
      }) }] }), { status: 200 }));
      const analyzed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' }, 'account-a', 'user-a', bucket);
      expect(analyzed.status).toBe(200);
      expect(db.sources.get('word')).toMatchObject({ analysis_status: 'reference_only', analysis_error: null });
      expect(db.sources.get('pdf')).toMatchObject({ analysis_status: 'analyzed', analysis_error: null });
    }
  });

  it('marks an oversized source failed without aborting other usable evidence', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Partial', pasted_text: 'Ali Shan' }) });
    const { batch, sources } = await created.json() as any;
    db.sources.set('oversized', { id: 'oversized', batch_id: batch.id, account_id: 'account-a', kind: 'invoice', pasted_text: null, r2_object_key: `curate/account-a/${batch.id}/big`, analysis_status: 'pending', metadata_json: JSON.stringify({ content_type: 'application/pdf', size: 6 * 1024 * 1024 }) });
    const bucket = { get: async () => ({ body: new Response(new Uint8Array(6 * 1024 * 1024)).body }) } as unknown as R2Bucket;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('one', `${sources[0].id}:0-7`)] }],
    }) }] }), { status: 200 }));

    expect((await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' }, 'account-a', 'user-a', bucket)).status).toBe(200);
    expect(db.sources.get('oversized')).toMatchObject({ analysis_status: 'failed', analysis_error: 'analysis_media_too_large' });
  });

  it('caps aggregate evidence source count before calling the AI provider', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Too many', pasted_text: 'seed' }) });
    const { batch } = await created.json() as any;
    for (let index = 0; index < 50; index++) db.sources.set(`extra-${index}`, { id: `extra-${index}`, batch_id: batch.id, account_id: 'account-a', kind: 'paste', pasted_text: 'tea', metadata_json: '{}' });
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const analyzed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' });
    expect(analyzed.status).toBe(502);
    expect(await analyzed.json()).toMatchObject({ code: 'analysis_too_many_sources' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects AI evidence references that do not name a source in the batch', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Refs', pasted_text: 'Taiwan Tea' }) });
    const { batch } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [{ ...itemProposal('one'), evidenceRefs: ['foreign-source:1-2'] }] }],
    }) }] }), { status: 200 }));
    const analyzed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' });
    expect(analyzed.status).toBe(502);
    expect(await analyzed.json()).toMatchObject({ code: 'analysis_invalid_evidence_reference' });
  });

  it.each([
    ['provider error', (_sourceId: string) => new Response('provider unavailable', { status: 500 })],
    ['malformed provider JSON', (_sourceId: string) => new Response(JSON.stringify({ content: [{ type: 'text', text: '{not-json' }] }), { status: 200 })],
    ['invalid provider references', (_sourceId: string) => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'bad refs', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('line-1', 'foreign:0-2')] }] }) }] }), { status: 200 })],
  ])('marks prepared evidence failed and retryable after %s', async (_label, failureResponse) => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Retry provider failure', pasted_text: 'Retry tea evidence' }) });
    const { batch, sources } = await created.json() as any;
    const sourceId = sources[0].id;
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(failureResponse(sourceId))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'recovered', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('line-1', `${sourceId}:0-5`)] }] }) }] }), { status: 200 }));

    const failed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' });
    expect(failed.status).toBe(502);
    expect(db.sources.get(sourceId)).toMatchObject({ analysis_status: 'failed' });
    expect(db.sources.get(sourceId)?.analysis_error).toBeTruthy();

    const retried = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST', body: JSON.stringify({ source_ids: [sourceId] }) });
    expect(retried.status).toBe(200);
    expect(db.sources.get(sourceId)).toMatchObject({ analysis_status: 'analyzed', analysis_error: null });
  });

  it('rejects invalid text ranges and PDF page references and persists valid structured references', async () => {
    const cases = ['source:99-120', 'pdf:page=3'];
    for (const evidenceRef of cases) {
      const db = new ImportDb();
      const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Refs', pasted_text: 'Short text' }) });
      const { batch, sources } = await created.json() as any;
      const sourceId = sources[0].id;
      db.sources.set('pdf', { id: 'pdf', batch_id: batch.id, account_id: 'account-a', kind: 'invoice', pasted_text: null, r2_object_key: `curate/account-a/${batch.id}/pdf`, metadata_json: JSON.stringify({ content_type: 'application/pdf', page_count: 2 }) });
      const bucket = { get: async () => ({ body: new Response('%PDF-two-pages').body }) } as unknown as R2Bucket;
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('one', evidenceRef === 'source:99-120' ? `${sourceId}:99-120` : evidenceRef)] }] }) }] }), { status: 200 }));
      const analyzed = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' }, 'account-a', 'user-a', bucket);
      expect(analyzed.status).toBe(502);
      expect(await analyzed.json()).toMatchObject({ code: 'analysis_invalid_evidence_reference' });
      vi.restoreAllMocks();
    }

    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Valid refs', pasted_text: 'Short text' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('one', `${sources[0].id}:0-5`)] }] }) }] }), { status: 200 }));
    expect((await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).status).toBe(200);
    expect(db.sources.get(sources[0].id)?.reference_metadata_json).toContain(`${sources[0].id}:0-5`);
  });

  it('preserves manually corrected parsed fields across safe analysis reruns', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Rerun', pasted_text: '500g x2' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'vendor', proposedVendorName: 'Vendor', items: [itemProposal('stable-source', sources[0].id)] }],
    }) }] }), { status: 200 }));
    const first = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    const reviewed = { ...first.items[0].parsed_data, englishName: 'My corrected inventory name' };
    expect((await request(db, `/api/curate/imports/${batch.id}/items/${first.items[0].id}`, { method: 'PUT', body: JSON.stringify({ parsed_data: reviewed }) })).status).toBe(200);
    const rerun = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    expect(rerun.items).toHaveLength(1);
    expect(rerun.items[0].parsed_data.englishName).toBe('My corrected inventory name');
    expect(rerun.items[0].manually_corrected_fields).toContain('parsed_data.englishName');
  });

  it('recomputes client-edited totals and blockers instead of trusting submitted derived fields', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Derived trust', items: [{
      name: 'Tea', parsed_data: itemProposal('source-derived'),
    }] }) });
    const { batch, items } = await created.json() as any;
    const malicious = { ...items[0].parsed_data, packCount: null, priceBasis: 'unknown', totalQuantityGrams: 999999, lineCost: 1, unitCost: 0.000001, blockingFields: [] };
    const updated = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ parsed_data: malicious }) });
    expect(updated.status).toBe(200);
    const body = await updated.json() as any;
    expect(body.parsed_data).toMatchObject({ totalQuantityGrams: null, lineCost: null, unitCost: null });
    expect(body.parsed_data.blockingFields).toEqual(expect.arrayContaining(['packCount', 'priceBasis']));
  });

  it('clears a material confidence blocker when the user explicitly corrects that field', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Confidence review', pasted_text: 'Tea USD 20' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'vendor', proposedVendorName: 'Vendor', items: [{ ...itemProposal('confidence', sources[0].id), confidence: { priceAmount: 0.5, currency: 0.5 } }] }],
    }) }] }), { status: 200 }));
    const analyzed = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    expect(analyzed.items[0].parsed_data.blockingFields).toContain('priceAmount');
    const corrected = buildImportCorrectionParsedData(analyzed.items[0].parsed_data, {
      englishName: analyzed.items[0].parsed_data.englishName, originalName: analyzed.items[0].parsed_data.originalName,
      type: analyzed.items[0].parsed_data.type, classification: analyzed.items[0].parsed_data.classification,
      year: analyzed.items[0].parsed_data.year, form: analyzed.items[0].parsed_data.form, originRegion: analyzed.items[0].parsed_data.originRegion,
      description: analyzed.items[0].parsed_data.description, inventoryPurpose: 'working', compassSelection: 'new', productSelection: 'new',
      acquired: true, packWeight: 100, weightUnit: 'g', packCount: 1, priceAmount: '21.5', currency: 'USD', priceBasis: 'line_total',
    });
    expect(corrected).toMatchObject({ priceAmount: '21.5', priceAmountExact: '21.5' });
    const response = await request(db, `/api/curate/imports/${batch.id}/items/${analyzed.items[0].id}`, { method: 'PUT', body: JSON.stringify({ parsed_data: corrected }) });
    expect(response.status).toBe(200);
    const reviewed = await response.json() as any;
    expect(reviewed.parsed_data.priceAmountExact).toBe('21.5');
    expect(reviewed.parsed_data.blockingFields).not.toContain('priceAmount');
    expect(reviewed.parsed_data.blockingFields).toContain('currency');
    expect(reviewed.parsed_data.confidence).not.toHaveProperty('priceAmount');
    const affirmed = await request(db, `/api/curate/imports/${batch.id}/items/${analyzed.items[0].id}`, { method: 'PUT', body: JSON.stringify({ reviewed_fields: ['currency'] }) });
    expect(affirmed.status).toBe(200);
    expect((await affirmed.json() as any).parsed_data.blockingFields).not.toContain('currency');
  });

  it('does not clear price confidence for a semantically unchanged price during an unrelated edit', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Unrelated edit', pasted_text: 'Tea USD 21.5' }) });
    const { batch, sources } = await created.json() as any;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'one', language: 'en', groups: [{ key: 'vendor', proposedVendorName: 'Vendor', items: [{ ...itemProposal('unchanged-money', sources[0].id), priceAmount: '21.5', confidence: { priceAmount: 0.5 } }] }],
    }) }] }), { status: 200 }));
    const analyzed = await (await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).json() as any;
    const unchanged = buildImportCorrectionParsedData(analyzed.items[0].parsed_data, {
      englishName: analyzed.items[0].parsed_data.englishName, originalName: analyzed.items[0].parsed_data.originalName,
      type: analyzed.items[0].parsed_data.type, classification: analyzed.items[0].parsed_data.classification, year: analyzed.items[0].parsed_data.year,
      form: analyzed.items[0].parsed_data.form, originRegion: analyzed.items[0].parsed_data.originRegion, description: 'Edited description',
      inventoryPurpose: 'working', compassSelection: 'new', productSelection: 'new', acquired: true, packWeight: 100, weightUnit: 'g', packCount: 1,
      priceAmount: '21.5', currency: 'USD', priceBasis: 'line_total',
    });
    const response = await request(db, `/api/curate/imports/${batch.id}/items/${analyzed.items[0].id}`, { method: 'PUT', body: JSON.stringify({ parsed_data: unchanged }) });
    expect(response.status).toBe(200);
    expect((await response.json() as any).parsed_data.blockingFields).toContain('priceAmount');
  });

  it('clears identity confidence when identity or holding selection is explicit', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Identity review', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    const parsed = { ...itemProposal('identity-review'), inventoryPurpose: 'working', duplicateResolution: 'unresolved', proposedCompassEntryId: null, proposedProductId: null, confidence: { identity: 0.4 }, uncertainty: { identity: 'two possible records' }, blockingFields: ['identity', 'duplicateResolution'] };
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify(parsed);
    const selected = { ...parsed, duplicateResolution: 'matched', proposedCompassEntryId: 'entry-a', proposedProductId: 'product-a' };
    const response = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ parsed_data: selected }) });
    expect(response.status).toBe(200);
    const reviewed = await response.json() as any;
    expect(reviewed.parsed_data.blockingFields).not.toContain('identity');
    expect(reviewed.parsed_data.confidence).not.toHaveProperty('identity');
    expect(reviewed.parsed_data.uncertainty).not.toHaveProperty('identity');
  });

  it('clears unchanged proposed identity confidence only with explicit identity affirmation', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Identity affirmation', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    const parsed = { ...itemProposal('identity-affirmation'), inventoryPurpose: 'working', duplicateResolution: 'matched', proposedCompassEntryId: 'entry-a', proposedProductId: 'product-a', confidence: { identity: 0.4 }, uncertainty: { identity: 'match needs confirmation' }, blockingFields: ['identity'] };
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify(parsed);
    const response = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ parsed_data: parsed, reviewed_fields: ['identity'] }) });
    expect(response.status).toBe(200);
    const reviewed = await response.json() as any;
    expect(reviewed.parsed_data.blockingFields).not.toContain('identity');
    expect(reviewed.parsed_data.confidence).not.toHaveProperty('identity');
    expect(reviewed.parsed_data.uncertainty).not.toHaveProperty('identity');
  });

  it('rejects unknown explicit review fields', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Invalid affirmation', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    const response = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ reviewed_fields: ['not-a-review-field'] }) });
    expect(response.status).toBe(400);
  });

  it('rejects contradictory exact prices and ignores equivalent derived-only changes for review', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Exact price integrity', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    const parsed = { ...itemProposal('exact-integrity'), inventoryPurpose: 'working', priceAmount: '21.5', priceAmountExact: '21.5', confidence: { priceAmount: 0.4 }, uncertainty: { priceAmount: 'confirm price' }, blockingFields: ['priceAmount'] };
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify(parsed);
    const contradictory = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ parsed_data: { ...parsed, priceAmountExact: '22' } }) });
    expect(contradictory.status).toBe(400);
    const equivalent = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ parsed_data: { ...parsed, priceAmountExact: '21.500' } }) });
    expect(equivalent.status).toBe(200);
    expect((await equivalent.json() as any).parsed_data.blockingFields).toContain('priceAmount');
  });

  it('accepts reviewed-fields-only identity confirmation for exact-only stored money', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Exact identity review', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    const parsed = { ...itemProposal('exact-identity'), inventoryPurpose: 'working', priceAmount: null, priceAmountExact: '999999999999999.99', duplicateResolution: 'matched', proposedCompassEntryId: 'entry-a', confidence: { identity: 0.4 }, uncertainty: { identity: 'confirm' }, blockingFields: ['identity'] };
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify(parsed);
    const response = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ reviewed_fields: ['identity'] }) });
    expect(response.status).toBe(200);
    const reviewed = await response.json() as any;
    expect(reviewed.parsed_data).toMatchObject({ priceAmount: null, priceAmountExact: '999999999999999.99' });
    expect(reviewed.parsed_data.blockingFields).not.toContain('identity');
  });

  it('treats explicit vendor selection as authoritative and clears vendor blockers for the group', async () => {
    const db = new ImportDb();
    db.customers.set('vendor-a', { id: 'vendor-a', account_id: 'account-a', name: 'Confirmed Vendor', tags: '["vendor"]' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Vendor review', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a', proposed_vendor_name: 'Maybe Vendor', resolved_vendor_customer_id: null, vendor_confidence: 0.4, uncertainty_json: '{"vendor":"unclear"}' });
    db.items.get(items[0].id)!.vendor_group_id = 'group-a';
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify({ ...itemProposal('vendor-review'), blockingFields: ['vendor'] });
    const response = await request(db, `/api/curate/imports/${batch.id}/groups/group-a`, { method: 'PUT', body: JSON.stringify({ resolved_vendor_customer_id: 'vendor-a' }) });
    expect(response.status).toBe(200);
    expect(db.groups.get('group-a')).toMatchObject({ resolved_vendor_customer_id: 'vendor-a', vendor_confidence: 1, uncertainty_json: '{}' });
    expect(JSON.parse(String(db.items.get(items[0].id)?.parsed_data_json)).blockingFields).not.toContain('vendor');
  });

  it('does not clear vendor review on an item moved during existing-vendor selection', async () => {
    const db = new ImportDb();
    db.customers.set('vendor-a', { id: 'vendor-a', account_id: 'account-a', name: 'Confirmed Vendor', tags: '["vendor"]' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Moved existing vendor', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.groups.set('group-b', { id: 'group-b', batch_id: batch.id, account_id: 'account-a', position: 1, group_key: 'b', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.items.get(items[0].id)!.vendor_group_id = 'group-a';
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify({ ...itemProposal('moved-existing'), confidence: { vendor: 0.4 }, uncertainty: { vendor: 'confirm' }, blockingFields: ['vendor'] });
    db.moveVendorItemBeforePatch = { itemId: items[0].id, groupId: 'group-b' };
    expect((await request(db, `/api/curate/imports/${batch.id}/groups/group-a`, { method: 'PUT', body: JSON.stringify({ resolved_vendor_customer_id: 'vendor-a' }) })).status).toBe(200);
    expect(db.items.get(items[0].id)?.vendor_group_id).toBe('group-b');
    expect(JSON.parse(String(db.items.get(items[0].id)?.parsed_data_json)).blockingFields).toContain('vendor');
  });

  it('preserves newer item JSON during existing-vendor selection', async () => {
    const db = new ImportDb();
    db.customers.set('vendor-a', { id: 'vendor-a', account_id: 'account-a', name: 'Confirmed Vendor', tags: '["vendor"]' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Newer existing vendor', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.items.get(items[0].id)!.vendor_group_id = 'group-a';
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify({ ...itemProposal('older-existing'), blockingFields: ['vendor'] });
    db.rewriteVendorItemBeforePatch = { itemId: items[0].id, parsedData: { ...itemProposal('newer-existing'), description: 'newer analysis', confidence: { vendor: 0.4, year: 0.5 }, uncertainty: { vendor: 'confirm', year: 'confirm year' }, blockingFields: ['vendor', 'year'] } };
    expect((await request(db, `/api/curate/imports/${batch.id}/groups/group-a`, { method: 'PUT', body: JSON.stringify({ resolved_vendor_customer_id: 'vendor-a' }) })).status).toBe(200);
    expect(JSON.parse(String(db.items.get(items[0].id)?.parsed_data_json))).toMatchObject({ description: 'newer analysis', confidence: { year: 0.5 }, uncertainty: { year: 'confirm year' }, blockingFields: ['year'] });
  });

  it('updates group vendors and the optional journey only within the active account', async () => {
    const db = new ImportDb();
    db.customers.set('vendor-a', { id: 'vendor-a', account_id: 'account-a', name: 'Chen', tags: '["vendor"]' });
    db.customers.set('customer-a', { id: 'customer-a', account_id: 'account-a', name: 'Buyer', tags: '[]' });
    db.journeys.set('journey-a', { id: 'journey-a', account_id: 'account-a', name: 'Yunnan' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Review' }) });
    const { batch } = await created.json() as any;
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a', proposed_vendor_name: 'Chen', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    expect((await request(db, `/api/curate/imports/${batch.id}/groups/group-a`, { method: 'PUT', body: JSON.stringify({ resolved_vendor_customer_id: 'customer-a' }) })).status).toBe(400);
    expect((await request(db, `/api/curate/imports/${batch.id}/groups/group-a`, { method: 'PUT', body: JSON.stringify({ resolved_vendor_customer_id: 'vendor-a' }) })).status).toBe(200);
    expect(db.groups.get('group-a')?.resolved_vendor_customer_id).toBe('vendor-a');
    expect((await request(db, `/api/curate/imports/${batch.id}/journey`, { method: 'PUT', body: JSON.stringify({ journey_id: 'journey-a' }) })).status).toBe(200);
    expect(db.batches.get(batch.id)?.journey_id).toBe('journey-a');
    expect((await request(db, `/api/curate/imports/${batch.id}/groups/group-a`, { method: 'PUT', body: JSON.stringify({ resolved_vendor_customer_id: 'vendor-a' }) }, 'account-b', 'user-b')).status).toBe(404);
  });

  it('creates a vendor through the existing customer model and assigns the complete group', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'New vendor', items: [{ name: 'Tea' }] }) });
    const { batch } = await created.json() as any;
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a', proposed_vendor_name: null, resolved_vendor_customer_id: null, vendor_confidence: 0.3, uncertainty_json: '{"vendor":"unclear","origin":"Yunnan or Sichuan"}' });
    const itemId = [...db.items.keys()][0];
    db.items.get(itemId)!.vendor_group_id = 'group-a';
    db.items.get(itemId)!.parsed_data_json = JSON.stringify({ ...itemProposal('create-vendor'), inventoryPurpose: 'working', duplicateResolution: 'new', blockingFields: ['vendor'] });
    const response = await request(db, `/api/curate/imports/${batch.id}/groups/group-a/vendor`, { method: 'POST', body: JSON.stringify({ name: 'New Tea Farm' }) });
    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(db.customers.get(body.vendor.id)).toMatchObject({ account_id: 'account-a', name: 'New Tea Farm', tags: '["vendor"]' });
    expect(db.groups.get('group-a')?.resolved_vendor_customer_id).toBe(body.vendor.id);
    expect(db.groups.get('group-a')).toMatchObject({ vendor_confidence: 1, uncertainty_json: '{"origin":"Yunnan or Sichuan"}' });
    const resolvedParsed = JSON.parse(String(db.items.get(itemId)?.parsed_data_json));
    expect(resolvedParsed.blockingFields).toEqual([]);
    expect(validateImportForFinalization({
      batch: { id: batch.id, accountId: 'account-a', journeyId: null, reviewState: 'reviewing' },
      groups: [{ id: 'group-a', vendorId: String(body.vendor.id), vendorName: 'New Tea Farm', position: 0 }],
      items: [{ id: itemId, groupId: 'group-a', category: 'tea', name: 'Tea', compassEntryId: null, productId: null, duplicateResolution: 'new', quantity: 100, unit: 'g', packCount: 1, lineCost: 20, currency: 'USD', unitCost: 0.2, purpose: 'working', blockingFields: resolvedParsed.blockingFields }],
    })).toEqual([]);
    const retry = await request(db, `/api/curate/imports/${batch.id}/groups/group-a/vendor`, { method: 'POST', body: JSON.stringify({ name: 'New Tea Farm' }) });
    expect(retry.status).toBe(200);
    expect((await retry.json() as any).vendor.id).toBe(body.vendor.id);
    expect(db.customers).toHaveLength(1);
    expect((await request(db, `/api/curate/imports/${batch.id}/groups/group-a/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Changed Farm' }) })).status).toBe(409);
  });

  it('conflicts when a concurrent deterministic vendor winner has a different name', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Vendor race' }) });
    const { batch } = await created.json() as any;
    db.groups.set('group-race', { id: 'group-race', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'race', proposed_vendor_name: null, resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.customers.set('curate-vendor-group-race', { id: 'curate-vendor-group-race', account_id: 'account-a', name: 'First Farm', tags: '["vendor"]' });
    const response = await request(db, `/api/curate/imports/${batch.id}/groups/group-race/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Second Farm' }) });
    expect(response.status).toBe(409);
    expect(db.groups.get('group-race')?.resolved_vendor_customer_id).toBeNull();
  });

  it('reloads the deterministic vendor winner after insert contention before assigning the group', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Vendor insert race' }) });
    const { batch } = await created.json() as any;
    db.groups.set('group-race', { id: 'group-race', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'race', proposed_vendor_name: null, resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.vendorWinnerBeforeInsert = { id: 'curate-vendor-group-race', account_id: 'account-a', name: 'First Farm', tags: '["vendor"]' };

    const loser = await request(db, `/api/curate/imports/${batch.id}/groups/group-race/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Second Farm' }) });

    expect(loser.status).toBe(409);
    expect(db.customers.get('curate-vendor-group-race')?.name).toBe('First Farm');
    expect(db.groups.get('group-race')?.resolved_vendor_customer_id).toBeNull();
  });

  it('converges on a same-name deterministic vendor winner under insert contention', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Same vendor race' }) });
    const { batch } = await created.json() as any;
    db.groups.set('group-same', { id: 'group-same', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'same', proposed_vendor_name: null, resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.vendorWinnerBeforeInsert = { id: 'curate-vendor-group-same', account_id: 'account-a', name: 'Same Farm', tags: '["vendor"]' };

    const result = await request(db, `/api/curate/imports/${batch.id}/groups/group-same/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Same Farm' }) });

    expect(result.status).toBe(201);
    expect(db.groups.get('group-same')?.resolved_vendor_customer_id).toBe('curate-vendor-group-same');
    expect(db.customers).toHaveLength(1);
  });

  it('assigns a deterministic same-name vendor winner despite case differences', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Case winner' }) });
    const { batch } = await created.json() as any;
    db.groups.set('group-case', { id: 'group-case', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'case', proposed_vendor_name: null, resolved_vendor_customer_id: null, uncertainty_json: '{"vendor":"case uncertain","origin":"Fujian"}' });
    db.vendorWinnerBeforeInsert = { id: 'curate-vendor-group-case', account_id: 'account-a', name: 'case farm', tags: '["vendor"]' };
    const result = await request(db, `/api/curate/imports/${batch.id}/groups/group-case/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Case Farm' }) });
    expect(result.status).toBe(201);
    expect(db.groups.get('group-case')).toMatchObject({ resolved_vendor_customer_id: 'curate-vendor-group-case', uncertainty_json: '{"origin":"Fujian"}' });
  });

  it.each([
    ['punctuation', 'Liu-Family Tea', 'Liu Family Tea'],
    ['repeated spacing', 'Liu   Family Tea', 'Liu Family Tea'],
    ['equivalent accents', 'Café Tea', 'Cafe Tea'],
  ])('assigns a deterministic vendor winner with normalized %s', async (_case, winnerName, requestedName) => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Normalized winner' }) });
    const { batch } = await created.json() as any;
    db.groups.set('group-normalized', { id: 'group-normalized', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'normalized', proposed_vendor_name: null, resolved_vendor_customer_id: null, uncertainty_json: '{"vendor":"confirm"}' });
    db.vendorWinnerBeforeInsert = { id: 'curate-vendor-group-normalized', account_id: 'account-a', name: winnerName, tags: '["vendor"]' };
    const result = await request(db, `/api/curate/imports/${batch.id}/groups/group-normalized/vendor`, { method: 'POST', body: JSON.stringify({ name: requestedName }) });
    expect(result.status).toBe(201);
    expect(db.groups.get('group-normalized')?.resolved_vendor_customer_id).toBe('curate-vendor-group-normalized');
  });

  it('does not clear vendor review on an item concurrently moved to another group', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Moved vendor item', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.groups.set('group-b', { id: 'group-b', batch_id: batch.id, account_id: 'account-a', position: 1, group_key: 'b', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.items.get(items[0].id)!.vendor_group_id = 'group-a';
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify({ ...itemProposal('moved'), confidence: { vendor: 0.4 }, uncertainty: { vendor: 'confirm' }, blockingFields: ['vendor'] });
    db.moveVendorItemBeforePatch = { itemId: items[0].id, groupId: 'group-b' };
    expect((await request(db, `/api/curate/imports/${batch.id}/groups/group-a/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Farm A' }) })).status).toBe(201);
    expect(db.items.get(items[0].id)?.vendor_group_id).toBe('group-b');
    expect(JSON.parse(String(db.items.get(items[0].id)?.parsed_data_json)).blockingFields).toContain('vendor');
  });

  it('patches only vendor review fields in concurrently newer item JSON', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Newer vendor item', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await created.json() as any;
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.items.get(items[0].id)!.vendor_group_id = 'group-a';
    db.items.get(items[0].id)!.parsed_data_json = JSON.stringify({ ...itemProposal('older'), blockingFields: ['vendor'] });
    db.rewriteVendorItemBeforePatch = { itemId: items[0].id, parsedData: { ...itemProposal('newer'), description: 'newer analysis', confidence: { vendor: 0.4, year: 0.5 }, uncertainty: { vendor: 'confirm', year: 'confirm year' }, blockingFields: ['vendor', 'year'] } };
    expect((await request(db, `/api/curate/imports/${batch.id}/groups/group-a/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Farm A' }) })).status).toBe(201);
    expect(JSON.parse(String(db.items.get(items[0].id)?.parsed_data_json))).toMatchObject({ description: 'newer analysis', confidence: { year: 0.5 }, uncertainty: { year: 'confirm year' }, blockingFields: ['year'] });
  });

  it('bounds vendor candidates after vendor-tag filtering', async () => {
    const db = new ImportDb();
    for (let index = 0; index < 200; index++) db.customers.set(`buyer-${index}`, { id: `buyer-${index}`, account_id: 'account-a', name: `Buyer ${index}`, tags: '[]' });
    db.customers.set('real-vendor', { id: 'real-vendor', account_id: 'account-a', name: 'Real Tea Vendor', tags: '["vendor"]' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Vendor bound', pasted_text: 'Real Tea Vendor' }) });
    const { batch, sources } = await created.json() as any;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'Real Tea Vendor', items: [itemProposal('bound', sources[0].id)] }] }) }] }), { status: 200 }));
    expect((await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' })).status).toBe(200);
    const prompt = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).messages[0].content.at(-1).text;
    expect(prompt).toContain('real-vendor');
  });

  it('never leaves an orphan vendor when finalization is requested after insert but before assignment', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Vendor terminal race' }) });
    const { batch } = await created.json() as any;
    db.groups.set('group-terminal', { id: 'group-terminal', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'terminal', proposed_vendor_name: null, resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.terminalizeAfterVendorInsert = true;

    const result = await request(db, `/api/curate/imports/${batch.id}/groups/group-terminal/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Atomic Farm' }) });

    const vendor = db.customers.get('curate-vendor-group-terminal');
    const linked = db.groups.get('group-terminal')?.resolved_vendor_customer_id === vendor?.id;
    if (result.status === 409) expect(vendor).toBeUndefined();
    else {
      expect(result.status).toBe(201);
      expect(linked).toBe(true);
    }
  });

  it('does not delete an inserted vendor when a contender assigned it before terminalization', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Vendor contender race' }) });
    const { batch } = await created.json() as any;
    const vendorId = 'curate-vendor-group-terminal';
    db.groups.set('group-terminal', { id: 'group-terminal', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'terminal', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.groups.set('group-contender', { id: 'group-contender', batch_id: batch.id, account_id: 'account-a', position: 1, group_key: 'contender', resolved_vendor_customer_id: vendorId, uncertainty_json: '{}' });
    db.terminalizeAfterVendorInsert = true;

    const result = await request(db, `/api/curate/imports/${batch.id}/groups/group-terminal/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Shared Farm' }) });

    expect(result.status).toBe(409);
    expect(db.customers.get(vendorId)).toMatchObject({ name: 'Shared Farm' });
    expect(db.groups.get('group-contender')?.resolved_vendor_customer_id).toBe(vendorId);
  });
  it('allows viewers to read imports but denies every import mutation', async () => {
    const db = new ImportDb();
    const seeded = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Seed', idempotency_key: 'owner-seed', items: [{ name: 'Tea' }] }) });
    const { batch, items } = await seeded.json() as any;
    db.role = 'viewer';
    expect((await request(db, '/api/curate/imports')).status).toBe(200);
    const mutations: Array<[string, string, unknown?]> = [
      ['POST', '/api/curate/imports', { title: 'Denied', idempotency_key: 'viewer-create' }],
      ['POST', `/api/curate/imports/${batch.id}/abandon`],
      ['POST', `/api/curate/imports/${batch.id}/items`, { name: 'Denied' }],
      ['POST', `/api/curate/imports/${batch.id}/evidence`],
      ['POST', `/api/curate/imports/${batch.id}/sources`, { kind: 'paste', pasted_text: 'Denied', idempotency_key: 'viewer-source' }],
      ['PUT', `/api/curate/imports/${batch.id}/items/${items[0].id}`, { name: 'Denied' }],
      ['POST', `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`],
      ['POST', `/api/curate/imports/${batch.id}/items/${items[0].id}/merge`, { compass_entry_id: 'denied' }],
    ];
    for (const [method, path, body] of mutations) expect((await request(db, path, { method, body: body ? JSON.stringify(body) : undefined })).status, path).toBe(403);
    expect(db.batches).toHaveLength(1);
    expect(db.items.get(items[0].id)?.name).toBe('Tea');
  });
  it('replays import creation and source addition after response loss and rejects key reuse with changed content', async () => {
    const db = new ImportDb();
    const create = (title: string) => request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title, idempotency_key: 'import-device-1' }) });
    const first = await create('Vendor list');
    const original = await first.json() as any;
    const replay = await create('Vendor list');
    expect(replay.status).toBe(200);
    expect((await replay.json() as any).batch.id).toBe(original.batch.id);
    expect((await create('Different list')).status).toBe(409);

    const add = (text: string) => request(db, `/api/curate/imports/${original.batch.id}/sources`, { method: 'POST', body: JSON.stringify({ kind: 'paste', pasted_text: text, idempotency_key: 'source-device-1' }) });
    const sources = await Promise.all([add('one tea'), add('one tea')]);
    expect(sources.map(result => result.status).sort()).toEqual([200, 201]);
    const sourceIds = await Promise.all(sources.map(async result => (await result.json() as any).id));
    expect(new Set(sourceIds).size).toBe(1);
    expect((await add('changed tea')).status).toBe(409);
    expect(db.batches).toHaveLength(1);
    expect(db.sources).toHaveLength(1);
  });
  it('resolves an evidence-only batch by adding a manual item or abandoning it', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Evidence only' }) });
    const { batch } = await created.json() as any;
    const added = await request(db, `/api/curate/imports/${batch.id}/items`, { method: 'POST', body: JSON.stringify({ name: 'Manual tea', category: 'tea' }) });
    expect(added.status).toBe(201);
    const addedItem = await added.json() as any;
    expect(addedItem).toMatchObject({ name: 'Manual tea', category: 'tea', review_state: 'pending' });
    const abandoned = await request(db, `/api/curate/imports/${batch.id}/abandon`, { method: 'POST' });
    expect(abandoned.status).toBe(200);
    expect(db.batches.get(batch.id)?.review_state).toBe('abandoned');
    expect(db.items.get(addedItem.id)?.review_state).toBe('abandoned');
    expect((await (await request(db, '/api/curate/imports?state=incomplete')).json() as any).imports).toHaveLength(0);
  });

  it('rejects every stale mutation after a batch reaches a terminal state', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Terminal', items: [{ name: 'Only' }] }) });
    const { batch, items } = await created.json() as any;
    expect((await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' })).status).toBe(201);
    const mutations: Array<[string, string, unknown?]> = [
      ['POST', `/api/curate/imports/${batch.id}/items`, { name: 'Late', category: 'tea' }],
      ['POST', `/api/curate/imports/${batch.id}/sources`, { kind: 'paste', pasted_text: 'late' }],
      ['POST', `/api/curate/imports/${batch.id}/evidence`],
      ['PUT', `/api/curate/imports/${batch.id}/items/${items[0].id}`, { name: 'Late' }],
      ['POST', `/api/curate/imports/${batch.id}/items/${items[0].id}/merge`, { compass_entry_id: 'x' }],
      ['POST', `/api/curate/imports/${batch.id}/abandon`],
    ];
    for (const [method, path, body] of mutations) expect((await request(db, path, { method, body: body ? JSON.stringify(body) : undefined })).status, path).toBe(409);
    expect((await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' })).status).toBe(409);
    db.items.set('stale-pending', { ...db.items.get(items[0].id), id: 'stale-pending', compass_entry_id: null, review_state: 'pending' } as Row);
    expect((await request(db, `/api/curate/imports/${batch.id}/items/stale-pending/accept`, { method: 'POST' })).status).toBe(409);
    expect(db.batches.get(batch.id)?.review_state).toBe('completed');
  });

  it('rejects writes when abandon wins between the stale read and guarded mutation', async () => {
    for (const operation of ['add', 'update', 'accept'] as const) {
      const db = new ImportDb();
      const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: operation, items: [{ name: 'Race' }] }) });
      const { batch, items } = await created.json() as any;
      db.terminalizeNextGuardedWrite = true;
      const result = operation === 'add'
        ? await request(db, `/api/curate/imports/${batch.id}/items`, { method: 'POST', body: JSON.stringify({ name: 'Late' }) })
        : operation === 'update'
          ? await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ name: 'Late' }) })
          : await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' });
      expect(result.status, operation).toBe(409);
      expect(db.batches.get(batch.id)?.review_state).toBe('abandoned');
      expect(db.items.get(items[0].id)).toMatchObject({ name: 'Race', review_state: 'pending', compass_entry_id: null });
      expect(db.compass.size).toBe(0);
    }
  });

  it('does not let a late analysis overwrite a completed finalization', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({
      title: 'Analysis race', pasted_text: 'Original evidence', items: [{ name: 'Original item' }],
    }) });
    const { batch, sources, items } = await created.json() as any;
    db.groups.set('original-group', { id: 'original-group', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'original', proposed_vendor_name: 'Original vendor', resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    db.items.get(items[0].id)!.vendor_group_id = 'original-group';

    let releaseProvider!: (response: Response) => void;
    const providerResponse = new Promise<Response>(resolve => { releaseProvider = resolve; });
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => providerResponse);
    const analyzing = request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' });
    await vi.waitFor(() => expect(db.batches.get(batch.id)?.analysis_state).toBe('analyzing'));

    expect((await reserveImportFinalization(db, batch.id)).meta.changes).toBe(1);
    expect((await completeImportFinalization(db, batch.id)).meta.changes).toBe(1);
    const completedBatch = { ...db.batches.get(batch.id)! };
    expect(completedBatch.analysis_state).toBe('complete');
    const originalGroups = [...db.groups.values()].map(row => ({ ...row }));
    const originalItems = [...db.items.values()].map(row => ({ ...row }));
    const originalSources = [...db.sources.values()].map(row => ({ ...row }));
    releaseProvider(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'Late rewrite', language: 'en', groups: [{ key: 'late', proposedVendorName: 'Late vendor', items: [itemProposal('late-item', sources[0].id)] }],
    }) }] }), { status: 200 }));

    const result = await analyzing;
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: 'analysis_superseded' });
    expect(db.batches.get(batch.id)).toMatchObject(completedBatch);
    expect([...db.groups.values()]).toEqual(originalGroups);
    expect([...db.items.values()]).toEqual(originalItems);
    expect([...db.sources.values()]).toEqual(originalSources);
  });

  it('retries only requested failed sources without reprocessing successful evidence', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Retry sources' }) });
    const { batch } = await created.json() as any;
    db.sources.set('done', { id: 'done', batch_id: batch.id, account_id: 'account-a', kind: 'file', pasted_text: 'Already processed', r2_object_key: null, analysis_status: 'analyzed', analysis_error: null, reference_metadata_json: JSON.stringify({ references: ['done:0-4'] }), metadata_json: JSON.stringify({ content_type: 'text/plain' }) });
    db.sources.set('failed', { id: 'failed', batch_id: batch.id, account_id: 'account-a', kind: 'file', pasted_text: null, r2_object_key: `curate/account-a/${batch.id}/failed.txt`, analysis_status: 'failed', analysis_error: 'analysis_evidence_unavailable', reference_metadata_json: '{}', metadata_json: JSON.stringify({ content_type: 'text/plain' }) });
    const bucketGets: string[] = [];
    const bucket = { get: async (key: string) => { bucketGets.push(key); return { body: new Response('Recovered tea').body }; } } as unknown as R2Bucket;
    const provider = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'recovered', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('recovered', 'failed:0-9')] }] }) }] }), { status: 200 }));

    const result = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST', body: JSON.stringify({ source_ids: ['failed'] }) }, 'account-a', 'user-a', bucket);

    expect(result.status).toBe(200);
    expect(bucketGets).toEqual([`curate/account-a/${batch.id}/failed.txt`]);
    expect(String(provider.mock.calls[0][1]?.body)).not.toContain('Already processed');
    expect(db.sources.get('done')).toMatchObject({ analysis_status: 'analyzed', analysis_error: null, reference_metadata_json: JSON.stringify({ references: ['done:0-4'] }) });
    expect(db.sources.get('failed')).toMatchObject({ analysis_status: 'analyzed', analysis_error: null });
  });

  it('scopes duplicate provider sourceItemIds to their evidence source during selective retry', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Duplicate source-local ids' }) });
    const { batch } = await created.json() as any;
    db.sources.set('source-a', { id: 'source-a', batch_id: batch.id, account_id: 'account-a', kind: 'paste', pasted_text: 'Alpha evidence', analysis_status: 'failed', metadata_json: '{}' });
    db.sources.set('source-b', { id: 'source-b', batch_id: batch.id, account_id: 'account-a', kind: 'paste', pasted_text: 'Beta evidence', analysis_status: 'failed', metadata_json: '{}' });
    const provider = vi.spyOn(globalThis, 'fetch');
    provider.mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'alpha', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [
      { ...itemProposal('line-1', 'source-a:0-5'), englishName: 'Alpha original' },
    ] }] }) }] }), { status: 200 }));
    expect((await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST', body: JSON.stringify({ source_ids: ['source-a'] }) })).status).toBe(200);
    provider.mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'beta retried', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [
      { ...itemProposal('line-1', 'source-b:0-4'), englishName: 'Beta retried' },
    ] }] }) }] }), { status: 200 }));

    expect((await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST', body: JSON.stringify({ source_ids: ['source-b'] }) })).status).toBe(200);
    const alpha = [...db.items.values()].find(item => item.source_id === 'source-a');
    const beta = [...db.items.values()].find(item => item.source_id === 'source-b');
    expect(JSON.parse(String(alpha?.parsed_data_json)).englishName).toBe('Alpha original');
    expect(JSON.parse(String(beta?.parsed_data_json)).englishName).toBe('Beta retried');
  });

  it('refuses per-source retry for evidence that is not failed', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'No duplicate retry', pasted_text: 'Processed' }) });
    const { batch, sources } = await created.json() as any;
    db.sources.get(sources[0].id)!.analysis_status = 'analyzed';
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const result = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST', body: JSON.stringify({ source_ids: [sources[0].id] }) });

    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: 'analysis_source_not_failed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not turn a superseded provider failure into a generic analysis failure', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Provider race', pasted_text: 'Evidence' }) });
    const { batch } = await created.json() as any;
    let releaseProvider!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(resolve => { releaseProvider = resolve; }));
    const analyzing = request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' });
    await vi.waitFor(() => expect(db.batches.get(batch.id)?.analysis_state).toBe('analyzing'));
    expect((await reserveImportFinalization(db, batch.id)).meta.changes).toBe(1);
    expect((await completeImportFinalization(db, batch.id)).meta.changes).toBe(1);
    releaseProvider(new Response('provider unavailable', { status: 503 }));

    const result = await analyzing;

    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ code: 'analysis_superseded' });
    expect(db.batches.get(batch.id)).toMatchObject({ review_state: 'completed', analysis_state: 'complete', finalize_idempotency_key: 'finish-key' });
  });

  it.each([
    ['Journey assignment', (db: ImportDb, batchId: string) => request(db, `/api/curate/imports/${batchId}/journey`, { method: 'PUT', body: JSON.stringify({ journey_id: 'journey-a' }) })],
    ['group update', (db: ImportDb, batchId: string) => request(db, `/api/curate/imports/${batchId}/groups/group-a`, { method: 'PUT', body: JSON.stringify({ resolved_vendor_customer_id: 'vendor-a' }) })],
    ['vendor creation', (db: ImportDb, batchId: string) => request(db, `/api/curate/imports/${batchId}/groups/group-a/vendor`, { method: 'POST', body: JSON.stringify({ name: 'Late Farm' }) })],
    ['item update', (db: ImportDb, batchId: string, itemId: string) => request(db, `/api/curate/imports/${batchId}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ name: 'Late item' }) })],
    ['item addition', (db: ImportDb, batchId: string) => request(db, `/api/curate/imports/${batchId}/items`, { method: 'POST', body: JSON.stringify({ name: 'Late item' }) })],
    ['source addition', (db: ImportDb, batchId: string) => request(db, `/api/curate/imports/${batchId}/sources`, { method: 'POST', body: JSON.stringify({ kind: 'paste', pasted_text: 'Late source' }) })],
    ['item acceptance', (db: ImportDb, batchId: string, itemId: string) => request(db, `/api/curate/imports/${batchId}/items/${itemId}/accept`, { method: 'POST' })],
    ['item merge', (db: ImportDb, batchId: string, itemId: string) => request(db, `/api/curate/imports/${batchId}/items/${itemId}/merge`, { method: 'POST', body: JSON.stringify({ compass_entry_id: 'entry-merge' }) })],
    ['evidence upload', (db: ImportDb, batchId: string, _itemId: string, bucket: R2Bucket) => request(db, `/api/curate/imports/${batchId}/evidence`, { method: 'POST', body: 'late evidence', headers: { 'Content-Type': 'text/plain', 'X-Filename': 'late.txt', 'X-Client-Evidence-Id': 'late-file' } }, 'account-a', 'user-a', bucket)],
    ['abandon', (db: ImportDb, batchId: string) => request(db, `/api/curate/imports/${batchId}/abandon`, { method: 'POST' })],
    ['analysis', (db: ImportDb, batchId: string) => request(db, `/api/curate/imports/${batchId}/analyze`, { method: 'POST' })],
  ])('rejects %s when finalization reserves after the stale read without changing review data', async (_label, mutate) => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Reservation race', pasted_text: 'Evidence', items: [{ name: 'Original item' }] }) });
    const { batch, items } = await created.json() as any;
    db.journeys.set('journey-a', { id: 'journey-a', account_id: 'account-a', name: 'Journey' });
    db.customers.set('vendor-a', { id: 'vendor-a', account_id: 'account-a', name: 'Vendor', tags: '["vendor"]' });
    db.compass.set('entry-merge', { id: 'entry-merge', account_id: 'account-a', user_id: 'user-a', name: 'Existing identity', category: 'tea' });
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'group', proposed_vendor_name: null, resolved_vendor_customer_id: null, uncertainty_json: '{}' });
    const storedObjects = new Map<string, ArrayBuffer>();
    const bucket = {
      put: async (key: string, value: ArrayBuffer) => { storedObjects.set(key, value); },
      delete: async (key: string) => { storedObjects.delete(key); },
      get: async () => null,
    } as unknown as R2Bucket;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({
      overview: 'Late', language: 'en', groups: [{ key: 'late', proposedVendorName: 'Late', items: [itemProposal('late', String([...db.sources.values()][0]?.id))] }],
    }) }] }), { status: 200 }));
    const before = {
      journeyId: db.batches.get(batch.id)?.journey_id ?? null,
      reviewState: db.batches.get(batch.id)?.review_state,
      groups: [...db.groups.values()].map(row => ({ ...row })),
      items: [...db.items.values()].map(row => ({ ...row })),
      sources: [...db.sources.values()].map(row => ({ ...row })),
      customers: [...db.customers.values()].map(row => ({ ...row })),
    };
    db.reserveNextGuardedWrite = true;

    const result = await mutate(db, batch.id, items[0].id, bucket);

    expect(result.status).toBe(409);
    if (_label === 'analysis') expect(await result.json()).toMatchObject({ code: 'analysis_superseded' });
    expect(db.batches.get(batch.id)).toMatchObject({ finalize_idempotency_key: 'finish-key', journey_id: before.journeyId, review_state: before.reviewState });
    expect([...db.groups.values()]).toEqual(before.groups);
    expect([...db.items.values()]).toEqual(before.items);
    expect([...db.sources.values()]).toEqual(before.sources);
    expect([...db.customers.values()]).toEqual(before.customers);
    expect(storedObjects.size).toBe(0);
  });

  it.each([
    ['reserved', 'reviewing', 'finish-key'],
    ['completed', 'completed', null],
  ])('rejects acceptance of an already-linked item when its batch is %s', async (_label, reviewState, finalizeKey) => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Linked terminal item', items: [{ name: 'Linked' }] }) });
    const { batch, items } = await created.json() as any;
    db.items.get(items[0].id)!.compass_entry_id = 'entry-linked';
    db.batches.set(batch.id, { ...db.batches.get(batch.id)!, review_state: reviewState, finalize_idempotency_key: finalizeKey });

    const result = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' });

    expect(result.status).toBe(409);
    expect(db.items.get(items[0].id)).toMatchObject({ compass_entry_id: 'entry-linked', review_state: 'pending' });
  });

  it('rejects acceptance until uncertainty is explicitly cleared on the server', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Uncertain', items: [{ name: 'Maybe', uncertainty: { name: 'unclear' } }] }) });
    const { batch, items } = await created.json() as any;
    expect((await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' })).status).toBe(409);
    await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}`, { method: 'PUT', body: JSON.stringify({ uncertainty: {} }) });
    expect((await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' })).status).toBe(201);
  });
  it('requires inventory finalization instead of completing analyzed grouped imports through legacy accept or merge', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Analyzed inventory', items: [{ name: 'One' }, { name: 'Two' }] }) });
    const { batch, items } = await created.json() as any;
    Object.assign(db.batches.get(batch.id)!, { review_state: 'reviewing', analysis_state: 'complete' });
    db.groups.set('group-a', { id: 'group-a', batch_id: batch.id, account_id: 'account-a', position: 0, group_key: 'a' });
    db.items.get(items[0].id)!.vendor_group_id = 'group-a';
    db.items.get(items[1].id)!.vendor_group_id = 'group-a';
    db.compass.set('existing', { id: 'existing', account_id: 'account-a', user_id: 'user-a', category: 'tea' });

    expect((await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' })).status).toBe(409);
    expect((await request(db, `/api/curate/imports/${batch.id}/items/${items[1].id}/merge`, { method: 'POST', body: JSON.stringify({ compass_entry_id: 'existing' }) })).status).toBe(409);
    expect(db.batches.get(batch.id)?.review_state).toBe('reviewing');
    expect(db.items.get(items[0].id)?.compass_entry_id).toBeNull();
    expect(db.items.get(items[1].id)?.compass_entry_id).toBeNull();
  });
  it('completes a batch only after every item is resolved and excludes it from recovery', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Lifecycle', items: [{ name: 'One' }, { name: 'Two' }] }) });
    const { batch, items } = await created.json() as any;
    await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/accept`, { method: 'POST' });
    expect(db.batches.get(batch.id)?.review_state).toBe('reviewing');
    expect((await (await request(db, '/api/curate/imports?state=incomplete')).json() as any).imports).toHaveLength(1);
    await request(db, `/api/curate/imports/${batch.id}/items/${items[1].id}`, { method: 'PUT', body: JSON.stringify({ review_state: 'abandoned' }) });
    expect(db.batches.get(batch.id)?.review_state).toBe('completed');
    expect((await (await request(db, '/api/curate/imports?state=incomplete')).json() as any).imports).toHaveLength(0);
  });
  it('durably uploads scoped evidence and lists the incomplete batch after reload', async () => {
    const db = new ImportDb();
    const objects = new Map<string, { value: ArrayBuffer; options: unknown }>();
    const bucket = {
      put: async (key: string, value: ArrayBuffer, options: unknown) => { objects.set(key, { value, options }); },
      delete: async (key: string) => { objects.delete(key); },
      get: async (key: string) => {
        const stored = objects.get(key);
        return stored ? { body: new Response(stored.value).body } : null;
      },
    } as unknown as R2Bucket;
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Invoice evidence' }) }, 'account-a', 'user-a', bucket);
    const { batch } = await created.json() as any;
    const uploaded = await request(db, `/api/curate/imports/${batch.id}/evidence`, {
      method: 'POST', headers: { 'X-Filename': encodeURIComponent('台灣 invoice.pdf'), 'X-Client-Evidence-Id': 'client-one', 'Content-Type': 'application/pdf' }, body: '%PDF-test',
    }, 'account-a', 'user-a', bucket);
    expect(uploaded.status).toBe(201);
    const source = await uploaded.json() as any;
    expect(source).toMatchObject({ kind: 'invoice', metadata: { filename: '台灣 invoice.pdf', content_type: 'application/pdf', size: 9, extraction_status: 'not_available', client_evidence_id: 'client-one' } });
    expect(source.r2_object_key).toMatch(new RegExp(`^curate/account-a/${batch.id}/`));
    expect(objects.has(source.r2_object_key)).toBe(true);
    const retried = await request(db, `/api/curate/imports/${batch.id}/evidence`, {
      method: 'POST', headers: { 'X-Filename': encodeURIComponent('台灣 invoice.pdf'), 'X-Client-Evidence-Id': 'client-one', 'Content-Type': 'application/pdf' }, body: '%PDF-test',
    }, 'account-a', 'user-a', bucket);
    expect(retried.status).toBe(200);
    expect(await retried.json()).toMatchObject({ id: source.id, already_uploaded: true });
    expect(objects.size).toBe(1);
    expect(db.sources.size).toBe(1);
    const concurrent = await Promise.all([request(db, `/api/curate/imports/${batch.id}/evidence`, {
      method: 'POST', headers: { 'X-Filename': 'other.pdf', 'X-Client-Evidence-Id': 'client-two', 'Content-Type': 'application/pdf' }, body: '%PDF-other',
    }, 'account-a', 'user-a', bucket), request(db, `/api/curate/imports/${batch.id}/evidence`, {
      method: 'POST', headers: { 'X-Filename': 'other.pdf', 'X-Client-Evidence-Id': 'client-two', 'Content-Type': 'application/pdf' }, body: '%PDF-other',
    }, 'account-a', 'user-a', bucket)]);
    expect(concurrent.map(result => result.status).sort()).toEqual([200, 201]);
    expect([...db.sources.values()].filter(row => row.client_evidence_id === 'client-two')).toHaveLength(1);
    const listed = await request(db, '/api/curate/imports?state=incomplete', {}, 'account-a', 'user-a', bucket);
    expect(listed.status).toBe(200);
    const recovery = await listed.json() as any;
    expect(recovery.imports).toHaveLength(1);
    expect(recovery.imports[0]).toMatchObject({ batch: { id: batch.id }, items: [] });
    expect(recovery.imports[0].sources).toEqual(expect.arrayContaining([expect.objectContaining({ id: source.id })]));
    const opened = await request(db, `/api/curate/imports/${batch.id}/sources/${source.id}/content`, {}, 'account-a', 'user-a', bucket);
    expect(opened.status).toBe(200);
    expect(opened.headers.get('Content-Disposition')).toContain("attachment; filename*=UTF-8''");
    expect(opened.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await opened.text()).toBe('%PDF-test');
    expect((await request(db, `/api/curate/imports/${batch.id}/sources/${source.id}/content`, {}, 'account-b', 'user-b', bucket)).status).toBe(404);
  });

  it('keeps an overlapping upload winner object when finalization makes the guarded insert lose', async () => {
    const db = new ImportDb();
    const objects = new Map<string, ArrayBuffer>();
    const bucket = {
      put: async (key: string, value: ArrayBuffer) => { objects.set(key, value); },
      delete: async (key: string) => { objects.delete(key); },
      get: async () => null,
    } as unknown as R2Bucket;
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Upload overlap' }) });
    const { batch } = await created.json() as any;
    db.evidenceWinnerBeforeGuard = true;

    const result = await request(db, `/api/curate/imports/${batch.id}/evidence`, {
      method: 'POST', headers: { 'X-Filename': 'same.txt', 'X-Client-Evidence-Id': 'same-file', 'Content-Type': 'text/plain' }, body: 'same evidence',
    }, 'account-a', 'user-a', bucket);

    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ id: 'source-winner', already_uploaded: true });
    expect(db.batches.get(batch.id)?.finalize_idempotency_key).toBe('finish-key');
    expect(db.sources.get('source-winner')?.r2_object_key).toBe([...objects.keys()][0]);
    expect(objects.size).toBe(1);
  });

  it('stores and retrieves JSON evidence with bounded metadata and a content-addressed json key', async () => {
    const db = new ImportDb();
    const objects = new Map<string, { value: ArrayBuffer; options: any }>();
    const bucket = {
      put: async (key: string, value: ArrayBuffer, options: unknown) => { objects.set(key, { value, options }); },
      delete: async (key: string) => { objects.delete(key); },
      get: async (key: string) => {
        const stored = objects.get(key);
        return stored ? { body: new Response(stored.value).body } : null;
      },
    } as unknown as R2Bucket;
    const created = await request(db, '/api/curate/imports', {
      method: 'POST', body: JSON.stringify({ title: 'JSON vendor list' }),
    }, 'account-a', 'user-a', bucket);
    const { batch } = await created.json() as any;
    const original = JSON.stringify([{ name: 'Ali Shan', price: 600 }, { name: 'Red Jade', price: 450 }]);
    const uploaded = await request(db, `/api/curate/imports/${batch.id}/evidence`, {
      method: 'POST',
      headers: {
        'X-Filename': encodeURIComponent('vendor-list.json'),
        'X-Client-Evidence-Id': 'json-one',
        'Content-Type': 'application/json',
      },
      body: original,
    }, 'account-a', 'user-a', bucket);
    expect(uploaded.status).toBe(201);
    const source = await uploaded.json() as any;
    expect(source).toMatchObject({
      kind: 'file',
      metadata: {
        filename: 'vendor-list.json', content_type: 'application/json',
        size: new TextEncoder().encode(original).byteLength,
        extraction_status: 'not_available', client_evidence_id: 'json-one',
      },
    });
    expect(source.r2_object_key).toMatch(new RegExp(`^curate/account-a/${batch.id}/json-one-[a-f0-9]{64}\\.json$`));
    expect(objects.get(source.r2_object_key)?.options).toMatchObject({
      httpMetadata: { contentType: 'application/json' },
      customMetadata: { account_id: 'account-a', batch_id: batch.id, source_id: source.id },
    });
    const opened = await request(db, `/api/curate/imports/${batch.id}/sources/${source.id}/content`, {}, 'account-a', 'user-a', bucket);
    expect(opened.status).toBe(200);
    expect(opened.headers.get('Content-Type')).toBe('application/json');
    expect(opened.headers.get('Content-Disposition')).toContain('attachment;');
    expect(opened.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(await opened.text()).toBe(original);
  });

  it('rejects unsupported, oversized, unbound, and cross-account evidence without persisting a source', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Evidence' }) });
    const { batch } = await created.json() as any;
    const path = `/api/curate/imports/${batch.id}/evidence`;
    expect((await request(db, path, { method: 'POST', headers: { 'X-Filename': 'x.pdf', 'Content-Type': 'application/pdf' }, body: 'x' })).status).toBe(503);
    const bucket = { put: async () => {} } as unknown as R2Bucket;
    expect((await request(db, path, { method: 'POST', headers: { 'X-Filename': 'x.exe', 'Content-Type': 'application/octet-stream' }, body: 'x' }, 'account-a', 'user-a', bucket)).status).toBe(415);
    const heic = await request(db, path, { method: 'POST', headers: { 'X-Filename': 'x.heic', 'X-Client-Evidence-Id': 'heic-one', 'Content-Type': 'image/heic' }, body: '0000ftypheic' }, 'account-a', 'user-a', bucket);
    expect(heic.status).toBe(415);
    expect(await heic.json()).toMatchObject({ error: 'Convert HEIC or HEIF photos to JPEG, PNG, or WebP before import' });
    expect((await request(db, path, { method: 'POST', headers: { 'X-Filename': 'x.json', 'X-Client-Evidence-Id': 'invalid-json', 'Content-Type': 'application/json' }, body: '{invalid' }, 'account-a', 'user-a', bucket)).status).toBe(415);
    expect((await request(db, path, { method: 'POST', headers: { 'X-Filename': 'x.pdf', 'Content-Type': 'application/pdf', 'Content-Length': String(10 * 1024 * 1024 + 1) }, body: 'x' }, 'account-a', 'user-a', bucket)).status).toBe(413);
    expect((await request(db, path, { method: 'POST', headers: { 'X-Filename': 'x.pdf', 'Content-Type': 'application/pdf' }, body: 'x' }, 'account-b', 'user-b', bucket)).status).toBe(404);
    expect(db.sources.size).toBe(0);
  });

  it('marks legacy HEIC evidence failed without poisoning usable mixed evidence', async () => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Mixed phone evidence', pasted_text: 'Usable tea list' }) });
    const { batch, sources } = await created.json() as any;
    db.sources.set('legacy-heic', { id: 'legacy-heic', batch_id: batch.id, account_id: 'account-a', kind: 'photo', pasted_text: null, r2_object_key: 'private/photo.heic', analysis_status: 'pending', metadata_json: JSON.stringify({ content_type: 'image/heic', size: 12 }) });
    const bucket = { get: async () => ({ body: new Response('0000ftypheic').body }) } as unknown as R2Bucket;
    const provider = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ overview: 'one', language: 'en', groups: [{ key: 'v', proposedVendorName: 'V', items: [itemProposal('usable', sources[0].id)] }] }) }] }), { status: 200 }));

    const result = await request(db, `/api/curate/imports/${batch.id}/analyze`, { method: 'POST' }, 'account-a', 'user-a', bucket);

    expect(result.status).toBe(200);
    expect(db.sources.get('legacy-heic')).toMatchObject({ analysis_status: 'failed', analysis_error: 'analysis_unsupported_source' });
    const content = JSON.parse(String(provider.mock.calls[0][1]?.body)).messages[0].content;
    expect(content.some((part: any) => part.type === 'image' && part.source?.media_type === 'image/heic')).toBe(false);
  });
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
    expect(second.status).toBe(409);
    expect(db.compass.size).toBe(1);
    expect([...db.compass.values()][0]).toMatchObject({ name: 'Ruby 18', category: 'tea', account_id: 'account-a', user_id: 'user-a' });
    expect(db.products).toHaveLength(0);
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
    expect(responses.map(result => result.status).sort()).toEqual([201, 409]);
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

  it.each([
    { parsed_data: { parser: { attachment: { base64: 'aGVsbG8=' } } }, uncertainty: {} },
    { parsed_data: {}, uncertainty: { photo: { uri: 'data:image/png;base64,aGVsbG8=' } } },
    { parsed_data: { invoice: { file_bytes: [1, 2, 3] } }, uncertainty: {} },
  ])('rejects binary payloads nested in structured import item fields: %j', async structured => {
    const db = new ImportDb();
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({
      title: 'Structured binary',
      pasted_text: 'exact evidence remains text',
      items: [{ name: 'Tea', raw_text: 'line', ...structured }],
    }) });
    expect(created.status).toBe(400);
    expect(db.batches.size).toBe(0);
  });

  it('returns 400 when structured item fields exceed traversal depth', async () => {
    const db = new ImportDb();
    let parsedData: Record<string, unknown> = { leaf: true };
    for (let index = 0; index < 40; index++) parsedData = { child: parsedData };
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({
      title: 'Deep parsed result', items: [{ name: 'Tea', parsed_data: parsedData }],
    }) });
    expect(created.status).toBe(400);
    expect(db.batches.size).toBe(0);
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

  it('refuses to merge into another user\'s Compass entry in the same account', async () => {
    const db = new ImportDb();
    db.compass.set('other-user-entry', { id: 'other-user-entry', account_id: 'account-a', user_id: 'user-b', name: 'Private encounter' });
    const created = await request(db, '/api/curate/imports', { method: 'POST', body: JSON.stringify({ title: 'Invoice', items: [{ name: 'Line one' }] }) });
    const { batch, items } = await created.json() as any;
    const merged = await request(db, `/api/curate/imports/${batch.id}/items/${items[0].id}/merge`, {
      method: 'POST', body: JSON.stringify({ compass_entry_id: 'other-user-entry' }),
    });
    expect(merged.status).toBe(404);
    expect(db.items.get(items[0].id)).toMatchObject({ review_state: 'pending', compass_entry_id: null });
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
