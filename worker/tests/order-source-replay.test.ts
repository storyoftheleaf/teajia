import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

// Launch 1 audit finding: a replayed order request must not gain a session
// source it did not have when it was first saved.
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

const VIA = 'aaaaaaaaaaaaaaaaaa';

describe('where an order request began, on a replay', () => {
  it('records a source only for a fresh save, never for a replay', async () => {
    const db = new SqliteD1('migrations'); databases.push(db);
    seedIdentity(db, { userId: 'host', accountId: 'shop' });
    db.sqlite.exec(`
      UPDATE accounts SET slug='shop', public_enabled=1, status='active' WHERE id='shop';
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, thanks_ref)
        VALUES ('event', 'shop', 'sit', 'A sit', '2026-11-20', 'completed', '${VIA}');
    `);
    const env = { DB: db, JWT_SECRET: 'replay-test', FIRST_TABLE_OPEN: 'true', INQUIRY_LIMITER: { limit: async () => ({ success: true }) } };
    const send = async (body: Record<string, unknown>) => {
      const background: Promise<unknown>[] = [];
      const response = await worker.fetch(new Request('https://app.test/api/inquiries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }), env as never, { waitUntil: (task: Promise<unknown>) => background.push(task) } as never);
      await Promise.all(background);
      return { status: response.status, data: await response.json() as Record<string, any> };
    };
    const base = { store_slug: 'shop', tracking_token: 'replaytrackingtokenreplaytrackingtoken12345', ref_number: 'R-1', name: 'Mei', email: 'mei@test.dev',
      items: [{ custom: true, storeSlug: 'shop', name: 'A tea', category: 'tea', quantityGrams: 50, packGrams: 50, packs: 1, pricePerGram: 0, totalPrice: 0 }], total_estimate_usd: 0, currency: 'USD' };
    const first = await send(base);
    expect(first.status, JSON.stringify(first.data)).toBe(201);
    const replay = await send({ ...base, via: VIA });
    expect(replay.data.id).toBe(first.data.id);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM order_session_sources').get()).toEqual({ n: 0 });

    const fresh = await send({ ...base, tracking_token: 'freshtrackingtokenfreshtrackingtoken1234567', ref_number: 'R-2', via: VIA });
    expect(fresh.status, JSON.stringify(fresh.data)).toBe(201);
    expect(db.sqlite.prepare('SELECT inquiry_id, event_id FROM order_session_sources').all())
      .toEqual([{ inquiry_id: fresh.data.id, event_id: 'event' }]);
  });
});
