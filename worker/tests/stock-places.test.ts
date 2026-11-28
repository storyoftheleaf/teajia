import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { countAtPlace, fitSplit, moveBetween, setAmounts, shiftPlace } from '../../shared/stockSplit';

/*
 * Adrian, 2026-11-28: "Split stock based on where it is stored, but just have
 * one number." The Aged Ripe Pu-erh is 1462 g in all: 462 g at the art studio
 * and 1000 g at his house. The shop still sells from one number; these tests
 * hold that the split always adds up to it, whichever door moved it.
 */

const SHOP = 'acc-places';
const OTHER = 'acc-elsewhere';
const TOKEN = 'tjmcp_stock_places_test';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

/* mcp.ts fires some writes without awaiting them, so the D1 it is handed has
   to return promises the way the real one does. */
class AsyncD1 {
  constructor(readonly inner: SqliteD1) {}
  prepare(sql: string) {
    const inner = this.inner.prepare(sql);
    const statement: any = {
      inner,
      bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
      first: async () => inner.first(),
      all: async () => inner.all(),
      run: async () => inner.run(),
    };
    return statement;
  }
  batch(statements: any[]) { return this.inner.batch(statements.map(s => s.inner)); }
}

const tokenHash = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');

async function makeDb(scopes = ['inventory:read', 'stock:write']) {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'other', accountId: OTHER, role: 'owner' });
  db.sqlite.prepare(`INSERT INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
    VALUES ('tok-places',?,?,?,'count',?,?,?,'account_owner')`)
    .run(SHOP, 'adrian', 'adrian@test.dev', await tokenHash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(scopes));
  return db;
}

function seedTea(db: SqliteD1, id: string, opts: { account?: string; type?: string; grams?: number | null; units?: number | null; status?: string; knownAt?: string | null; personalOffer?: string | null } = {}) {
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, type, product_name, given_name, chinese_name, stock_grams, quantity_units, stock_known_at, status, recheck_stock, personal_offer_source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
    .run(id, opts.account ?? SHOP, opts.type ?? 'Red', id, id, '六百年古树红茶', opts.grams ?? null, opts.units ?? null,
      opts.knownAt ?? null, opts.status ?? 'Active', opts.personalOffer ?? null);
}

async function rpc(db: SqliteD1, method: string, params: Record<string, unknown>) {
  const response = await worker.fetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), { DB: new AsyncD1(db) } as any, { waitUntil() {}, passThroughOnException() {} } as any);
  return await response.json() as any;
}

async function count(db: SqliteD1, args: Record<string, unknown>) {
  const body = await rpc(db, 'tools/call', { name: 'count_stock', arguments: args });
  // A refused argument comes back as a JSON-RPC error rather than a result.
  if (body.error) return { rpcError: body.error, isError: true } as any;
  const text = body.result?.content?.[0]?.text ?? '{}';
  try { return { ...JSON.parse(text), isError: body.result?.isError }; } catch { return { text, isError: body.result?.isError }; }
}


async function call(db: SqliteD1, name: string, args: Record<string, unknown>) {
  const body = await rpc(db, 'tools/call', { name, arguments: args });
  if (body.error) return { rpcError: body.error } as any;
  return JSON.parse(body.result?.content?.[0]?.text ?? '{}');
}
const total = (db: SqliteD1, id: string) => Number((db.sqlite.prepare('SELECT stock_grams FROM products WHERE id = ?').get(id) as any).stock_grams);
const split = async (db: SqliteD1, id: string) => (await call(db, 'list_stock_places', { product_id: id })).stock_places;
const both = async (db: SqliteD1, name: string, args: Record<string, unknown>) => {
  const preview = await call(db, name, args);
  expect(preview.confirmation_token, JSON.stringify(preview)).toBeTruthy();
  return call(db, name, { ...args, confirm: preview.confirmation_token });
};

describe('the arithmetic', () => {
  const places = [{ id: 'a', name: 'Art studio', position: 0 }, { id: 'h', name: "Adrian's house", position: 1 }];
  it('keeps what is not placed as the rest of the total', () => {
    expect(fitSplit(1462, places, new Map([['a', 462]]))).toEqual({ total: 1462, not_placed: 1000, places: [
      { place_id: 'a', name: 'Art studio', amount: 462 }, { place_id: 'h', name: "Adrian's house", amount: 0 }] });
  });
  it('takes a sale that named no place off the first place once nothing is unplaced', () => {
    const fitted = fitSplit(1400, places, new Map([['a', 462], ['h', 1000]]));
    expect(fitted.places.map(p => p.amount)).toEqual([400, 1000]);
    expect(fitted.not_placed).toBe(0);
  });
  it('refuses to take from a place more than it holds, or to place more than the total', () => {
    const s = fitSplit(1462, places, new Map([['a', 462]]));
    expect(shiftPlace(s, 'a', -500)).toMatchObject({ error: 'place_short', available: 462 });
    expect(moveBetween(s, null, 'h', 1001)).toMatchObject({ error: 'place_short', available: 1000 });
    expect(setAmounts(s, [{ place_id: 'h', amount: 1001 }])).toMatchObject({ error: 'over_total' });
  });
  it('counts a place from what was not placed before it grows the total', () => {
    const s = fitSplit(1462, places, new Map());
    expect(countAtPlace(s, 'a', 462)).toMatchObject({ total: 1462, not_placed: 1000 });
    const placed = fitSplit(1462, places, new Map([['a', 462], ['h', 1000]]));
    expect(countAtPlace(placed, 'a', 500)).toMatchObject({ total: 1500, not_placed: 0 });
    expect(countAtPlace(placed, 'a', 400)).toMatchObject({ total: 1400 });
  });
});

describe('the Aged Ripe Pu-erh, through the connector', () => {
  it('places 462 g at a new Art studio and 1000 g at a new house without moving the total', async () => {
    const db = await makeDb();
    seedTea(db, 'puerh', { grams: 1462, knownAt: '2026-11-28' });
    const preview = await call(db, 'move_stock_between_places', { product_id: 'puerh', amount: 462, to: 'Art studio' });
    expect(preview.preview.read_back).toMatch(/Move 462 g .* from not placed yet to Art studio \(a new place\)\. The total stays 1462 g/);
    expect((await call(db, 'list_stock_places', {})).places).toEqual([]);
    await call(db, 'move_stock_between_places', { confirm: preview.confirmation_token });
    await both(db, 'move_stock_between_places', { product_id: 'puerh', amount: 1000, to: "Adrian's house" });
    expect(total(db, 'puerh')).toBe(1462);
    expect(await split(db, 'puerh')).toEqual({ total: 1462, unit: 'g', not_placed: 0, places: [
      expect.objectContaining({ name: 'Art studio', amount: 462 }), expect.objectContaining({ name: "Adrian's house", amount: 1000 })] });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger').get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_place_moves').get()).toEqual({ n: 2 });
  });

  it('takes stock out of the place named, and a sale with no place off the first place', async () => {
    const db = await makeDb();
    seedTea(db, 'puerh', { grams: 1462, knownAt: '2026-11-28' });
    await both(db, 'move_stock_between_places', { product_id: 'puerh', amount: 462, to: 'Art studio' });
    await both(db, 'move_stock_between_places', { product_id: 'puerh', amount: 1000, to: "Adrian's house" });
    await both(db, 'remove_stock', { id: 'puerh', grams: 100, reason: 'SAMPLE', place: "adrian's house" });
    expect(total(db, 'puerh')).toBe(1362);
    expect((await split(db, 'puerh')).places.map((p: any) => p.amount)).toEqual([462, 900]);
    const short = await call(db, 'remove_stock', { id: 'puerh', grams: 500, place: 'Art studio' });
    expect(short.error).toBe('place_short');
    // Something else (an invoice) moves the total without a place.
    db.sqlite.prepare('UPDATE products SET stock_grams = 1300 WHERE id = ?').run('puerh');
    expect(await split(db, 'puerh')).toMatchObject({ total: 1300, not_placed: 0 });
    expect((await split(db, 'puerh')).places.map((p: any) => p.amount)).toEqual([400, 900]);
  });

  it('adds a delivery at a place and counts a place through the stock ledger', async () => {
    const db = await makeDb();
    seedTea(db, 'puerh', { grams: 1462, knownAt: '2026-11-28' });
    const counted = await both(db, 'count_stock', { product_id: 'puerh', counted: 462, place: 'Art studio', agent: 'Claude' });
    expect(counted).toMatchObject({ committed: true, balance_before: 1462, balance_after: 1462 });
    expect(await split(db, 'puerh')).toMatchObject({ total: 1462, not_placed: 1000 });
    await both(db, 'add_stock', { id: 'puerh', grams: 38, place: 'Art studio' });
    expect(total(db, 'puerh')).toBe(1500);
    expect((await split(db, 'puerh')).places).toEqual([expect.objectContaining({ name: 'Art studio', amount: 500 })]);
    const recount = await both(db, 'count_stock', { product_id: 'puerh', counted: 450, place: 'Art studio' });
    expect(recount).toMatchObject({ balance_after: 1450, difference: -50 });
    expect(await split(db, 'puerh')).toMatchObject({ total: 1450, not_placed: 1000 });
  });

  it('keeps one shop\'s places out of another\'s', async () => {
    const db = await makeDb();
    seedTea(db, 'puerh', { grams: 1462 });
    seedTea(db, 'theirs', { grams: 50, account: OTHER });
    db.sqlite.prepare("INSERT INTO stock_places (id, account_id, name) VALUES ('p-other', ?, 'Their shed')").run(OTHER);
    expect((await call(db, 'list_stock_places', {})).places).toEqual([]);
    expect((await call(db, 'move_stock_between_places', { product_id: 'puerh', amount: 1, from: 'p-other' })).error).toBe('unknown_place');
    expect((await call(db, 'list_stock_places', { product_id: 'theirs' })).error).toBe('not_found');
  });
});
