import { setPersonalSellerApproval } from '../src/personalSellerApproval';
import { hostStanding } from '../src/hostApproval';
import { resolveInventoryStoreSlug } from '../../src/lib/publicProductNavigation';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { oldSeatCredential, oldShop, switches } from './helpers/oldShop';
import { signedToken } from './helpers/sqliteD1';
import { tableInfo } from './helpers/migratedSqlite';

const quoted = (name: string) => '"' + name.replaceAll('"', '""') + '"';

it('preserves every original row and cell at every migration boundary and leaves new tables empty', () => {
  const original = new Map<string, { columns: string; rows: string[] }>();
  const versions: string[] = [];
  let originalChangeCount: number;
  const { db } = oldShop((sqlite, version) => {
    versions.push(version);
    const changes = Number(sqlite.prepare('SELECT total_changes() AS n').get()!.n);
    if (version === '0127') originalChangeCount = changes;
    else expect(changes, version + ' performed a row write').toBe(originalChangeCount);
    const tables = sqlite.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all().map(row => String(row.name));
    for (const table of original.keys()) expect(tables, version).toContain(table);
    for (const table of tables) {
      const before = original.get(table);
      const columns = before?.columns ?? tableInfo(sqlite, quoted(table)).map(c => quoted(c.name)).join(', ');
      const rows = sqlite.prepare(`SELECT ${columns} FROM ${quoted(table)}`).all()
        .map(row => JSON.stringify(row)).sort();
      if (version === '0127') original.set(table, { columns, rows });
      else expect(rows, `${version} ${table}`).toEqual(before?.rows ?? []);
    }
  });
  db.close();
  // 0137 and 0142 have no SQL file in the migration ledger; 0150 came from main
  // (practice lines), 0151 is taken on another branch, 0153 (vendor face
  // originals) is schema only, and 0155 (short codes) writes no rows against this old shop.
  expect(versions).toEqual(['0127', '0128', '0129', '0130', '0131', '0132', '0133', '0134',
    '0135', '0136', '0138', '0139', '0140', '0141', '0143', '0144', '0145', '0146', '0147', '0148', '0149', '0150', '0152', '0153', '0155', '0156', '0157', '0158', '0159', '0160']);
});

describe.each([false, true])('older Tea Chest, switches open = %s', open => {
  it('preserves a zero cost and leaves the source blank until the owner enters it', async () => {
    const { db } = oldShop();
    try {
      const token = await signedToken('chest-secret', { sub: 'chest-reader', role: 'user' });
      const request = (path: string, body?: object) => worker.fetch(new Request('https://worker.test' + path, {
        method: body ? 'PUT' : 'GET',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: body && JSON.stringify(body),
      }), { DB: db, JWT_SECRET: 'chest-secret', ...switches(open) } as unknown as Parameters<typeof worker.fetch>[1]);
      const list = await request('/api/me/cellar');
      expect(list.status).toBe(200);
      const { items } = await list.json() as { items: Record<string, unknown>[] };
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ id: 'old-chest', source: null, costAmount: 0, costCurrency: 'CNY' });
      if (open) expect(items[0].favourite).toBe(false);
      else expect(items[0]).not.toHaveProperty('favourite');

      const edit = await request('/api/me/cellar/old-chest', { source_kind: 'gift', source_from_name: 'Lin' });
      expect(edit.status).toBe(200);
      expect(await edit.json()).toMatchObject({ item: { grams: 45, costAmount: 0, source: { kind: 'gift', fromName: 'Lin' } } });
    } finally {
      db.close();
    }
  });
});

it.each([false, true])('Sales opens, fills and records payment on an old order without creating host credit (open=%s)', async open => {
  const { sqlite, db } = oldShop();
  try {
    const secret = 'old-shop-test-key';
    const token = await signedToken(secret, {
      sub: 'sales-owner', email: 'sales-owner@test.dev', name: 'Sales owner', active_account_id: 'sales-shop',
    });
    async function sales(path: string, method = 'GET', body?: unknown) {
      const tasks: Promise<unknown>[] = [];
      const response = await worker.fetch(new Request('https://worker.test' + path, {
        method, headers: {
          Authorization: 'Bearer ' + token, 'X-Teajia-Account': 'sales-shop', 'Content-Type': 'application/json',
        }, body: body === undefined ? undefined : JSON.stringify(body),
      }), { DB: db, JWT_SECRET: secret, ...switches(open) } as never, {
        waitUntil: (task: Promise<unknown>) => tasks.push(task),
      } as never);
      await Promise.all(tasks);
      const value = await response.json();
      expect(response.ok, method + ' ' + path + ' ' + JSON.stringify(value)).toBe(true);
      return value;
    }
    expect(await sales('/api/invoices')).toEqual([expect.objectContaining({
      id: 'sales-invoice', customer_name: 'Old buyer', status: 'Draft', computed_total: 12.5,
    })]);
    const tracking = await worker.fetch(new Request('https://worker.test/api/inquiries/sales-old-tracking-token-for-cart-00001'),
      { DB: db, JWT_SECRET: secret, ...switches(open) } as never);
    expect(tracking.status).toBe(200);
    expect(await tracking.json()).toMatchObject({
      invoice_number: '00001', invoice_items: [expect.objectContaining({ quantity: 25, unit_price_usd: 0.5 })],
    });
    const path = '/api/invoices/sales-invoice';
    expect(await sales(path + '/items')).toEqual([expect.objectContaining({
      product_name: 'Old oolong', quantity: 25, quantity_unit: 'g', price_at_sale: 0.5,
    })]);
    await sales(path, 'PUT', { status: 'Pending' });
    await sales(path, 'PUT', { status: 'Filled' });
    await sales(path + '/payments', 'POST', { amount: 12.5, request_id: 'sales-old-payment' });
    expect(await sales('/api/invoices')).toEqual([expect.objectContaining({
      id: 'sales-invoice', status: 'Filled', payment_status: 'paid',
      payment: expect.objectContaining({ paid_usd: 12.5, outstanding_usd: 0 }),
    })]);
    expect(sqlite.prepare('SELECT * FROM order_session_sources WHERE inquiry_id = ?').all('sales-inquiry')).toEqual([]);
    expect(sqlite.prepare('SELECT * FROM host_credit_entries WHERE invoice_id = ?').all('sales-invoice')).toEqual([]);
    expect(sqlite.prepare("SELECT signature FROM incident_ledger WHERE signature LIKE 'host_credit_%'").all()).toEqual([]);
  } finally {
    sqlite.close();
  }
});

function publicCalls(shop: ReturnType<typeof oldShop>, open: boolean, userId = 'legacy-author') {
  const secret = 'legacy-fixture';
  const user = shop.sqlite.prepare('SELECT email, name FROM users WHERE id = ?').get(userId)!;
  const token = signedToken(secret, { sub: userId, ...user, session_version: 0 });
  const allow = { limit: async () => ({ success: true }) };
  return async (path: string, method = 'GET', body?: unknown, signed = false) => {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (signed) headers.set('Authorization', 'Bearer ' + await token);
    return worker.fetch(new Request('https://old-shop.test' + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }), { DB: shop.db, JWT_SECRET: secret, ...switches(open), PROVIDER_LIMITER: allow } as never,
    { waitUntil: () => undefined } as never);
  };
}

describe.each([true, false])('old public records with switches open=%s', open => {
  it('opens the old person page and keeps its words and photograph on the page until consent changes', async () => {
    const shop = oldShop();
    try {
      const call = publicCalls(shop, open);
      const page = async () => {
        const response = await call('/api/people/legacy-mei');
        expect(response.status).toBe(200);
        return (await response.json() as any).tastings;
      };
      const [tasting] = await page();
      expect(tasting.words).toEqual([expect.objectContaining({ text: 'Sweet finish' })]);
      expect(tasting.photographs[0].id).toBe('legacy-photo');
      if (open) expect(tasting.photographs[0].photograph_by).toBeNull();
      else expect(tasting.photographs[0]).not.toHaveProperty('photograph_by');
      const credit = (show: boolean) => call('/api/family/photographs/legacy-photo/credit', 'PUT', { credit_name_shown: show }, true);
      expect((await credit(true)).status).toBe(open ? 200 : 404);
      if (open) {
        expect((await page())[0].photographs[0].photograph_by).toBe('Mei');
        expect((await credit(false)).status).toBe(200);
        expect((await page())[0].photographs[0].photograph_by).toBeNull();
      }
      const top = await call('/api/public/people/legacy-mei/top-teas');
      expect(top.status).toBe(open ? 200 : 404);
      if (open) expect(await top.json()).toMatchObject({ picks: [] });
      const stream = await call('/api/tea-table?show=tastings');
      expect(stream.status).toBe(open ? 200 : 404);
      if (open) expect(await stream.json()).toMatchObject({ items: [], held: [] });
      const share = (share_state: string, tea_table = false) =>
        call('/api/family/teas/legacy-leaf/share', 'PUT', { share_state, tea_table }, true);
      const reshared = await share('page', true);
      expect(reshared.status).toBe(200);
      expect(await reshared.json()).toMatchObject({ on_tea_table: open });
      if (open) {
        const listed = await (await call('/api/tea-table?show=tastings')).json() as any;
        expect(listed.items).toEqual([expect.objectContaining({ id: 'legacy-journal',
          words: [expect.objectContaining({ text: 'Sweet finish' })],
          photographs: [expect.objectContaining({ id: 'legacy-photo' })] })]);
      }
      const takeOff = await call('/api/tea-table/mine/tasting/legacy-journal', 'DELETE', undefined, true);
      expect(takeOff.status).toBe(open ? 200 : 404);
      if (open) expect(await (await call('/api/tea-table?show=tastings')).json()).toMatchObject({ items: [] });
      expect(await page()).toEqual([expect.objectContaining({ product_id: 'legacy-leaf' })]);
      expect((await share('private')).status).toBe(200);
      expect(await page()).toEqual([]);
      expect(shop.sqlite.prepare("SELECT id FROM customer_tasting_journal WHERE id = 'legacy-journal'").get()).toBeTruthy();
    } finally { shop.sqlite.close(); }
  });

  it('deduplicates both old shop hearts and omits hidden and missing targets', async () => {
    const shop = oldShop();
    try {
      const call = publicCalls(shop, open);
      const read = () => call('/api/me/favourites', 'GET', undefined, true);
      const before = await read();
      expect(before.status).toBe(open ? 200 : 404);
      if (!open) return;
      const initial = await before.json() as { shop_teas: { id: string }[] };
      expect(initial.shop_teas.map(tea => tea.id).sort()).toEqual(['legacy-leaf', 'retired-tea']);
      shop.sqlite.exec("UPDATE products SET shown_in_shop = 0 WHERE id = 'legacy-leaf'");
      expect(await (await read()).json()).toMatchObject({ shop_teas: [{ id: 'retired-tea' }] });
      shop.sqlite.exec("DELETE FROM products WHERE id = 'retired-tea'");
      expect(shop.sqlite.prepare("SELECT id FROM products WHERE id = 'retired-tea'").get()).toBeUndefined();
      expect(await (await read()).json()).toMatchObject({ shop_teas: [] });
    } finally { shop.sqlite.close(); }
  });

  it('reads and names a previously saved place with only the public area', async () => {
    const shop = oldShop();
    try {
      const call = publicCalls(shop, open);
      const read = await call('/api/me/your-table', 'GET', undefined, true);
      expect(read.status).toBe(open ? 200 : 404);
      if (open) expect((await read.json() as any).places[0]).toEqual({ id: 'legacy-place-1', name: 'Garden 01', area_hint: null, is_table: false, shown: false });
      const save = await call('/api/me/your-table', 'PUT', { place_id: 'legacy-place-1', area_hint: 'North district' }, true);
      expect(save.status).toBe(open ? 200 : 404);
      const record = shop.sqlite.prepare("SELECT address, area_hint, is_host_table FROM saved_locations WHERE id = 'legacy-place-1'").get();
      expect(record).toEqual({ address: '7 Garden Street', area_hint: open ? 'North district' : null, is_host_table: Number(open) });
    } finally { shop.sqlite.close(); }
  });
});

it('opens an old favourite in its own shop after visiting another shop', async () => {
  const shop = oldShop();
  try {
    const call = publicCalls(shop, true);
    const list = await call('/api/me/favourites', 'GET', undefined, true);
    expect(list.status).toBe(200);
    const tea = (await list.json() as { shop_teas: { id: string; path: string }[] }).shop_teas.find(tea => tea.id === 'legacy-leaf')!;
    const url = new URL(tea.path, 'https://old-shop.test');
    const store = resolveInventoryStoreSlug(url.searchParams, 'other-legacy-house');
    const address = url.pathname.split('/').pop();
    expect((await call('/api/s/legacy-house/products/' + address)).status).toBe(200);
    expect((await call('/api/s/' + store + '/products/' + address)).status).toBe(200);
  } finally { shop.sqlite.close(); }
});

it('offers the fifty-first old saved place in the table chooser', async () => {
  const shop = oldShop();
  try {
    const call = publicCalls(shop, true);
    const response = await call('/api/me/your-table', 'GET', undefined, true);
    expect(response.status).toBe(200);
    const { places } = await response.json() as any;
    expect(places.map((place: { id: string }) => place.id)).toContain('legacy-place-51');
  } finally { shop.sqlite.close(); }
});

async function legacySessionRequest(db: ReturnType<typeof oldShop>['db'], open: boolean, path: string,
  method = 'GET', body?: object, signedIn = false) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (signedIn) {
    const token = await signedToken('review-only', {
      sub: 'legacy-guest', name: 'Lin Chen', role: 'user', email: 'guest@example.test',
    });
    headers.set('Authorization', 'Bearer ' + token);
  }
  return worker.fetch(new Request('https://review.invalid' + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    ...switches(open), DB: db, JWT_SECRET: 'review-only', APP_URL: 'https://review.invalid',
    AFTER_SIT_LIMITER: { limit: async () => ({ success: true }) },
    RSVP_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil: () => undefined } as never);
}

// Use the worker's two Journey answers as the query cache for the actual archive.
async function renderSitArchive(open: boolean, sits: unknown, tables: unknown) {
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MemoryRouter } = await import('react-router-dom');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const scopeHooks = await import('../../src/lib/memberPrivateSits');
  const hosting = await import('../../src/hooks/useMayHost');
  const { MemberSitsJourney } = await import('../../src/components/account/MemberSitsJourney');
  const scope = { userId: 'legacy-guest', accountId: null };
  const cache = new QueryClient();
  try {
    // Vite fixes site switches at build time. Supply the matching render state
    // while keeping the real component, links, query data and worker gates.
    vi.spyOn(hosting, 'hostedTablesOpen').mockReturnValue(open);
    vi.spyOn(scopeHooks, 'useMemberSitScope').mockReturnValue(scope);
    vi.spyOn(hosting, 'useMayHost').mockReturnValue({ mayHost: open, showSignIn: false });
    cache.setQueryData(scopeHooks.memberSitsKey(scope), sits);
    cache.setQueryData(['me-tables', scope.userId], tables);
    return renderToStaticMarkup(h(QueryClientProvider, { client: cache }, h(MemoryRouter, {}, h(MemberSitsJourney))));
  } finally {
    cache.clear();
    vi.restoreAllMocks();
  }
}

describe.each([false, true])('older sessions with switches open = %s', open => {
  it('keeps the old shop doors, capacities and time zone when a guest asks for a seat', async () => {
    const { db, sqlite } = oldShop();
    try {
      for (const [id, approval, status] of [['legacy-request', 1, 'requested'], ['legacy-instant', 0, 'confirmed']] as const) {
        const path = '/api/events/' + id;
        const page = await legacySessionRequest(db, open, path + '/public');
        expect(page.status).toBe(200);
        expect(await page.json()).toMatchObject({ id, door: null, requires_approval: approval, seats_remaining: 2, timezone: approval ? 'Asia/Taipei' : null });
        const missing = await legacySessionRequest(db, open, path + '/rsvp', 'POST', { full_name: 'Jo' });
        expect(missing.status).toBe(400);
        expect(await missing.json()).toMatchObject({ code: 'contact_required' });
        const seat = await legacySessionRequest(db, open, path + '/rsvp', 'POST', { full_name: 'Jo', email: 'jo@example.test' });
        expect(seat.status).toBe(201);
        expect(await seat.json()).toMatchObject({ status });
        const after = await legacySessionRequest(db, open, path + '/public');
        expect(await after.json()).toMatchObject({ seats_remaining: approval ? 2 : 1 });
        expect(sqlite.prepare('SELECT host_user_id, lifecycle_status, is_tasting FROM events WHERE id = ?').get(id))
          .toMatchObject({ host_user_id: null, lifecycle_status: 'published', is_tasting: 0 });
      }
      expect(await hostStanding(db as unknown as D1Database, 'legacy-guest')).toEqual({ approved: false, stopped: false, reach: 'invitation' });
    } finally { sqlite.close(); }
  });

  it('opens and edits an old private sit from Journey while preserving its tea and private note', async () => {
    const { db, sqlite } = oldShop();
    try {
      const path = '/api/me/private-sits';
      const call = (url: string, method = 'GET', body?: object) => legacySessionRequest(db, open, url, method, body, true);
      const archive = await call(path);
      expect(archive.status).toBe(200);
      const sit = { id: 'legacy-sit', title: 'Morning by the window', note: 'Plum', tea: { id: null, name: 'Rock tea' } };
      expect(await archive.json()).toMatchObject({ sits: [sit] });
      expect(await (await call(path + '/legacy-sit')).json()).toMatchObject(sit);
      expect((await call(path + '/legacy-sit/note', 'PUT', { note: 'Plum and honey' })).status).toBe(200);
      expect(await (await call(path + '/legacy-sit')).json()).toMatchObject({ ...sit, note: 'Plum and honey' });
      const newTable = await call('/api/me/tables', 'POST', { date: '2099-01-02', time: '12:00', timezone: 'Asia/Taipei', seats: 1 });
      expect(newTable.status).toBe(open ? 201 : 404);
      const tables = await call('/api/me/tables');
      expect(tables.status).toBe(open ? 200 : 404);
      const archiveRows = await (await call(path)).json();
      const tableRows = open ? await tables.json() : { tables: [] };
      const links = await renderSitArchive(open, archiveRows, tableRows);
      expect(links).toContain('href="/account/journey/sits/legacy-sit"');
      if (open) {
        const table = await newTable.json() as { id: string };
        expect(tableRows).toMatchObject({ tables: [{ id: table.id, seats: 1, door: 'request' }] });
        expect(archiveRows).toMatchObject({ sits: [{ ...sit, note: 'Plum and honey' }] });
        expect(links).toContain('href="/account/host/' + table.id + '"');
        expect(links).toContain('Host a table');
        expect(links).not.toContain('Start a sit');
      } else {
        expect(links).toContain('Start a sit');
        expect(links).not.toContain('Host a table');
        const created = await call(path, 'POST', { requestId: 'new-review-sit', date: '2026-12-01' });
        expect(created.status).toBe(201);
      }
    } finally { sqlite.close(); }
  });

  it('keeps an included note signed, its old photograph unnamed and its note editable', async () => {
    const { db, sqlite } = oldShop();
    try {
      const bookRequest = (action: string, extra?: object) => legacySessionRequest(db, open,
        '/api/after-sit/guest-book', 'POST', { credential: oldSeatCredential, action, ...extra }, true);
      const book = await bookRequest('read');
      expect(book.status).toBe(200);
      // Other guests read the booking first name, never the surname (A7-1).
      const entries = await book.json();
      expect(entries).toMatchObject({ entries: [{ display_name: 'Lin', note: 'Gentle finish' }] });
      expect(JSON.stringify(entries)).not.toContain('Chen');
      const photos = await bookRequest('photos-read');
      expect(photos.status).toBe(200);
      // The photograph stays unnamed either way. Closed, it keeps main's entry key
      // grouping it with its taker's note (flags-off parity, 4b2a3bac); open, only a named one does (A3).
      const gallery = (await photos.json() as { gallery: Record<string, unknown>[] }).gallery;
      expect(gallery).toEqual([{ id: 'legacy-offer', display_name: null, alt_text: 'Tea setup',
        ...(open ? {} : { entry_key: expect.stringMatching(/^[0-9a-f]{64}$/) }) }]);
      const edit = await bookRequest('entry-save', { note: 'Long finish' });
      expect(edit.status).toBe(200);
      expect(sqlite.prepare('SELECT note, status, revision, public_recap FROM session_guest_book WHERE id = ?').get('legacy-note'))
        .toMatchObject({ note: 'Long finish', status: 'pending', revision: 2, public_recap: 0 });
    } finally { sqlite.close(); }
  });

  it('opens the older thank-you link and keeps its poured tea once across two requests', async () => {
    const { db } = oldShop();
    try {
      const post = (action: string, extra?: object) => legacySessionRequest(db, open,
        '/api/after-sit/' + action, 'POST', { credential: oldSeatCredential, ...extra }, true);
      const recap = await post('recap');
      expect(recap.status).toBe(200);
      expect(await recap.json()).toMatchObject({
        event: { id: 'legacy-past' }, is_tasting: false, reading: null, thanks_ref: expect.any(String),
        teas: [{ id: 'old-pour', name: 'Roasted tea', path: null, kept: false }],
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        const kept = await post('keep-tea', { teaId: 'old-pour' });
        expect(kept.status).toBe(200);
        expect(await kept.json()).toMatchObject({ item: { source: { kind: 'session', eventId: 'legacy-past' } } });
      }
      expect(await (await post('recap')).json()).toMatchObject({ teas: [{ id: 'old-pour', kept: true }] });
      expect(db.sqlite.prepare("SELECT count(*) AS n FROM personal_cellar_items WHERE source_event_id = 'legacy-past'").get()).toEqual({ n: 1 });
    } finally { db.close(); }
  });

  it('stops listing an old session once its own seat door says it has ended', async () => {
    const { db, sqlite } = oldShop();
    try {
      const seat = await legacySessionRequest(db, open, '/api/events/legacy-ended-today/rsvp', 'POST', { full_name: 'Jo', email: 'jo@example.test' });
      expect(seat.status).toBe(409);
      expect(await seat.json()).toMatchObject({ code: 'event_not_reservable' });
      const signed = await legacySessionRequest(db, open, '/api/me/sessions', 'GET', undefined, true);
      expect(signed.status).toBe(open ? 200 : 404);
      const publicList = await legacySessionRequest(db, open, '/api/events');
      expect(publicList.status).toBe(200);
      const carriedBy = [];
      for (const [name, response] of [['public', publicList], ['signed in', signed]] as const) {
        if (response.status === 404) continue;
        const rows = await response.json() as { slug: string }[];
        expect(rows.some(row => row.slug === 'legacy-request')).toBe(true);
        if (rows.some(row => row.slug === 'legacy-ended-today')) carriedBy.push(name);
      }
      expect(carriedBy).toEqual([]);
    } finally { sqlite.close(); }
  });
});

it.each([false, true])('removes an old saved offer from favourites when the owner withdraws seller approval (open=%s)', async open => {
  const shop = oldShop();
  try {
    const call = publicCalls(shop, open, 'chest-reader');
    const listing = '/api/s/legacy-personal/products/legacy-spring-pack';
    const read = () => call('/api/me/favourites', 'GET', undefined, true);
    expect((await call(listing)).status).toBe(200);
    const saved = await read();
    expect(saved.status).toBe(open ? 200 : 404);
    if (open) expect(await saved.json()).toMatchObject({ shop_teas: [{ id: 'legacy-pack' }] });
    await setPersonalSellerApproval(shop.db as unknown as D1Database, 'legacy-author', false, 'legacy-author');
    // A changed name distinguishes current seller data from a saved historical label.
    shop.sqlite.exec("UPDATE products SET product_name = 'Unpublished replacement label' WHERE id = 'legacy-pack'");
    expect((await call(listing)).status).toBe(404);
    const after = await read();
    expect(after.status).toBe(open ? 200 : 404);
    if (open) expect(await after.json()).toMatchObject({ shop_teas: [] });
  } finally { shop.db.close(); }
});

// Optional DOM checks use the real chooser against the migrated worker without opening a port.
// A6.md gives the command for supplying jsdom outside the worktree.
const requireDom = createRequire(import.meta.url);
async function walkOldPlaceChooser(previouslyNamed: boolean) {
  const { JSDOM } = requireDom('jsdom');
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://review.invalid/account/host' });
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'localStorage', 'sessionStorage']) {
    vi.stubGlobal(name, name === 'window' ? dom.window : dom.window[name]);
  }
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const { createElement: h, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { MemoryRouter } = await import('react-router-dom');
  const { YourTablePlaceSection } = await import('../../src/components/host/YourTablePlace');
  const { api } = await import('../../src/lib/api');
  const auth = await import('../../src/hooks/useAuth');
  const shop = oldShop();
  const call = publicCalls(shop, true);
  const root = createRoot(dom.window.document.querySelector('#root'));
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const email = 'legacy-author@test.dev';
  const choose = async (body: { place_id: string; area_hint: string }) => {
    const response = await call('/api/me/your-table', 'PUT', body, true);
    expect(response.status).toBe(200);
    return await response.json() as Awaited<ReturnType<typeof api.hosting.yourTable>>;
  };
  try {
    vi.spyOn(auth, 'useAuth').mockReturnValue({ user: { email } } as ReturnType<typeof auth.useAuth>);
    if (previouslyNamed) await choose({ place_id: 'legacy-place-2', area_hint: 'South garden' });
    const initial = await choose({ place_id: 'legacy-place-1', area_hint: 'North garden' });
    cache.setQueryData(['your-table', email], initial);
    vi.spyOn(api.hosting, 'chooseYourTable').mockImplementation(choose);
    await act(async () => root.render(h(QueryClientProvider, { client: cache },
      h(MemoryRouter, { initialEntries: ['/account/host'] }, h(YourTablePlaceSection)))));
    const screen = dom.window.document;
    const steps: string[] = [];
    const click = async (target: HTMLElement, name: string) => {
      expect(target, name).toBeTruthy();
      await act(async () => {
        target.click();
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      steps.push(name);
    };
    const button = (name: string) => Array.from(screen.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(item => item.textContent?.trim() === name)!;
    // Accept a layout that makes the choices available immediately.
    const change = button('Choose another place');
    if (change) await click(change, 'Choose another place');
    const radio = screen.querySelector('input[value="legacy-place-2"]');
    await click(radio, 'Garden 02');
    const area = screen.querySelector('input[type="text"]').value;
    if (!previouslyNamed) return { steps, area };
    expect(area).toBe('South garden');
    if (button('Make this my table')) await click(button('Make this my table'), 'Make this my table');
    expect(shop.sqlite.prepare("SELECT is_host_table FROM saved_locations WHERE id = 'legacy-place-2'").get())
      .toEqual({ is_host_table: 1 });
    return { steps, area };
  } finally {
    await act(async () => {
      root.unmount();
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    cache.clear();
    shop.db.close();
    dom.window.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  }
}

describe.runIf(process.env.A6_DOM === '1')('older places in the rendered chooser', () => {
  it('switches back to a previously named place in at most two taps', async () => {
    const { steps } = await walkOldPlaceChooser(true);
    expect(steps.length, steps.join(' > ')).toBeLessThanOrEqual(2);
  }, 20_000);
  it('clears the previous public area when choosing an older place with no saved area', async () => {
    const { area } = await walkOldPlaceChooser(false);
    expect(area).toBe('');
  }, 20_000);
});
