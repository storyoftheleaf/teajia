import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../src/index';
import { arrangePeopleList, PEOPLE_LIST_SHOP_PICK_WEIGHT, PEOPLE_LIST_WINDOW_DAYS } from '../src/peopleList';
import { MIGRATIONS_DIR } from './helpers/migratedSqlite';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// The people list (todo/plans/teajia-family.md, "The people list", Adrian 2026-11-21):
// no photograph, no place; This season, Founding members, The family; the
// family in a quiet order; the owner can pin. Driven through worker.fetch
// against a real SQLite database built from worker/schema.sql.

const SECRET = 'people-list-secret';
const SHOP = 'acc_teajia_bali';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

/** A moment `days` ago, as SQLite writes it. */
const ago = (days: number, hour = 10) => {
  const at = new Date(Date.now() - days * 86_400_000);
  at.setUTCHours(hour, 0, 0, 0);
  return at.toISOString().slice(0, 19).replace('T', ' ');
};

function setup() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: SHOP, role: 'owner' });
  db.sqlite.prepare(`UPDATE accounts SET is_platform_owner = 1 WHERE id = ?`).run(SHOP);
  for (const tea of ['tea-a', 'tea-b', 'tea-c', 'tea-d']) {
    db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, status, stock_grams)
      VALUES (?, ?, 'Oolong', ?, ?, 1, 'Active', 100)`).run(tea, SHOP, tea, tea);
  }
  const person = (id: string, tier: string | null, photo: 'portrait' | 'avatar' | 'gallery' | null) => {
    db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES (?, ?, ?, 'x', 'user', 0)`)
      .run(`user-${id}`, `${id}@test.dev`, id);
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, portrait_url, avatar_url)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?)`).run(id, SHOP, `user-${id}`, `Name ${id}`, tier, photo === 'portrait' ? `${id}.jpg` : null, photo === 'avatar' ? `${id}-small.jpg` : null);
    if (photo === 'gallery') {
      db.sqlite.prepare(`INSERT INTO contributor_gallery_images (id, contributor_id, image_url, position) VALUES (?, ?, ?, 0)`).run(`g-${id}`, id, `${id}-hands.jpg`);
    }
  };
  let n = 0;
  const share = (id: string, tea: string, at: string) => {
    n += 1;
    db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
      VALUES (?, NULL, ?, ?, ?, 9, '{}', '[]')`).run(`j-${n}`, `${id}@test.dev`, tea, tea);
    db.sqlite.prepare(`INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at, updated_at)
      VALUES (?, ?, ?, ?, 'page', ?, ?)`).run(`j-${n}`, SHOP, tea, `user-${id}`, at, at);
  };
  const picked = (id: string, tea: string, at: string) => {
    n += 1;
    db.sqlite.prepare(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key, full_bytes, small_bytes,
      full_width, full_height, small_width, small_height, share_state, shop_use, shop_decided_at, offered_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 900000, 90000, 2000, 1500, 480, 360, 'offered', 'placed', ?, ?, ?)`).run(`p-${n}`, SHOP, tea, `user-${id}`, `f-${n}`, `s-${n}`, at, at, at);
  };
  /** A photograph taken in a tasting. `state` is the author's choice: private, page or offered. */
  const tastingPhoto = (id: string, tea: string, state: string, opts: { removed?: boolean; at?: string } = {}) => {
    n += 1;
    const at = opts.at ?? ago(1);
    db.sqlite.prepare(`INSERT INTO member_photographs (id, account_id, product_id, author_user_id, full_key, small_key, full_bytes, small_bytes,
      full_width, full_height, small_width, small_height, share_state, removed_by_member_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 900000, 90000, 2000, 1500, 480, 360, ?, ?, ?, ?)`).run(`t-${n}`, SHOP, tea, `user-${id}`, `full-${n}.jpg`, `small-${n}.jpg`, state, opts.removed ? at : null, at, at);
    return { id: `t-${n}`, small: `small-${n}.jpg` };
  };
  return { db, env: { DB: db as any, JWT_SECRET: SECRET }, person, share, picked, tastingPhoto };
}

const get = (env: any, path: string) => worker.fetch(new Request(`https://worker.test${path}`), env);
const ids = async (env: any) => ((await (await get(env, '/api/people')).json()) as any).contributors.map((c: any) => c.id as string);

async function put(env: any, who: { userId: string; account?: string } | null, path: string, body: unknown) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (who) {
    headers.set('Authorization', `Bearer ${await signedToken(SECRET, { sub: who.userId, email: `${who.userId}@test.dev`, name: who.userId, active_account_id: who.account ?? null, platform_role: null })}`);
    if (who.account) headers.set('X-Teajia-Account', who.account);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, { method: 'PUT', headers, body: JSON.stringify(body) }), env);
}
const OWNER = { userId: 'owner', account: SHOP };

describe('no photograph, no place on the list', () => {
  it('leaves out a person with no photograph, and keeps their page at its own address', async () => {
    const { env, person } = setup();
    person('faceless', 'family', null);
    person('portrait', 'family', 'portrait');
    person('hands', 'family', 'gallery');
    person('small', 'family', 'avatar');
    expect((await ids(env)).sort()).toEqual(['hands', 'portrait', 'small']);
    const page = await get(env, '/api/people/faceless');
    expect(page.status).toBe(200);
    expect(((await page.json()) as any).display_name ?? ((await (await get(env, '/api/people/faceless')).json()) as any).contributor?.display_name).toBe('Name faceless');
  });

  it('applies to tea masters and pages from before the family as well', async () => {
    const { env, person } = setup();
    person('master-no-photo', 'master', null);
    person('old-no-photo', null, null);
    person('master', 'master', 'portrait');
    expect(await ids(env)).toEqual(['master']);
  });
});

describe('a photograph shared from a tasting counts', () => {
  it('lists a person whose only photograph is one they shared, and uses the newest as their picture', async () => {
    const { env, person, tastingPhoto } = setup();
    person('taster', 'family', null);
    tastingPhoto('taster', 'tea-a', 'page', { at: ago(5) });
    const newest = tastingPhoto('taster', 'tea-b', 'offered', { at: ago(1) });
    const list = ((await (await get(env, '/api/people')).json()) as any).contributors;
    expect(list.map((c: any) => c.id)).toEqual(['taster']);
    expect(list[0].card_image_url).toBe(`https://media.teajia.co/${newest.small}`);
    expect(list[0]).not.toHaveProperty('list_tasting_photo_key');
  });

  it('does not count one kept private, one they removed, or one the owner hid', async () => {
    const { db, env, person, tastingPhoto } = setup();
    person('private', 'family', null);
    person('removed', 'family', null);
    person('hidden', 'family', null);
    tastingPhoto('private', 'tea-a', 'private');
    tastingPhoto('removed', 'tea-a', 'page', { removed: true });
    const hidden = tastingPhoto('hidden', 'tea-a', 'page');
    db.sqlite.prepare(`INSERT INTO family_hides (account_id, target_kind, target_id, hidden_by) VALUES (?, 'photograph', ?, 'owner')`).run(SHOP, hidden.id);
    expect(await ids(env)).toEqual([]);
  });

  it("keeps the photograph on their page as their picture when they have both", async () => {
    const { env, person, tastingPhoto } = setup();
    person('both', 'family', 'portrait');
    tastingPhoto('both', 'tea-a', 'page');
    const [row] = ((await (await get(env, '/api/people')).json()) as any).contributors;
    expect(row.card_image_url).toBe('both.jpg');
  });
});

describe('three groups, in order', () => {
  it('puts This season first, then Founding members, then The family', async () => {
    const { db, env, person } = setup();
    person('fam', 'family', 'portrait');
    person('founder', 'family', 'portrait');
    person('master', 'master', 'portrait');
    person('old', null, 'portrait');
    db.sqlite.prepare(`UPDATE contributors SET founding_member = 1 WHERE id = 'founder'`).run();
    const list = ((await (await get(env, '/api/people')).json()) as any).contributors;
    expect(list.map((c: any) => [c.id, c.list_group])).toEqual([['master', 'season'], ['old', 'season'], ['founder', 'founding'], ['fam', 'family']]);
  });

  it('lists a person once: a founding member who is also a tea master sits with the founding members', async () => {
    const { db, env, person } = setup();
    person('both', 'master', 'portrait');
    db.sqlite.prepare(`UPDATE contributors SET founding_member = 1 WHERE id = 'both'`).run();
    const list = ((await (await get(env, '/api/people')).json()) as any).contributors;
    expect(list.map((c: any) => [c.id, c.list_group])).toEqual([['both', 'founding']]);
  });
});

describe('the family is ordered quietly', () => {
  it('counts a day once, however many teas were shared on it', async () => {
    const { env, person, share } = setup();
    person('burst', 'family', 'portrait');
    person('steady', 'family', 'portrait');
    // Four teas in one day earn what one tea does.
    for (const tea of ['tea-a', 'tea-b', 'tea-c', 'tea-d']) share('burst', tea, ago(2));
    share('steady', 'tea-a', ago(20));
    share('steady', 'tea-b', ago(10));
    expect(await ids(env)).toEqual(['steady', 'burst']);
  });

  it('weighs the shop choosing a photograph above what a person does themselves', async () => {
    const { env, person, share, picked } = setup();
    person('busy', 'family', 'portrait');
    person('chosen', 'family', 'portrait');
    share('busy', 'tea-a', ago(3));
    share('busy', 'tea-b', ago(2));
    picked('chosen', 'tea-a', ago(30));
    expect(PEOPLE_LIST_SHOP_PICK_WEIGHT).toBeGreaterThan(2);
    expect(await ids(env)).toEqual(['chosen', 'busy']);
  });

  it('lets old activity fade, so a newcomer can rise', async () => {
    const { env, person, share } = setup();
    person('veteran', 'family', 'portrait');
    person('newcomer', 'family', 'portrait');
    for (const [tea, days] of [['tea-a', 200], ['tea-b', 150], ['tea-c', PEOPLE_LIST_WINDOW_DAYS + 5]] as const) share('veteran', tea, ago(days));
    share('newcomer', 'tea-a', ago(1));
    expect(await ids(env)).toEqual(['newcomer', 'veteran']);
  });

  it('sends no number, score or pin with the list', async () => {
    const { db, env, person, share, picked } = setup();
    person('one', 'family', 'portrait');
    share('one', 'tea-a', ago(1));
    picked('one', 'tea-a', ago(1));
    db.sqlite.prepare(`UPDATE contributors SET list_pinned_at = datetime('now') WHERE id = 'one'`).run();
    const [row] = ((await (await get(env, '/api/people')).json()) as any).contributors;
    for (const key of ['list_days_shared', 'list_shop_picks', 'list_pinned_at', 'founding_member', 'score', 'rank']) expect(row).not.toHaveProperty(key);
    expect(JSON.stringify(row)).not.toMatch(/most active|score|rank/i);
  });
});

describe("the owner's hand stays on it", () => {
  it('a pin puts a person at the top of their group, and unpinning puts them back', async () => {
    const { env, person, share } = setup();
    person('active', 'family', 'portrait');
    person('quiet', 'family', 'portrait');
    share('active', 'tea-a', ago(1));
    expect(await ids(env)).toEqual(['active', 'quiet']);
    const pinned = await put(env, OWNER, '/api/admin/family/pages/quiet/list', { pinned: true });
    expect(pinned.status).toBe(200);
    expect(await pinned.json()).toEqual({ id: 'quiet', founding: false, pinned: true });
    expect(await ids(env)).toEqual(['quiet', 'active']);
    await put(env, OWNER, '/api/admin/family/pages/quiet/list', { pinned: false });
    expect(await ids(env)).toEqual(['active', 'quiet']);
  });

  it('names and un-names a founding member', async () => {
    const { env, person } = setup();
    person('early', 'family', 'portrait');
    expect(await (await put(env, OWNER, '/api/admin/family/pages/early/list', { founding: true })).json()).toEqual({ id: 'early', founding: true, pinned: false });
    expect(((await (await get(env, '/api/people')).json()) as any).contributors[0].list_group).toBe('founding');
    await put(env, OWNER, '/api/admin/family/pages/early/list', { founding: false });
    expect(((await (await get(env, '/api/people')).json()) as any).contributors[0].list_group).toBe('family');
  });

  it('is the owner alone: a member and a stranger are refused, and an empty ask is refused', async () => {
    const { db, env, person } = setup();
    person('early', 'family', 'portrait');
    expect((await put(env, null, '/api/admin/family/pages/early/list', { founding: true })).status).toBe(401);
    expect([401, 403]).toContain((await put(env, { userId: 'user-early' }, '/api/admin/family/pages/early/list', { founding: true })).status);
    expect((await put(env, OWNER, '/api/admin/family/pages/early/list', {})).status).toBe(400);
    expect(db.sqlite.prepare(`SELECT founding_member FROM contributors WHERE id = 'early'`).get()).toEqual({ founding_member: 0 });
  });
});

describe('the order, on its own', () => {
  it('breaks a tie by who shared most recently, then by name', () => {
    const base = { card_image_url: 'x.jpg', page_tier: 'family' as const };
    const out = arrangePeopleList([
      { ...base, display_name: 'Bo', family_last_active: '2026-11-01 10:00:00' },
      { ...base, display_name: 'Ana', family_last_active: '2026-11-01 10:00:00' },
      { ...base, display_name: 'Cy', family_last_active: '2026-11-10 10:00:00' },
    ]);
    expect(out.map(p => p.display_name)).toEqual(['Cy', 'Ana', 'Bo']);
  });
});

describe('migration 0077', () => {
  it('adds two empty columns and touches no row', () => {
    const sql = readFileSync(`${MIGRATIONS_DIR}/0077_people_list_place.sql`, 'utf8');
    const statements = sql.split('\n').filter(line => line.trim() && !line.trim().startsWith('--'));
    expect(statements).toHaveLength(2);
    for (const statement of statements) expect(statement).toMatch(/^ALTER TABLE contributors ADD COLUMN /);
    expect(sql).not.toMatch(/^\s*(UPDATE|DELETE|INSERT)\b/im);
  });
});
