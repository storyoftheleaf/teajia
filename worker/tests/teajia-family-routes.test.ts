import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { seedFromMigrations, splitStatements, MIGRATIONS_DIR } from './helpers/migratedSqlite';
import { inspectJpeg } from '../src/familyJpeg';
import { FAMILY_PAGE_NOT_HIDDEN_SQL } from '../src/familyPersonTastings';

// Teajia family, stage 1 (todo/plans/teajia-family.md): the upload door and
// the shop's side of it, driven through worker.fetch against a real SQLite
// database built from worker/schema.sql.

const SECRET = 'family-secret';
const SHOP = 'acc_teajia_bali';
const OTHER_SHOP = 'acc-other';
const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
  vi.unstubAllGlobals();
});

class Bucket {
  objects = new Map<string, { bytes: Uint8Array; type: string }>();
  async put(key: string, value: ArrayBuffer | Uint8Array, options: any) {
    const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
    this.objects.set(key, { bytes, type: options?.httpMetadata?.contentType });
  }
  async get(key: string) {
    const object = this.objects.get(key);
    return object ? {
      arrayBuffer: async () => object.bytes.slice().buffer, httpMetadata: { contentType: object.type },
      writeHttpMetadata: (headers: Headers) => { headers.set('content-type', object.type); }, httpEtag: '"e"', body: object.bytes,
    } : null;
  }
  async head(key: string) { return this.objects.has(key) ? {} : null; }
  async delete(key: string) { this.objects.delete(key); }
}

/** A JPEG header with real frame dimensions. Only the headers are read by the door. */
function jpeg(width: number, height: number, options: { exif?: boolean; pad?: number } = {}) {
  const parts: number[] = [0xff, 0xd8];
  parts.push(0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00);
  if (options.exif) {
    // APP1 "Exif\0\0" with a scrap of payload: where a phone writes the location.
    parts.push(0xff, 0xe1, 0x00, 0x0c, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d, 0x00, 0x2a);
  }
  parts.push(0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01);
  parts.push(0xff, 0xda, 0x00, 0x0c, 0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00);
  for (let i = 0; i < (options.pad ?? 64); i += 1) parts.push(0x12);
  parts.push(0xff, 0xd9);
  return new Uint8Array(parts);
}

const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);

function setup() {
  const db = new SqliteD1();
  databases.push(db);
  const bucket = new Bucket();
  // The shop: owner holds every bundle. A second shop with its own owner.
  seedIdentity(db, { userId: 'owner', accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'other-owner', accountId: OTHER_SHOP, role: 'owner' });
  // Members: signed up, no account membership at all.
  for (const id of ['member-one', 'member-two', 'visitor-account']) {
    db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES (?, ?, ?, 'x', 'user', 0)`)
      .run(id, `${id}@test.dev`, id === 'member-one' ? 'Mei' : id);
  }
  const product = (id: string, account: string, opts: { isPublic?: number; status?: string; stock?: number } = {}) =>
    db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, status, stock_grams)
      VALUES (?, ?, 'Oolong', ?, ?, ?, ?, ?)`).run(id, account, `Tea ${id}`, `Tea ${id}`, opts.isPublic ?? 1, opts.status ?? 'Active', opts.stock ?? 100);
  product('tea-a', SHOP);
  product('tea-b', SHOP);
  product('tea-gone', SHOP, { status: 'Sold Out', stock: 0 });
  product('tea-hidden', SHOP, { isPublic: 0 });
  product('tea-elsewhere', OTHER_SHOP);
  // Member one's private journal for tea-a: a score and a verdict that must never leave it.
  db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
    VALUES ('journal-one', NULL, 'member-one@test.dev', 'tea-a', 'Tea tea-a', 9, ?, ?)`).run(
    JSON.stringify({ rating: 9, verdict: 'love', personalNote: 'secret words', tasting: {}, updatedAt: '2026-11-19T00:00:00Z' }),
    JSON.stringify([{ id: 's1', createdAt: '2026-11-18T08:00:00Z', tasting: { notes: ['orchid'] } }]),
  );
  const env = {
    DB: db as any, JWT_SECRET: SECRET, MEDIA_BUCKET: bucket as any, GROQ_API_KEY: 'groq',
    PROVIDER_LIMITER: { limit: async () => ({ success: true }) },
  };
  return { db, bucket, env };
}

type Who = { userId: string; account?: string } | null;

async function call(env: any, who: Who, path: string, init: { method?: string; body?: unknown; form?: FormData; ip?: string } = {}) {
  const headers = new Headers();
  if (who) {
    const token = await signedToken(SECRET, {
      sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: who.account ?? null, platform_role: null,
    });
    headers.set('Authorization', `Bearer ${token}`);
    if (who.account) headers.set('X-Teajia-Account', who.account);
  }
  if (init.ip) headers.set('CF-Connecting-IP', init.ip);
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) { body = JSON.stringify(init.body); headers.set('Content-Type', 'application/json'); }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: init.method ?? 'GET', headers, body }), env);
}

const MEMBER = { userId: 'member-one' };
const MEMBER_TWO = { userId: 'member-two' };
const OWNER = { userId: 'owner', account: SHOP };
const OTHER_OWNER = { userId: 'other-owner', account: OTHER_SHOP };

function photoForm(productId: string, options: {
  full?: Uint8Array; small?: Uint8Array; fullType?: string; smallType?: string; page?: string;
} = {}) {
  const form = new FormData();
  form.set('product_id', productId);
  form.set('full', new File([options.full ?? jpeg(2000, 1500, { pad: 4000 })],'full.jpg', { type: options.fullType ?? 'image/jpeg' }));
  form.set('small', new File([options.small ?? jpeg(480, 360)], 'small.jpg', { type: options.smallType ?? 'image/jpeg' }));
  if (options.page) form.set('page', options.page);
  return form;
}

async function upload(env: any, who: Who, productId = 'tea-a', options: Parameters<typeof photoForm>[1] = {}) {
  return call(env, who, '/api/family/photographs', { method: 'POST', form: photoForm(productId, options) });
}

describe('the JPEG reader at the door', () => {
  it('reads the frame size and refuses camera metadata and non-JPEG bytes', () => {
    expect(inspectJpeg(jpeg(2000, 1500))).toEqual({ ok: true, width: 2000, height: 1500 });
    expect(inspectJpeg(jpeg(2000, 1500, { exif: true }))).toEqual({ ok: false, reason: 'carries_metadata' });
    expect(inspectJpeg(new TextEncoder().encode('not a picture at all'))).toEqual({ ok: false, reason: 'not_jpeg' });
    expect(inspectJpeg(jpeg(2000, 1500).slice(0, 30))).toMatchObject({ ok: false });
  });
});

describe('POST /api/family/photographs', () => {
  it('stores both copies for a signed-in member with no shop membership, and files them under the tea\'s shop', async () => {
    const { env, bucket, db } = setup();
    const response = await upload(env, MEMBER, 'tea-a', { page: 'impression' });
    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.remaining).toBe(5);
    expect(body.photograph).toMatchObject({
      product_id: 'tea-a', journal_entry_id: 'journal-one', page: 'impression', share_state: 'private',
      full_width: 2000, full_height: 1500, small_width: 480, small_height: 360,
    });
    expect(body.photograph.small_url).toMatch(/^https:\/\/media\.teajia\.co\/family-photos\/acc_teajia_bali\/tea-a\/.+-small\.jpg\?exp=\d+&sig=[0-9a-f]{64}$/);
    expect([...bucket.objects.values()].map(o => o.type)).toEqual(['image/jpeg', 'image/jpeg']);
    const row = db.sqlite.prepare('SELECT account_id, author_user_id, full_bytes, small_bytes FROM member_photographs').get() as any;
    expect(row).toMatchObject({ account_id: SHOP, author_user_id: 'member-one' });
    expect(row.small_bytes).toBeLessThan(row.full_bytes);
  });

  it('refuses a stranger, the wrong type, a forged signature, location data, oversize copies and mismatched copies, storing nothing', async () => {
    const { env, bucket } = setup();
    expect((await upload(env, null)).status).toBe(401);
    const png = await upload(env, MEMBER, 'tea-a', { fullType: 'image/png' });
    expect(png.status).toBe(415);
    expect(await png.json()).toMatchObject({ code: 'unsupported_media_type', error: 'Photographs are sent as JPEG pictures.' });
    const forged = await upload(env, MEMBER, 'tea-a', { full: new TextEncoder().encode('GIF89a pretending') });
    expect(forged.status).toBe(415);
    expect(await forged.json()).toMatchObject({ code: 'invalid_media_signature' });
    const located = await upload(env, MEMBER, 'tea-a', { full: jpeg(2000, 1500, { exif: true }) });
    expect(located.status).toBe(422);
    expect(await located.json()).toMatchObject({ code: 'photo_carries_metadata' });
    const heavy = await upload(env, MEMBER, 'tea-a', { full: jpeg(2000, 1500, { pad: 1_000_001 }) });
    expect(heavy.status).toBe(413);
    const bigSmall = await upload(env, MEMBER, 'tea-a', { small: jpeg(800, 600) });
    expect(bigSmall.status).toBe(422);
    expect(await bigSmall.json()).toMatchObject({ code: 'photo_wrong_size' });
    const giant = await upload(env, MEMBER, 'tea-a', { full: jpeg(4032, 3024) });
    expect(giant.status).toBe(422);
    const mismatched = await upload(env, MEMBER, 'tea-a', { small: jpeg(360, 480) });
    expect(mismatched.status).toBe(422);
    expect(await mismatched.json()).toMatchObject({ code: 'photo_sizes_do_not_match' });
    expect((await upload(env, MEMBER, 'tea-hidden')).status).toBe(404);
    expect((await upload(env, MEMBER, 'no-such-tea')).status).toBe(404);
    expect(bucket.objects.size).toBe(0);
  });

  it('lets the shop photograph its own tea that is not public yet (the sourcing tasting), and no other shop', async () => {
    const { env } = setup();
    expect((await upload(env, OWNER, 'tea-hidden')).status).toBe(201);
    expect((await upload(env, OTHER_OWNER, 'tea-hidden')).status).toBe(404);
  });

  it('refuses a seventh photograph of one tea in a plain sentence, and a removed one frees its place', async () => {
    const { env, bucket } = setup();
    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await upload(env, MEMBER);
      expect(response.status).toBe(201);
      ids.push(((await response.json()) as any).photograph.id);
    }
    const seventh = await upload(env, MEMBER);
    expect(seventh.status).toBe(409);
    expect(await seventh.json()).toEqual({
      error: 'You have six photographs of this tea. Remove one from your page to add another.', code: 'tea_photo_limit',
    });
    expect(bucket.objects.size).toBe(12);
    // Another tea is its own six.
    expect((await upload(env, MEMBER, 'tea-b')).status).toBe(201);
    expect((await call(env, MEMBER, `/api/family/photographs/${ids[0]}/remove`, { method: 'POST' })).status).toBe(200);
    expect((await upload(env, MEMBER)).status).toBe(201);
  });

  it('holds a daily ceiling across all teas', async () => {
    const { env, db } = setup();
    const insert = db.sqlite.prepare(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key,
      full_bytes, small_bytes, full_width, full_height, small_width, small_height, removed_by_member_at)
      VALUES (?, ?, 'tea-b', 'member-one', ?, ?, 1, 1, 10, 10, 10, 10, datetime('now'))`);
    for (let i = 0; i < 24; i += 1) insert.run(`old-${i}`, SHOP, `f-${i}`, `s-${i}`);
    const response = await upload(env, MEMBER);
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'daily_photo_limit' });
    // Yesterday's photographs do not count against today.
    db.sqlite.exec(`UPDATE member_photographs SET created_at = datetime('now', '-2 days')`);
    expect((await upload(env, MEMBER)).status).toBe(201);
  });
});

describe('the member\'s own tea shop', () => {
  it('lists only their own photographs, and their cover is theirs alone', async () => {
    const { env } = setup();
    const mine = ((await (await upload(env, MEMBER)).json()) as any).photograph.id;
    const theirs = ((await (await upload(env, MEMBER_TWO)).json()) as any).photograph.id;
    expect((await call(env, null, '/api/family/teas/tea-a/mine')).status).toBe(401);
    expect((await call(env, MEMBER, '/api/family/teas/tea-a/cover', { method: 'PUT', body: { photograph_id: theirs } })).status).toBe(404);
    const cover = await call(env, MEMBER, '/api/family/teas/tea-a/cover', { method: 'PUT', body: { photograph_id: mine } });
    expect(await cover.json()).toEqual({ product_id: 'tea-a', cover_photograph_id: mine });
    const view = await (await call(env, MEMBER, '/api/family/teas/tea-a/mine')).json() as any;
    expect(view.photographs.map((p: any) => p.id)).toEqual([mine]);
    expect(view).toMatchObject({ cover_photograph_id: mine, tasting_share_state: 'private', remaining: 5 });
    const other = await (await call(env, MEMBER_TWO, '/api/family/teas/tea-a/mine')).json() as any;
    expect(other).toMatchObject({ cover_photograph_id: null, tasting_share_state: null });
    expect(other.photographs.map((p: any) => p.id)).toEqual([theirs]);
    // Removing the cover photograph clears the cover.
    await call(env, MEMBER, `/api/family/photographs/${mine}/remove`, { method: 'POST' });
    expect(await (await call(env, MEMBER, '/api/family/teas/tea-a/mine')).json()).toMatchObject({ photographs: [], cover_photograph_id: null });
  });
});

describe('sharing a tasting', () => {
  it('needs a saved tasting, shares its photographs with it, and never lets the score out', async () => {
    const { env } = setup();
    await upload(env, MEMBER);
    await upload(env, MEMBER_TWO);
    const unsaved = await call(env, MEMBER_TWO, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } });
    expect(unsaved.status).toBe(409);
    expect(await unsaved.json()).toMatchObject({ code: 'tasting_not_saved' });

    const before = await (await call(env, null, '/api/family/teas/tea-a/photographs')).json() as any;
    expect(before).toEqual({ product_id: 'tea-a', lead: null, placed: [], family: [] });

    const shared = await call(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } });
    expect(shared.status).toBe(200);
    const sharedText = await shared.text();
    expect(JSON.parse(sharedText)).toMatchObject({ share_state: 'page', photographs_updated: 1, journal_entry_id: 'journal-one' });

    const publicView = await call(env, null, '/api/family/teas/tea-a/photographs');
    const publicText = await publicView.text();
    const publicBody = JSON.parse(publicText);
    expect(publicBody.family).toHaveLength(1);
    expect(publicBody.family[0].author).toEqual({ name: 'Mei', page_id: null });
    for (const text of [sharedText, publicText, await (await call(env, MEMBER, '/api/family/teas/tea-a/mine')).text()]) {
      expect(text).not.toMatch(/rating|verdict|love|secret words/);
    }
    // Back to private: gone from the tea page.
    await call(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'private' } });
    expect(((await (await call(env, null, '/api/family/teas/tea-a/photographs')).json()) as any).family).toEqual([]);
    expect((await call(env, null, '/api/family/teas/tea-hidden/photographs')).status).toBe(404);
  });
});

describe('the shop\'s side', () => {
  async function offeredPhoto(env: any) {
    const id = ((await (await upload(env, MEMBER)).json()) as any).photograph.id;
    await call(env, MEMBER, `/api/family/photographs/${id}/share`, { method: 'PUT', body: { share_state: 'offered' } });
    return id as string;
  }

  it('sees only photographs offered to it, and only in its own account', async () => {
    const { env } = setup();
    await upload(env, MEMBER);
    const offered = await offeredPhoto(env);
    expect((await call(env, MEMBER, '/api/admin/family/photographs')).status).toBe(403);
    const pile = await (await call(env, OWNER, '/api/admin/family/photographs')).json() as any;
    expect(pile.photographs.map((p: any) => p.id)).toEqual([offered]);
    expect(pile.photographs[0]).toMatchObject({ product_id: 'tea-a', product_name: 'Tea tea-a', shop_use: 'none', removed_by_author: false, hidden: false });
    expect(((await (await call(env, OTHER_OWNER, '/api/admin/family/photographs')).json()) as any).photographs).toEqual([]);
    expect((await call(env, OTHER_OWNER, `/api/admin/family/photographs/${offered}/lead`, { method: 'POST' })).status).toBe(404);
  });

  it('keeps a photograph the member removed from their page, and can make it the credited lead picture and restore', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published, links)
      VALUES ('mei-page', ?, 'Mei Lin', 'member-one', 1, '[]')`).run(SHOP);
    const first = await offeredPhoto(env);
    const second = await offeredPhoto(env);
    expect((await call(env, MEMBER, `/api/family/photographs/${first}/remove`, { method: 'POST' })).status).toBe(200);
    // Gone from the member's page and view...
    expect(((await (await call(env, MEMBER, '/api/family/teas/tea-a/mine')).json()) as any).photographs.map((p: any) => p.id)).toEqual([second]);
    expect(((await (await call(env, null, '/api/family/teas/tea-a/photographs')).json()) as any).family.map((p: any) => p.id)).toEqual([second]);
    // ...and still the shop's to use.
    const pile = await (await call(env, OWNER, '/api/admin/family/photographs')).json() as any;
    expect(pile.photographs.find((p: any) => p.id === first)).toMatchObject({ removed_by_author: true });
    expect((await call(env, OWNER, `/api/admin/family/photographs/${first}/lead`, { method: 'POST' })).status).toBe(200);
    let tea = await (await call(env, null, '/api/family/teas/tea-a/photographs')).json() as any;
    expect(tea.lead).toMatchObject({ id: first, author: { name: 'Mei Lin', page_id: 'mei-page' } });

    // A placed photograph made lead, then a new lead: the old lead steps back to what it was.
    await call(env, OWNER, `/api/admin/family/photographs/${second}/place`, { method: 'POST' });
    await call(env, OWNER, `/api/admin/family/photographs/${second}/lead`, { method: 'POST' });
    tea = await (await call(env, null, '/api/family/teas/tea-a/photographs')).json() as any;
    expect(tea.lead.id).toBe(second);
    expect(tea.placed).toEqual([]);
    expect(tea.family).toEqual([]);
    // Restore puts the tea back as it was before the lead: the second photograph placed, no lead.
    const restored = await call(env, OWNER, `/api/admin/family/photographs/${second}/restore`, { method: 'POST' });
    expect(await restored.json()).toMatchObject({ id: second, shop_use: 'placed' });
    tea = await (await call(env, null, '/api/family/teas/tea-a/photographs')).json() as any;
    expect(tea.lead).toBeNull();
    expect(tea.placed.map((p: any) => p.id)).toEqual([second]);
    // The tea's own picture was never touched.
    expect(db.sqlite.prepare(`SELECT image_url FROM products WHERE id = 'tea-a'`).get()).toEqual({ image_url: null });
  });

  it('only uses what was offered', async () => {
    const { env } = setup();
    const kept = ((await (await upload(env, MEMBER)).json()) as any).photograph.id;
    const refused = await call(env, OWNER, `/api/admin/family/photographs/${kept}/place`, { method: 'POST' });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ code: 'not_offered' });
  });

  it('takes a report from a signed-out visitor and hides a photograph or a whole page in one tap', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published, links)
      VALUES ('mei-page', ?, 'Mei Lin', 'member-one', 1, '[]')`).run(SHOP);
    const one = ((await (await upload(env, MEMBER)).json()) as any).photograph.id;
    const two = ((await (await upload(env, MEMBER)).json()) as any).photograph.id;
    await call(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } });

    const reported = await call(env, null, '/api/family/reports', { method: 'POST', body: { target_kind: 'photograph', target_id: one, reason: 'Not tea' }, ip: '203.0.113.9' });
    expect(reported.status).toBe(201);
    expect((await call(env, null, '/api/family/reports', { method: 'POST', body: { target_kind: 'photograph', target_id: 'nothing-here' } })).status).toBe(404);
    expect(db.sqlite.prepare('SELECT reporter_user_id FROM family_reports').get()).toEqual({ reporter_user_id: null });
    const reports = await (await call(env, OWNER, '/api/admin/family/reports')).json() as any;
    expect(reports.reports).toMatchObject([{ target_kind: 'photograph', target_id: one, reason: 'Not tea', status: 'open' }]);
    expect((await call(env, MEMBER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'photograph', target_id: one } })).status).toBe(403);

    expect((await call(env, OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'photograph', target_id: one } })).status).toBe(200);
    let family = ((await (await call(env, null, '/api/family/teas/tea-a/photographs')).json()) as any).family.map((p: any) => p.id);
    expect(family).toEqual([two]);
    expect(((await (await call(env, OWNER, '/api/admin/family/reports')).json()) as any).reports).toEqual([]);

    await call(env, OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'page', target_id: 'mei-page' } });
    family = ((await (await call(env, null, '/api/family/teas/tea-a/photographs')).json()) as any).family;
    expect(family).toEqual([]);
    await call(env, OWNER, '/api/admin/family/unhide', { method: 'POST', body: { target_kind: 'page', target_id: 'mei-page' } });
    await call(env, OWNER, '/api/admin/family/unhide', { method: 'POST', body: { target_kind: 'photograph', target_id: one } });
    family = ((await (await call(env, null, '/api/family/teas/tea-a/photographs')).json()) as any).family;
    expect(family).toHaveLength(2);
    // Another shop cannot hide this shop's photograph.
    expect((await call(env, OTHER_OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'photograph', target_id: one } })).status).toBe(404);
  });

  it('keeps one shop from hiding a page that belongs to another shop, and from undoing its hide', async () => {
    const { env, db } = setup();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published, links)
      VALUES ('mei-page', ?, 'Mei Lin', 'member-one', 1, '[]')`).run(SHOP);
    expect((await call(env, OTHER_OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'page', target_id: 'mei-page' } })).status).toBe(404);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM family_hides').get()).toEqual({ n: 0 });
    // A stray hide row from another shop does not take the page off the people list either.
    db.sqlite.prepare(`INSERT INTO family_hides (account_id, target_kind, target_id, hidden_by) VALUES (?, 'page', 'mei-page', 'other-owner')`).run(OTHER_SHOP);
    const row = db.sqlite.prepare(`SELECT c.id FROM contributors c WHERE c.id = 'mei-page' AND ${FAMILY_PAGE_NOT_HIDDEN_SQL}`).get();
    expect(row).toEqual({ id: 'mei-page' });
    expect((await call(env, OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'page', target_id: 'mei-page' } })).status).toBe(200);
    expect(db.sqlite.prepare(`SELECT c.id FROM contributors c WHERE c.id = 'mei-page' AND ${FAMILY_PAGE_NOT_HIDDEN_SQL}`).get()).toBeUndefined();
  });

  it('serves a family photograph to the public only while it is on show, and to its author by a signed address', async () => {
    const { env, db, bucket } = setup();
    const made = ((await (await upload(env, MEMBER)).json()) as any).photograph;
    const keyOf = (url: string) => url.replace('https://media.teajia.co/', '/api/media/');
    const fetchPath = (path: string) => worker.fetch(new Request(`https://worker.test${path}`), env);
    const bare = keyOf(made.small_url.split('?')[0]);
    // Private: the bare address gives nothing, the signed one the author holds does.
    expect((await fetchPath(bare)).status).toBe(404);
    const signed = await fetchPath(keyOf(made.small_url));
    expect(signed.status).toBe(200);
    expect(signed.headers.get('Cache-Control')).toMatch(/^private/);
    expect((await fetchPath(`${bare}?exp=${Math.floor(Date.now() / 1000) + 600}&sig=${'0'.repeat(64)}`)).status).toBe(404);
    // Shared: public.
    await call(env, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } });
    const shown = await fetchPath(bare);
    expect(shown.status).toBe(200);
    // Short, never a year: a browser that saw it must lose it within a minute of its removal.
    expect(shown.headers.get('Cache-Control')).toBe('public, max-age=60');
    // Hidden by the shop: gone again.
    await call(env, OWNER, '/api/admin/family/hide', { method: 'POST', body: { target_kind: 'photograph', target_id: made.id } });
    expect((await fetchPath(bare)).status).toBe(404);
    await call(env, OWNER, '/api/admin/family/unhide', { method: 'POST', body: { target_kind: 'photograph', target_id: made.id } });
    expect((await fetchPath(bare)).status).toBe(200);
    // Taken off the page by its author: the address that was once public stops working.
    await call(env, MEMBER, `/api/family/photographs/${made.id}/remove`, { method: 'POST' });
    expect((await fetchPath(bare)).status).toBe(404);
    expect(db.sqlite.prepare('SELECT removed_by_member_at FROM member_photographs').get()).not.toEqual({ removed_by_member_at: null });
    // Media outside the family folder is untouched by this rule.
    bucket.objects.set('other/thing.jpg', { bytes: new Uint8Array([1]), type: 'image/jpeg' });
    expect((await fetchPath('/api/media/other/thing.jpg')).status).toBe(200);
  });

  it('lands "find me more" with the shop for a sold-out tea, once per person', async () => {
    const { env } = setup();
    const inStock = await call(env, MEMBER, '/api/family/teas/tea-a/restock-request', { method: 'POST', body: {} });
    expect(inStock.status).toBe(409);
    expect(await inStock.json()).toMatchObject({ code: 'still_in_stock' });
    expect((await call(env, null, '/api/family/teas/tea-gone/restock-request', { method: 'POST', body: {} })).status).toBe(401);
    const first = await call(env, MEMBER, '/api/family/teas/tea-gone/restock-request', { method: 'POST', body: { note: 'Two cakes please' } });
    expect(first.status).toBe(201);
    const again = await call(env, MEMBER, '/api/family/teas/tea-gone/restock-request', { method: 'POST', body: {} });
    expect(await again.json()).toMatchObject({ already_asked: true });
    const list = await (await call(env, OWNER, '/api/admin/family/restock-requests')).json() as any;
    expect(list.requests).toMatchObject([{ product_id: 'tea-gone', requester_name: 'Mei', note: 'Two cakes please', status: 'open' }]);
    expect(((await (await call(env, OTHER_OWNER, '/api/admin/family/restock-requests')).json()) as any).requests).toEqual([]);
    expect((await call(env, OWNER, `/api/admin/family/restock-requests/${list.requests[0].id}/answer`, { method: 'POST' })).status).toBe(200);
  });
});

describe('voice notes for members', () => {
  function voiceForm(bytes: Uint8Array = WEBM, seconds?: number) {
    const form = new FormData();
    form.set('file', new File([bytes], 'recording.webm', { type: 'audio/webm;codecs=opus' }));
    if (seconds !== undefined) form.set('duration_seconds', String(seconds));
    return form;
  }

  it('lets a member who is not shop staff speak a note, filed under the shop with their own limits', async () => {
    const { env, db, bucket } = setup();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: 'Orchid and honey.' })));
    const spoken = await call(env, MEMBER, '/api/transcribe', { method: 'POST', form: voiceForm(WEBM, 45) });
    expect(spoken.status).toBe(200);
    expect(await spoken.json()).toMatchObject({ text: 'Orchid and honey.' });
    const row = db.sqlite.prepare('SELECT account_id, user_id, status, object_key FROM private_recordings').get() as any;
    expect(row).toMatchObject({ account_id: SHOP, user_id: 'member-one', status: 'completed' });
    expect(bucket.objects.has(row.object_key)).toBe(true);

    expect((await call(env, null, '/api/transcribe', { method: 'POST', form: voiceForm() })).status).toBe(401);
    const long = await call(env, MEMBER, '/api/transcribe', { method: 'POST', form: voiceForm(WEBM, 150) });
    expect(long.status).toBe(413);
    expect(await long.json()).toEqual({ error: 'A voice note can be up to two minutes.', code: 'voice_note_too_long' });
    const heavy = new Uint8Array(4 * 1024 * 1024 + 10);
    heavy.set(WEBM);
    expect((await call(env, MEMBER, '/api/transcribe', { method: 'POST', form: voiceForm(heavy) })).status).toBe(413);

    const insert = db.sqlite.prepare(`INSERT INTO private_recordings (id, account_id, user_id, object_key, mime_type, size_bytes, status, expires_at)
      VALUES (?, ?, 'member-one', ?, 'audio/webm', 1, 'completed', datetime('now', '+7 days'))`);
    for (let i = 0; i < 19; i += 1) insert.run(`r-${i}`, SHOP, `k-${i}`);
    const twentyFirst = await call(env, MEMBER, '/api/transcribe', { method: 'POST', form: voiceForm(WEBM, 10) });
    expect(twentyFirst.status).toBe(429);
    expect(await twentyFirst.json()).toMatchObject({ code: 'daily_voice_limit' });
  });

  it('leaves shop staff on the staff handler, with no member ceiling', async () => {
    const { env, db } = setup();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: 'Staff note.' })));
    const insert = db.sqlite.prepare(`INSERT INTO private_recordings (id, account_id, user_id, object_key, mime_type, size_bytes, status, expires_at)
      VALUES (?, ?, 'other-owner', ?, 'audio/webm', 1, 'completed', datetime('now', '+7 days'))`);
    for (let i = 0; i < 25; i += 1) insert.run(`r-${i}`, OTHER_SHOP, `k-${i}`);
    const response = await call(env, OTHER_OWNER, '/api/transcribe', { method: 'POST', form: voiceForm() });
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    // Only the staff handler hands back the audio address and files under the staff member's own shop.
    expect(body.audio_url).toMatch(/^\/api\/transcriptions\/.+\/audio$/);
    const row = db.sqlite.prepare('SELECT account_id FROM private_recordings WHERE id = ?').get(body.recording_id) as any;
    expect(row.account_id).toBe(OTHER_SHOP);
  });

  it('retries a member\'s own failed note and nobody else\'s', async () => {
    const { env } = setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('busy', { status: 503 })));
    const failed = await call(env, MEMBER, '/api/transcribe', { method: 'POST', form: voiceForm(WEBM, 5) });
    expect(failed.status).toBe(502);
    const { recording_id } = await failed.json() as any;
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: 'Second time.' })));
    expect((await call(env, MEMBER_TWO, `/api/transcriptions/${recording_id}/retry`, { method: 'POST' })).status).toBe(404);
    const retried = await call(env, MEMBER, `/api/transcriptions/${recording_id}/retry`, { method: 'POST' });
    expect(await retried.json()).toMatchObject({ text: 'Second time.', recording_id });
  });
});

describe('the shape a photograph is shown in', () => {
  it('is square until its author picks 2:3 or 3:2, and nobody else can change it', async () => {
    const { env } = setup();
    const mine = ((await (await upload(env, MEMBER)).json()) as any).photograph;
    expect(mine.shape).toBe('square');
    // Only the three, and only by the author, signed in.
    expect((await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'panorama' } })).status).toBe(400);
    expect((await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: {} })).status).toBe(400);
    expect((await call(env, MEMBER_TWO, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'across' } })).status).toBe(404);
    expect((await call(env, null, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'across' } })).status).toBe(401);
    const stillSquare = await (await call(env, MEMBER, '/api/family/teas/tea-a/mine')).json() as any;
    expect(stillSquare.photographs[0].shape).toBe('square');

    const upright = await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'upright' } });
    expect(upright.status).toBe(200);
    expect(((await upright.json()) as any).photograph.shape).toBe('upright');
    const view = await (await call(env, MEMBER, '/api/family/teas/tea-a/mine')).json() as any;
    expect(view.photographs[0].shape).toBe('upright');

    // Shared, the public tea page shows it in the shape its author chose.
    await call(env, MEMBER, `/api/family/photographs/${mine.id}/share`, { method: 'PUT', body: { share_state: 'page' } });
    const onTea = await (await call(env, null, '/api/family/teas/tea-a/photographs')).json() as any;
    expect(onTea.family.map((p: any) => [p.id, p.shape])).toEqual([[mine.id, 'upright']]);

    // A crop is the part of the picture that shows, kept as numbers beside the shape.
    const frame = { crop: { x: 12.5, y: -4 }, zoom: 1.6, area: { x: 20, y: 18.75, width: 62.5, height: 62.5 } };
    const framed = await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'across', frame } });
    expect(framed.status).toBe(200);
    expect(((await framed.json()) as any).photograph).toMatchObject({ shape: 'across', frame });
    expect(((await (await call(env, null, '/api/family/teas/tea-a/photographs')).json()) as any).family[0].frame).toEqual(frame);
    // A straightened picture keeps its turn, in degrees.
    const turned = { ...frame, rotation: -3.5 };
    expect(((await (await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'across', frame: turned } })).json()) as any).photograph.frame).toEqual(turned);
    expect((await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'across', frame: { ...frame, rotation: 999 } } })).status).toBe(400);
    await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'across', frame } });
    // A part outside the picture, a zoom outside the editor's range, or anything but numbers is refused and nothing changes.
    for (const bad of [
      { ...frame, area: { x: 60, y: 0, width: 62.5, height: 50 } },
      { ...frame, zoom: 9 },
      { ...frame, area: { x: 0, y: 0, width: '100', height: 100 } },
      'https://example.com/other.jpg',
    ]) {
      const refused = await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'across', frame: bad } });
      expect(refused.status).toBe(400);
      expect(((await refused.json()) as any).code).toBe('invalid_frame');
    }
    expect(((await (await call(env, MEMBER, '/api/family/teas/tea-a/mine')).json()) as any).photographs[0].frame).toEqual(frame);
    // A shape sent alone puts the photograph back to the middle of the picture.
    expect(((await (await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'upright' } })).json()) as any).photograph.frame).toBeNull();

    // Back to square is one more choice, and a removed photograph can no longer be reshaped.
    expect(((await (await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'square' } })).json()) as any).photograph.shape).toBe('square');
    await call(env, MEMBER, `/api/family/photographs/${mine.id}/remove`, { method: 'POST' });
    expect((await call(env, MEMBER, `/api/family/photographs/${mine.id}/shape`, { method: 'PUT', body: { shape: 'across' } })).status).toBe(404);
  });

  it('the frame comes from migration 0076: one empty column, no row touched', () => {
    const sql = readFileSync(`${MIGRATIONS_DIR}/0076_member_photograph_frame.sql`, 'utf8');
    const statements = splitStatements(sql);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/ALTER TABLE member_photographs ADD COLUMN frame TEXT$/);
    const { db, applied } = seedFromMigrations();
    expect(applied).toContain('0076_member_photograph_frame.sql');
    const column = (db.prepare(`SELECT dflt_value, "notnull" AS required FROM pragma_table_info('member_photographs') WHERE name = 'frame'`).get()) as any;
    expect(column).toMatchObject({ dflt_value: null, required: 0 });
    db.close();
  });

  it('comes from migration 0075, which adds one column with a default and touches no row', () => {
    const sql = readFileSync(`${MIGRATIONS_DIR}/0075_member_photograph_shape.sql`, 'utf8');
    const statements = splitStatements(sql);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/ALTER TABLE member_photographs ADD COLUMN shape TEXT NOT NULL DEFAULT 'square'/);
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT)\b/);
    const { db, applied } = seedFromMigrations();
    expect(applied).toContain('0075_member_photograph_shape.sql');
    const column = (db.prepare(`SELECT dflt_value, "notnull" AS required FROM pragma_table_info('member_photographs') WHERE name = 'shape'`).get()) as any;
    expect(column).toMatchObject({ dflt_value: "'square'", required: 1 });
    db.close();
  });
});

describe('migration 0069', () => {
  it('adds tables and indexes only, and applies on top of the migration ledger', () => {
    const sql = readFileSync(`${MIGRATIONS_DIR}/0073_teajia_family.sql`, 'utf8');
    for (const statement of splitStatements(sql)) {
      expect(statement).toMatch(/^(--[^\n]*\n\s*)*CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS/);
    }
    const { db, applied } = seedFromMigrations();
    expect(applied).toContain('0073_teajia_family.sql');
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN
      ('member_photographs', 'member_tea_covers', 'member_tasting_shares', 'restock_requests', 'family_reports', 'family_hides') ORDER BY name`).all() as any[])
      .map(row => row.name);
    expect(tables).toEqual(['family_hides', 'family_reports', 'member_photographs', 'member_tasting_shares', 'member_tea_covers', 'restock_requests']);
    db.close();
  });
});
