import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * The sample page keeps one tasting id for one opening of the tasting, so a
 * second Save sends the same id. The worker used to answer a repeated id with
 * the stored row unchanged, so the second save's edits were gone on reload.
 * It now updates the tasting in place when the same author sends it again for
 * the same sample, keeps its created time, does not repeat the sample's
 * status change, and refuses an id that belongs to another sample, account or
 * author. A guest proves authorship with the edit key the first save returned.
 * Driven through the worker's own route against the migration ledger.
 */

const SECRET = 'sample-tasting-secret';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: 'shop' });
  seedIdentity(db, { userId: 'other', accountId: 'shop' });
  seedIdentity(db, { userId: 'elsewhere', accountId: 'other-shop' });
  db.sqlite.exec(`
    INSERT INTO tea_sample_sets (id, name, account_id) VALUES ('set', 'Samples', 'shop'), ('set-2', 'Samples', 'other-shop');
    INSERT INTO tea_samples (id, name, set_id, status, account_id) VALUES
      ('sample', 'Gaoshan', 'set', 'received', 'shop'),
      ('sample-b', 'Dancong', 'set', 'received', 'shop'),
      ('sample-c', 'Elsewhere', 'set-2', 'received', 'other-shop');
  `);
  return db;
}

async function save(db: SqliteD1, sampleId: string, body: Record<string, unknown>, user?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, name: user })}`;
  const response = await worker.fetch(new Request(`https://app.test/api/samples/${sampleId}/tastings`, {
    method: 'POST', headers, body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
  return { status: response.status, body: await response.json() as any };
}

const rows = (db: SqliteD1) => db.sqlite.prepare('SELECT * FROM tea_sample_tastings ORDER BY id').all() as any[];
const first = { id: 'tasting-1', tasting: { notes: ['first'] }, rating: 6, verdict: 'like', wouldBuy: false, personalNote: 'first' };
const second = { ...first, tasting: { notes: ['second'] }, rating: 8, verdict: 'love', wouldBuy: true, personalNote: 'second' };

describe('saving a sample tasting again in one opening updates it', () => {
  it('the edit key a guest is handed can never be used as a sign-in token', async () => {
    // The tasting id is the caller's to choose and the key comes back to an
    // unauthenticated guest. A key computed directly under the worker's secret
    // would sign "<label><id>", and a sign-in token is "<header>.<payload>"
    // signed under that same secret with a header nobody checks, so an id of
    // ".<payload>" would mint a token. The key is computed under a derived key.
    const db = seed();
    const claims = { sub: 'adrian', email: 'adrian@test.dev', active_account_id: 'shop', exp: Math.floor(Date.now() / 1000) + 3600 };
    const payload = btoa(JSON.stringify(claims));
    const created = await save(db, 'sample', { ...first, id: `.${payload}` });
    expect(created.status).toBe(201);
    const key = String(created.body.edit_key);
    const signature = btoa(String.fromCharCode(...(key.match(/../g) ?? []).map(hex => parseInt(hex, 16))));

    for (const header of ['sample-tasting-edit:', 'teajia/sample-tasting-edit-key/v1', '']) {
      const forged = `${header}.${payload}.${signature}`;
      const response = await worker.fetch(new Request('https://app.test/api/compass/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${forged}`, 'X-Teajia-Account': 'shop', 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: [] }),
      }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
      expect(response.status).toBe(401);
    }

    // And it is not the plain signature of anything the caller controls.
    const direct = async (text: string) => {
      const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text)))).map(n => n.toString(16).padStart(2, '0')).join('');
    };
    expect(key).not.toBe(await direct(`.${payload}`));
    expect(key).not.toBe(await direct(`sample-tasting-edit:.${payload}`));
  });

  it('the same signed-in author saving again updates the one tasting and keeps its created time', async () => {
    const db = seed();
    const created = await save(db, 'sample', first, 'adrian');
    expect(created.status).toBe(201);
    db.sqlite.exec(`UPDATE tea_sample_tastings SET created_at = '2026-11-01 08:00:00'`);
    db.sqlite.exec(`UPDATE tea_samples SET status = 'favorite', updated_at = '2026-11-02 08:00:00' WHERE id = 'sample'`);

    const updated = await save(db, 'sample', second, 'adrian');
    expect(updated.status).toBe(200);
    expect(rows(db)).toHaveLength(1);
    expect(rows(db)[0]).toMatchObject({
      id: 'tasting-1', sample_id: 'sample', taster_id: 'adrian@test.dev', rating: 8, verdict: 'love',
      would_buy: 1, personal_note: 'second', created_at: '2026-11-01 08:00:00',
    });
    expect(JSON.parse(rows(db)[0].tasting)).toEqual({ notes: ['second'] });
    expect(updated.body).toMatchObject({ id: 'tasting-1', verdict: 'love', created_at: '2026-11-01 08:00:00' });
    // The repeat is not a second tasting: the sample's lifecycle write does not run again.
    expect(db.sqlite.prepare(`SELECT status, updated_at FROM tea_samples WHERE id = 'sample'`).get())
      .toEqual({ status: 'favorite', updated_at: '2026-11-02 08:00:00' });
  });

  it('a guest updates its own tasting with the edit key its first save returned, and not without it', async () => {
    const db = seed();
    const created = await save(db, 'sample', { ...first, tasterName: 'Mei' });
    expect(created.status).toBe(201);
    expect(typeof created.body.edit_key).toBe('string');

    const withoutKey = await save(db, 'sample', { ...second, tasterName: 'Mei' });
    expect(withoutKey.status).toBe(409);
    expect(rows(db)[0].verdict).toBe('like');

    const withKey = await save(db, 'sample', { ...second, tasterName: 'Mei', edit_key: created.body.edit_key });
    expect(withKey.status).toBe(200);
    expect(rows(db)).toHaveLength(1);
    expect(rows(db)[0]).toMatchObject({ verdict: 'love', personal_note: 'second', taster_name: 'Mei' });

    // The public read of the sample never hands the key out.
    const read = await worker.fetch(new Request('https://app.test/api/samples/sample'), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(JSON.stringify(await read.json())).not.toContain(created.body.edit_key);
  });

  it('a retried first save from a guest is answered with the stored tasting, without a key', async () => {
    const db = seed();
    await save(db, 'sample', first);
    const retry = await save(db, 'sample', first);
    expect(retry.status).toBe(200);
    expect(retry.body.id).toBe('tasting-1');
    expect(retry.body.edit_key).toBeUndefined();
    expect(rows(db)).toHaveLength(1);
  });

  it('an id that belongs to another sample, account or author is refused and left alone', async () => {
    const db = seed();
    const created = await save(db, 'sample', first, 'adrian');

    expect((await save(db, 'sample-b', second, 'adrian')).status).toBe(409);
    expect((await save(db, 'sample', second, 'other')).status).toBe(409);
    expect((await save(db, 'sample', { ...second, edit_key: 'not-the-key' })).status).toBe(409);
    // A key for this tasting does not open another author's row on another sample's id.
    expect((await save(db, 'sample-c', { ...second, edit_key: created.body.edit_key }, 'elsewhere')).status).toBe(409);

    expect(rows(db)).toHaveLength(1);
    expect(rows(db)[0]).toMatchObject({ sample_id: 'sample', verdict: 'like', personal_note: 'first' });
  });
});
