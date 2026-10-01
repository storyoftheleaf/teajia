import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { mayEditReadMagazine, parseReadPublishRequest, publishStatesFromRows } from '../src/readPublishDomain';
import { ARTICLE_LIVE, isReadPathPublic } from '../../src/pages/read/articleLive';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// A Read story is published, or taken back down, from the story itself
// (migration 0030). What this file pins: only Teajia's own editors may press
// the button, never a visitor and never a curator who owns their own shop; a
// stored state overrides the code map in both directions; a path the map does
// not curate is refused; pressing the same button twice changes nothing.
//
// Every request goes through worker.fetch against a real database, so deleting
// the auth check or the path check turns a test here red.

const SECRET = 'read-publish-secret';
const databases: SqliteD1[] = [];

function database(schema: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(schema);
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

function env(db: SqliteD1) {
  return { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any;
}

/** Teajia's own account, marked the way the live one is, and its owner. */
function seedTeajia(db: SqliteD1) {
  seedIdentity(db, { userId: 'adrian', accountId: 'acc_teajia', role: 'owner' });
  db.sqlite.prepare(`UPDATE accounts SET is_platform_owner = 1, kind = 'platform' WHERE id = 'acc_teajia'`).run();
}

/** A curator: owns a shop on the network, is nobody at Teajia. */
function seedCurator(db: SqliteD1) {
  seedIdentity(db, { userId: 'curator', accountId: 'acc_curator', role: 'owner' });
  db.sqlite.prepare(`UPDATE accounts SET kind = 'master' WHERE id = 'acc_curator'`).run();
}

async function press(db: SqliteD1, userId: string | null, body: unknown, accountId = 'acc_teajia') {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (userId) {
    const token = await signedToken(SECRET, {
      sub: userId, email: `${userId}@test.dev`, name: userId,
      active_account_id: accountId, platform_role: null,
    });
    headers.set('Authorization', `Bearer ${token}`);
  }
  return worker.fetch(new Request('https://worker.test/api/read/publish-state', {
    method: 'POST', headers, body: JSON.stringify(body),
  }), env(db));
}

async function states(db: SqliteD1): Promise<Record<string, 'live' | 'draft'>> {
  const response = await worker.fetch(new Request('https://worker.test/api/public/read/publish-state'), env(db));
  expect(response.status).toBe(200);
  return (await response.json()).states;
}

function rows(db: SqliteD1) {
  return db.sqlite.prepare('SELECT path, account_id, state, changed_by FROM read_publish_state ORDER BY path').all();
}

describe('the rules, without a request', () => {
  it('lets the platform tier and Teajia\'s own owner in, and keeps a curator out', () => {
    expect(mayEditReadMagazine({ platformRole: 'platform_owner', memberships: [] })).toBe(true);
    expect(mayEditReadMagazine({ platformRole: 'platform_admin', memberships: [] })).toBe(true);
    expect(mayEditReadMagazine({ platformRole: null, memberships: [{ role: 'owner', account_kind: 'platform' }] })).toBe(true);
    expect(mayEditReadMagazine({ platformRole: null, memberships: [{ role: 'owner', is_platform_account: true }] })).toBe(true);
    expect(mayEditReadMagazine({ platformRole: null, memberships: [{ role: 'staff', account_kind: 'platform', bundles: ['publish'] }] })).toBe(true);
    // The over-grant: owning SOME account is not owning Teajia's.
    expect(mayEditReadMagazine({ platformRole: null, memberships: [{ role: 'owner', account_kind: 'master' }] })).toBe(false);
    expect(mayEditReadMagazine({ platformRole: null, memberships: [{ role: 'owner', account_kind: 'location' }] })).toBe(false);
    expect(mayEditReadMagazine({ platformRole: null, memberships: [{ role: 'staff', account_kind: 'platform', bundles: ['stock'] }] })).toBe(false);
    expect(mayEditReadMagazine({ platformRole: null, memberships: [{ role: 'viewer', account_kind: 'platform' }] })).toBe(false);
    expect(mayEditReadMagazine({ platformRole: null, memberships: [] })).toBe(false);
  });

  it('accepts only a curated path and a real state', () => {
    expect(parseReadPublishRequest({ path: '/read/history', state: 'live' })).toEqual({ path: '/read/history', state: 'live' });
    expect(parseReadPublishRequest({ path: '/read/history/', state: 'draft' })).toEqual({ path: '/read/history', state: 'draft' });
    expect(parseReadPublishRequest({ path: '/read/never-written', state: 'live' })).toMatchObject({ code: 'read_publish_unknown_path' });
    // The ungated pages are not the map's to change: they are always public.
    expect(parseReadPublishRequest({ path: '/read/leaf-to-liquor', state: 'draft' })).toMatchObject({ code: 'read_publish_unknown_path' });
    expect(parseReadPublishRequest({ path: '/read', state: 'draft' })).toMatchObject({ code: 'read_publish_unknown_path' });
    expect(parseReadPublishRequest({ path: '/read/history', state: 'published' })).toMatchObject({ code: 'read_publish_state' });
    expect(parseReadPublishRequest(null)).toMatchObject({ code: 'read_publish_body' });
  });

  it('serves only rows for curated paths', () => {
    expect(publishStatesFromRows([
      { path: '/read/history', state: 'live' },
      { path: '/read/somewhere-else', state: 'live' },
      { path: '/read/ritual', state: 'nonsense' },
    ])).toEqual({ '/read/history': 'live' });
  });

  it('lets a stored state override the map in both directions, and no row leaves the map deciding', () => {
    expect(ARTICLE_LIVE['/read/history']).toBe(false);
    expect(ARTICLE_LIVE['/read/porcelain-and-tea']).toBe(true);
    expect(isReadPathPublic('/read/history', { '/read/history': 'live' })).toBe(true);
    expect(isReadPathPublic('/read/porcelain-and-tea', { '/read/porcelain-and-tea': 'draft' })).toBe(false);
    expect(isReadPathPublic('/read/history', {})).toBe(false);
    expect(isReadPathPublic('/read/porcelain-and-tea', {})).toBe(true);
    // A stray row cannot open a path the map never listed, nor close an ungated one.
    expect(isReadPathPublic('/read/never-written', { '/read/never-written': 'live' })).toBe(false);
    expect(isReadPathPublic('/read/leaf-to-liquor', { '/read/leaf-to-liquor': 'draft' })).toBe(true);
  });
});

describe('who may press Publish', () => {
  it('refuses a visitor with no session, and writes nothing', async () => {
    const db = database();
    seedTeajia(db);
    const response = await press(db, null, { path: '/read/history', state: 'live' });
    expect(response.status).toBe(401);
    expect(rows(db)).toEqual([]);
  });

  it('refuses a curator who owns their own shop, and writes nothing', async () => {
    const db = database();
    seedTeajia(db); seedCurator(db);
    const response = await press(db, 'curator', { path: '/read/history', state: 'live' }, 'acc_curator');
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('read_editor_required');
    expect(rows(db)).toEqual([]);
  });

  it('refuses a curator even when they name Teajia\'s account in the header', async () => {
    const db = database();
    seedTeajia(db); seedCurator(db);
    const response = await press(db, 'curator', { path: '/read/history', state: 'live' }, 'acc_teajia');
    expect(response.status).toBe(403);
    expect(rows(db)).toEqual([]);
  });

  it('accepts Teajia\'s owner, records who and on whose account, and logs it', async () => {
    const db = database();
    seedTeajia(db);
    const response = await press(db, 'adrian', { path: '/read/history', state: 'live' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ path: '/read/history', state: 'live', changed: true });
    expect(body.states).toEqual({ '/read/history': 'live' });
    expect(rows(db)).toEqual([{ path: '/read/history', account_id: 'acc_teajia', state: 'live', changed_by: 'adrian' }]);
    const audit = db.sqlite.prepare(`SELECT action, target_id, account_id FROM platform_audit_log WHERE target_type = 'read_story'`).all();
    expect(audit).toEqual([{ action: 'read.published', target_id: '/read/history', account_id: 'acc_teajia' }]);
  });

  it('accepts the platform owner with no membership at all', async () => {
    const db = database();
    seedTeajia(db);
    seedIdentity(db, { userId: 'platform-person', accountId: 'acc_elsewhere', role: 'viewer', platformRole: 'platform_owner' });
    const response = await press(db, 'platform-person', { path: '/read/history', state: 'live' }, 'acc_elsewhere');
    expect(response.status).toBe(200);
  });

  it('refuses a path that is not one of the Read stories', async () => {
    const db = database();
    seedTeajia(db);
    const response = await press(db, 'adrian', { path: '/read/never-written', state: 'live' });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('read_publish_unknown_path');
    expect(rows(db)).toEqual([]);
  });

  it('makes a draft public for a visitor at once', async () => {
    const db = database();
    seedTeajia(db);
    expect(isReadPathPublic('/read/history', await states(db))).toBe(false);
    await press(db, 'adrian', { path: '/read/history', state: 'live' });
    expect(isReadPathPublic('/read/history', await states(db))).toBe(true);
  });

  it('is harmless pressed twice: one row, one log line', async () => {
    const db = database();
    seedTeajia(db);
    await press(db, 'adrian', { path: '/read/history', state: 'live' });
    const again = await press(db, 'adrian', { path: '/read/history', state: 'live' });
    expect(again.status).toBe(200);
    expect((await again.json()).changed).toBe(false);
    expect(rows(db)).toHaveLength(1);
    const logged = db.sqlite.prepare(`SELECT COUNT(*) AS n FROM platform_audit_log WHERE target_type = 'read_story'`).get() as { n: number };
    expect(logged.n).toBe(1);
  });
});

describe('Unpublish', () => {
  it('refuses a visitor and a curator, and writes nothing', async () => {
    const db = database();
    seedTeajia(db); seedCurator(db);
    expect((await press(db, null, { path: '/read/porcelain-and-tea', state: 'draft' })).status).toBe(401);
    expect((await press(db, 'curator', { path: '/read/porcelain-and-tea', state: 'draft' }, 'acc_curator')).status).toBe(403);
    expect(rows(db)).toEqual([]);
    expect(isReadPathPublic('/read/porcelain-and-tea', await states(db))).toBe(true);
  });

  it('takes a story the map calls live back to draft for visitors, and Publish restores it', async () => {
    const db = database();
    seedTeajia(db);
    expect(ARTICLE_LIVE['/read/porcelain-and-tea']).toBe(true);

    const down = await press(db, 'adrian', { path: '/read/porcelain-and-tea', state: 'draft' });
    expect(down.status).toBe(200);
    expect(isReadPathPublic('/read/porcelain-and-tea', await states(db))).toBe(false);

    const up = await press(db, 'adrian', { path: '/read/porcelain-and-tea', state: 'live' });
    expect(up.status).toBe(200);
    expect(isReadPathPublic('/read/porcelain-and-tea', await states(db))).toBe(true);

    const actions = db.sqlite.prepare(`SELECT action FROM platform_audit_log WHERE target_type = 'read_story' ORDER BY rowid`).all();
    expect(actions).toEqual([{ action: 'read.unpublished' }, { action: 'read.published' }]);
  });
});

describe('the public read', () => {
  it('answers an empty map before anything is pressed, with a short cache', async () => {
    const db = database();
    const response = await worker.fetch(new Request('https://worker.test/api/public/read/publish-state'), env(db));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=15');
    expect(await response.json()).toEqual({ states: {} });
  });

  it('exists in the migration ledger the live database is built from, with no rows', () => {
    const db = database('migrations');
    const count = db.sqlite.prepare('SELECT COUNT(*) AS n FROM read_publish_state').get() as { n: number };
    expect(count.n).toBe(0);
  });
});
