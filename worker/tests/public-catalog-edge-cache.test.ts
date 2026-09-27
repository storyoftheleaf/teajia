import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';

/**
 * The public catalogue was rebuilt from D1 on every shop visit: 150 KB and
 * 4-13 ms of CPU a request (measured 2026-09-26) against the Free plan's 10 ms
 * limit, because Cloudflare does not cache what a Worker returns and the
 * s-maxage header was never honoured. The catalogue routes now keep the built
 * response in the data center's cache. These tests hold them to building it
 * once, ignoring query strings, and never storing a failure.
 */

const store = new Map<string, Response>();

beforeEach(() => {
  store.clear();
  (globalThis as unknown as { caches: unknown }).caches = {
    default: {
      match: async (req: Request) => store.get(req.url)?.clone(),
      put: async (req: Request, res: Response) => { store.set(req.url, res); },
    },
  };
});

afterEach(() => {
  delete (globalThis as unknown as { caches?: unknown }).caches;
});

/** A D1 stand-in with one store, 'shop-one', and an empty shelf; it counts
 *  visibility checks separately from full catalogue builds. */
function countingDb() {
  const calls = { queries: 0, visibilityChecks: 0, catalogueBuilds: 0 };
  let publicStore = true;
  const statement = (sql: string) => {
    const stmt = {
      bind: () => stmt,
      first: async () => {
        calls.queries += 1;
        if (/SELECT id FROM accounts WHERE slug/i.test(sql)) {
          calls.visibilityChecks += 1;
          return publicStore ? { id: 'acc-one' } : null;
        }
        return null;
      },
      all: async () => { calls.queries += 1; return { results: [] }; },
      run: async () => { calls.queries += 1; return { success: true }; },
    };
    return stmt;
  };
  const db = {
    prepare: statement,
    batch: async (stmts: unknown[]) => {
      calls.queries += 1;
      calls.catalogueBuilds += 1;
      return stmts.map(() => ({ results: [] }));
    },
  };
  return { db, calls, closeStore: () => { publicStore = false; } };
}

const call = (db: unknown, path: string) =>
  worker.fetch(new Request(`https://worker.test${path}`, { method: 'GET' }), { DB: db } as any);

describe('the public catalogue is built once per cache window, not once per visit', () => {
  it('rechecks store visibility on a cache hit without rebuilding the catalogue', async () => {
    const { db, calls } = countingDb();
    const first = await call(db, '/api/s/shop-one/products');
    expect(first.status).toBe(200);
    const built = calls.queries;
    expect(built).toBeGreaterThan(0);
    expect(calls.catalogueBuilds).toBe(1);

    const second = await call(db, '/api/s/shop-one/products');
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual([]);
    expect(calls.queries).toBe(built + 1);
    expect(calls.visibilityChecks).toBe(2);
    expect(calls.catalogueBuilds).toBe(1);
  });

  it('ignores the query string, so ?anything cannot force a rebuild', async () => {
    const { db, calls } = countingDb();
    await call(db, '/api/s/shop-one/products');
    const built = calls.queries;
    await call(db, '/api/s/shop-one/products?bust=1');
    expect(calls.queries).toBe(built + 1);
    expect(calls.catalogueBuilds).toBe(1);
  });

  it('refuses a cached catalogue after the store closes', async () => {
    const { db, calls, closeStore } = countingDb();
    expect((await call(db, '/api/s/shop-one/products')).status).toBe(200);
    expect(store.size).toBe(1);
    closeStore();
    expect((await call(db, '/api/s/shop-one/products')).status).toBe(404);
    expect(calls.catalogueBuilds).toBe(1);
  });

  it('never stores a failure', async () => {
    const { db } = countingDb();
    db.prepare = ((sql: string) => ({ bind() { return this; }, first: async () => null, all: async () => ({ results: [] }), run: async () => ({}) })) as never;
    const missing = await call(db, '/api/s/no-such-shop/products');
    expect(missing.status).toBe(404);
    expect(store.size).toBe(0);
  });
});
