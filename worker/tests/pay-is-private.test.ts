import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { decidePayAccess, isShareTokenShaped, mintShareToken, whatsappShareUrl, withShareToken } from '../src/payAccessDomain';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Pay is private, and approval is permanent (migration 0022).
//
// The rule this file pins: pressing Pay never shows a bank detail to the
// public. A contributor's transfer details open for exactly three viewers,
// the contributor, an account they approved, and whoever holds a share link,
// and for nobody else. Everything below either proves a door opens for the
// right person or proves it stays shut for everyone else.

const SECRET = 'pay-is-private-secret';
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

async function as(db: SqliteD1, userId: string, path: string, options: { method?: string; body?: unknown; accountId?: string } = {}) {
  const token = await signedToken(SECRET, {
    sub: userId, email: `${userId}@test.dev`, name: userId,
    active_account_id: options.accountId ?? 'acc-one', platform_role: null,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}` });
  if (options.accountId) headers.set('X-Teajia-Account', options.accountId);
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? (options.body !== undefined ? 'POST' : 'GET'), headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), env(db));
}

async function anonymous(db: SqliteD1, path: string) {
  return worker.fetch(new Request(`https://worker.test${path}`), env(db));
}

/** Kenji, published, with a bank transfer method the public must never read. */
function seedKenji(db: SqliteD1) {
  seedIdentity(db, { userId: 'kenji-user', accountId: 'acc-one', role: 'owner' });
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, business_name, is_published, links)
    VALUES ('kenji-tanaka', 'acc-one', 'kenji-user', 'Kenji Tanaka', 'Tanaka Tea House', 1, '[]')`).run();
  db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('kenji-tanaka', 'acc-one')`).run();
  db.sqlite.prepare(`INSERT INTO payment_methods
    (id, contributor_id, account_id, method_type, label, recipient_name, account_identifier, is_published)
    VALUES ('pm-kenji', 'kenji-tanaka', NULL, 'bank_transfer', 'Bank transfer (Kyoto)', 'Kenji Tanaka', 'Tanaka Tea House, account ending 0092', 1)`).run();
}

/** A visitor with an account and no relationship to Kenji. */
function seedAmara(db: SqliteD1) {
  db.sqlite.prepare(`INSERT OR IGNORE INTO users (id, email, name, password_hash, role, session_version)
    VALUES ('amara-user', 'amara@test.dev', 'Amara Osei', 'test', 'user', 0)`).run();
}

const BANK_DETAIL = 'account ending 0092';

describe('the rules, without a request', () => {
  it('opens for the owner, a link holder and an approved account, and gates everyone else', () => {
    expect(decidePayAccess({ isOwner: true, hasApprovedGrant: false, hasValidLink: false })).toEqual({ access: 'open', via: 'owner' });
    expect(decidePayAccess({ isOwner: false, hasApprovedGrant: true, hasValidLink: false })).toEqual({ access: 'open', via: 'approved' });
    expect(decidePayAccess({ isOwner: false, hasApprovedGrant: false, hasValidLink: true })).toEqual({ access: 'open', via: 'link' });
    expect(decidePayAccess({ isOwner: false, hasApprovedGrant: false, hasValidLink: false })).toEqual({ access: 'gate', via: null });
  });

  it('mints 32 hex characters and recognises nothing else as a token', () => {
    const token = mintShareToken();
    expect(isShareTokenShaped(token)).toBe(true);
    expect(isShareTokenShaped(token.slice(1))).toBe(false);
    expect(isShareTokenShaped('t=' + token)).toBe(false);
    expect(isShareTokenShaped(null)).toBe(false);
  });

  it('puts the token on a pay url beside the amount, replacing any token already there', () => {
    const url = new URL(withShareToken('https://www.teajia.com/people/kenji-tanaka/pay?amount=35.00&t=old', 'abc'));
    expect(url.searchParams.get('t')).toBe('abc');
    expect(url.searchParams.get('amount')).toBe('35.00');
    expect(url.searchParams.getAll('t')).toHaveLength(1);
  });

  it('builds a WhatsApp deep link with or without a number', () => {
    expect(whatsappShareUrl('pay here', '+62 812 3456')).toBe('https://wa.me/628123456?text=pay%20here');
    expect(whatsappShareUrl('pay here')).toBe('https://wa.me/?text=pay%20here');
  });
});

describe('the public never sees a bank number', () => {
  it('answers a stranger with the gate and the person to ask, and no method', async () => {
    const db = database();
    seedKenji(db);
    const response = await anonymous(db, '/api/public/people/kenji-tanaka/payment-methods');
    expect(response.status).toBe(403);
    const text = await response.text();
    expect(text).not.toContain(BANK_DETAIL);
    expect(JSON.parse(text)).toMatchObject({
      code: 'pay_private', access: 'gate',
      contributor: { id: 'kenji-tanaka', display_name: 'Kenji Tanaka', business_name: 'Tanaka Tea House' },
    });
  });

  it('answers a signed-in account with no grant the same way', async () => {
    const db = database();
    seedKenji(db); seedAmara(db);
    const response = await as(db, 'amara-user', '/api/public/people/kenji-tanaka/payment-methods');
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(BANK_DETAIL);
  });

  it('refuses a token that is not one of this contributor links, even a well formed one', async () => {
    const db = database();
    seedKenji(db);
    const response = await anonymous(db, `/api/public/people/kenji-tanaka/payment-methods?t=${mintShareToken()}`);
    expect(response.status).toBe(403);
  });

  it('pay-access says gate for a stranger and names whether they are signed in', async () => {
    const db = database();
    seedKenji(db); seedAmara(db);
    const stranger = await (await anonymous(db, '/api/public/people/kenji-tanaka/pay-access')).json() as any;
    expect(stranger).toMatchObject({ access: 'gate', via: null, viewer: { signed_in: false, request_status: null } });
    const amara = await (await as(db, 'amara-user', '/api/public/people/kenji-tanaka/pay-access')).json() as any;
    expect(amara).toMatchObject({ access: 'gate', viewer: { signed_in: true, is_owner: false, request_status: null } });
  });
});

describe('asking, approving, declining', () => {
  it('asking needs an account, creates one pending request, and asking again does not add a second', async () => {
    const db = database();
    seedKenji(db); seedAmara(db);
    const signedOut = await worker.fetch(new Request('https://worker.test/api/public/people/kenji-tanaka/pay-access/request', { method: 'POST' }), env(db));
    expect(signedOut.status).toBe(401);

    const first = await as(db, 'amara-user', '/api/public/people/kenji-tanaka/pay-access/request', { body: {} });
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ status: 'pending' });
    const again = await as(db, 'amara-user', '/api/public/people/kenji-tanaka/pay-access/request', { body: {} });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ status: 'pending' });
    const rows = db.sqlite.prepare(`SELECT status, granted_via, account_id FROM payment_access_grants WHERE contributor_id = 'kenji-tanaka'`).all();
    expect(rows).toEqual([{ status: 'pending', granted_via: 'request', account_id: 'acc-one' }]);
    const audit = db.sqlite.prepare(`SELECT action FROM platform_audit_log WHERE action LIKE 'pay_access.%'`).all();
    expect(audit).toEqual([{ action: 'pay_access.requested' }]);
    // Still gated while pending.
    expect((await as(db, 'amara-user', '/api/public/people/kenji-tanaka/payment-methods')).status).toBe(403);
  });

  it('the contributor cannot ask themselves', async () => {
    const db = database();
    seedKenji(db);
    const response = await as(db, 'kenji-user', '/api/public/people/kenji-tanaka/pay-access/request', { body: {} });
    expect(response.status).toBe(400);
  });

  it('the request lands at the contributor table with a name, and approval opens the sheet for good', async () => {
    const db = database();
    seedKenji(db); seedAmara(db);
    await as(db, 'amara-user', '/api/public/people/kenji-tanaka/pay-access/request', { body: {} });

    const table = await (await as(db, 'kenji-user', '/api/me/pay-access')).json() as any;
    expect(table.pending).toHaveLength(1);
    expect(table.pending[0]).toMatchObject({ user_name: 'Amara Osei', status: 'pending', granted_via: 'request' });
    expect(table.approved).toEqual([]);
    expect(table.share_link).toBeNull();

    const approve = await as(db, 'kenji-user', `/api/me/pay-access/${table.pending[0].id}/approve`, { body: {} });
    expect(approve.status).toBe(200);

    const opened = await as(db, 'amara-user', '/api/public/people/kenji-tanaka/payment-methods');
    expect(opened.status).toBe(200);
    expect(await opened.text()).toContain(BANK_DETAIL);
    const access = await (await as(db, 'amara-user', '/api/public/people/kenji-tanaka/pay-access')).json() as any;
    expect(access).toMatchObject({ access: 'open', via: 'approved', viewer: { request_status: 'approved' } });

    // Approving twice is not a second approval, and there is no revoke route.
    expect((await as(db, 'kenji-user', `/api/me/pay-access/${table.pending[0].id}/approve`, { body: {} })).status).toBe(404);
    const after = await (await as(db, 'kenji-user', '/api/me/pay-access')).json() as any;
    expect(after.approved).toHaveLength(1);
    expect(after.approved[0]).toMatchObject({ user_name: 'Amara Osei', status: 'approved' });
  });

  it('declining removes the request so the person may ask again, and is audited', async () => {
    const db = database();
    seedKenji(db); seedAmara(db);
    const asked = await (await as(db, 'amara-user', '/api/public/people/kenji-tanaka/pay-access/request', { body: {} })).json() as any;
    const decline = await as(db, 'kenji-user', `/api/me/pay-access/${asked.grant_id}/decline`, { body: {} });
    expect(decline.status).toBe(200);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM payment_access_grants`).get()).toEqual({ n: 0 });
    expect((await as(db, 'amara-user', '/api/public/people/kenji-tanaka/payment-methods')).status).toBe(403);
    const actions = db.sqlite.prepare(`SELECT action FROM platform_audit_log WHERE action LIKE 'pay_access.%' ORDER BY rowid`).all();
    expect(actions.map((row: any) => row.action)).toEqual(['pay_access.requested', 'pay_access.declined']);
  });

  it('another contributor cannot approve a request that is not theirs', async () => {
    const db = database();
    seedKenji(db); seedAmara(db);
    seedIdentity(db, { userId: 'wei-user', accountId: 'acc-one', role: 'staff' });
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published, links)
      VALUES ('wei-chen', 'acc-one', 'wei-user', 'Wei Chen', 1, '[]')`).run();
    const asked = await (await as(db, 'amara-user', '/api/public/people/kenji-tanaka/pay-access/request', { body: {} })).json() as any;
    expect((await as(db, 'wei-user', `/api/me/pay-access/${asked.grant_id}/approve`, { body: {} })).status).toBe(404);
    expect(db.sqlite.prepare(`SELECT status FROM payment_access_grants`).get()).toEqual({ status: 'pending' });
  });
});

describe('a link simply opens', () => {
  it('the open share link is minted once, returned on every later call, and opens the sheet for a stranger', async () => {
    const db = database();
    seedKenji(db);
    const first = await as(db, 'kenji-user', '/api/me/pay-access/share-link', { body: {} });
    expect(first.status).toBe(201);
    const minted = await first.json() as any;
    const url = new URL(minted.url);
    expect(url.pathname).toBe('/people/kenji-tanaka/pay');
    expect(url.searchParams.get('t')).toMatch(/^[0-9a-f]{32}$/);
    expect(url.searchParams.get('amount')).toBeNull();

    const second = await as(db, 'kenji-user', '/api/me/pay-access/share-link', { body: {} });
    expect(second.status).toBe(200);
    expect((await second.json() as any).url).toBe(minted.url);
    expect((await (await as(db, 'kenji-user', '/api/me/pay-access')).json() as any).share_link).toBe(minted.url);

    const opened = await anonymous(db, `/api/public/people/kenji-tanaka/payment-methods?t=${url.searchParams.get('t')}`);
    expect(opened.status).toBe(200);
    expect(await opened.text()).toContain(BANK_DETAIL);
  });

  it('opening a link while signed in records an approval for that account, permanently', async () => {
    const db = database();
    seedKenji(db); seedAmara(db);
    const minted = await (await as(db, 'kenji-user', '/api/me/pay-access/share-link', { body: {} })).json() as any;
    const token = new URL(minted.url).searchParams.get('t');

    const viaLink = await (await as(db, 'amara-user', `/api/public/people/kenji-tanaka/pay-access?t=${token}`)).json() as any;
    expect(viaLink).toMatchObject({ access: 'open', via: 'link', invoice: null });

    // The link is no longer needed: her account is approved from now on.
    const withoutLink = await as(db, 'amara-user', '/api/public/people/kenji-tanaka/payment-methods');
    expect(withoutLink.status).toBe(200);
    const grants = db.sqlite.prepare(`SELECT status, granted_via FROM payment_access_grants WHERE grantee_user_id = 'amara-user'`).all();
    expect(grants).toEqual([{ status: 'approved', granted_via: 'link' }]);
    const opens = db.sqlite.prepare(`SELECT open_count FROM payment_share_links WHERE token = ?`).get(token) as any;
    expect(opens.open_count).toBe(1);
  });

  it('a stranger following a link is not recorded as anyone, and the link keeps working', async () => {
    const db = database();
    seedKenji(db);
    const minted = await (await as(db, 'kenji-user', '/api/me/pay-access/share-link', { body: {} })).json() as any;
    const token = new URL(minted.url).searchParams.get('t');
    for (let i = 0; i < 3; i += 1) {
      expect((await anonymous(db, `/api/public/people/kenji-tanaka/pay-access?t=${token}`)).status).toBe(200);
    }
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM payment_access_grants`).get()).toEqual({ n: 0 });
    expect((db.sqlite.prepare(`SELECT open_count FROM payment_share_links WHERE token = ?`).get(token) as any).open_count).toBe(3);
  });
});

describe('an invoice pay link is a share link', () => {
  function seedInvoice(db: SqliteD1, id = 'inv-1') {
    db.sqlite.prepare(`INSERT INTO invoices (id, account_id, invoice_number, status, payment_status, customer_name, customer_whatsapp, sold_by_user_id, display_currency)
      VALUES (?, 'acc-one', 'INV-0412', 'Pending', 'unpaid', 'Amara Osei', '+1 503 555 0100', 'kenji-user', 'USD')`).run(id);
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type, status, is_public, shown_in_shop, stock_grams)
      VALUES ('prod-1', 'acc-one', 'Aged Oolong', 'Oolong', 'Active', 1, 1, 100)`).run();
    db.sqlite.prepare(`INSERT INTO invoice_line_items (id, invoice_id, product_id, quantity, price_at_sale)
      VALUES ('line-1', ?, 'prod-1', 2, 17.50)`).run(id);
  }

  it('the admin share endpoint returns the tokened url with the balance owed and the customer number, and the same url twice', async () => {
    const db = database();
    seedKenji(db); seedInvoice(db);
    const first = await as(db, 'kenji-user', '/api/invoices/inv-1/pay-link', { body: {}, accountId: 'acc-one' });
    expect(first.status).toBe(200);
    const body = await first.json() as any;
    const url = new URL(body.url);
    expect(url.searchParams.get('amount')).toBe('35.00');
    expect(url.searchParams.get('reference')).toBe('INV-0412');
    expect(url.searchParams.get('t')).toMatch(/^[0-9a-f]{32}$/);
    expect(body).toMatchObject({ invoice_number: 'INV-0412', customer_whatsapp: '+1 503 555 0100', recipient_name: 'Kenji Tanaka', outstanding_usd: 35 });

    const second = await (await as(db, 'kenji-user', '/api/invoices/inv-1/pay-link', { body: {}, accountId: 'acc-one' })).json() as any;
    expect(new URL(second.url).searchParams.get('t')).toBe(url.searchParams.get('t'));
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM payment_share_links WHERE invoice_id = 'inv-1'`).get()).toEqual({ n: 1 });

    // The link opens the sheet for whoever holds it, and pay-access names the invoice.
    const access = await (await anonymous(db, `/api/public/people/kenji-tanaka/pay-access?t=${url.searchParams.get('t')}`)).json() as any;
    expect(access).toMatchObject({ access: 'open', via: 'link', invoice: { invoice_number: 'INV-0412', outstanding_usd: 35 } });
    expect((await anonymous(db, `/api/public/people/kenji-tanaka/payment-methods?t=${url.searchParams.get('t')}`)).status).toBe(200);
  });

  it('refuses to share when nothing is outstanding, in words', async () => {
    const db = database();
    seedKenji(db); seedInvoice(db);
    db.sqlite.prepare(`UPDATE invoices SET payment_status = 'paid' WHERE id = 'inv-1'`).run();
    const response = await as(db, 'kenji-user', '/api/invoices/inv-1/pay-link', { body: {}, accountId: 'acc-one' });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'invoice_settled' });
  });
});

describe('migration 0022 builds what schema.sql describes', () => {
  it('creates both tables with the same columns, and one open link per contributor', () => {
    const fromSchema = database('schema');
    const fromMigrations = database('migrations');
    for (const table of ['payment_access_grants', 'payment_share_links']) {
      const columns = (db: SqliteD1) => db.sqlite.prepare(`PRAGMA table_info(${table})`).all()
        .map((column: any) => `${column.name}:${column.type}:${column.notnull}:${column.dflt_value ?? ''}`);
      expect(columns(fromMigrations), table).toEqual(columns(fromSchema));
    }
    fromMigrations.sqlite.prepare(`INSERT INTO accounts (id, slug, name, status, public_enabled) VALUES ('a', 'a', 'a', 'active', 1)`).run();
    fromMigrations.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, links) VALUES ('c', 'a', 'C', '[]')`).run();
    const insert = fromMigrations.sqlite.prepare(`INSERT INTO payment_share_links (id, account_id, contributor_id, invoice_id, token) VALUES (?, 'a', 'c', NULL, ?)`);
    insert.run('l1', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(() => insert.run('l2', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toThrow();
    expect(() => fromMigrations.sqlite.prepare(`INSERT INTO payment_access_grants (id, account_id, contributor_id, grantee_user_id, granted_via, status) VALUES ('g', 'a', 'c', 'u', 'request', 'revoked')`).run()).toThrow();
  });
});
