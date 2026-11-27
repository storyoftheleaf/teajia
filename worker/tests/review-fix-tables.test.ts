// Review run, fix package 3 "Same table again" (A11-13 with W6-3, W2-2):
// the host's own page makes the same copy the same_table_again tool makes.
// Record: todo/review/fixes/tables.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-fix-tables-secret';
const DAY = 24 * 60 * 60 * 1000;
type Actor = { userId: string; accountId: string };
const ana: Actor = { userId: 'ana', accountId: 'ana-personal' };
const bo: Actor = { userId: 'bo', accountId: 'bo-personal' };

let db: SqliteD1;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean } = {}) {
  const { actor, body, method = 'GET', open = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.47' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.userId, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: 'true', ANYONE_HOSTS_OPEN: open ? 'true' : 'false',
    RSVP_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil: () => undefined } as never);
}

function personalAccount(actor: Actor) {
  seedIdentity(db, { userId: actor.userId, accountId: `${actor.userId}-unused`, publicEnabled: false });
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(actor.accountId, actor.accountId, `${actor.userId} chest`, actor.userId, actor.userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`)
    .run(actor.accountId, actor.userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(actor.userId);
}

const start = new Date(Date.now() + 2 * DAY);
const wall = (at: Date) => ({ date: at.toISOString().slice(0, 10), time: at.toISOString().slice(11, 16) });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  personalAccount(ana);
  personalAccount(bo);
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door, requires_approval,
      public_visibility, network_discovery, host_user_id, status, lifecycle_status, area_hint)
    VALUES ('t', ?, 't-slug', 'Saturday oolong', ?, 5, 'UTC', 'link', 0, 'unlisted', 0, 'ana', 'active', 'published', 'Ubud')`)
    .run(ana.accountId, start.toISOString());
  db.sqlite.prepare(`INSERT INTO event_tea_menu (id, account_id, event_id, custom_name, brew_order) VALUES ('m1', ?, 't', 'Dong Ding', 1)`)
    .run(ana.accountId);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('same table again from the host’s page (A11-13)', () => {
  const again = (body: unknown, options: { actor?: Actor; open?: boolean; id?: string } = {}) =>
    call(`/api/me/tables/${options.id ?? 't'}/again`, { actor: options.actor ?? ana, method: 'POST', body, open: options.open });

  it('makes the copy a week on, published, with its seats, door, area and teas', async () => {
    const answer = await again(wall(new Date(start.getTime() + 7 * DAY)));
    expect(answer.status).toBe(201);
    const made = await answer.json() as { id: string; slug: string; link: string };
    expect(made.slug).toMatch(/^saturday-oolong-[a-f0-9]{24}$/);
    expect(made.link).toBe(`https://hosts.test/event/${made.slug}`);
    const copy = db.sqlite.prepare('SELECT * FROM events WHERE id = ?').get(made.id) as Record<string, unknown>;
    expect(copy).toMatchObject({
      account_id: ana.accountId, host_user_id: 'ana', title: 'Saturday oolong', total_capacity: 5, door: 'link',
      area_hint: 'Ubud', lifecycle_status: 'published', status: 'active',
    });
    expect(Date.parse(String(copy.event_date))).toBe(Math.floor((start.getTime() + 7 * DAY) / 60_000) * 60_000);
    expect(db.sqlite.prepare('SELECT custom_name FROM event_tea_menu WHERE event_id = ?').all(made.id)).toEqual([{ custom_name: 'Dong Ding' }]);
  });

  it('refuses a day already past, another host’s table, and a missing time', async () => {
    expect((await again(wall(new Date(Date.now() - DAY)))).status).toBe(400);
    expect((await again(wall(new Date(start.getTime() + 7 * DAY)), { actor: bo })).status).toBe(404);
    expect((await again({ date: '2027-01-01' })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM events').get()).toEqual({ n: 1 });
  });

  it('is closed with Launch 3, as the same_table_again tool is', async () => {
    expect((await again(wall(new Date(start.getTime() + 7 * DAY)), { open: false })).status).toBe(404);
  });
});
