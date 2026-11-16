import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * The journal push used to replace a tea's stored `tastings` and `note` with
 * whatever the device sent, so a phone holding an older copy erased the
 * sittings a laptop had added. The worker now merges on push with the rule the
 * client uses when it pulls (`src/lib/tastingJournalMerge.ts`): sittings are
 * united by id, and the side whose note was edited later keeps its note and
 * its copy of a sitting both hold. Driven through the worker's own route
 * against the migration ledger.
 */

const SECRET = 'journal-merge-secret';
const ACCOUNT = 'shop';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

const record = (id: string, createdAt: string, words: string, extra: Record<string, unknown> = {}) => ({
  id, createdAt, tasting: { notes: [words] }, ...extra,
});
const note = (words: string, updatedAt: string) => ({ tasting: { notes: [words] }, personalNote: words, updatedAt });

function seed(stored?: { tastings: unknown[]; note: unknown; archived?: number }) {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'taster', accountId: ACCOUNT });
  if (stored) {
    db.sqlite.prepare(`INSERT INTO customer_tasting_journal
      (id, account_id, user_id, product_id, product_name, product_type, note, tastings, archived, created_at)
      VALUES ('entry-laptop', ?, 'taster@test.dev', 'tea', 'Old name', 'Oolong', ?, ?, ?, '2026-11-01T08:00:00.000Z')`)
      .run(ACCOUNT, JSON.stringify(stored.note), JSON.stringify(stored.tastings), stored.archived ?? 0);
  }
  return db;
}

async function push(db: SqliteD1, entry: Record<string, unknown>) {
  const token = await signedToken(SECRET, { sub: 'taster', email: 'taster@test.dev', active_account_id: ACCOUNT });
  const response = await worker.fetch(new Request('https://app.test/api/tasting-journal/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' },
    body: JSON.stringify([{
      product_id: 'tea', product_name: 'New name', product_type: 'Oolong', product_image: null,
      compass_entry_id: null, created_at: '2026-11-02T08:00:00.000Z', archived: 0,
      ...entry,
      note: JSON.stringify(entry.note),
      tastings: JSON.stringify(entry.tastings),
    }]),
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
  return { status: response.status, body: await response.json() as any };
}

function stored(db: SqliteD1) {
  const row = db.sqlite.prepare(`SELECT * FROM customer_tasting_journal WHERE user_id = 'taster@test.dev' AND product_id = 'tea'`).get() as any;
  return { ...row, note: JSON.parse(row.note), tastings: JSON.parse(row.tastings) };
}

describe('a second device keeps the other device\'s tastings', () => {
  it('a phone holding an older copy adds its sitting without erasing the laptop\'s', async () => {
    const db = seed({
      tastings: [record('first', '2026-11-01T08:00:00.000Z', 'first'), record('laptop', '2026-11-05T08:00:00.000Z', 'laptop sitting')],
      note: note('laptop note', '2026-11-05T08:00:00.000Z'),
    });
    const result = await push(db, {
      id: 'entry-phone',
      tastings: [record('first', '2026-11-01T08:00:00.000Z', 'first'), record('phone', '2026-11-06T08:00:00.000Z', 'phone sitting')],
      note: note('phone note', '2026-11-06T08:00:00.000Z'),
    });
    expect(result).toEqual({ status: 200, body: { synced: 1 } });
    const row = stored(db);
    expect(row.tastings.map((t: any) => t.id)).toEqual(['first', 'laptop', 'phone']);
    expect(row.note.personalNote).toBe('phone note');
    expect(row.id).toBe('entry-laptop');
    expect(row.product_name).toBe('New name');
  });

  it('a stale push keeps the newer note and the newer copy of a sitting both hold', async () => {
    const db = seed({
      tastings: [record('first', '2026-11-01T08:00:00.000Z', 'edited on the laptop')],
      note: note('laptop note', '2026-11-07T08:00:00.000Z'),
    });
    await push(db, {
      tastings: [record('first', '2026-11-01T08:00:00.000Z', 'phone copy from before'), record('phone', '2026-11-03T08:00:00.000Z', 'phone sitting')],
      note: note('phone note', '2026-11-03T08:00:00.000Z'),
    });
    const row = stored(db);
    expect(row.note.personalNote).toBe('laptop note');
    expect(row.tastings).toEqual([
      record('first', '2026-11-01T08:00:00.000Z', 'edited on the laptop'),
      record('phone', '2026-11-03T08:00:00.000Z', 'phone sitting'),
    ]);
  });

  it('a later edit of a sitting both hold wins', async () => {
    const db = seed({
      tastings: [record('first', '2026-11-01T08:00:00.000Z', 'before')],
      note: note('before', '2026-11-01T08:00:00.000Z'),
    });
    await push(db, {
      tastings: [record('first', '2026-11-01T08:00:00.000Z', 'after')],
      note: note('after', '2026-11-02T08:00:00.000Z'),
    });
    expect(stored(db).tastings).toEqual([record('first', '2026-11-01T08:00:00.000Z', 'after')]);
  });

  it('a group session sitting the server bridged is not doubled by the device\'s own copy', async () => {
    const db = seed({
      tastings: [record('bridge-id', '2026-11-04T08:00:00.000Z', 'bridged', { sourceType: 'session', eventId: 'session-1' })],
      note: note('bridged', '2026-11-04T08:00:00.000Z'),
    });
    await push(db, {
      tastings: [record('device-id', '2026-11-04T08:00:01.000Z', 'device copy', { sourceType: 'session', eventId: 'session-1' })],
      note: note('device copy', '2026-11-04T08:00:01.000Z'),
    });
    const row = stored(db);
    expect(row.tastings).toHaveLength(1);
    expect(row.tastings[0].tasting.notes).toEqual(['device copy']);
  });

  it('a first push and archiving behave as before', async () => {
    const fresh = seed();
    await push(fresh, {
      id: 'entry-phone',
      tastings: [record('phone', '2026-11-06T08:00:00.000Z', 'phone sitting')],
      note: note('phone note', '2026-11-06T08:00:00.000Z'),
    });
    expect(stored(fresh)).toMatchObject({ id: 'entry-phone', archived: 0, tastings: [record('phone', '2026-11-06T08:00:00.000Z', 'phone sitting')] });

    const sittings = [record('first', '2026-11-01T08:00:00.000Z', 'first')];
    const archived = seed({ tastings: sittings, note: note('n', '2026-11-05T08:00:00.000Z') });
    await push(archived, { archived: 1, tastings: sittings, note: note('n', '2026-11-05T08:00:00.000Z') });
    expect(stored(archived).archived).toBe(1);
    await push(archived, { archived: 0, tastings: sittings, note: note('n', '2026-11-05T08:00:00.000Z') });
    expect(stored(archived).archived).toBe(0);
  });
});
