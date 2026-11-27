import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { onRequest } from '../../functions/_middleware';
import { readFileSync } from 'node:fs';
import { createAfterSitCredential, hashAfterSitCredential } from '../src/afterSitCredential';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Ordinary reads of one fictional table. Each projection must carry a known
// public value as well as leave out the private values in the same database.
const shop = 'acc_teajia_bali';
const secret = 'local-A7';
const switches = Object.fromEntries([
  'FIRST_TABLE', 'FEW_HOSTS', 'ANYONE_HOSTS', 'TEA_TABLE', 'FAVOURITES', 'YOUR_TABLE_PAGE',
  'HOST_ARTICLES', 'TOP_TEAS', 'TEA_HOUSES', 'YOUR_TABLE_PLACE', 'HOME_BAR', 'HOST_CREDIT',
  'CIRCLES', 'HOST_TOKENS', 'TABLE_CARD', 'KNOW_THIS_TEA',
].map(name => [name + '_OPEN', 'true']));

let db: SqliteD1;
const credentials = { booking: createAfterSitCredential(), party: createAfterSitCredential() };
const accounts = { peer: shop, stranger: 'reader-home', host: 'host-home', otherHost: 'other-host-home', owner: shop };
type Actor = keyof typeof accounts;

beforeAll(async () => {
  vi.stubGlobal('fetch', () => { throw new Error('Only in-process worker reads are allowed'); });
  db = new SqliteD1('migrations');
  seedIdentity(db, { accountId: shop, accountSlug: 'teajia-bali', userId: 'owner', platformRole: 'platform_owner' });
  seedIdentity(db, { accountId: shop, userId: 'peer', role: 'viewer', bundles: [] });
  seedIdentity(db, { accountId: accounts.host, userId: 'host', publicEnabled: false });
  seedIdentity(db, { accountId: accounts.otherHost, userId: 'otherHost', publicEnabled: false });
  seedIdentity(db, { accountId: accounts.stranger, userId: 'stranger', role: 'viewer' });
  seedIdentity(db, { accountId: shop, userId: 'party-writer', role: 'viewer' });
  seedIdentity(db, { accountId: shop, userId: 'reporter-A7', role: 'viewer' });
  db.exec(`
    UPDATE accounts SET owner_user_id = 'owner', is_platform_owner = 1 WHERE id = '${shop}';
    UPDATE accounts SET owner_user_id = 'host', personal_inventory_user_id = 'host' WHERE id = 'host-home';
    UPDATE accounts SET owner_user_id = 'otherHost', personal_inventory_user_id = 'otherHost' WHERE id = 'other-host-home';
    INSERT INTO events (id,account_id,slug,title,event_date,host_user_id)
    VALUES ('other-table','other-host-home','outside-table','Another hosting account','2099-02-01','otherHost');
    UPDATE users SET host_approved_at = '2020-03-04T01:23:45Z' WHERE id = 'host';
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility,
      recap_status, network_discovery, tea_table_at, area_hint, address_text, map_link, venue_guide)
    VALUES ('sit', '${shop}', 'sit', 'Autumn A7 table', '2020-11-01', 'completed', 'public',
      'published', 1, '2020-11-02', 'A7 district', 'A7 Hidden Lane', 'https://map.invalid/A7',
      '{"steps":[{"text":"A7 private gate"}]}');
    INSERT INTO event_post_session (id, account_id, event_id, session_notes, host_notes)
    VALUES ('post', '${shop}', 'sit', 'Autumn A7 recap', 'A7 private host memo');
    INSERT INTO event_attendees (id, account_id, event_id, user_id, full_name, email, phone_number, magic_token, status, attended)
    VALUES ('reader-seat', '${shop}', 'sit', 'peer', 'Peer Guest', 'peer@test.dev', NULL, 'reader-link', 'confirmed', 1),
      ('booking', '${shop}', 'sit', NULL, 'Rowan Familyname', 'booking@example.invalid', '+15550104726', 'booking-link', 'confirmed', 1);
    INSERT INTO session_guest_book (id, account_id, event_id, attendee_id, user_id, note, status, public_recap, signed_name, updated_at)
    VALUES ('party-note', '${shop}', 'sit', 'booking', 'party-writer', 'A7 guest words', 'included', 1, 'Jun', '2020-11-02');
    INSERT INTO session_reports (id, target_kind, target_id, reason, reporter_user_id, reporter_seat_id)
    VALUES ('report', 'session', 'sit', 'A7 report reason', 'reporter-A7', 'A7 report seat');
    INSERT INTO tea_table_keeps (user_id, item_kind, item_id) VALUES ('peer', 'recap', 'sit');
    INSERT INTO session_series (id, account_id, host_user_id, name, kind)
    VALUES ('circle', 'host-home', 'host', 'Monday circle', 'circle');
    INSERT INTO products (id, account_id, type, product_name, given_name, status, stock_grams, shown_in_shop,
      is_public, cost_amount, cost_currency, markup_multiplier, shipping_rate_per_kg, tasting)
    VALUES ('leaf','${shop}','Oolong','A7 spring leaf','A7 spring leaf','Active',100,1,1,NULL,NULL,NULL,NULL,
      '{"quality":7,"aroma":["orchid"]}');
    INSERT INTO user_favorites (account_id,user_id,item_id) VALUES ('${shop}','peer','leaf');
    INSERT INTO customer_tasting_journal (id,user_id,product_id,product_name,rating,note)
    VALUES ('private-journal','peer@test.dev','leaf','A7 spring leaf',7,'A7 unshared sitting');
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier, links)
    VALUES ('host-page','${shop}','owner','Autumn host',1,'family','[]');
    INSERT INTO tea_compass_entries (id,user_id,account_id,name,tasting) VALUES ('source','owner','${shop}',
      'A7 card tea','{"quality":7,"aroma":["orchid"]}');
    INSERT INTO compass_shares (id,source_entry_id,source_account_id,source_user_id,source_user_name,shared_metadata,invite_token)
    VALUES ('share','source','${shop}','owner','Autumn host','{"name":"A7 card tea","type":"Oolong"}','a7-invite');
    INSERT INTO tea_table_questions (id,asker_user_id,where_from,full_key,small_key,small_width,small_height)
    VALUES ('question','owner','A7 tea market','family-photos/q/full.jpg','family-photos/q/small.jpg',480,360);
    INSERT INTO tea_table_question_notes (id,question_id,writer_user_id,words,name_shown)
    VALUES ('reply','question','peer','A7 private answer',0);
    INSERT INTO host_credit_entries (id,account_id,host_user_id,kind,amount,currency,source_inquiry_id,event_id,
      invoice_id,invoice_line_id,basis_amount,basis_currency,created_by)
    VALUES ('A7-credit','${shop}','host','earned',47.29,'USD','inquiry','sit','invoice','line',472.90,'USD','owner');
  `);
  db.exec(`
    INSERT INTO events (id,account_id,slug,title,event_date,status,lifecycle_status,public_visibility,host_user_id,door,
      address_text,map_link,venue_guide,area_hint)
    VALUES ('future','host-home','next-table','A7 next table','2099-01-01','active','published','unlisted','host','request',
      'A7 Hidden Lane','https://map.invalid/A7','{"steps":[{"description":"A7 private gate"}]}','A7 district');
    INSERT INTO events (id,account_id,slug,title,event_date,status,lifecycle_status,public_visibility,host_user_id,series_id)
    VALUES ('past','host-home','circle-past','First meeting','2020-01-01','active','completed','unlisted','host','circle');
    UPDATE events SET series_id = 'circle' WHERE id = 'future';
    INSERT INTO event_attendees (id,account_id,event_id,full_name,phone_number,magic_token,status)
    VALUES ('circle-seat','host-home','past','A7 Circlemember','+15550934009','past-seat','confirmed'),
      ('future-seat','host-home','future','A7 Futureguest','+15550832009','next-seat','confirmed');
    INSERT INTO event_attendees (id,account_id,event_id,user_id,full_name,magic_token,status)
    VALUES ('future-peer','host-home','future','peer','Peer Guest','next-peer','confirmed');
    UPDATE event_attendees SET email = 'future@example.invalid' WHERE id = 'future-seat';
    INSERT INTO event_tea_menu (id,account_id,event_id,custom_name) VALUES ('next-tea','host-home','future','A7 spring leaf');
    INSERT INTO personal_cellar_items (id,owner_user_id,name,grams,favourite)
    VALUES ('owner-leaf','owner','My owner leaf',30,1), ('host-leaf','host','My hosting leaf',30,1);
    UPDATE events SET status = 'active' WHERE id = 'sit';
    INSERT INTO event_tea_menu (id, account_id, event_id, product_id) VALUES ('menu','${shop}','sit','leaf');
    UPDATE users SET name = 'SaffronAvery Calder' WHERE id = 'peer';
    INSERT INTO member_photographs (id,account_id,product_id,author_user_id,full_key,small_key,full_bytes,small_bytes,
      full_width,full_height,small_width,small_height,share_state,credit_name_shown)
    VALUES ('photo','${shop}','leaf','peer','a7/full.jpg','a7/small.jpg',8000,1000,800,600,400,300,'page',0);
    INSERT INTO session_guest_book (id,account_id,event_id,attendee_id,user_id,note,status,public_recap,updated_at)
    VALUES ('reader-note','${shop}','sit','reader-seat','peer','Autumn in my own words','included',0,'2020-11-03');
  `);
  db.sqlite.prepare("INSERT INTO after_sit_access VALUES ('reader-seat','sit',?,?,unixepoch()+3600)")
    .run(shop, await hashAfterSitCredential(credentials.booking));
  for (const [actor, scope, tier] of [['owner','inventory:read','platform_owner'], ['host','host:self','account_owner']] as const) {
    const token = 'tjmcp_a7_' + actor;
    db.sqlite.prepare(`INSERT INTO mcp_tokens (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
      VALUES (?,?,?,?,?,?,?,?,?)`).run('token-' + actor,accounts[actor],actor,actor + '@test.dev','A7',
        await hashAfterSitCredential(token),'tjmcp_',JSON.stringify([scope]),tier);
  }
  db.sqlite.prepare(`INSERT INTO after_sit_party_links (id,credential_hash,attendee_id,event_id,account_id,first_name,expires_at,created_at)
    VALUES ('party',?,'booking','sit',?,'Jun',unixepoch()+3600,datetime('now'))`).run(await hashAfterSitCredential(credentials.party), shop);
});

afterAll(() => { db?.close(); vi.unstubAllGlobals(); });

async function read(path: string, actor?: Actor, body?: unknown, flags = switches, bearer?: string) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (actor) {
    const jwt = await signedToken(secret, { sub: actor, email: actor + '@test.dev', active_account_id: accounts[actor] });
    headers.set('Authorization', 'Bearer ' + jwt);
    headers.set('X-Teajia-Account', accounts[actor]);
  }
  if (bearer) headers.set('Authorization', 'Bearer ' + bearer);
  const limiter = { limit: async () => ({ success: true }) };
  // Authenticated MCP records last use asynchronously, as D1 does in production.
  const rpcDb = { prepare(sql: string) {
    const stmt = db.prepare(sql);
    const statement = {
      bind(...values: unknown[]) { stmt.bind(...values); return statement; },
      run: async () => stmt.run(), first: async () => stmt.first(), all: async () => stmt.all(),
    };
    return statement;
  } };
  const response = await worker.fetch(new Request('https://worker.invalid' + path, {
    headers, method: body === undefined ? 'GET' : 'POST', body: JSON.stringify(body),
  }), { ...flags, DB: path === '/mcp' ? rpcDb : db, JWT_SECRET: secret, PROVIDER_LIMITER: limiter, AFTER_SIT_LIMITER: limiter, PUBLIC_MCP_LIMITER: limiter } as never,
  { waitUntil() {} } as never);
  return { status: response.status, json: await response.json() };
}

const privateFacts = [
  'A7 Hidden Lane', 'map.invalid/A7', 'A7 private gate', 'Rowan Familyname', 'booking@example.invalid',
  '+15550104726', 'A7 unshared sitting', 'A7 private host memo', 'A7 report seat', 'reporter-A7',
  'A7 private answer', '2020-03-04T01:23:45Z', '47.29', 'A7-credit',
  'A7 Circlemember', '+15550934009', 'A7 Futureguest', '+15550832009', 'future@example.invalid',
];
function checkProjection(value: unknown, visible: string, allowed: string[] = []) {
  const body = JSON.stringify(value);
  expect(body).toContain(visible);
  for (const fact of privateFacts.filter(f => !allowed.includes(f))) expect(body).not.toContain(fact);
  expect(body).not.toMatch(/"(quality|rating|stars|avg_rating|verdictCounts|host_approved_at|host_reach)"\s*:/i);
}

describe.each([undefined, 'stranger', 'peer', 'otherHost'] as const)('public reads as %s', actor => {
  it.each([
    ['/api/events/sit/public', 'A7 district'], ['/api/events/next-table/public', 'A7 district'], ['/api/public/sit-recaps/sit', 'A7 guest words'],
    ['/api/compass/invite/a7-invite', 'A7 card tea'], ['/api/events/sit/recap', 'Autumn A7 recap'], ['/api/events/next-table/tea-menu', 'A7 spring leaf'],
    ['/api/tea-table', 'Autumn A7 table'], ['/api/tea-table/questions/question', 'A7 tea market'],
    ['/api/people/host-page', 'Autumn host'], ['/api/s/teajia-bali/products/leaf', 'A7 spring leaf'],
  ])('%s returns its public content', async (path, visible) => {
    const result = await read(path, actor);
    expect(result.status).toBe(200);
    checkProjection(result.json, visible);
    expect(JSON.stringify(result.json)).not.toMatch(/"keeps"\s*:\s*\d/);
  });
});

it.each(['booking','party'] as const)('the %s credential reads the finished recap', async kind => {
  const result = await read('/api/after-sit/recap', undefined, { credential: credentials[kind] });
  expect(result.status).toBe(200);
  checkProjection(result.json, 'Autumn A7 table');
});

it('the published note carries the signature its party writer used', async () => {
  const result = await read('/api/public/sit-recaps/sit');
  checkProjection(result.json, 'A7 guest words');
  expect(JSON.stringify(result.json)).toContain('"name":"Jun"');
});

it('guest-facing note signatures omit the booking surname when the writer used the booking name', async () => {
  // Read the writer's own approved note in the guest-facing book.
  const result = await read('/api/after-sit/guest-book', 'peer', { credential: credentials.booking, action: 'read' });
  expect(result.status).toBe(200);
  const body = JSON.stringify(result.json);
  expect(body).toContain('Autumn in my own words');
  expect(body).toContain('Peer');
  expect(body).not.toContain('Peer Guest');
});

it.each([
  ['/api/me/tables/future/circle-guests', 'host', 'A7 Circlemember', ['A7 Circlemember']],
  ['/api/me/tables/future', 'host', '+15550832009', ['A7 Futureguest', '+15550832009']],
  ['/api/me/favourites', 'peer', 'A7 spring leaf', []],
  ['/api/me/circles', 'host', 'Monday circle', []],
  ['/api/me/tea-credit', 'host', '47.29', ['47.29', 'A7-credit']],
  ['/api/host-credit', 'owner', '47.29', ['47.29', 'A7-credit']],
  ['/api/admin/session-reports', 'owner', 'A7 report reason', []],
  ['/api/admin/tea-table', 'owner', '"keeps":1', []],
  ['/api/tea-table/questions/question/asked', 'owner', 'A7 private answer', ['A7 private answer']],
] as const)('%s carries the permitted fact', async (path, actor, visible, allowed) => {
  const result = await read(path, actor);
  expect(result.status).toBe(200);
  checkProjection(result.json, visible, [...allowed]);
});

it('public MCP reads the same published tea', async () => {
  const result = await read('/mcp/public?account=teajia-bali', undefined, {
    jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_tea', arguments: { id: 'leaf' } },
  });
  expect(result.status).toBe(200);
  checkProjection(result.json, 'A7 spring leaf');
  const rpc = result.json as { result: { content: { text: string }[] } };
  checkProjection(JSON.parse(rpc.result.content[0].text), 'A7 spring leaf');
});

it.each(['true', 'false'])('the public photograph respects its author when the Tea Table is %s', async state => {
  const result = await read('/api/family/teas/leaf/photographs', 'peer', undefined, { ...switches, TEA_TABLE_OPEN: state });
  expect(result.status).toBe(200);
  checkProjection(result.json, 'a7/small.jpg');
  expect(JSON.stringify(result.json)).not.toContain('SaffronAvery');
});

it.each(['host', 'owner'] as const)('the %s MCP token reads its own favourites', async actor => {
  const result = await read('/mcp', undefined, { jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'list_my_favourites', arguments: {} },
  }, switches, 'tjmcp_a7_' + actor);
  expect(result.status).toBe(200);
  const visible = actor === 'host' ? 'My hosting leaf' : 'My owner leaf';
  const hidden = actor === 'host' ? 'My owner leaf' : 'My hosting leaf';
  checkProjection(result.json, visible);
  expect(JSON.stringify(result.json)).not.toContain(hidden);
});

it('the confirmed seat sees the way in before the end', async () => {
  const result = await read('/api/rsvp/next-seat');
  expect(result.status).toBe(200);
  const own = ['A7 Hidden Lane','map.invalid/A7','A7 private gate','A7 Futureguest','+15550832009','future@example.invalid'];
  checkProjection(result.json, 'A7 next table', own);
  for (const fact of own) expect(JSON.stringify(result.json)).toContain(fact);
});

it('the shop owner MCP roster lists booking names without contacts', async () => {
  const result = await read('/mcp', undefined, { jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'list_event_rsvps', arguments: { event_id: 'sit' } },
  }, switches, 'tjmcp_a7_owner');
  expect(result.status).toBe(200);
  checkProjection(result.json, 'Rowan Familyname', ['Rowan Familyname']);
});

it.each(['peer','stranger'] as const)('the unrelated credit reader %s gets none of the hosting balance', async actor => {
  const result = await read('/api/me/tea-credit', actor);
  expect(result.status).toBe(200);
  checkProjection(result.json, 'balances');
});

it('ending the confirmed seat closes the way in', async () => {
  const result = await read('/api/rsvp/reader-link');
  expect(result.status).toBe(200);
  checkProjection(result.json, 'Autumn A7 table');
});

it('the host MCP key sees names at its own table without guest contact details', async () => {
  const result = await read('/mcp', undefined, { jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'get_table_guests', arguments: { table_id: 'future' } },
  }, switches, 'tjmcp_a7_host');
  expect(result.status).toBe(200);
  checkProjection(result.json, 'A7 Futureguest', ['A7 Futureguest']);
});

it('the same consent covers the same sittings on the person page and Tea Table', async () => {
  db.exec(`INSERT INTO customer_tasting_journal (id,account_id,user_id,product_id,product_name,tastings)
    VALUES ('shared-journal','${shop}','owner@test.dev','leaf','A7 spring leaf',
      '[{"id":"first","createdAt":"2020-01-01","tasting":{"notes":["Shared floral note"]}},{"id":"second","createdAt":"2020-01-03","tasting":{"notes":["Later sitting words"]}}]');
    INSERT INTO member_tasting_shares (journal_entry_id,account_id,product_id,author_user_id,share_state,shared_at,updated_at,
      tea_table_at,tea_table_sittings) VALUES ('shared-journal','${shop}','leaf','owner','page','2020-01-02','2020-01-02','2020-01-02','["first"]');`);
  try {
    for (const path of ['/api/tea-table','/api/people/host-page']) {
      const result = await read(path, 'owner');
      expect(result.status).toBe(200);
      checkProjection(result.json, 'Shared floral note');
      expect(JSON.stringify(result.json), path).not.toContain('Later sitting words');
    }
  } finally {
    db.exec("DELETE FROM member_tasting_shares WHERE journal_entry_id='shared-journal'; DELETE FROM customer_tasting_journal WHERE id='shared-journal'");
  }
});

it.each(['/people/host-page', '/session/sit', '/after-sit', '/tea-table'])('crawler preview for %s uses the ordinary site shell', async path => {
  const shell = readFileSync('index.html','utf8');
  const result = await onRequest({ request: new Request('https://site.invalid' + path, { headers: { 'User-Agent': 'Twitterbot' } }),
    env: {}, next: async () => new Response(shell),
  } as never);
  expect(await result.text()).toBe(shell);
});
