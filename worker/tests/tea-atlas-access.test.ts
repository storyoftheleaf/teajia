import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { atlasKeyFor, hasTeaAtlasTick, withTeaAtlasTick } from '../src/atlas';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Tea Atlas is visible only to people given access (docs/TEA_ATLAS.md).
//
// The rule this file pins: for anyone who may not read it, the library does
// not exist. A page's data, the home index and a picture all answer exactly
// what an unknown API route answers, whether the visitor is signed out, a
// customer, staff holding every bundle, a platform admin, or the owner of
// another shop. The site owner and a ticked member of the platform account
// read it. Then the tick itself: who can set it, where, and that nothing else
// quietly clears it.

const SECRET = 'tea-atlas-secret';
const PLATFORM = 'acc-platform';
const OTHER_SHOP = 'acc-other';
const databases: SqliteD1[] = [];

const ARTICLE = 'articles/2012-02-p03-answering-some-puerh-questions.json';
const HOME = 'home.json';
const PICTURE = 'media/2012-02/2012-02-001-000.jpg';

/** A private bucket holding one article, the home index and one picture. */
function fakeBucket() {
  const objects = new Map<string, { body: string; type: string }>([
    [ARTICLE, { body: JSON.stringify({ id: '2012-02-p03-answering-some-puerh-questions', blocks: [{ t: 'p', v: 'Puerh questions.' }] }), type: 'application/json' }],
    ['index/v1/home.json', { body: JSON.stringify({ format: 1, sources: [], topics: [] }), type: 'application/json' }],
    [PICTURE, { body: 'JPEGBYTES', type: 'image/jpeg' }],
  ]);
  const reads: string[] = [];
  return {
    reads,
    get: async (key: string) => {
      reads.push(key);
      const hit = objects.get(key);
      if (!hit) return null;
      return {
        body: new Response(hit.body).body,
        httpEtag: `"${key.length}"`,
        writeHttpMetadata: (headers: Headers) => headers.set('Content-Type', hit.type),
      };
    },
  };
}

function setup() {
  const db = new SqliteD1('schema');
  databases.push(db);
  const bucket = fakeBucket();

  // The site owner, who is also the owner of the platform account.
  seedIdentity(db, { userId: 'site-owner', accountId: PLATFORM, role: 'owner', platformRole: 'platform_owner' });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run(PLATFORM);
  // Staff on the platform account with all six bundles and no tick.
  seedIdentity(db, { userId: 'staff-all-bundles', accountId: PLATFORM, role: 'staff', bundles: ['catalog', 'stock', 'publish', 'gather', 'sell', 'members'] });
  // A viewer on the platform account, the shape a plain reader is given.
  seedIdentity(db, { userId: 'reader', accountId: PLATFORM, role: 'viewer', bundles: [] });
  // Staff on the platform account who may grant (Members) but has no tick.
  seedIdentity(db, { userId: 'access-manager', accountId: PLATFORM, role: 'staff', bundles: ['members'] });
  // A platform admin: all bundles everywhere, and still no library.
  db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, platform_role, session_version)
    VALUES ('platform-admin', 'admin@test.dev', 'admin', 'test', 'user', 'platform_admin', 0)`).run();
  // The owner of another shop, and a staff member there carrying a tick that
  // only counts on the platform account.
  seedIdentity(db, { userId: 'other-owner', accountId: OTHER_SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'other-staff', accountId: OTHER_SHOP, role: 'staff', bundles: ['members'] });
  db.sqlite.prepare('UPDATE account_members SET permissions = ? WHERE user_id = ?')
    .run(JSON.stringify({ bundles: ['members'], tea_atlas: true }), 'other-staff');
  // A signed-in customer with no membership anywhere.
  db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version)
    VALUES ('customer', 'customer@test.dev', 'customer', 'test', 'user', 0)`).run();

  const env = { DB: db as any, JWT_SECRET: SECRET, ATLAS_BUCKET: bucket, APP_URL: 'https://www.teajia.com' } as any;
  return { db, bucket, env };
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function request(env: any, path: string, userId: string | null, options: { method?: string; body?: unknown; accountId?: string } = {}) {
  const headers = new Headers();
  if (userId) {
    const token = await signedToken(SECRET, {
      sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: options.accountId ?? PLATFORM,
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', options.accountId ?? PLATFORM);
  }
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), env);
}

const SURFACES = { 'a page': ARTICLE, 'the API': HOME, 'a picture': PICTURE };

describe('the library does not exist for anyone without access', () => {
  const outsiders: Array<[string, string | null]> = [
    ['a signed-out visitor', null],
    ['a signed-in customer', 'customer'],
    ['staff holding every bundle, no tick', 'staff-all-bundles'],
    ['a platform admin', 'platform-admin'],
    ['the owner of another shop', 'other-owner'],
    ['staff ticked on another shop', 'other-staff'],
  ];

  for (const [who, userId] of outsiders) {
    for (const [what, path] of Object.entries(SURFACES)) {
      it(`${who} gets the plain 404 on ${what}`, async () => {
        const { env, bucket } = setup();
        const unknownRoute = await request(env, '/api/no-such-route', userId, { accountId: userId === 'other-owner' || userId === 'other-staff' ? OTHER_SHOP : PLATFORM });
        const res = await request(env, `/api/atlas/${path}`, userId, { accountId: userId === 'other-owner' || userId === 'other-staff' ? OTHER_SHOP : PLATFORM });
        expect(res.status).toBe(404);
        expect(await res.text()).toBe(await unknownRoute.text());
        expect(res.headers.get('Content-Type')).toBe('application/json');
        // Decided before storage is touched: a real key and a made-up one cannot be told apart.
        expect(bucket.reads).toEqual([]);
      });
    }
  }

  it('answers 404, not 401, to an expired or forged token', async () => {
    const { env } = setup();
    const res = await worker.fetch(new Request(`https://worker.test/api/atlas/${HOME}`, {
      headers: { Authorization: 'Bearer not.a.token' },
    }), env);
    expect(res.status).toBe(404);
  });
});

describe('the site owner and ticked members read it', () => {
  for (const [what, path] of Object.entries(SURFACES)) {
    it(`the site owner gets 200 on ${what}`, async () => {
      const { env } = setup();
      const res = await request(env, `/api/atlas/${path}`, 'site-owner');
      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toMatch(/^private/);
      expect(res.headers.get('X-Robots-Tag')).toContain('noindex');
    });
  }

  it('serves a picture as the picture', async () => {
    const { env } = setup();
    const res = await request(env, `/api/atlas/${PICTURE}`, 'site-owner');
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(await res.text()).toBe('JPEGBYTES');
  });

  it('a missing article is the same 404 for the owner too', async () => {
    const { env } = setup();
    const res = await request(env, '/api/atlas/articles/not-there.json', 'site-owner');
    expect(res.status).toBe(404);
  });

  it('never serves the upload record or the raw manifest', async () => {
    const { env, bucket } = setup();
    for (const path of ['_atlas-upload-state.json', 'manifest.json', 'README.md', 'index/v1/home.json', 'media/../manifest.json']) {
      const res = await request(env, `/api/atlas/${path}`, 'site-owner');
      expect(res.status, path).toBe(404);
    }
    expect(bucket.reads).toEqual([]);
  });
});

describe('the tick', () => {
  it('opens the library for one person and closes it again', async () => {
    const { env } = setup();
    expect((await request(env, `/api/atlas/${ARTICLE}`, 'reader')).status).toBe(404);

    const grant = await request(env, `/api/accounts/${PLATFORM}/members/reader/tea-atlas`, 'site-owner', { method: 'PUT', body: { granted: true } });
    expect(grant.status).toBe(200);
    expect((await request(env, `/api/atlas/${ARTICLE}`, 'reader')).status).toBe(200);
    expect((await request(env, `/api/atlas/${PICTURE}`, 'reader')).status).toBe(200);

    const revoke = await request(env, `/api/accounts/${PLATFORM}/members/reader/tea-atlas`, 'site-owner', { method: 'PUT', body: { granted: false } });
    expect(revoke.status).toBe(200);
    expect((await request(env, `/api/atlas/${ARTICLE}`, 'reader')).status).toBe(404);
  });

  it('an access manager may set it; staff without Members may not', async () => {
    const { env } = setup();
    const byManager = await request(env, `/api/accounts/${PLATFORM}/members/reader/tea-atlas`, 'access-manager', { method: 'PUT', body: { granted: true } });
    expect(byManager.status).toBe(200);
    const byReader = await request(env, `/api/accounts/${PLATFORM}/members/staff-all-bundles/tea-atlas`, 'reader', { method: 'PUT', body: { granted: true } });
    expect(byReader.status).toBe(403);
  });

  it('is not offered on any other shop', async () => {
    const { env } = setup();
    const res = await request(env, `/api/accounts/${OTHER_SHOP}/members/other-staff/tea-atlas`, 'other-owner', { method: 'PUT', body: { granted: true }, accountId: OTHER_SHOP });
    expect(res.status).toBe(404);
  });

  it('cannot be taken from the site owner', async () => {
    const { env } = setup();
    const res = await request(env, `/api/accounts/${PLATFORM}/members/site-owner/tea-atlas`, 'access-manager', { method: 'PUT', body: { granted: false } });
    expect(res.status).toBe(400);
  });

  it('survives a change of bundles', async () => {
    const { env } = setup();
    await request(env, `/api/accounts/${PLATFORM}/members/staff-all-bundles/tea-atlas`, 'site-owner', { method: 'PUT', body: { granted: true } });
    const bundles = await request(env, `/api/accounts/${PLATFORM}/members/staff-all-bundles/bundles`, 'site-owner', { method: 'PUT', body: { bundles: ['sell'] } });
    expect(bundles.status).toBe(200);
    expect((await request(env, `/api/atlas/${HOME}`, 'staff-all-bundles')).status).toBe(200);
  });

  it('shows on the roster of the platform account only', async () => {
    const { env } = setup();
    await request(env, `/api/accounts/${PLATFORM}/members/reader/tea-atlas`, 'site-owner', { method: 'PUT', body: { granted: true } });
    const roster = await (await request(env, `/api/accounts/${PLATFORM}/access`, 'site-owner')).json() as any;
    const byId = Object.fromEntries(roster.members.map((m: any) => [m.user_id, m]));
    expect(byId['site-owner']).toMatchObject({ tea_atlas: true, tea_atlas_always: true });
    expect(byId.reader).toMatchObject({ tea_atlas: true, tea_atlas_always: false });
    expect(byId['staff-all-bundles']).toMatchObject({ tea_atlas: false });
    // Not a bundle: it never appears among them.
    expect(byId.reader.bundles).not.toContain('tea_atlas');

    const other = await (await request(env, `/api/accounts/${OTHER_SHOP}/access`, 'other-owner', { accountId: OTHER_SHOP })).json() as any;
    for (const m of other.members) expect(m).not.toHaveProperty('tea_atlas');
  });
});

describe('the rules, without a request', () => {
  it('reads and writes the tick without disturbing the rest', () => {
    expect(hasTeaAtlasTick(null)).toBe(false);
    expect(hasTeaAtlasTick('not json')).toBe(false);
    expect(hasTeaAtlasTick('{"tea_atlas":"yes"}')).toBe(false);
    const on = withTeaAtlasTick('{"bundles":["sell"]}', true);
    expect(JSON.parse(on)).toEqual({ bundles: ['sell'], tea_atlas: true });
    expect(JSON.parse(withTeaAtlasTick(on, false))).toEqual({ bundles: ['sell'] });
  });

  it('maps only the published shapes to keys', () => {
    expect(atlasKeyFor('home.json')).toBe('index/v1/home.json');
    expect(atlasKeyFor('issues/2012-02.json')).toBe('index/v1/issues/2012-02.json');
    expect(atlasKeyFor('search/text/pu.json')).toBe('index/v1/search/text/pu.json');
    expect(atlasKeyFor('search/text/u3f.json')).toBe('index/v1/search/text/u3f.json');
    expect(atlasKeyFor(ARTICLE)).toBe(ARTICLE);
    expect(atlasKeyFor(PICTURE)).toBe(PICTURE);
    for (const bad of ['manifest.json', '_atlas-upload-state.json', 'index/v1/home.json', 'media/../x.jpg', 'media/a/b.png', 'articles/x.json/../y', 'issues/.json']) {
      expect(atlasKeyFor(bad), bad).toBeNull();
    }
  });
});
