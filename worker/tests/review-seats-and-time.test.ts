import { createRequire } from 'node:module';
import { createElement as h, act } from 'react';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { advanceWaitingLists, offerFreedSeats } from '../src/waitingList';
import { mayShowWalkthrough, sessionEndsAt, sessionInstant } from '../src/sessionWalkthrough';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';
import { formatEventDate, formatTime } from '../../src/components/events/GuestManagement/helpers';

const scope = { accountId: 'house', eventId: 'tea' };
const secret = 'a9-local-test-secret';
let anyone = true;
const password = 'a9-local-test-password';
const start = Date.parse('2099-03-05T15:30:00Z');
const minute = 60_000;
let db: SqliteD1;


beforeEach(() => {
  db = new SqliteD1('migrations');
  anyone = true;
  vi.stubGlobal('fetch', () => { throw new Error('External fetch in a local review'); });
  seedIdentity(db, { userId: 'host', accountId: 'house', publicEnabled: false, bundles: ['gather'] });
  seedIdentity(db, { userId: 'guest', accountId: 'home', role: 'viewer' });
  db.exec(`UPDATE accounts SET owner_user_id='host', personal_inventory_user_id='host',
      host_approved_at='2026-01-01' WHERE id='house';
    UPDATE users SET host_approved_at='2026-01-01' WHERE id='host';`);
  db.sqlite.prepare('UPDATE users SET password_hash=?').run(createHash('sha256').update(password).digest('hex'));
  table('tea', '2099-03-05T15:30:00Z');
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function table(id: string, date: string) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, host_user_id, slug, title, event_date, timezone,
    address_text, total_capacity, door, requires_approval, public_visibility, status, lifecycle_status, claim_window_minutes)
    VALUES (?, 'house','host',?,'Tea',?,'Asia/Makassar','Garden gate',1,'link',0,'unlisted','active','published',30)`)
    .run(id, id, date);
}

async function call(path: string, method = 'GET', body?: object, actor?: 'host' | 'guest') {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (actor) {
    const account = actor === 'host' ? 'house' : 'home';
    headers.set('X-Teajia-Account', account);
    headers.set('Authorization', 'Bearer ' + await signedToken(secret, {
      sub: actor, email: actor + '@test.dev', active_account_id: account, role: 'user',
    }));
  }
  return worker.fetch(new Request('https://worker.test' + path, { headers, method, body: JSON.stringify(body) }), {
    DB: db, JWT_SECRET: secret, APP_URL: 'https://test.invalid', FEW_HOSTS_OPEN: 'true',
    ANYONE_HOSTS_OPEN: String(anyone), CIRCLES_OPEN: 'true', TEA_TABLE_OPEN: 'true', HOST_CREDIT_OPEN: 'true',
    RSVP_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil() {} } as never);
}

const ask = (name: string, fields = {}, actor?: 'guest') =>
  call('/api/events/tea/rsvp', 'POST', { full_name: name, ...fields }, actor);
const change = (fields: object) => call('/api/me/tables/tea', 'PUT', fields, 'host');
const claim = (id: string) => call('/api/rsvp/key-' + id + '/claim', 'POST');
const offer = (now = Date.now()) => offerFreedSeats(db as never, scope, now);
const count = (sql: string) => Number(db.sqlite.prepare(sql).get()?.n);
const seats = () => count("SELECT count(*) n FROM event_attendees WHERE event_id='tea' AND status='confirmed'");

function waiting(id: string, position: number) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, magic_token, full_name, status, waitlist_position)
    VALUES (?, 'house','tea',?,?,'waitlist',?)`).run(id, 'key-' + id, id, position);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id,event_id,participation_id,full_name,is_primary,seat_status)
    VALUES (?, 'house','tea',?,?,1,'requested')`).run('party-' + id, id, id);
}

it('two guests racing for the last seat get one confirmation', async () => {
  const results = await Promise.all([ask('Lin'), ask('Bo')]);
  expect(results.map(r => r.status).sort()).toEqual([201, 409]);
  expect(seats()).toBe(1);
});

it('a seat confirmed before party rows existed still fills the table', async () => {
  db.exec(`INSERT INTO event_attendees (id,account_id,event_id,magic_token,full_name,status)
    VALUES ('older','house','tea','old-key','Lin','confirmed')`);
  const result = await ask('Bo');
  expect({ seats: seats(), status: result.status }).toEqual({ seats: 1, status: 409 });
});

it('two queue advances offer one free seat to the first guest once', async () => {
  waiting('lin', 1);
  waiting('bo', 2);
  const results = await Promise.all([offer(), offer()]);
  expect(results.flat()).toEqual(['lin']);
  expect(count("SELECT count(*) n FROM event_seat_notices WHERE kind='offered'")).toBe(1);
});

it('an offer at its SQLite deadline can no longer be accepted', async () => {
  waiting('lin', 1);
  expect(await offer()).toEqual(['lin']);
  const boundary = '2099-03-04T12:00:00Z';
  db.sqlite.prepare("UPDATE event_attendees SET claim_expires_at=? WHERE id='lin'").run(boundary);
  // Freeze only SQLite's current instant; its own datetime comparison still runs.
  const prepare = db.prepare.bind(db);
  vi.spyOn(db, 'prepare').mockImplementation(sql => prepare(sql.replaceAll("datetime('now')", "datetime('2099-03-04T12:00:00Z')")));
  expect((await claim('lin')).status).toBe(410);
  expect(seats()).toBe(0);
});

it('the scheduler honours its injected clock when an offer expires', async () => {
  waiting('lin', 1);
  waiting('bo', 2);
  const now = Date.now();
  expect(await offer(now)).toEqual(['lin']);
  const result = await advanceWaitingLists(db as never, now + 31 * minute);
  expect(result).toEqual({ lapsed: 1, offered: 1 });
});

it('the host cannot lower capacity below confirmed seats', async () => {
  expect((await change({ seats: 3 })).status).toBe(200);
  for (const name of ['Lin','Bo']) expect((await ask(name)).status).toBe(201);
  expect((await change({ seats: 1 })).status).toBe(409);
  expect(db.sqlite.prepare("SELECT total_capacity FROM events WHERE id='tea'").get()).toEqual({ total_capacity: 3 });
});

it('a pending request still needs the host after a change to the link door', async () => {
  expect((await change({ door: 'request' })).status).toBe(200);
  const reply = await ask('Lin', { email: 'lin@test.invalid' });
  expect(reply.status).toBe(201);
  expect((await change({ door: 'link' })).status).toBe(200);
  expect(db.sqlite.prepare("SELECT status FROM event_attendees WHERE full_name='Lin'").get()).toEqual({ status: 'requested' });
});

it('an open door still requires the host to confirm a guest', async () => {
  db.exec("UPDATE events SET door='open', requires_approval=1 WHERE id='tea'");
  const reply = await ask('Lin', { email: 'lin@test.invalid' });
  expect(reply.status).toBe(201);
  expect(await reply.json()).toMatchObject({ status: 'requested' });
});

it('cancellation committed between the host reading a request and confirming wins', async () => {
  expect((await change({ door: 'request' })).status).toBe(200);
  expect((await ask('Lin', { email: 'lin@test.invalid' })).status).toBe(201);
  const id = db.sqlite.prepare('SELECT id FROM event_attendees').get()!.id;
  const batch = db.batch.bind(db);
  const race = vi.spyOn(db, 'batch').mockImplementationOnce(statements => {
    db.exec("UPDATE events SET lifecycle_status='cancelled',status='closed' WHERE id='tea'");
    return batch(statements);
  });
  const answer = await call('/api/me/tables/tea/guests/' + id + '/yes', 'PUT', {}, 'host');
  expect(race).toHaveBeenCalled();
  expect(answer.status).toBe(409);
  expect(seats()).toBe(0);
});

it('returning a seat removes directions on the next phone read and offers it once', async () => {
  const reply = await ask('Bo');
  const { magic_token } = await reply.json() as { magic_token: string };
  const path = '/api/rsvp/' + magic_token;
  expect(await (await call(path)).json()).toMatchObject({ event: { address_text: 'Garden gate' } });
  waiting('lin', 1);
  for (let i = 0; i < 2; i++) expect((await call(path, 'PUT', { cancel: true })).status).toBe(200);
  expect(await (await call(path)).json()).toMatchObject({ attendee: { status: 'cancelled' }, event: { address_text: null, venue_guide: null } });
  expect(count("SELECT count(*) n FROM event_seat_notices WHERE kind='offered' AND attendee_id='lin'")).toBe(1);
});

it.each(['draft','registration_closed','cancelled','completed','archived'])('%s table gives out no seats', async lifecycle => {
  db.sqlite.prepare('UPDATE events SET lifecycle_status=?').run(lifecycle);
  expect((await ask('Lin')).status).toBeGreaterThanOrEqual(400);
  expect(seats()).toBe(0);
});

const session = { event_date: '2099-03-05T23:30', event_end_date: '2099-03-06T00:30', timezone: 'Asia/Makassar' };
it('the table that crosses midnight keeps directions up until its exact end', () => {
  expect(sessionInstant(session.event_date, session.timezone)?.at).toBe(start);
  expect(sessionEndsAt(session)).toBe(start + 60 * minute);
  for (const now of [start - 1, start, start + 60 * minute - 1]) expect(mayShowWalkthrough('confirmed', session, true, now)).toBe(true);
  expect(mayShowWalkthrough('confirmed', session, true, start + 60 * minute)).toBe(false);
});

it('a timed session without an end lasts four hours', () => {
  expect(sessionEndsAt({ ...session, event_end_date: null })).toBe(start + 240 * minute);
});

it('the guest sees the table time or a labelled conversion on a New York phone', () => {
  vi.stubEnv('TZ', 'America/New_York');
  try {
    const date = new Date(start).toISOString();
    const shown = formatEventDate(date) + ' ' + formatTime(date);
    expect(shown).toMatch(/11:30 PM|New York|Eastern|EST|GMT-5/);
  } finally { vi.unstubAllEnvs(); }
});

it('an offer from just before the start stops asking the guest by the time tea begins', async () => {
  waiting('lin', 1);
  expect(await offer(start - minute)).toEqual(['lin']);
  const { attendee } = await (await call('/api/rsvp/key-lin')).json() as { attendee: { claim_expires_at: string } };
  expect(Date.parse(attendee.claim_expires_at)).toBeLessThanOrEqual(start);
});

it('attendance stays closed while a regular session is still sitting', async () => {
  expect((await ask('Lin')).status).toBe(201);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(start + minute);
  const result = await call('/api/me/tables/tea/came', 'PUT', { attendee_ids: [] }, 'host');
  expect({ status: result.status, lifecycle: db.sqlite.prepare('SELECT lifecycle_status FROM events').get()?.lifecycle_status })
    .toEqual({ status: 409, lifecycle: 'published' });
});

it.each(['stopped','withdrawn'])('existing guest and public links after host standing changes to %s', async state => {
  const { magic_token } = await (await ask('Lin')).json() as { magic_token: string };
  if (state === 'stopped') db.exec("UPDATE users SET hosting_stopped_at='2026-01-02' WHERE id='host'");
  else db.exec("UPDATE users SET host_approved_at=NULL WHERE id='host'; UPDATE accounts SET host_approved_at=NULL WHERE id='house'");
  expect((await call('/api/events/tea/public')).status).toBe(200);
  expect(await (await call('/api/rsvp/' + magic_token)).json()).toMatchObject({
    attendee: { status: 'confirmed' }, event: { address_text: 'Garden gate' },
  });
  const reply = await ask('Bo', { email: 'bo@test.invalid' });
  if (state === 'stopped') expect(reply.status).toBe(409);
  else expect(await reply.json()).toMatchObject({ status: 'waitlist' });
});

it('a circle invitation, a request and a link use the same signed-in seat', async () => {
  table('earlier', '2099-02-01T00:00:00Z');
  db.exec(`INSERT INTO session_series (id,account_id,host_user_id,name,kind) VALUES ('circle','house','host','Thursday','circle');
    UPDATE events SET series_id='circle', total_capacity=4,door='request',requires_approval=1;
    INSERT INTO event_attendees (id,account_id,event_id,magic_token,full_name,status,user_id,email)
    VALUES ('previous','house','earlier','previous-key','Lin','confirmed','guest','guest@test.dev')`);
  const invitation = await call('/api/me/tables/tea/circle-guests/previous/ask', 'POST', {}, 'host');
  expect(invitation.status).toBe(200);
  expect((await ask('Lin', { email: 'guest@test.dev' }, 'guest')).status).toBe(200);
  expect((await change({ door: 'link' })).status).toBe(200);
  await ask('Lin', { seat_key: 'same_guest_on_a_new_phone' }, 'guest');
  expect(seats()).toBe(1);
});

it('deleting a guest removes their guest book and Tea Table piece and resolves their future seat', async () => {
  const answer = await ask('Guest', {}, 'guest');
  expect(answer.status).toBe(201);
  const id = db.sqlite.prepare("SELECT id FROM event_attendees WHERE user_id='guest'").get()!.id;
  table('past', '2020-01-01T00:00:00Z');
  db.exec(`UPDATE events SET lifecycle_status='completed',status='closed' WHERE id='past';
    INSERT INTO event_attendees (id,account_id,event_id,magic_token,full_name,user_id,status)
      VALUES ('old-guest','house','past','old-key','Guest','guest','confirmed');
    INSERT INTO session_guest_book (id,account_id,event_id,attendee_id,user_id,note,status,updated_at)
      VALUES ('entry','house','past','old-guest','guest','Lovely tea','included',datetime('now'));
    INSERT INTO products (id,account_id,type,product_name,cost_amount,cost_currency)
      VALUES ('tea-leaf','house','Oolong','Tea leaf',NULL,NULL);
    INSERT INTO customer_tasting_journal (id,user_id,product_id,product_name)
      VALUES ('tasting','person:guest','tea-leaf','Tea leaf');
    INSERT INTO member_tasting_shares (journal_entry_id,account_id,product_id,author_user_id,share_state,tea_table_at)
      VALUES ('tasting','house','tea-leaf','guest','page',datetime('now'));`);
  waiting('lin', 1);
  const result = await call('/api/auth/account', 'DELETE', { password }, 'guest');
  expect(result.status).toBe(200);
  expect(count('SELECT count(*) n FROM session_guest_book')).toBe(0);
  expect(count('SELECT count(*) n FROM member_tasting_shares')).toBe(0);
  const seat = db.sqlite.prepare('SELECT user_id,status FROM event_attendees WHERE id=?').get(id);
  const offers = count("SELECT count(*) n FROM event_seat_notices WHERE kind='offered' AND attendee_id='lin'");
  expect({ seat, offers }).toEqual({ seat: { user_id: null, status: 'cancelled' }, offers: 1 });
});

it('host deletion is actionable after transfer with a future table, a circle and earned credit', async () => {
  db.exec(`INSERT INTO session_series (id,account_id,host_user_id,name,kind) VALUES ('circle','house','host','Thursday','circle');
    UPDATE events SET series_id='circle';
    INSERT INTO host_credit_entries (id,account_id,host_user_id,kind,amount,currency,source_inquiry_id,event_id,
      invoice_id,invoice_line_id,basis_amount,basis_currency,created_by)
      VALUES ('earned','house','host','earned',1,'USD','inquiry','tea','invoice','line',10,'USD','system');`);
  expect((await call('/api/auth/account', 'DELETE', { password }, 'host')).status).toBe(409);
  // Model a finished ownership transfer. The host reference on the event is historical.
  db.exec(`UPDATE accounts SET owner_user_id='guest',personal_inventory_user_id=NULL WHERE id='house';
    UPDATE account_members SET role='staff' WHERE user_id='host';
    INSERT INTO account_members (account_id,user_id,role,status) VALUES ('house','guest','owner','active');`);
  const result = await call('/api/auth/account', 'DELETE', { password }, 'host');
  expect(db.sqlite.prepare("SELECT amount,currency FROM host_credit_entries WHERE id='earned'").get()).toEqual({ amount: 1, currency: 'USD' });
  expect([200,409]).toContain(result.status);
});

it('a former host whose tables have all ended gets an answer, not a failure, while records still name them', async () => {
  db.exec(`UPDATE events SET event_date='2020-01-01T10:00:00Z', lifecycle_status='completed', status='closed';
    UPDATE accounts SET owner_user_id='guest',personal_inventory_user_id=NULL WHERE id='house';
    UPDATE account_members SET role='staff' WHERE user_id='host';
    INSERT INTO account_members (account_id,user_id,role,status) VALUES ('house','guest','owner','active');`);
  const result = await call('/api/auth/account', 'DELETE', { password }, 'host');
  expect(result.status).toBe(409);
  expect(count("SELECT count(*) n FROM users WHERE id='host'")).toBe(1);
});

it('with Launch 3 closed, deleting a guest leaves their seat as main did', async () => {
  anyone = false;
  expect((await ask('Guest', {}, 'guest')).status).toBe(201);
  expect((await call('/api/auth/account', 'DELETE', { password }, 'guest')).status).toBe(200);
  expect(db.sqlite.prepare("SELECT user_id,status FROM event_attendees WHERE event_id='tea'").get()).toEqual({ user_id: null, status: 'confirmed' });
});

it('a claim cannot confirm a seat after a published session has ended by time', async () => {
  waiting('lin', 1);
  expect(await offer()).toEqual(['lin']);
  // Move the event instead of the SQL clock. The offer was already made.
  db.exec("UPDATE events SET event_date=datetime('now','-2 hours'),event_end_date=datetime('now','-1 hour'),timezone='UTC'");
  const result = await claim('lin');
  expect(seats()).toBe(0);
  expect(result.ok).toBe(false);
});

// The optional DOM walks use jsdom through NODE_PATH and the production screens.
// The worker checks run without a browser or an additional package.
const requireDom = createRequire(import.meta.url);
const domWalk = it.skipIf(!process.env.A9_DOM);

async function openScreen(url: string, fixture?: { key: string[], data: object }, preparePhone?: () => void) {
  const { JSDOM } = requireDom('jsdom');
  const dom = new JSDOM('<main id="root"></main>', { url: 'https://test.invalid' + url });
  for (const key of ['window', 'document', 'localStorage', 'sessionStorage', 'HTMLElement']) {
    vi.stubGlobal(key, key === 'window' ? dom.window : dom.window[key]);
  }
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_FEW_HOSTS_OPEN', 'true');
  vi.resetModules();
  const { createRoot } = await import('react-dom/client');
  const { MemoryRouter, Routes, Route } = await import('react-router-dom');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const query = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  if (fixture) query.setQueryData(fixture.key, fixture.data);
  query.setQueryData(['host-table-notes', 'tea'], { notes: [] });
  const root = createRoot(document.querySelector('#root')!);
  preparePhone?.();
  const isGuest = url.startsWith('/m/');
  vi.doMock('../../src/lib/fewHosts', async importOriginal => ({ ...await importOriginal<object>(), fewHostsOpen: () => true }));
  vi.doMock('../../src/hooks/useAuth', () => ({ useAuth: () => ({ user: { email: 'host@test.dev' }, isSessionReady: true }) }));
  vi.doMock('../../src/lib/api', async importOriginal => {
    const original = await importOriginal<typeof import('../../src/lib/api')>();
    return { ...original, hasToken: () => true, api: { ...original.api,
      rsvp: { ...original.api.rsvp, get: async (token: string) => (await call('/api/rsvp/' + token)).json() },
      tables: { ...original.api.tables,
      get: async () => fixture?.data, notes: async () => ({ notes: [] }), markWhoCame: async () => ({ ok: true }),
    } } };
  });
  const Screen = isGuest ? (await import('../../src/components/events/GuestManagement')).default
    : (await import('../../src/pages/HostedTablePage')).default;
  const close = async () => {
    await act(async () => root.unmount());
    query.clear();
    dom.window.close();
    vi.doUnmock('../../src/hooks/useAuth');
    vi.doUnmock('../../src/lib/api');
    vi.doUnmock('../../src/lib/fewHosts');
    vi.unstubAllEnvs();
  };
  try {
    await act(async () => root.render(h(QueryClientProvider, { client: query },
      h(MemoryRouter, { initialEntries: [url] }, h(Routes, {}, h(Route, {
        path: isGuest ? '/m/:magicToken' : '/account/host/:id', element: h(Screen),
      }))))));
    if (isGuest) {
      // React Query notifies the mounted page on the next tick.
      await vi.waitFor(async () => {
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
        expect(query.getQueryState(['guest-management', url.slice(3)])?.status).toBe('success');
      });
    }
    return { close, document: dom.window.document as Document };
  } catch (error) {
    await close();
    throw error;
  }
}

async function bookedPageWithBriefing() {
  db.exec(`UPDATE events SET briefing_cards='[{"text":"Bring a cup","order":0}]'`);
  const result = await ask('Lin');
  expect(result.status).toBe(201);
  return (await result.json() as { magic_token: string }).magic_token;
}

domWalk('a confirmed first visit before tea can read the briefing the host saved', async () => {
  const token = await bookedPageWithBriefing();
  const screen = await openScreen('/m/' + token);
  try {
    expect(screen.document.querySelector('[aria-label="Event briefing"]')).toBeTruthy();
  } finally { await screen.close(); }
});

domWalk('a first visit during tea has no automatic briefing or guest planning form', async () => {
  const token = await bookedPageWithBriefing();
  db.sqlite.prepare('UPDATE events SET event_date=?').run(new Date(Date.now() - minute).toISOString());
  const screen = await openScreen('/m/' + token);
  try {
    const briefing = screen.document.querySelector('[aria-label="Event briefing"]');
    expect.soft(Boolean(briefing), 'automatic briefing over the confirmed seat').toBe(false);
    const skip = [...screen.document.querySelectorAll('button')].find(b => b.textContent === 'Skip');
    if (skip) await act(async () => skip.click());
    const prompts = ['Bringing a guest?', 'Dietary notes or special requests', 'Show my first name to other confirmed guests'];
    expect(prompts.filter(prompt => screen.document.body.textContent?.includes(prompt))).toEqual([]);
  } finally { await screen.close(); }
});

domWalk('a host can reach a missed guest and record the absence within two taps', async () => {
  const screen = await openScreen('/account/host/tea', {
    key: ['host-table', 'tea'],
    data: {
      table: { id: 'tea', title: 'Tea', event_date: '2020-01-01T00:00:00Z', timezone: 'Asia/Makassar',
        door: 'request', seats: 1, seats_taken: 1, lifecycle_status: 'published', link: '/sit/tea' },
      guests: [{ id: 'lin', full_name: 'Lin', status: 'confirmed', attended: null }], teas: [], doors: ['request','link'],
    },
  });
  try {
    const taps: string[] = [];
    const tap = async (label: string, control: HTMLElement | undefined) => {
      expect(control, label + ' in ' + screen.document.body.textContent).toBeTruthy();
      await act(async () => control!.click());
      taps.push(label);
    };
    const button = (label: string) => [...screen.document.querySelectorAll('button')].find(b => b.textContent === label);
    // Follow the shortest visible route: a future inline attendance action
    // can remove one or both of the current steps.
    const checkbox = () => screen.document.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (!checkbox() && !button('Mark who came')) await tap('After', button('After'));
    if (!checkbox()) await tap('Mark who came', button('Mark who came'));
    await tap('Lin', checkbox() ?? undefined);
    expect(checkbox()?.checked).toBe(false);
    await tap('Save', screen.document.querySelector<HTMLButtonElement>('[data-host-part] button[type=submit]') ?? undefined);
    expect(taps.length, taps.join(' > ')).toBeLessThanOrEqual(2);
  } finally { await screen.close(); }
});

domWalk('the next cancelled seat read removes both parts of the way kept on the phone', async () => {
  const { magic_token: token } = await (await ask('Lin')).json() as { magic_token: string };
  expect((await call('/api/rsvp/' + token, 'PUT', { cancel: true })).status).toBe(200);
  const names = new Set(['teajia-way:' + token]);
  vi.stubGlobal('caches', { keys: async () => [...names], delete: async (name: string) => names.delete(name) });
  const screen = await openScreen('/m/' + token, undefined, () => localStorage.setItem('teajia.way.' + token, JSON.stringify({
    v: 1, ends_at: start, guide: { steps: [] }, address: 'Garden gate', photos: ['step-photo'],
  })));
  try {
    expect(localStorage.getItem('teajia.way.' + token)).toBeNull();
    expect([...names]).toEqual([]);
  } finally { await screen.close(); }
});

domWalk('a confirmed guest sees that the host cancelled their table', async () => {
  const guest = await (await ask('Lin')).json() as { magic_token: string };
  const cancelled = await call('/api/admin/events/tea', 'PUT', { lifecycle_status: 'cancelled' }, 'host');
  expect(cancelled.status).toBe(200);
  const raw = await (await call('/api/rsvp/' + guest.magic_token)).json() as {
    attendee: { status: string }, event: { lifecycle_status: string, event_date: string, status: string, title: string }
  };
  expect(raw.event.lifecycle_status).toBe('cancelled');
  const screen = await openScreen('/m/' + guest.magic_token);
  try {
    expect(screen.document.body.textContent).not.toContain('Your seat is confirmed');
    expect(screen.document.body.textContent).toMatch(/cancelled/i);
  } finally { await screen.close(); }
});

it('Manage does not queue a coming-up reminder after the table has started', async () => {
  expect((await ask('Lin')).status).toBe(201);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(start + minute);
  const path = '/api/admin/events/tea/notifications';
  await call(path, 'POST', {}, 'host');
  const list = await call(path, 'GET', undefined, 'host');
  expect(list.status).toBe(200);
  const rows = await list.json() as { message_template: string }[];
  expect(rows.map(row => row.message_template)).toEqual([]);
});

domWalk('a Launch 2 guest left without directions can tell what to do after approval is withdrawn', async () => {
  anyone = false;
  const { magic_token } = await (await ask('Lin')).json() as { magic_token: string };
  db.exec("UPDATE users SET host_approved_at=NULL WHERE id='host'; UPDATE accounts SET host_approved_at=NULL WHERE id='house'");
  const publicPage = await call('/api/events/tea/public');
  const ticket = await call('/api/rsvp/' + magic_token);
  expect(ticket.status).toBe(200);
  const body = await ticket.json() as { attendee: { status: string }, event: { address_text: string | null } };
  if (body.event.address_text || body.attendee.status === 'cancelled') return;
  const screen = await openScreen('/m/' + magic_token);
  try {
    expect(screen.document.body.textContent, 'public link ' + publicPage.status + ', address absent')
      .toMatch(/contact (the|your) host|ask (the|your) host|table (is|was|has been) cancelled|directions (are|will)/i);
  } finally { await screen.close(); }
});

domWalk('a pending guest of a stopped host is not told to wait for an answer the host cannot give', async () => {
  expect((await change({ door: 'request' })).status).toBe(200);
  const { magic_token } = await (await ask('Lin', { email: 'lin@test.invalid' })).json() as { magic_token: string };
  db.exec("UPDATE users SET hosting_stopped_at=datetime('now') WHERE id='host'");
  const raw = await (await call('/api/rsvp/' + magic_token)).json() as {
    attendee: { id: string, status: string }, event: { private_host: boolean, event_date: string, title: string }
  };
  expect((await call('/api/me/tables/tea/guests/' + raw.attendee.id + '/yes', 'PUT', {}, 'host')).status).toBe(403);
  const screen = await openScreen('/m/' + magic_token);
  try {
    expect(screen.document.body.textContent).not.toContain('The host will answer you');
  } finally { await screen.close(); }
});
