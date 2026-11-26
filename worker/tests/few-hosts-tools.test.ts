// Launch 2, slice H12 (todo/plans/guests-and-tea-masters-launch-2-run.md,
// "Sonnet, H12"): the host's actions as agent tools. Every call goes through
// the real /mcp route, so the tools are registered, scoped and handed the
// same seat path the host's page uses. Each write does nothing on preview and
// writes on confirm; the confirm reads the table again; another host's table
// is not found; an unapproved caller is refused; the guest list carries no
// address, no contact and no note.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { saveGuestNote } from '../src/hostGuestNotes';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/* mcp.ts fires some writes without awaiting them, so the D1 it is handed has
   to return promises the way the real one does. */
class AsyncD1 {
  constructor(readonly inner: SqliteD1) {}
  prepare(sql: string) {
    const inner = this.inner.prepare(sql);
    const statement: any = {
      inner,
      bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
      first: async () => inner.first(),
      all: async () => inner.all(),
      run: async () => inner.run(),
    };
    return statement;
  }
  async batch(statements: any[]) { return this.inner.batch(statements.map(s => s.inner)); }
}

const ALL_SCOPES = ['inventory:read', 'customers:read', 'sales:read', 'stock:write', 'sales:write', 'catalog:write', 'customers:write', 'admin:write'];
const TOKENS = {
  adrian: 'tjmcp_few_hosts_adrian',
  ana: 'tjmcp_few_hosts_ana',
  anaShop: 'tjmcp_few_hosts_ana_shop',
  bo: 'tjmcp_few_hosts_bo',
  cy: 'tjmcp_few_hosts_cy',
} as const;
type Who = keyof typeof TOKENS;

let db: SqliteD1;
let open = true;

const tokenHash = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');

async function mintToken(who: Who, userId: string, accountId: string, tier: string) {
  const token = TOKENS[who];
  db.sqlite.prepare(`INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`tok-${who}`, accountId, userId, `${userId}@test.dev`, who, await tokenHash(token), token.slice(0, 8), JSON.stringify(ALL_SCOPES), tier);
}

async function rpc(who: Who, method: string, params: Record<string, unknown>) {
  const response = await worker.fetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKENS[who]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), {
    DB: new AsyncD1(db), JWT_SECRET: 'few-hosts-tools-secret', APP_URL: 'https://hosts.test',
    FEW_HOSTS_OPEN: open ? 'true' : 'false',
  } as any, { waitUntil() {}, passThroughOnException() {} } as any);
  return await response.json() as any;
}

async function call(who: Who, name: string, args: Record<string, unknown> = {}) {
  const body = await rpc(who, 'tools/call', { name, arguments: args });
  if (body.error) return { rpcError: body.error } as any;
  return JSON.parse(body.result?.content?.[0]?.text ?? '{}');
}

/** Preview, then confirm with the token the preview gave. */
async function previewAndConfirm(who: Who, name: string, args: Record<string, unknown>) {
  const preview = await call(who, name, args);
  expect(preview.confirmation_token, JSON.stringify(preview)).toBeTruthy();
  return { preview, done: await call(who, name, { confirm: preview.confirmation_token }) };
}

function personalAccount(userId: string, approved: boolean) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, ?)`)
    .run(id, id, id, userId, userId, approved ? '2026-11-26T00:00:00Z' : null);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(id, userId);
  if (approved) db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(userId);
}

function table(id: string, accountId: string, hostUserId: string | null, seats = 4) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status, address_text, map_link)
    VALUES (?, ?, ?, ?, ?, ?, 'Asia/Taipei', 'request', 1, 'unlisted', 0, ?, 'active', 'published', '12 Secret Lane', 'https://maps.test/secret')`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, new Date(Date.now() + 7 * 86400000).toISOString(), seats, hostUserId);
}

function guest(id: string, name: string, eventId: string, accountId: string, options: { status?: string; phone?: string; note?: string; photo?: 0 | 1 | null } = {}) {
  const status = options.status ?? 'requested';
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, phone_number, email, magic_token, status, notes, photo_consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, accountId, eventId, name, options.phone ?? null, `${id}@guest.test`, `magic-${id}`, status, options.note ?? null, options.photo ?? null);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`)
    .run(`seat-${id}`, accountId, eventId, id, name, status === 'confirmed' ? 'confirmed' : 'requested');
}

const count = (sql: string, ...values: unknown[]) => Number((db.sqlite.prepare(sql).get(...values as never[]) as { n: number }).n);
const statusOf = (id: string) => (db.sqlite.prepare('SELECT status FROM event_attendees WHERE id = ?').get(id) as { status: string }).status;
const teaNames = (eventId: string) => (db.sqlite.prepare('SELECT custom_name AS name, product_id FROM event_tea_menu WHERE event_id = ? ORDER BY brew_order').all(eventId) as { name: string; product_id: string | null }[]);

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  open = true;
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'adrian', accountId: 'platform-home', platformRole: 'platform_owner' });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run('platform-home');
  for (const [person, approved] of [['ana', true], ['bo', true], ['cy', false]] as const) {
    seedIdentity(db, { userId: person, accountId: `${person}-home`, publicEnabled: false });
    personalAccount(person, approved);
  }
  await mintToken('adrian', 'adrian', 'platform-home', 'platform_owner');
  await mintToken('ana', 'ana', 'ana-personal', 'account_owner');
  await mintToken('anaShop', 'ana', 'ana-home', 'account_owner');
  await mintToken('bo', 'bo', 'bo-personal', 'account_owner');
  await mintToken('cy', 'cy', 'cy-personal', 'account_owner');

  table('t-ana', 'ana-personal', 'ana');
  guest('g-mei', 'Mei Lin', 't-ana', 'ana-personal', { phone: '+886 912 000 111', note: 'First time, so excited.', photo: 0 });
  guest('g-tao', 'Tao', 't-ana', 'ana-personal', { phone: '+886 912 000 222' });
  table('t-bo', 'bo-personal', 'bo');
  guest('g-bo', 'Bo guest', 't-bo', 'bo-personal');
  table('t-shop', 'platform-home', null);
  guest('g-shop', 'Shop guest', 't-shop', 'platform-home');

  db.exec(`
    -- The shop tea is in stock: tea search lists only what the shop's browse list shows (A2 F9).
    INSERT INTO products (id, account_id, type, product_name, given_name, slug, is_public, shown_in_shop, status, stock_grams) VALUES
      ('p-shou', 'platform-home', 'Ripe Pu-erh', '2015 Menghai Shou', '2015 Shou', 'shou-2015', 1, 1, 'Active', 500),
      ('p-draft', 'platform-home', 'Oolong', 'Draft Oolong', NULL, 'draft-oolong', 1, 1, 'Draft', 500),
      ('p-chest', 'ana-personal', 'Oolong', 'Ana Dong Ding', NULL, 'ana-dong-ding', 0, 0, 'Active', 0),
      ('p-bo', 'bo-personal', 'Green', 'Bo Green', NULL, 'bo-green', 0, 0, 'Active', 0);
  `);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

const HOST_TOOLS = ['host_table', 'list_my_tables', 'get_table_guests', 'answer_guest', 'add_table_tea', 'set_guest_note', 'get_guest_notes'];

describe('who may use the host tools', () => {
  it('lists every host tool to a host', async () => {
    const body = await rpc('ana', 'tools/list', {});
    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    for (const name of [...HOST_TOOLS, 'set_host_approval']) expect(names).toContain(name);
  });

  it('answers "not available" to a person Adrian has not approved, writing nothing', async () => {
    for (const name of HOST_TOOLS) {
      expect(await call('cy', name, { table_id: 't-ana', date: '2030-01-05', time: '16:00', timezone: 'Asia/Taipei' }))
        .toMatchObject({ error: 'not_available' });
    }
    expect(count('SELECT COUNT(*) AS n FROM events WHERE account_id = ?', 'cy-personal')).toBe(0);
    expect(count('SELECT COUNT(*) AS n FROM mcp_confirmation_tickets')).toBe(0);
  });

  it('answers "not available" while Launch 2 is closed, even to an approved host', async () => {
    open = false;
    for (const name of [...HOST_TOOLS, 'set_host_approval']) {
      expect(await call(name === 'set_host_approval' ? 'adrian' : 'ana', name, { table_id: 't-ana' }))
        .toMatchObject({ error: 'not_available' });
    }
  });

  it('answers "not available" to a host whose token is on a shop rather than their own account', async () => {
    expect(await call('anaShop', 'list_my_tables')).toMatchObject({ error: 'not_available' });
    expect(await call('anaShop', 'get_table_guests', { table_id: 't-ana' })).toMatchObject({ error: 'not_available' });
  });

  it('answers "not found" for another host\'s table and for a shop\'s session', async () => {
    for (const table_id of ['t-bo', 't-shop', 'nope']) {
      expect(await call('ana', 'get_table_guests', { table_id })).toEqual({ error: 'table_not_found' });
      expect(await call('ana', 'get_guest_notes', { table_id })).toEqual({ error: 'table_not_found' });
      expect(await call('ana', 'answer_guest', { table_id, attendee_id: 'g-bo', answer: 'yes' })).toEqual({ error: 'table_not_found' });
      expect(await call('ana', 'add_table_tea', { table_id, name: 'Anything', as_typed: true })).toEqual({ error: 'table_not_found' });
      expect(await call('ana', 'set_guest_note', { table_id, attendee_id: 'g-bo', note: 'x' })).toEqual({ error: 'table_not_found' });
    }
    expect(statusOf('g-bo')).toBe('requested');
  });
});

describe('host_table', () => {
  it('writes nothing on preview, makes the table on confirm, and spends the ticket once', async () => {
    const preview = await call('ana', 'host_table', { date: '2030-01-05', time: '16:00', timezone: 'Asia/Taipei' });
    expect(preview.preview).toMatchObject({ action: 'host_table', seats: 6, when: 'Saturday, January 5, 2030 at 16:00 (Asia/Taipei)' });
    expect(count('SELECT COUNT(*) AS n FROM events WHERE account_id = ?', 'ana-personal')).toBe(1);

    const done = await call('ana', 'host_table', { confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, action: 'host_table' });
    expect(done.link).toMatch(/^https:\/\/hosts\.test\/event\//);
    const made = db.sqlite.prepare('SELECT account_id, host_user_id, door, total_capacity FROM events WHERE id = ?').get(done.table_id);
    expect(made).toEqual({ account_id: 'ana-personal', host_user_id: 'ana', door: 'request', total_capacity: 6 });

    expect(await call('ana', 'host_table', { confirm: preview.confirmation_token }))
      .toEqual({ error: 'invalid_or_expired_confirmation_token' });
    expect(count('SELECT COUNT(*) AS n FROM events WHERE account_id = ?', 'ana-personal')).toBe(2);
  });

  it('takes the zone of the host\'s last table when none is given, and refuses a day already past at confirm', async () => {
    const preview = await call('ana', 'host_table', { date: '2020-01-04', time: '16:00' });
    expect(preview.preview.when).toContain('(Asia/Taipei)');
    expect(await call('ana', 'host_table', { confirm: preview.confirmation_token }))
      .toMatchObject({ error: 'hosted_table_past_day' });
    expect(count('SELECT COUNT(*) AS n FROM events WHERE account_id = ?', 'ana-personal')).toBe(1);
  });

  it('a ticket of one host cannot be spent by another', async () => {
    const preview = await call('ana', 'host_table', { date: '2030-01-05', time: '16:00', timezone: 'Asia/Taipei' });
    expect(await call('bo', 'host_table', { confirm: preview.confirmation_token }))
      .toEqual({ error: 'invalid_or_expired_confirmation_token' });
    expect(count('SELECT COUNT(*) AS n FROM events WHERE host_user_id IN (?, ?)', 'ana', 'bo')).toBe(2);
  });
});

describe('list_my_tables and get_table_guests', () => {
  it('lists only the host\'s own tables', async () => {
    const out = await call('ana', 'list_my_tables');
    expect(out.tables.map((row: { id: string }) => row.id)).toEqual(['t-ana']);
    expect(out.tables[0]).toMatchObject({ seats: 4, guests: { confirmed: 0, waiting: 2 }, link: 'https://hosts.test/event/slug-t-ana' });
  });

  it('gives names, status and the photograph wish, and never an address, a contact or a note', async () => {
    await saveGuestNote(db as never, { hostUserId: 'ana', accountId: 'ana-personal', eventId: 't-ana', attendeeId: 'g-mei', note: 'Likes it strong.' });
    const out = await call('ana', 'get_table_guests', { table_id: 't-ana' });
    expect(out.guests).toEqual([
      { attendee_id: 'g-mei', name: 'Mei Lin', status: 'requested', party_guests: 0, came: null, asked_at: expect.any(String), no_photographs: true },
      { attendee_id: 'g-tao', name: 'Tao', status: 'requested', party_guests: 0, came: null, asked_at: expect.any(String), no_photographs: false },
    ]);
    const raw = JSON.stringify(out);
    for (const secret of ['Secret Lane', 'maps.test', '912', 'guest.test', 'magic-', 'First time', 'Likes it strong', 'phone', 'email', 'note', 'address']) {
      expect(raw).not.toContain(secret);
    }
  });
});

describe('answer_guest', () => {
  it('writes nothing on preview, and a yes by name seats the guest on confirm', async () => {
    const preview = await call('ana', 'answer_guest', { table_id: 't-ana', guest_name: 'mei', answer: 'yes' });
    expect(preview.preview).toMatchObject({ guest: 'Mei Lin', answer: 'yes', seats: { taken: 0, total: 4, this_answer_takes: 1 } });
    expect(statusOf('g-mei')).toBe('requested');

    const done = await call('ana', 'answer_guest', { confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, attendee_id: 'g-mei', status: 'confirmed' });
    expect(statusOf('g-mei')).toBe('confirmed');
    expect((db.sqlite.prepare('SELECT seat_status FROM event_party_members WHERE participation_id = ?').get('g-mei') as { seat_status: string }).seat_status)
      .toBe('confirmed');
  });

  it('a no writes nothing on preview and turns the guest away on confirm', async () => {
    const { preview, done } = await previewAndConfirm('ana', 'answer_guest', { table_id: 't-ana', attendee_id: 'g-tao', answer: 'no' });
    expect(preview.preview).toMatchObject({ guest: 'Tao', answer: 'no' });
    expect(done).toMatchObject({ committed: true, status: 'denied' });
    expect(statusOf('g-tao')).toBe('denied');
  });

  it('re-checks the seats at confirm: a table that filled after the preview refuses, and nothing is written', async () => {
    const preview = await call('ana', 'answer_guest', { table_id: 't-ana', attendee_id: 'g-mei', answer: 'yes' });
    // Someone else takes the last seat in the meantime.
    db.sqlite.prepare('UPDATE events SET total_capacity = 1 WHERE id = ?').run('t-ana');
    guest('g-late', 'Late', 't-ana', 'ana-personal', { status: 'confirmed' });
    expect(await call('ana', 'answer_guest', { confirm: preview.confirmation_token })).toMatchObject({ error: 'capacity_conflict' });
    expect(statusOf('g-mei')).toBe('requested');
  });

  it('re-checks the guest at confirm: one who left after the preview is not seated', async () => {
    const preview = await call('ana', 'answer_guest', { table_id: 't-ana', attendee_id: 'g-mei', answer: 'yes' });
    db.sqlite.prepare("UPDATE event_attendees SET status = 'cancelled' WHERE id = ?").run('g-mei');
    expect(await call('ana', 'answer_guest', { confirm: preview.confirmation_token })).toMatchObject({ error: 'state_conflict' });
    expect(statusOf('g-mei')).toBe('cancelled');
  });

  it('re-checks ownership at confirm: a table moved away after the preview is not found', async () => {
    const preview = await call('ana', 'answer_guest', { table_id: 't-ana', attendee_id: 'g-mei', answer: 'yes' });
    db.sqlite.prepare("UPDATE events SET host_user_id = 'bo' WHERE id = ?").run('t-ana');
    expect(await call('ana', 'answer_guest', { confirm: preview.confirmation_token })).toEqual({ error: 'table_not_found' });
    expect(statusOf('g-mei')).toBe('requested');
  });

  it('refuses a yes at a full table at preview', async () => {
    db.sqlite.prepare('UPDATE events SET total_capacity = 1 WHERE id = ?').run('t-ana');
    guest('g-late', 'Late', 't-ana', 'ana-personal', { status: 'confirmed' });
    const out = await call('ana', 'answer_guest', { table_id: 't-ana', attendee_id: 'g-mei', answer: 'yes' });
    expect(out).toMatchObject({ error: 'capacity_conflict' });
    expect(out.confirmation_token).toBeUndefined();
  });
});

describe('add_table_tea', () => {
  it('writes nothing on preview, and adds a shop tea matched by name on confirm, linked', async () => {
    const preview = await call('ana', 'add_table_tea', { table_id: 't-ana', name: '2015 shou' });
    expect(preview.preview).toMatchObject({ tea: '2015 Shou', position: 1 });
    expect(teaNames('t-ana')).toEqual([]);
    const done = await call('ana', 'add_table_tea', { confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, tea: { name: '2015 Shou', source: 'shop' } });
    expect(teaNames('t-ana')).toEqual([{ name: '2015 Shou', product_id: 'p-shou' }]);
  });

  it('adds a chest tea by id and a plain name as typed, after the teas already there', async () => {
    await previewAndConfirm('ana', 'add_table_tea', { table_id: 't-ana', product_id: 'p-shou' });
    const chest = await previewAndConfirm('ana', 'add_table_tea', { table_id: 't-ana', product_id: 'p-chest', from: 'Lugu' });
    expect(chest.done.tea).toMatchObject({ name: 'Ana Dong Ding', source: 'chest' });
    const plain = await previewAndConfirm('ana', 'add_table_tea', { table_id: 't-ana', name: '2015 shou from a friend', as_typed: true });
    expect(plain.done.tea).toMatchObject({ source: 'name' });
    expect(teaNames('t-ana')).toEqual([
      { name: '2015 Shou', product_id: 'p-shou' },
      { name: 'Ana Dong Ding', product_id: 'p-chest' },
      { name: '2015 shou from a friend', product_id: null },
    ]);
  });

  it('refuses a draft shop tea and another person\'s tea, and never shows a price', async () => {
    for (const product_id of ['p-draft', 'p-bo', 'nope']) {
      const out = await call('ana', 'add_table_tea', { table_id: 't-ana', product_id });
      expect(out).toMatchObject({ error: 'tea_not_found' });
    }
    const preview = await call('ana', 'add_table_tea', { table_id: 't-ana', product_id: 'p-shou' });
    expect(JSON.stringify(preview)).not.toMatch(/price|cost|stock/i);
    expect(teaNames('t-ana')).toEqual([]);
  });
});

describe('the private guest book', () => {
  it('writes nothing on preview, keeps the line on confirm, and reads it back to the host alone', async () => {
    const preview = await call('ana', 'set_guest_note', { table_id: 't-ana', guest_name: 'Tao', note: 'Brought cakes.' });
    expect(preview.preview).toMatchObject({ guest: 'Tao', note: 'Brought cakes.', replaces: 'no note' });
    expect(count('SELECT COUNT(*) AS n FROM host_guest_notes')).toBe(0);

    const done = await call('ana', 'set_guest_note', { confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, attendee_id: 'g-tao', note: 'Brought cakes.' });
    expect(await call('ana', 'get_guest_notes', { table_id: 't-ana' })).toMatchObject({
      notes: [{ attendee_id: 'g-tao', name: 'Tao', note: 'Brought cakes.' }],
    });
    expect(await call('bo', 'get_guest_notes', { table_id: 't-ana' })).toEqual({ error: 'table_not_found' });
    expect(JSON.stringify(await call('ana', 'get_table_guests', { table_id: 't-ana' }))).not.toContain('Brought cakes');
  });

  it('clears a line with an empty note', async () => {
    await previewAndConfirm('ana', 'set_guest_note', { table_id: 't-ana', attendee_id: 'g-tao', note: 'Brought cakes.' });
    await previewAndConfirm('ana', 'set_guest_note', { table_id: 't-ana', attendee_id: 'g-tao', note: '' });
    expect(count('SELECT COUNT(*) AS n FROM host_guest_notes')).toBe(0);
  });
});

describe('set_host_approval', () => {
  it('is for the platform owner only', async () => {
    expect(await call('ana', 'set_host_approval', { user_id: 'cy', approved: true })).toMatchObject({ error: 'not_available' });
    expect(count("SELECT COUNT(*) AS n FROM users WHERE id = 'cy' AND host_approved_at IS NOT NULL")).toBe(0);
  });

  it('writes nothing on preview, approves on confirm, and the new host can then host', async () => {
    const preview = await call('adrian', 'set_host_approval', { email: 'cy@test.dev', approved: true });
    expect(preview.preview).toMatchObject({ person: { id: 'cy' }, approved_now: false, approved: true });
    expect(count("SELECT COUNT(*) AS n FROM users WHERE id = 'cy' AND host_approved_at IS NOT NULL")).toBe(0);

    expect(await call('adrian', 'set_host_approval', { confirm: preview.confirmation_token }))
      .toMatchObject({ committed: true, user_id: 'cy', may_host: true });
    expect(count("SELECT COUNT(*) AS n FROM accounts WHERE id = 'cy-personal' AND host_approved_at IS NOT NULL")).toBe(1);
    expect(await call('cy', 'list_my_tables')).toMatchObject({ tables: [] });

    const withdraw = await previewAndConfirm('adrian', 'set_host_approval', { user_id: 'cy', approved: false });
    expect(withdraw.done).toMatchObject({ committed: true, may_host: false });
    expect(await call('cy', 'list_my_tables')).toMatchObject({ error: 'not_available' });
  });
});
