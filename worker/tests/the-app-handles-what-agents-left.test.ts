import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * What an agent leaves for Adrian (teas it found, to-dos, orders on their
 * way) can be handled in the app as well as through the agent. The app's
 * routes read and write the same rows the curate_* tools do, and only for
 * people in the shop who can source.
 */

const JWT = 'agent-lists-secret';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function call(db: SqliteD1, path: string, who: { sub: string; account: string }, init: { method?: string; body?: unknown } = {}) {
  const token = await signedToken(JWT, { sub: who.sub, email: `${who.sub}@test.dev`, name: who.sub, active_account_id: who.account, platform_role: null });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': who.account, 'Content-Type': 'application/json' });
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }), { DB: db as any, JWT_SECRET: JWT } as any);
}

const OWNER = { sub: 'adrian', account: 'acc-shop' };
const VIEWER = { sub: 'looker', account: 'acc-shop' };
const OTHER = { sub: 'stranger', account: 'acc-other' };

function seeded() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: 'acc-shop', role: 'owner', bundles: ['catalog', 'gather', 'stock'] });
  seedIdentity(db, { userId: 'looker', accountId: 'acc-shop', role: 'viewer', bundles: [] });
  seedIdentity(db, { userId: 'stranger', accountId: 'acc-other', role: 'owner', bundles: ['catalog', 'gather'] });
  db.sqlite.exec(`
    INSERT INTO curate_suggestions (id, account_id, created_by_user_id, batch_id, from_agent, from_url, from_vendor_name, name, category, fields_json)
      VALUES ('s-1', 'acc-shop', 'adrian', 'b-1', 'GrokBot', 'https://shop.example', 'Wang Laoshi', 'Yiwu Gushu', 'tea', '{"year":2019,"price_amount":450,"price_currency":"Yuan"}'),
             ('s-2', 'acc-shop', 'adrian', 'b-1', 'GrokBot', 'https://shop.example', 'Wang Laoshi', 'Bulang', 'tea', '{}'),
             ('s-9', 'acc-other', 'stranger', 'b-9', 'Hermes', NULL, NULL, 'Not yours', 'tea', '{}');
    INSERT INTO curate_todos (id, account_id, created_by_user_id, text, from_agent) VALUES
      ('t-1', 'acc-shop', 'adrian', 'Ask Wang for the 2018', 'Hermes'),
      ('t-9', 'acc-other', 'stranger', 'Not yours', NULL);
  `);
  return db;
}

describe("the app's agent lists", () => {
  it('lists what an agent found, grouped by find, for this shop only', async () => {
    const db = seeded();
    const res = await call(db, '/api/curate/suggestions', OWNER);
    expect(res.status).toBe(200);
    const { waiting } = await res.json() as any;
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ found_by: 'GrokBot', vendor: 'Wang Laoshi', url: 'https://shop.example' });
    expect(waiting[0].teas.map((t: any) => t.name)).toEqual(['Yiwu Gushu', 'Bulang']);
    expect(waiting[0].teas[0].price).toEqual({ amount: 450, currency: 'Yuan', per_grams: null });
  });

  it('a tick in the app picks a tea into Curate and drops the rest', async () => {
    const db = seeded();
    const res = await call(db, '/api/curate/suggestions/pick', OWNER, { method: 'POST', body: { pick: ['s-1'], drop: ['s-2'] } });
    expect(res.status).toBe(200);
    const states = db.sqlite.prepare(`SELECT id, state, compass_entry_id FROM curate_suggestions WHERE account_id = 'acc-shop' ORDER BY id`).all() as any[];
    expect(states.map((r) => r.state)).toEqual(['picked', 'dropped']);
    const entry = db.sqlite.prepare('SELECT name, account_id, user_id FROM tea_compass_entries WHERE id = ?').get(states[0].compass_entry_id) as any;
    expect(entry).toMatchObject({ name: 'Yiwu Gushu', account_id: 'acc-shop', user_id: 'adrian' });
    const left = await (await call(db, '/api/curate/suggestions', OWNER)).json() as any;
    expect(left.waiting).toEqual([]);
  });

  it("will not pick another shop's suggestion", async () => {
    const db = seeded();
    await call(db, '/api/curate/suggestions/pick', OWNER, { method: 'POST', body: { pick: ['s-9'] } });
    expect((db.sqlite.prepare(`SELECT state FROM curate_suggestions WHERE id = 's-9'`).get() as any).state).toBe('waiting');
  });

  it('adds a to-do, lists the open ones, and ticks one off', async () => {
    const db = seeded();
    const add = await call(db, '/api/curate/todos', OWNER, { method: 'POST', body: { text: 'Weigh the Bulang cake' } });
    expect(add.status).toBe(201);
    const { todos } = await (await call(db, '/api/curate/todos', OWNER)).json() as any;
    expect(todos.map((t: any) => t.text)).toEqual(['Ask Wang for the 2018', 'Weigh the Bulang cake']);
    expect(todos[0].from_agent).toBe('Hermes');
    expect((await call(db, '/api/curate/todos/t-1/done', OWNER, { method: 'POST' })).status).toBe(200);
    expect((await call(db, '/api/curate/todos/t-9/done', OWNER, { method: 'POST' })).status).toBe(404);
    const after = await (await call(db, '/api/curate/todos', OWNER)).json() as any;
    expect(after.todos.map((t: any) => t.text)).toEqual(['Weigh the Bulang cake']);
  });

  it('lists the orders on their way', async () => {
    const db = seeded();
    db.sqlite.exec(`
      INSERT INTO tea_compass_entries (id, user_id, account_id, name, vendor_name) VALUES ('e-1', 'adrian', 'acc-shop', 'Yiwu Gushu', 'Wang Laoshi');
      INSERT INTO curate_receipt_proposals (id, account_id, compass_entry_id, product_name, purpose, quantity, unit, acquisition_kind, idempotency_key, proposed_by_user_id)
        VALUES ('r-1', 'acc-shop', 'e-1', 'Yiwu Gushu', 'working', 2, 'unit', 'purchase', 'k-1', 'adrian');
    `);
    const { pending } = await (await call(db, '/api/curate/receipt-proposals', OWNER)).json() as any;
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ id: 'r-1', tea_name: 'Yiwu Gushu', vendor_name: 'Wang Laoshi', quantity: 2, unit: 'unit' });
    const other = await (await call(db, '/api/curate/receipt-proposals', OTHER)).json() as any;
    expect(other.pending).toEqual([]);
  });

  it('turns away someone in the shop who cannot source', async () => {
    const db = seeded();
    for (const path of ['/api/curate/suggestions', '/api/curate/todos', '/api/curate/receipt-proposals']) {
      expect((await call(db, path, VIEWER)).status).toBe(403);
    }
  });
});
