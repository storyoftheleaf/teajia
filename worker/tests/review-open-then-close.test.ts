// A10 review (https://github.com/storyoftheleaf/teajia/blob/4eb502f99c40509176472e9fede440243d23e3ef/todo/plans/review-prompts/astra-a10-open-then-close.md): data
// made while a switch is open, after the switch closes, and when it opens
// again. For each switch: make the data open, close it, call the routes it
// gates and the public readers that could still show the data, open it again
// and check the data is whole. Driven through worker.fetch against SQLite built
// from the migration ledger, as the live database was built.
//
// A test written `it.fails` records a hole found in this review: it passes
// while the hole is there and starts failing once the fix lands, so whoever
// fixes it turns it into a plain `it`. Findings: todo/review/findings/A10.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { settleHostCredit } from '../src/hostCreditLedger';
import { sha256Hex } from '../src/inquiryDomain';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'a10-open-then-close';
const allow = { limit: async () => ({ success: true }) };
const databases: SqliteD1[] = [];
afterEach(() => {
  while (databases.length) databases.pop()!.close();
  vi.unstubAllGlobals();
});

function fresh() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  return db;
}

type Who = { userId: string; account?: string } | null;
type Flags = Record<string, string>;

async function call(db: SqliteD1, flags: Flags, who: Who, path: string,
  init: { method?: string; body?: unknown; bearer?: string } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10' });
  if (who) {
    const token = await signedToken(SECRET, { sub: who.userId, name: who.userId, email: `${who.userId}@test.dev`, role: 'user',
      ...(who.account ? { active_account_id: who.account } : {}) });
    headers.set('Authorization', `Bearer ${token}`);
    if (who.account) headers.set('X-Teajia-Account', who.account);
  }
  if (init.bearer) headers.set('Authorization', `Bearer ${init.bearer}`);
  const method = init.method ?? 'GET';
  const response = await worker.fetch(new Request(`https://worker.test${path}`, {
    method, headers, body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test',
    PROVIDER_LIMITER: allow, RSVP_LIMITER: allow, INQUIRY_LIMITER: allow, PUBLIC_MCP_LIMITER: allow,
    FIRST_TABLE_OPEN: 'true', ...flags,
  } as never, { waitUntil() {}, passThroughOnException() {} } as never);
  const text = await response.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, body, text, headers: [...response.headers.entries()] };
}

/** An approved host with a private personal account, as Launch 2 makes one. */
function host(db: SqliteD1, userId: string) {
  const accountId = `${userId}-personal`;
  seedIdentity(db, { userId, accountId: `${userId}-unused`, publicEnabled: false });
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-20T00:00:00Z')`)
    .run(accountId, accountId, `${userId} tea chest`, userId, userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(accountId, userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-20T00:00:00Z' WHERE id = ?`).run(userId);
  return accountId;
}

function hostedTable(db: SqliteD1, id: string, accountId: string, hostUserId: string, door = 'request') {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status, address_text, map_link)
    VALUES (?, ?, ?, ?, ?, 4, 'Asia/Makassar', ?, 1, 'unlisted', 0, ?, 'active', 'published', '12 Secret Lane', 'https://maps.test/secret')`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, new Date(Date.now() + 7 * 86400000).toISOString(), door, hostUserId);
}

function seat(db: SqliteD1, id: string, eventId: string, accountId: string, status: string) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, magic_token, status)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, accountId, eventId, `Guest ${id}`, `magic-${id}`, status);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`).run(`party-${id}`, accountId, eventId, id, `Guest ${id}`, status);
}

// ─── HOST_CREDIT ─────────────────────────────────────────────────────────────

describe('HOST_CREDIT: credit earned while open, after the switch closes', () => {
  const via = 'aaaaaaaaaaaaaaaaaa';
  function shop() {
    const db = fresh();
    seedIdentity(db, { accountId: 'shop', userId: 'host' });
    db.sqlite.exec(`
      UPDATE accounts SET default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD' WHERE id = 'shop';
      INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
      INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams)
        VALUES ('tea', 'shop', 'Red', 'Red tea', 'Loose', 20, 'USD', 300, 1000);
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, thanks_ref)
        VALUES ('event', 'shop', 'sit', 'Tea', '2026-01-10', 'completed', '${via}');
      INSERT INTO contributors (id, account_id, display_name, user_id, is_published) VALUES ('contributor', 'shop', 'Host', 'host', 1);
      INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('contributor', 'shop');
      INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public)
        VALUES ('lead', 'shop', 'event', 'contributor', 'lead_host', 1);
    `);
    return db;
  }
  const creditEnv = (db: SqliteD1, open: boolean) => ({
    DB: db as unknown as D1Database, JWT_SECRET: SECRET, HOST_CREDIT_OPEN: String(open), FIRST_TABLE_OPEN: 'true', INQUIRY_LIMITER: allow,
  });
  async function checkout(db: SqliteD1) {
    const tasks: Promise<unknown>[] = [];
    const response = await worker.fetch(new Request('https://worker.test/api/inquiries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'website', via, store_slug: 'shop', tracking_token: 'a10opencloseredteatrackingtoken0000000001',
        ref_number: 'A10-CREDIT', customer_name: 'Buyer', customer_contact: 'buyer@example.com',
        customer_location: 'Ubud, Indonesia', currency: 'USD', total_estimate_usd: 14,
        items: [{ id: 'tea', name: 'Red tea', category: 'tea', storeSlug: 'shop', quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 0.28, totalPrice: 14 }],
      }),
    }), creditEnv(db, true) as never, { waitUntil: (task: Promise<unknown>) => tasks.push(task) } as never);
    await Promise.all(tasks);
    const saved = await response.json() as { invoice_id: string };
    expect(response.status, JSON.stringify(saved)).toBe(201);
    return saved.invoice_id;
  }
  const kinds = (db: SqliteD1, invoice: string) =>
    db.sqlite.prepare('SELECT kind FROM host_credit_entries WHERE invoice_id = ? ORDER BY rowid').all(invoice).map(row => row.kind);

  it('the credit earned stays whole through a close and opens again as it was', async () => {
    const db = shop();
    const invoice = await checkout(db);
    db.sqlite.prepare("UPDATE invoices SET status = 'Filled', payment_status = 'paid' WHERE id = ?").run(invoice);
    await settleHostCredit(creditEnv(db, true), invoice);
    expect(kinds(db, invoice)).toEqual(['pending', 'earned']);
    const me = { userId: 'host' };
    const open = await call(db, { HOST_CREDIT_OPEN: 'true' }, me, '/api/me/tea-credit');
    expect(open.status, open.text).toBe(200);
    const closed = await call(db, { HOST_CREDIT_OPEN: 'false' }, me, '/api/me/tea-credit');
    expect(closed.status).toBe(404);
    expect((await call(db, { HOST_CREDIT_OPEN: 'false' }, { userId: 'host', account: 'shop' }, '/api/host-credit')).status).toBe(404);
    const again = await call(db, { HOST_CREDIT_OPEN: 'true' }, me, '/api/me/tea-credit');
    expect(again.body).toEqual(open.body);
  });

  // A10-1 (S1), fixed: settleHostCredit records the reversal of a voided order
  // whether the switch is open or closed (closed earns nothing new, and still
  // reads no source). todo/review/fixes/credit.md.
  it('A10-1: an order voided while the switch is closed takes its credit back', async () => {
    const db = shop();
    const invoice = await checkout(db);
    db.sqlite.prepare("UPDATE invoices SET status = 'Filled', payment_status = 'paid' WHERE id = ?").run(invoice);
    await settleHostCredit(creditEnv(db, true), invoice);
    expect(kinds(db, invoice)).toEqual(['pending', 'earned']);
    // Closed: the shop voids the order, and every void path calls settleHostCredit.
    db.sqlite.prepare("UPDATE invoices SET status = 'Void' WHERE id = ?").run(invoice);
    const closedSettle = await settleHostCredit(creditEnv(db, false), invoice);
    expect(closedSettle.reversed).toBe(1);
    expect(kinds(db, invoice)).toEqual(['pending', 'earned', 'reversed']);
    // Open again: nothing of the voided order is left to spend.
    const balance = await call(db, { HOST_CREDIT_OPEN: 'true' }, { userId: 'host' }, '/api/me/tea-credit');
    expect(balance.status).toBe(200);
    expect(balance.body.balances[0]).toMatchObject({ earned: 1.4, reversed: 1.4, available: 0 });
  });

  // A row written before the fix: a Void settled while closed left the award
  // unreversed. The first read after reopening reverses it before any balance is shown.
  it('A10-1, an award left unreversed before the fix is reversed when credit reopens', async () => {
    const db = shop();
    const invoice = await checkout(db);
    db.sqlite.prepare("UPDATE invoices SET status = 'Filled', payment_status = 'paid' WHERE id = ?").run(invoice);
    await settleHostCredit(creditEnv(db, true), invoice);
    // The old shape: Void with no settle at all, as the closed early return left it.
    db.sqlite.prepare("UPDATE invoices SET status = 'Void' WHERE id = ?").run(invoice);
    expect(kinds(db, invoice)).toEqual(['pending', 'earned']);
    const balance = await call(db, { HOST_CREDIT_OPEN: 'true' }, { userId: 'host' }, '/api/me/tea-credit');
    expect(balance.status).toBe(200);
    expect(kinds(db, invoice)).toEqual(['pending', 'earned', 'reversed']);
    expect(balance.body.balances[0]).toMatchObject({ available: 0 });
  });
});

// ─── TEA_TABLE (and KNOW_THIS_TEA, quiet acknowledgement) ───────────────────

describe('TEA_TABLE: a piece, a keep and a hold made while open', () => {
  const SHOP = 'acc_teajia_bali';
  const MEMBER = { userId: 'member-one' };
  const READER = { userId: 'member-two' };
  const OWNER = { userId: 'owner', account: SHOP };
  function setup() {
    const db = fresh();
    seedIdentity(db, { userId: 'owner', accountId: SHOP, accountSlug: 'teajia-bali', role: 'owner' });
    for (const id of ['member-one', 'member-two']) {
      db.sqlite.prepare(`INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at)
        VALUES (?, ?, ?, 'x', 'user', 0, '2026-11-01')`).run(id, `${id}@test.dev`, id);
    }
    db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, is_public, shown_in_shop, status, stock_grams,
        tasting, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
      VALUES ('tea-a', ?, 'Oolong', 'Tea A', 'Tea A', 1, 1, 'Active', 100, '{}', NULL, NULL, NULL, NULL)`).run(SHOP);
    db.sqlite.prepare(`INSERT INTO customer_tasting_journal (id, account_id, user_id, product_id, product_name, rating, note, tastings)
      VALUES ('journal-one', NULL, 'member-one@test.dev', 'tea-a', 'Tea A', 9, ?, ?)`).run(
      JSON.stringify({ rating: 9, verdict: 'love', tasting: {} }),
      JSON.stringify([{ id: 's1', createdAt: '2026-11-10T08:00:00Z', rating: 9, tasting: { notes: ['Orchid on the lid'] } }]),
    );
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, links)
      VALUES ('mei', ?, 'member-one', 'Mei', 1, 'family', '[]')`).run(SHOP);
    return db;
  }
  const OPEN = { TEA_TABLE_OPEN: 'true' };
  const CLOSED = { TEA_TABLE_OPEN: 'false' };
  const share = (db: SqliteD1, flags: Flags) => call(db, flags, MEMBER, '/api/family/teas/tea-a/share',
    { method: 'PUT', body: { share_state: 'page', tea_table: true } });
  const onTable = (db: SqliteD1) => (db.sqlite.prepare('SELECT tea_table_at FROM member_tasting_shares WHERE journal_entry_id = ?')
    .get('journal-one') as { tea_table_at: string | null } | undefined)?.tea_table_at ?? null;

  it('goes quiet everywhere while closed and comes back whole', async () => {
    const db = setup();
    expect((await share(db, OPEN)).body.on_tea_table).toBe(true);
    expect((await call(db, OPEN, READER, '/api/tea-table/keeps/tasting/journal-one', { method: 'PUT' })).status).toBe(200);
    const before = await call(db, OPEN, null, '/api/tea-table');
    expect(before.body.items.map((i: any) => `${i.kind}:${i.id}`)).toEqual(['tasting:journal-one']);
    const keptBefore = (await call(db, OPEN, READER, '/api/tea-table/me')).body;

    const unknown = await call(db, CLOSED, null, '/api/no-such-address');
    for (const [who, path] of [[null, '/api/tea-table'], [READER, '/api/tea-table/me'], [OWNER, '/api/admin/tea-table']] as const) {
      const closed = await call(db, CLOSED, who, path);
      expect(closed.status, path).toBe(404);
      expect(closed.text, path).toBe(unknown.text);
    }
    // The person page and the tea's own page still show the tasting (it is on the page too) but say nothing of the table.
    const person = await call(db, CLOSED, null, '/api/people/mei');
    expect(person.status).toBe(200);
    expect(person.text).not.toMatch(/tea_table|on_table|kept|keeps/);
    // Taking it off the page while closed is the person's own choice and still works: it is not lost data.
    // Re-sharing under the page wording while closed leaves the table moment as it was.
    expect((await call(db, CLOSED, MEMBER, '/api/family/teas/tea-a/share', { method: 'PUT', body: { share_state: 'page' } })).status).toBe(200);
    expect(onTable(db)).not.toBeNull();

    const after = await call(db, OPEN, null, '/api/tea-table');
    expect(after.body.items.map((i: any) => `${i.kind}:${i.id}`)).toEqual(['tasting:journal-one']);
    expect((await call(db, OPEN, READER, '/api/tea-table/me')).body).toEqual(keptBefore);
  });

  // A10-2 (S2, half-open): the site has TEA_TABLE open and the worker not yet.
  // The site sends tea_table: true under "On my page and the Tea Table" and
  // then says "On your page and the Tea Table." whatever the answer was
  // (src/components/tasting/TastingShareStep.tsx). The worker records only the
  // page share and answers on_tea_table: false, which the site never reads.
  it('A10-2: a Tea Table share sent while the worker is closed is answered on_tea_table false and nothing is recorded', async () => {
    const db = setup();
    const sent = await share(db, CLOSED);
    expect(sent.status).toBe(200);
    expect(sent.body.on_tea_table).toBe(false);
    expect(onTable(db)).toBeNull();
    // When the worker opens, the tasting the person put on the table is not there.
    expect((await call(db, OPEN, null, '/api/tea-table')).body.items).toEqual([]);
  });

  it('KNOW_THIS_TEA stands on TEA_TABLE: open alone, every question route is closed', async () => {
    const db = setup();
    for (const path of ['/api/tea-table/questions/q-1', '/api/admin/tea-table/questions']) {
      expect((await call(db, { TEA_TABLE_OPEN: 'false', KNOW_THIS_TEA_OPEN: 'true' }, OWNER, path)).status, path).toBe(404);
    }
  });
});

// ─── FAVOURITES ──────────────────────────────────────────────────────────────

describe('FAVOURITES: marks made while open', () => {
  it('go quiet while closed, survive an edit of the chest tea made while closed, and come back whole', async () => {
    const db = fresh();
    seedIdentity(db, { userId: 'reader', accountId: 'shop' });
    db.exec(`
      INSERT INTO articles (id, account_id, title, slug, status) VALUES ('art-open', 'shop', 'Water and stone', 'water-and-stone', 'published');
      INSERT INTO personal_cellar_items (id, owner_user_id, name, grams) VALUES ('chest-mine', 'reader', 'My Liu Bao', 100);
    `);
    const me = { userId: 'reader' };
    const OPEN = { FAVOURITES_OPEN: 'true' };
    const CLOSED = { FAVOURITES_OPEN: 'false' };
    expect((await call(db, OPEN, me, '/api/me/favourites/articles/art-open', { method: 'PUT' })).status).toBe(200);
    expect((await call(db, OPEN, me, '/api/me/cellar/chest-mine/favourite', { method: 'PUT', body: { favourite: true } })).status).toBe(200);
    const before = (await call(db, OPEN, me, '/api/me/favourites')).body;
    expect(before.articles.map((a: any) => a.id)).toEqual(['art-open']);
    expect(before.chest_teas.map((t: any) => t.id)).toEqual(['chest-mine']);

    expect((await call(db, CLOSED, me, '/api/me/favourites')).status).toBe(404);
    expect((await call(db, CLOSED, me, '/api/me/cellar/chest-mine/favourite', { method: 'PUT', body: { favourite: false } })).status).toBe(404);
    const chest = await call(db, CLOSED, me, '/api/me/cellar');
    expect(chest.status, chest.text).toBe(200);
    expect(chest.text).not.toMatch(/favourite/);
    // An edit of the chest tea while closed (the chest is open to everyone) must not wipe the mark.
    const edited = await call(db, CLOSED, me, '/api/me/cellar/chest-mine', { method: 'PUT', body: { name: 'My Liu Bao, 2008', grams: 90 } });
    expect([200, 204]).toContain(edited.status);

    const after = (await call(db, OPEN, me, '/api/me/favourites')).body;
    expect(after.articles.map((a: any) => a.id)).toEqual(['art-open']);
    expect(after.chest_teas.map((t: any) => t.id)).toEqual(['chest-mine']);
  });
});

// ─── FEW_HOSTS and the switches that stand on it ─────────────────────────────

describe('FEW_HOSTS: a hosted table with guests, after the switch closes', () => {
  function setup() {
    const db = fresh();
    const ana = host(db, 'ana');
    hostedTable(db, 't-ana', ana, 'ana');
    seat(db, 'g-yes', 't-ana', ana, 'confirmed');
    seat(db, 'g-asks', 't-ana', ana, 'requested');
    return db;
  }
  const OPEN = { FEW_HOSTS_OPEN: 'true' };
  const CLOSED = { FEW_HOSTS_OPEN: 'false' };

  it('the host and the link go quiet, each guest keeps their own page, and the table comes back whole', async () => {
    const db = setup();
    const ana = { userId: 'ana' };
    const tables = await call(db, OPEN, ana, '/api/me/tables');
    expect(tables.status, tables.text).toBe(200);
    expect((await call(db, OPEN, null, '/api/events/slug-t-ana/public')).status).toBe(200);

    expect((await call(db, CLOSED, ana, '/api/me/tables')).status).toBe(404);
    expect((await call(db, CLOSED, ana, '/api/me/hosting')).status).toBe(404);
    expect((await call(db, CLOSED, null, '/api/events/slug-t-ana/public')).status).toBe(404);
    // The guests are not left with nothing: each one's own page still answers.
    const yes = await call(db, CLOSED, null, '/api/rsvp/magic-g-yes');
    expect(yes.status).toBe(200);
    expect(yes.body.attendee.status).toBe('confirmed');
    const asks = await call(db, CLOSED, null, '/api/rsvp/magic-g-asks');
    expect(asks.status).toBe(200);
    // A10-5: but the guest who asked is still "requested", and with the host's
    // page closed nobody can answer them. Recorded as it is.
    expect(asks.body.attendee.status).toBe('requested');
    expect((await call(db, CLOSED, ana, '/api/me/tables/t-ana/guests/g-asks/yes', { method: 'PUT', body: {} })).status).toBe(404);

    const again = await call(db, OPEN, ana, '/api/me/tables');
    expect(again.body).toEqual(tables.body);
    // Open again, the same yes goes through: the request waited, whole, for the switch.
    const yesAgain = await call(db, OPEN, ana, '/api/me/tables/t-ana/guests/g-asks/yes', { method: 'PUT', body: {} });
    expect(yesAgain.status, yesAgain.text).toBe(200);
  });

  it.each([
    ['CIRCLES_OPEN', '/api/me/circles'],
    ['HOST_TOKENS_OPEN', '/api/me/assistant-tokens'],
    ['YOUR_TABLE_PLACE_OPEN', '/api/me/your-table'],
  ])('%s opened without FEW_HOSTS answers nothing', async (name, path) => {
    const db = setup();
    expect((await call(db, { [name]: 'true', FEW_HOSTS_OPEN: 'false' }, { userId: 'ana' }, path)).status).toBe(404);
    expect((await call(db, { [name]: 'true', FEW_HOSTS_OPEN: 'true' }, { userId: 'ana' }, path)).status).toBe(200);
  });

  it('CIRCLES: a circle made while open is whole after a close, and the public session says nothing of it while closed', async () => {
    const db = setup();
    const ana = { userId: 'ana', account: 'ana-personal' };
    const OPEN_C = { FEW_HOSTS_OPEN: 'true', ANYONE_HOSTS_OPEN: 'true', CIRCLES_OPEN: 'true' };
    const CLOSED_C = { ...OPEN_C, CIRCLES_OPEN: 'false' };
    const made = await call(db, OPEN_C, ana, '/api/me/circles', { method: 'POST', body: { name: 'Thursday tea', kind: 'series' } });
    expect(made.status, made.text).toBeLessThan(300);
    const circleId = made.body.circle?.id ?? made.body.id;
    expect((await call(db, OPEN_C, ana, '/api/me/tables/t-ana/circle', { method: 'PUT', body: { circle_id: circleId } })).status).toBe(200);
    const listed = (await call(db, OPEN_C, ana, '/api/me/circles')).body;

    expect((await call(db, CLOSED_C, ana, '/api/me/circles')).status).toBe(404);
    const page = await call(db, CLOSED_C, null, '/api/events/slug-t-ana/public');
    expect(page.status).toBe(200);
    expect(page.body).not.toHaveProperty('series');
    expect((db.sqlite.prepare('SELECT series_id FROM events WHERE id = ?').get('t-ana') as any).series_id).toBe(circleId);

    expect((await call(db, OPEN_C, ana, '/api/me/circles')).body).toEqual(listed);
  });

  it('HOST_TOKENS: a host key made while open stops working when closed and works again, unasked, when reopened', async () => {
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
    const db = setup();
    const OPEN_T = { FEW_HOSTS_OPEN: 'true', ANYONE_HOSTS_OPEN: 'true', HOST_TOKENS_OPEN: 'true' };
    const made = await call(db, OPEN_T, { userId: 'ana' }, '/api/me/assistant-tokens', { method: 'POST', body: { label: 'My phone' } });
    expect(made.status, made.text).toBe(201);
    const key = made.body.token as string;
    expect(await sha256Hex(key)).toBeTruthy();
    const list = (flags: Flags) => call(db, flags, null, '/mcp', { method: 'POST', bearer: key, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    const tools = (r: Awaited<ReturnType<typeof call>>) => (r.body?.result?.tools ?? []).map((t: any) => t.name);
    expect(tools(await list(OPEN_T))).toContain('list_my_tables');
    for (const closed of [{ ...OPEN_T, HOST_TOKENS_OPEN: 'false' }, { ...OPEN_T, FEW_HOSTS_OPEN: 'false' }]) {
      const answer = await list(closed);
      expect(tools(answer)).not.toContain('list_my_tables');
    }
    // Reopened, the same key works again. The host was never told it stopped, nor that it started again.
    expect(tools(await list(OPEN_T))).toContain('list_my_tables');
  });
});

// ─── What a closed route answers ─────────────────────────────────────────────

describe('a closed route answers as a route that does not exist', () => {
  // A4 finding 12 made this the rule for Launch 4 (worker/src/launch4Closed.ts).
  // Launches 2, 3 and 5 close in their handlers instead. Each closed answer
  // here is compared with the unknown-address answer, signed out and signed in.
  const ROUTES: Array<[string, string, Flags]> = [
    ['GET', '/api/me/tables', { FEW_HOSTS_OPEN: 'false' }],
    ['GET', '/api/me/hosting', { FEW_HOSTS_OPEN: 'false' }],
    ['GET', '/api/me/sessions', { FEW_HOSTS_OPEN: 'false' }],
    ['POST', '/api/session-reports', { ANYONE_HOSTS_OPEN: 'false' }],
    ['GET', '/api/admin/session-reports', { ANYONE_HOSTS_OPEN: 'false' }],
    ['GET', '/api/me/tea-credit', { HOST_CREDIT_OPEN: 'false' }],
    ['GET', '/api/host-credit', { HOST_CREDIT_OPEN: 'false' }],
    ['GET', '/api/me/circles', { FEW_HOSTS_OPEN: 'true', CIRCLES_OPEN: 'false' }],
    ['GET', '/api/me/assistant-tokens', { FEW_HOSTS_OPEN: 'true', HOST_TOKENS_OPEN: 'false' }],
    ['GET', '/api/tea-table/questions/q-1', { TEA_TABLE_OPEN: 'true', KNOW_THIS_TEA_OPEN: 'false' }],
    ['GET', '/api/admin/tea-table/questions', { TEA_TABLE_OPEN: 'true', KNOW_THIS_TEA_OPEN: 'false' }],
  ];

  it('records which closed answers can be told from an unknown address (A10-7)', async () => {
    const db = fresh();
    seedIdentity(db, { userId: 'owner', accountId: 'shop', platformRole: 'platform_owner' });
    const differ: string[] = [];
    for (const who of [null, { userId: 'owner', account: 'shop' }]) {
      for (const [method, path, flags] of ROUTES) {
        const unknown = await call(db, flags, who, '/api/no-such-address', { method, body: method === 'GET' ? undefined : {} });
        const closed = await call(db, flags, who, path, { method, body: method === 'GET' ? undefined : {} });
        if (closed.status !== unknown.status || closed.text !== unknown.text) {
          differ.push(`${who ? 'signed in' : 'signed out'} ${method} ${path}: ${closed.status} ${closed.text}`);
        }
      }
    }
    // As found on build/review: circles, host keys and Know this tea add a code the unknown address does not carry.
    expect(differ).toEqual([
      'signed out GET /api/me/circles: 404 {"error":"Not found","code":"not_found"}',
      'signed out GET /api/me/assistant-tokens: 404 {"error":"Not found","code":"not_found"}',
      'signed out GET /api/tea-table/questions/q-1: 404 {"error":"Not found","code":"not_found"}',
      'signed out GET /api/admin/tea-table/questions: 404 {"error":"Not found","code":"not_found"}',
      'signed in GET /api/me/circles: 404 {"error":"Not found","code":"not_found"}',
      'signed in GET /api/me/assistant-tokens: 404 {"error":"Not found","code":"not_found"}',
      'signed in GET /api/tea-table/questions/q-1: 404 {"error":"Not found","code":"not_found"}',
      'signed in GET /api/admin/tea-table/questions: 404 {"error":"Not found","code":"not_found"}',
    ]);
  });
});
