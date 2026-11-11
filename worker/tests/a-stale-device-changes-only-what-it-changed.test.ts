import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { previewCurateMutation, confirmCurateMutation } from '../src/curateMutations';
import type { ToolAuth, ToolEnv } from '../src/mcpTools/registry';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * Curate used to sync whole records, last write wins, so a phone holding
 * yesterday's copy of a tea put yesterday's price and name back when it saved
 * today's note. A current browser now says which fields it changed, what they
 * held before, and when (`changes` beside `entries`), and the worker writes
 * only those (`worker/src/compassFieldPatch.ts`). Driven through the worker's
 * own route against the migration ledger, as the owner (the audited write)
 * and as an ordinary member writing their own tea (the plain upsert).
 */

const SECRET = 'field-patch-secret';
const ACCOUNT = 'shop';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

const YESTERDAY = '2026-11-10T08:00:00.000Z';
const LAPTOP_SAVED = '2026-11-11T09:00:00.000Z';

/** What the phone loaded yesterday, as its sync sends it. */
const phoneCopy = {
  id: 'tea', name: 'Old name', notes: 'old note', price_amount: 100, price_currency: 'Yuan',
  price_per_unit_grams: 357, season: null, storage: null, photos: '[]', audio_clips: '[]',
};

function seed() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: ACCOUNT, role: 'owner' });
  seedIdentity(db, { userId: 'member', accountId: ACCOUNT, role: 'staff', bundles: [] });
  db.sqlite.exec(`
    INSERT INTO tea_compass_entries (id, account_id, user_id, name, notes, price_amount, price_currency, price_per_unit_grams, photos, updated_at) VALUES
      ('tea', '${ACCOUNT}', 'owner', 'New name', 'new note', 120, 'Yuan', 357, '[]', '${LAPTOP_SAVED}'),
      ('own', '${ACCOUNT}', 'member', 'New name', 'new note', 120, 'Yuan', 357, '[]', '${LAPTOP_SAVED}');
  `);
  return db;
}

async function sync(db: SqliteD1, user: string, body: unknown) {
  const token = await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, active_account_id: ACCOUNT });
  const response = await worker.fetch(new Request('https://app.test/api/compass/sync', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
  return { status: response.status, body: await response.json() as any };
}

const tea = (db: SqliteD1, id = 'tea') => db.sqlite.prepare('SELECT * FROM tea_compass_entries WHERE id = ?').get(id) as any;
const hint = (fields: Record<string, { base: unknown; at: string }>) => ({
  fields: Object.keys(fields),
  base: Object.fromEntries(Object.entries(fields).map(([field, edit]) => [field, edit.base])),
  edited_at: Object.fromEntries(Object.entries(fields).map(([field, edit]) => [field, edit.at])),
});

describe('a save from a device changes only the fields that device changed', () => {
  it('a stale device changing one field leaves a newer price, name and note alone', async () => {
    for (const [user, id] of [['owner', 'tea'], ['member', 'own']] as const) {
      const db = seed();
      const result = await sync(db, user, {
        entries: [{ ...phoneCopy, id, season: 'Spring' }],
        changes: { [id]: hint({ season: { base: null, at: '2026-11-11T10:00:00.000Z' } }) },
      });
      expect(result.status).toBe(200);
      expect(result.body.syncedIds).toEqual([id]);
      expect(tea(db, id)).toMatchObject({ season: 'Spring', name: 'New name', notes: 'new note', price_amount: 120, price_currency: 'Yuan' });
    }
  });

  it('a first product link a device gives an existing tea still lands, and a stale one is refused', async () => {
    // A graduated sample: the product is created naming the tea, then the
    // device links the tea to it in a field patch.
    const db = seed();
    db.sqlite.exec(`INSERT INTO products (id, account_id, product_name, type, source_compass_entry_id) VALUES ('made', '${ACCOUNT}', 'Made from tea', 'Oolong', 'tea'), ('other', '${ACCOUNT}', 'Another tea', 'Oolong', NULL)`);
    const linked = await sync(db, 'owner', {
      entries: [{ ...phoneCopy, id: 'tea', draft_product_id: 'made' }],
      changes: { tea: hint({ draft_product_id: { base: null, at: '2026-11-11T10:00:00.000Z' } }) },
    });
    expect(linked.status).toBe(200);
    expect(tea(db)).toMatchObject({ draft_product_id: 'made', name: 'New name', price_amount: 120 });

    // Once linked, a device cannot point the tea at a different product.
    const repointed = await sync(db, 'owner', {
      entries: [{ ...phoneCopy, id: 'tea', draft_product_id: 'other' }],
      changes: { tea: hint({ draft_product_id: { base: 'made', at: '2026-11-11T11:00:00.000Z' } }) },
    });
    expect(repointed.status).toBe(200);
    expect(tea(db).draft_product_id).toBe('made');

    // And a device that never touched the link does not send one.
    const untouched = await sync(db, 'owner', {
      entries: [{ ...phoneCopy, id: 'tea', draft_product_id: null, season: 'Autumn' }],
      changes: { tea: hint({ season: { base: null, at: '2026-11-11T12:00:00.000Z' } }) },
    });
    expect(untouched.status).toBe(200);
    expect(tea(db)).toMatchObject({ draft_product_id: 'made', season: 'Autumn' });
  });

  it('when both changed the same field, the later edit wins and nothing else is disturbed', async () => {
    const earlier = seed();
    const lost = await sync(earlier, 'owner', {
      entries: [{ ...phoneCopy, notes: 'phone note typed before the laptop saved', season: 'Autumn' }],
      changes: { tea: hint({
        notes: { base: 'old note', at: '2026-11-11T08:30:00.000Z' },
        season: { base: null, at: '2026-11-11T08:30:00.000Z' },
      }) },
    });
    expect(lost.body.syncedIds).toEqual(['tea']);
    expect(lost.body.kept_server).toEqual({ tea: ['notes'] });
    expect(tea(earlier)).toMatchObject({ notes: 'new note', season: 'Autumn', name: 'New name', price_amount: 120 });

    const later = seed();
    await sync(later, 'owner', {
      entries: [{ ...phoneCopy, notes: 'phone note typed after the laptop saved' }],
      changes: { tea: hint({ notes: { base: 'old note', at: '2026-11-11T09:30:00.000Z' } }) },
    });
    expect(tea(later)).toMatchObject({ notes: 'phone note typed after the laptop saved', name: 'New name', price_amount: 120 });
  });

  it('an old-style whole-record save still behaves as today', async () => {
    const db = seed();
    const result = await sync(db, 'owner', { entries: [{ ...phoneCopy, season: 'Spring' }] });
    expect(result.body.syncedIds).toEqual(['tea']);
    expect(result.body).not.toHaveProperty('kept_server');
    expect(tea(db)).toMatchObject({ season: 'Spring', name: 'Old name', notes: 'old note', price_amount: 100 });
  });

  it('a new tea is created whole whatever the hint says', async () => {
    const db = seed();
    await sync(db, 'owner', {
      entries: [{ ...phoneCopy, id: 'fresh', name: 'Fresh', season: 'Winter' }],
      changes: { fresh: hint({ season: { base: null, at: '2026-11-11T10:00:00.000Z' } }) },
    });
    expect(tea(db, 'fresh')).toMatchObject({ name: 'Fresh', season: 'Winter', notes: 'old note', price_amount: 100, price_currency: 'Yuan' });
  });

  it('a device with nothing left to write is acknowledged without a write', async () => {
    const db = seed();
    const before = tea(db);
    const result = await sync(db, 'owner', { entries: [phoneCopy], changes: { tea: hint({}) } });
    expect(result.body.syncedIds).toEqual(['tea']);
    expect(tea(db)).toEqual(before);
  });

  it('a patch that touches cost keeps the amount with the currency it was typed in', async () => {
    // The laptop re-stated the money in Taiwan dollars after the phone loaded it.
    const restated = () => {
      const db = seed();
      db.sqlite.exec(`UPDATE tea_compass_entries SET price_amount = 450, price_currency = 'NT' WHERE id = 'tea'`);
      return db;
    };
    // The phone typed 110 (yuan, as it showed) BEFORE the laptop's change: the
    // laptop's amount and currency stay together, the phone's 110 is not
    // written onto Taiwan dollars.
    const older = restated();
    const kept = await sync(older, 'owner', {
      entries: [{ ...phoneCopy, price_amount: 110 }],
      changes: { tea: hint({ price_amount: { base: 100, at: '2026-11-11T08:30:00.000Z' } }) },
    });
    expect(kept.body.kept_server).toEqual({ tea: ['price_amount'] });
    expect(tea(older)).toMatchObject({ price_amount: 450, price_currency: 'NT' });

    // Typed AFTER the laptop's change: the phone's amount lands with its own
    // currency, never as 110 Taiwan dollars.
    const newer = restated();
    await sync(newer, 'owner', {
      entries: [{ ...phoneCopy, price_amount: 110 }],
      changes: { tea: hint({ price_amount: { base: 100, at: '2026-11-11T09:30:00.000Z' } }) },
    });
    expect(tea(newer)).toMatchObject({ price_amount: 110, price_currency: 'Yuan' });

    // Same currency on both sides: only the amount moves, a typed 0 stays 0,
    // and the price-per grams the laptop changed is left alone.
    const zero = seed();
    zero.sqlite.exec(`UPDATE tea_compass_entries SET price_per_unit_grams = 100 WHERE id = 'tea'`);
    await sync(zero, 'owner', {
      entries: [{ ...phoneCopy, price_amount: 0 }],
      changes: { tea: hint({ price_amount: { base: 100, at: '2026-11-11T10:00:00.000Z' } }) },
    });
    expect(tea(zero)).toMatchObject({ price_amount: 0, price_currency: 'Yuan', price_per_unit_grams: 100 });

    // Clearing a price is a NULL, not a zero.
    const cleared = seed();
    await sync(cleared, 'owner', {
      entries: [{ ...phoneCopy, price_amount: null }],
      changes: { tea: hint({ price_amount: { base: 120, at: '2026-11-11T10:00:00.000Z' } }) },
    });
    expect(tea(cleared).price_amount).toBeNull();
  });

  it('an offline queue replayed after another device\'s edits keeps the other device\'s later work', async () => {
    // The phone went offline yesterday evening with two edits queued: a note
    // and a price. The laptop changed the price this morning. The phone comes
    // back online now and replays its queue.
    const db = seed();
    const offline = '2026-11-10T20:00:00.000Z';
    const result = await sync(db, 'owner', {
      entries: [{ ...phoneCopy, notes: 'written offline', price_amount: 105, storage: 'Dry' }],
      changes: { tea: hint({
        notes: { base: 'new note', at: offline },
        price_amount: { base: 100, at: offline },
        storage: { base: null, at: offline },
      }) },
    });
    expect(result.body.syncedIds).toEqual(['tea']);
    expect(tea(db)).toMatchObject({ notes: 'written offline', storage: 'Dry', price_amount: 120, name: 'New name' });
  });

  it('the agent door\'s write survives a stale tab\'s save', async () => {
    const db = seed();
    const env = { DB: db as unknown as D1Database } as ToolEnv;
    const auth: ToolAuth = { accountId: ACCOUNT, userId: 'owner', tokenId: 'token', userEmail: 'owner@test.dev', creatorTier: 'admin' } as ToolAuth;
    const preview = await previewCurateMutation(env, auth, { action: 'edit', entity: 'tea', id: 'tea', fields: { price_amount: 135, name: 'Agent name' } });
    await confirmCurateMutation(env, auth, preview.confirmation_token);
    expect(tea(db)).toMatchObject({ price_amount: 135, name: 'Agent name' });

    // A tab opened before the agent's correction saves a note.
    await sync(db, 'owner', {
      entries: [{ ...phoneCopy, notes: 'note from the stale tab' }],
      changes: { tea: hint({ notes: { base: 'new note', at: new Date().toISOString() } }) },
    });
    expect(tea(db)).toMatchObject({ notes: 'note from the stale tab', price_amount: 135, price_currency: 'Yuan', name: 'Agent name' });
  });

  it('refuses a malformed change list instead of guessing', async () => {
    const db = seed();
    const result = await sync(db, 'owner', { entries: [phoneCopy], changes: { tea: { fields: 'notes' } } });
    expect(result.status).toBe(400);
    expect(tea(db).name).toBe('New name');
  });
});
