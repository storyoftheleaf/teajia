import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import {
  approveHostCreditSpend,
  checkHostCreditIntegrity,
  holdHostCreditSpend,
  settleHostCredit,
} from '../src/hostCreditLedger';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Launch 5, M1: tea credit for hosts, through the real order doors.
// todo/plans/guests-and-tea-masters-launch-5-run.md, hard question 1 and
// "Credit is held securely"; the shapes come from the M1 audit.

const SECRET = 'host-credit-secret';
const SHOP = 'shop';
const OWNER = 'adrian';
const HOST = 'host';
const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

type Db = SqliteD1;

function seed(): Db {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: HOST, accountId: 'host-home', role: 'owner' });
  seedIdentity(db, { userId: 'host2', accountId: 'host2-home', role: 'owner' });
  seedIdentity(db, { userId: 'staff', accountId: SHOP, role: 'staff', bundles: ['sell', 'catalog', 'stock'] });
  db.sqlite.exec(`
    INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, thanks_ref)
      VALUES ('event', '${SHOP}', 'sit', 'A sit', '2026-01-10', 'completed', 'aaaaaaaaaaaaaaaaaa');
    INSERT INTO products (id, account_id, product_name, type, stock_grams, quantity_units, status)
      VALUES ('tea', '${SHOP}', 'Da Hong Pao', 'Oolong', 5000, 0, 'Active'),
             ('ware', '${SHOP}', 'A gaiwan', 'Teaware', 0, 10, 'Active'),
             ('other-shop-tea', 'host-home', 'Not this shop', 'Oolong', 5000, 0, 'Active');
    INSERT INTO customers (id, account_id, name) VALUES ('guest', '${SHOP}', 'Mei');
    INSERT INTO customers (id, account_id, name, user_id) VALUES ('host-buyer', '${SHOP}', 'The host', '${HOST}');
  `);
  return db;
}

/** One order request that began from a thank-you, and the invoice it became. */
function order(db: Db, o: {
  invoice: string; inquiry?: string; host?: string | null; customer?: string; status?: string;
  via?: 'converted' | 'website' | 'both' | 'none'; lines?: Array<[string, string | null, number, number]>;
  shipping?: number; paymentStatus?: string; deducted?: number;
}) {
  const inquiry = o.inquiry ?? `inq-${o.invoice}`;
  const via = o.via ?? 'converted';
  const exists = db.sqlite.prepare('SELECT 1 FROM inquiries WHERE id = ?').get(inquiry);
  if (!exists) {
    db.sqlite.prepare(`INSERT INTO inquiries (id, account_id, name, email, items, status, converted_invoice_id)
      VALUES (?, ?, 'Mei', 'mei@test.dev', '[]', 'replied', ?)`)
      .run(inquiry, SHOP, via === 'converted' || via === 'both' ? o.invoice : null);
    if (o.host !== undefined || via !== 'none') {
      db.sqlite.prepare(`INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id) VALUES (?, ?, 'event', ?)`)
        .run(inquiry, SHOP, o.host === undefined ? HOST : o.host);
    }
  }
  db.sqlite.prepare(`INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_id, display_currency,
      shipping_cost_usd, status, payment_status, inventory_deducted, source_inquiry_id)
    VALUES (?, ?, ?, 'Mei', ?, 'USD', ?, ?, ?, ?, ?)`)
    .run(o.invoice, SHOP, `TJ-${o.invoice}`, o.customer ?? 'guest', o.shipping ?? 0, o.status ?? 'Pending',
      o.paymentStatus ?? 'unpaid', o.deducted ?? 0, via === 'website' || via === 'both' ? inquiry : null);
  const lines = o.lines ?? [[`${o.invoice}-tea`, 'tea', 50, 0.5]];
  for (const [id, product, quantity, price] of lines) {
    db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, SHOP, o.invoice, product, product ? null : 'A custom line', quantity, price);
  }
}

function env(db: Db, open = true) {
  return { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com', ...(open ? { HOST_CREDIT_OPEN: 'true' } : {}) } as any;
}

async function call(db: Db, path: string, o: { method?: string; body?: unknown; as?: string; account?: string; open?: boolean } = {}) {
  const user = o.as ?? OWNER;
  const account = o.account ?? (user === HOST ? 'host-home' : user === 'host2' ? 'host2-home' : SHOP);
  const token = await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, name: user, active_account_id: account, platform_role: null });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': account });
  if (o.body !== undefined) headers.set('Content-Type', 'application/json');
  const background: Promise<unknown>[] = [];
  const response = await worker.fetch(new Request(`https://worker.test${path}`, {
    method: o.method ?? 'GET', headers, body: o.body === undefined ? undefined : JSON.stringify(o.body),
  }), env(db, o.open ?? true), { waitUntil: (task: Promise<unknown>) => background.push(task) } as never);
  await Promise.all(background);
  const text = await response.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}

const pay = async (db: Db, invoice: string, amount: number, o: { open?: boolean } = {}) => {
  const requestId = `pay-${invoice}-${amount}-${Math.random().toString(36).slice(2, 10)}`.replace(/[^A-Za-z0-9_-]/g, '_');
  const paid = await call(db, `/api/invoices/${invoice}/payments`, { method: 'POST', body: { amount, request_id: requestId }, ...o });
  expect(paid.status, JSON.stringify(paid.data)).toBe(201);
  return paid;
};
const setStatus = (db: Db, invoice: string, status: string, o: { open?: boolean } = {}) =>
  call(db, `/api/invoices/${invoice}`, { method: 'PUT', body: { status }, ...o });

/** Filled by hand: a paid order with its stock taken is shipped; any other is marked Filled in Sales. */
async function fill(db: Db, invoice: string, o: { open?: boolean } = {}) {
  const row = db.sqlite.prepare('SELECT inventory_deducted FROM invoices WHERE id = ?').get(invoice) as { inventory_deducted: number };
  return Number(row.inventory_deducted) === 1
    ? call(db, '/api/rpc/ship-invoice', { method: 'POST', body: { invoice_id: invoice }, ...o })
    : setStatus(db, invoice, 'Filled', o);
}

function entries(db: Db, invoice?: string) {
  return db.sqlite.prepare(`SELECT kind, invoice_line_id, amount, currency, host_user_id, basis_amount, basis_currency, created_by
    FROM host_credit_entries ${invoice ? 'WHERE invoice_id = ?' : ''} ORDER BY kind, invoice_line_id`)
    .all(...(invoice ? [invoice] : [])) as Array<Record<string, any>>;
}
const kinds = (db: Db, invoice?: string) => entries(db, invoice).map(row => `${row.kind}:${row.invoice_line_id}:${row.amount}`);
const incidents = (db: Db) => (db.sqlite.prepare('SELECT signature FROM incident_ledger').all() as Array<{ signature: string }>)
  .map(row => row.signature).join(' ');

describe('tea credit for hosts: earning', () => {
  it('holds a converted order as pending, and earns only once it is Filled by hand and fully paid', async () => {
    const db = seed();
    order(db, { invoice: 'inv' });
    expect((await settleHostCredit(env(db), 'inv')).pending).toBe(1);
    expect(kinds(db)).toEqual(['pending:inv-tea:2.5']);

    // Paid but not Filled: still pending. An order nobody has verified earns nothing.
    expect((await pay(db, 'inv', 25)).status).toBe(201);
    expect(kinds(db)).toEqual(['pending:inv-tea:2.5']);

    const filled = await fill(db, 'inv');
    expect(filled.status, JSON.stringify(filled.data)).toBe(200);
    expect(entries(db)).toEqual([
      { kind: 'earned', invoice_line_id: 'inv-tea', amount: 2.5, currency: 'USD', host_user_id: HOST, basis_amount: 25, basis_currency: 'USD', created_by: 'system' },
      { kind: 'pending', invoice_line_id: 'inv-tea', amount: 2.5, currency: 'USD', host_user_id: HOST, basis_amount: 25, basis_currency: 'USD', created_by: 'system' },
    ]);
  });

  it('Filled then paid, through the fulfil door, earns once', async () => {
    const db = seed();
    order(db, { invoice: 'inv' });
    expect((await call(db, '/api/rpc/fulfill-invoice', { method: 'POST', body: { invoice_id: 'inv' } })).status).toBe(200);
    expect(kinds(db)).toEqual(['pending:inv-tea:2.5']);
    expect((await pay(db, 'inv', 10)).status).toBe(201);
    expect(kinds(db)).toEqual(['pending:inv-tea:2.5']);
    expect((await pay(db, 'inv', 15)).status).toBe(201);
    expect(kinds(db)).toEqual(['earned:inv-tea:2.5', 'pending:inv-tea:2.5']);
  });

  it('paid then Filled earns once, and a replay of every door earns nothing more', async () => {
    const db = seed();
    order(db, { invoice: 'inv' });
    await pay(db, 'inv', 25);
    await fill(db, 'inv');
    await fill(db, 'inv');
    await pay(db, 'inv', 1);
    for (let i = 0; i < 3; i++) await settleHostCredit(env(db), 'inv');
    expect(kinds(db)).toEqual(['earned:inv-tea:2.5', 'pending:inv-tea:2.5']);
  });

  it('a legacy paid column counts as paid', async () => {
    const db = seed();
    order(db, { invoice: 'inv', paymentStatus: 'paid' });
    await fill(db, 'inv');
    expect(kinds(db)).toEqual(['earned:inv-tea:2.5', 'pending:inv-tea:2.5']);
  });

  it('shipping, a custom line and teaware earn nothing; a tea of another shop earns nothing', async () => {
    const db = seed();
    order(db, {
      invoice: 'inv', shipping: 7,
      lines: [['t', 'tea', 40, 0.5], ['w', 'ware', 1, 9], ['c', null, 1, 5], ['x', 'other-shop-tea', 10, 1]],
    });
    await pay(db, 'inv', 20 + 9 + 5 + 10 + 7);
    await fill(db, 'inv');
    expect(kinds(db)).toEqual(['earned:t:2', 'pending:t:2']);
  });

  it('an order of only teaware and shipping earns zero', async () => {
    const db = seed();
    order(db, { invoice: 'inv', shipping: 5, lines: [['w', 'ware', 2, 9]] });
    await pay(db, 'inv', 23);
    await fill(db, 'inv');
    expect(kinds(db)).toEqual([]);
  });

  it('partly paid and Filled earns nothing until the balance is paid', async () => {
    const db = seed();
    order(db, { invoice: 'inv', shipping: 5 });
    await pay(db, 'inv', 25);
    await fill(db, 'inv');
    expect(kinds(db)).toEqual(['pending:inv-tea:2.5']);
  });

  it('a host never earns on their own order, and that is filed for the builder', async () => {
    const db = seed();
    order(db, { invoice: 'inv', customer: 'host-buyer' });
    await pay(db, 'inv', 25);
    await fill(db, 'inv');
    expect(kinds(db)).toEqual([]);
    expect(incidents(db)).toContain('host_credit_self_purchase');
  });

  it('a source with no host earns nothing', async () => {
    const db = seed();
    order(db, { invoice: 'inv', host: null });
    await pay(db, 'inv', 25);
    await fill(db, 'inv');
    expect(kinds(db)).toEqual([]);
  });

  it('an order with no source earns nothing', async () => {
    const db = seed();
    order(db, { invoice: 'inv', via: 'none' });
    db.sqlite.exec("DELETE FROM order_session_sources");
    await pay(db, 'inv', 25);
    await fill(db, 'inv');
    expect(kinds(db)).toEqual([]);
  });

  it('a request linked both ways is one source, and its order earns once', async () => {
    const db = seed();
    order(db, { invoice: 'inv', via: 'both' });
    db.sqlite.exec(`UPDATE invoices SET inventory_deducted = 1 WHERE id = 'inv'`);
    await pay(db, 'inv', 25);
    expect((await call(db, '/api/rpc/ship-invoice', { method: 'POST', body: { invoice_id: 'inv' } })).status).toBe(200);
    expect(kinds(db)).toEqual(['earned:inv-tea:2.5', 'pending:inv-tea:2.5']);
  });

  it('a website order split in two earns per line, once, on each invoice', async () => {
    const db = seed();
    order(db, { invoice: 'web-a', inquiry: 'inq-web', via: 'website', lines: [['a1', 'tea', 20, 0.5]] });
    order(db, { invoice: 'web-b', inquiry: 'inq-web', via: 'website', lines: [['b1', 'tea', 30, 0.5], ['b2', 'tea', 10, 1]] });
    db.sqlite.exec(`UPDATE invoices SET inventory_deducted = 1`);
    for (const [invoice, amount] of [['web-a', 10], ['web-b', 25]] as const) {
      await pay(db, invoice, amount);
      expect((await call(db, '/api/rpc/ship-invoice', { method: 'POST', body: { invoice_id: invoice } })).status).toBe(200);
      await call(db, '/api/rpc/ship-invoice', { method: 'POST', body: { invoice_id: invoice } });
    }
    expect(kinds(db).filter(k => k.startsWith('earned'))).toEqual(['earned:a1:1', 'earned:b1:1.5', 'earned:b2:1']);
  });

  it('a converted order split away from its request, and a rebooked replacement, lose the link and earn nothing', async () => {
    const db = seed();
    order(db, { invoice: 'orig' });
    // A converted bag split keeps only the original linked; a replacement after Void has no link.
    db.sqlite.exec(`INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_id, status, payment_status)
      VALUES ('split-off', '${SHOP}', 'TJ-S', 'Mei', 'guest', 'Pending', 'unpaid')`);
    db.sqlite.exec(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale)
      VALUES ('s1', '${SHOP}', 'split-off', 'tea', 20, 0.5)`);
    await pay(db, 'split-off', 10);
    await fill(db, 'split-off');
    expect(kinds(db, 'split-off')).toEqual([]);
  });

  it('reads the share when it is used: a new setting applies to the next award, and 0 is obeyed', async () => {
    const db = seed();
    expect((await call(db, `/api/accounts/${SHOP}`, { method: 'PUT', body: { host_credit_percent: 20 } })).status).toBe(200);
    order(db, { invoice: 'inv' });
    await pay(db, 'inv', 25);
    await fill(db, 'inv');
    expect(kinds(db)).toEqual(['earned:inv-tea:5', 'pending:inv-tea:5']);

    expect((await call(db, `/api/accounts/${SHOP}`, { method: 'PUT', body: { host_credit_percent: 0 } })).status).toBe(200);
    order(db, { invoice: 'inv2' });
    await pay(db, 'inv2', 25);
    await fill(db, 'inv2');
    expect(kinds(db, 'inv2')).toEqual([]);
    expect((await call(db, `/api/accounts/${SHOP}`, { method: 'PUT', body: { host_credit_percent: 101 } })).status).toBe(400);
  });

  it('there is no window: an order long after the session still earns', async () => {
    const db = seed();
    db.sqlite.exec(`UPDATE events SET event_date = '2020-01-01'`);
    order(db, { invoice: 'inv' });
    await pay(db, 'inv', 25);
    await fill(db, 'inv');
    expect(kinds(db)).toEqual(['earned:inv-tea:2.5', 'pending:inv-tea:2.5']);
  });

  it('above the ceiling an order stays pending until the owner approves it in Manage', async () => {
    const db = seed();
    order(db, { invoice: 'big', lines: [['big-tea', 'tea', 400, 0.5]] });
    await pay(db, 'big', 200);
    await fill(db, 'big');
    expect(kinds(db)).toEqual(['pending:big-tea:20']);
    expect((await call(db, '/api/host-credit/invoices/big/approve', { method: 'POST', as: 'staff' })).status).toBe(403);
    expect((await call(db, '/api/host-credit/invoices/big/approve', { method: 'POST', as: HOST, account: SHOP })).status).toBe(403);
    const approved = await call(db, '/api/host-credit/invoices/big/approve', { method: 'POST' });
    expect(approved.status, JSON.stringify(approved.data)).toBe(200);
    expect(entries(db).map(row => `${row.kind}:${row.created_by}`)).toEqual(['earned:adrian', 'pending:system']);
    expect((await call(db, '/api/host-credit/invoices/big/approve', { method: 'POST' })).data.idempotent).toBe(true);
    expect(kinds(db)).toEqual(['earned:big-tea:20', 'pending:big-tea:20']);
  });

  it('the owner cannot approve an order that is not Filled and paid', async () => {
    const db = seed();
    order(db, { invoice: 'big', lines: [['big-tea', 'tea', 400, 0.5]] });
    await settleHostCredit(env(db), 'big');
    expect((await call(db, '/api/host-credit/invoices/big/approve', { method: 'POST' })).status).toBe(409);
    expect(kinds(db)).toEqual(['pending:big-tea:20']);
  });
});

describe('tea credit for hosts: Void', () => {
  it('Void reverses once, and a second Void does nothing', async () => {
    // A paid order whose stock was taken cannot be made Void (the audit). One
    // marked paid by hand and Filled in Sales can, so that is the door here.
    const db = seed();
    order(db, { invoice: 'inv', paymentStatus: 'paid' });
    expect((await setStatus(db, 'inv', 'Filled')).status).toBe(200);
    expect((await setStatus(db, 'inv', 'Void')).status).toBe(200);
    expect(kinds(db)).toEqual(['earned:inv-tea:2.5', 'pending:inv-tea:2.5', 'reversed:inv-tea:2.5']);
    await setStatus(db, 'inv', 'Void');
    expect((await call(db, '/api/rpc/void-invoice', { method: 'POST', body: { invoice_id: 'inv' } })).status).toBe(400);
    await settleHostCredit(env(db), 'inv');
    await settleHostCredit(env(db, false), 'inv');
    expect(kinds(db)).toEqual(['earned:inv-tea:2.5', 'pending:inv-tea:2.5', 'reversed:inv-tea:2.5']);
    const mine = await call(db, '/api/me/tea-credit', { as: HOST });
    expect(mine.data.balances[0]).toMatchObject({ earned: 2.5, reversed: 2.5, available: 0, pending: 0 });
    expect(mine.data.lines.map((line: any) => line.status)).toEqual(['reversed']);
  });

  it('a pending order made Void never earns and leaves nothing to reverse', async () => {
    const db = seed();
    order(db, { invoice: 'inv' });
    await settleHostCredit(env(db), 'inv');
    expect((await call(db, '/api/rpc/void-invoice', { method: 'POST', body: { invoice_id: 'inv' } })).status).toBe(200);
    expect(kinds(db)).toEqual(['pending:inv-tea:2.5']);
    expect((await call(db, '/api/me/tea-credit', { as: HOST })).data.lines[0].status).toBe('void');
  });
});

describe('tea credit for hosts: who reads what', () => {
  it('a host reads only their own credit; a guest has none; the owner reads every host', async () => {
    const db = seed();
    order(db, { invoice: 'mine' });
    order(db, { invoice: 'theirs', host: 'host2' });
    for (const invoice of ['mine', 'theirs']) { await pay(db, invoice, 25); await fill(db, invoice); }

    const mine = await call(db, '/api/me/tea-credit', { as: HOST });
    expect(mine.status).toBe(200);
    expect(mine.data.balances).toEqual([expect.objectContaining({ account_id: SHOP, currency: 'USD', earned: 2.5, available: 2.5 })]);
    expect(mine.data.lines).toHaveLength(1);
    expect(JSON.stringify(mine.data)).not.toContain('host2');
    expect(JSON.stringify(mine.data)).not.toContain('Mei');

    const guest = await call(db, '/api/me/tea-credit', { as: 'staff' });
    expect(guest.data).toEqual({ balances: [], lines: [] });

    expect((await call(db, '/api/host-credit', { as: 'staff' })).status).toBe(403);
    expect((await call(db, '/api/host-credit', { as: HOST, account: SHOP })).status).toBe(403);
    const owner = await call(db, '/api/host-credit');
    expect(owner.status).toBe(200);
    expect(owner.data.hosts.map((h: any) => [h.host_user_id, h.available])).toEqual([[HOST, 2.5], ['host2', 2.5]]);
    expect(owner.data.lines).toHaveLength(2);
    expect(owner.data.terms).toEqual({ percent: 10, ceilingUsd: 10 });
  });

  it('the platform owner reads a shop; a platform admin does not', async () => {
    const db = seed();
    seedIdentity(db, { userId: 'po', accountId: 'po-home', platformRole: 'platform_owner' });
    seedIdentity(db, { userId: 'pa', accountId: 'pa-home', platformRole: 'platform_admin' });
    expect((await call(db, '/api/host-credit', { as: 'po', account: SHOP })).status).toBe(200);
    expect((await call(db, '/api/host-credit', { as: 'pa', account: SHOP })).status).toBe(403);
  });

  it('nothing about credit is taken from a request: forged figures are ignored, and only the owner sets the terms', async () => {
    const db = seed();
    order(db, { invoice: 'inv', paymentStatus: 'paid' });
    const forged = await call(db, '/api/invoices/inv', {
      method: 'PUT', body: { status: 'Filled', host_user_id: 'host2', host_credit_percent: 100, amount: 999, credit: 999 },
    });
    expect(forged.status).toBe(200);
    expect(entries(db).map(row => [row.kind, row.host_user_id, row.amount])).toEqual([['earned', HOST, 2.5], ['pending', HOST, 2.5]]);
    expect((await call(db, `/api/accounts/${SHOP}`, { method: 'PUT', as: 'staff', body: { host_credit_percent: 50 } })).status).toBe(403);
    expect((await call(db, `/api/accounts/${SHOP}`, { method: 'PUT', body: { host_credit_order_ceiling_usd: -1 } })).status).toBe(400);
    expect((await call(db, `/api/accounts/${SHOP}`, { method: 'PUT', body: { host_credit_order_ceiling_usd: 25 } })).status).toBe(200);
    expect((await call(db, '/api/host-credit')).data.terms).toEqual({ percent: 10, ceilingUsd: 25 });
  });

  it('flag off: every route is 404 and nothing is written', async () => {
    const db = seed();
    order(db, { invoice: 'inv' });
    await pay(db, 'inv', 25, { open: false });
    expect((await fill(db, 'inv', { open: false })).status).toBe(200);
    expect(kinds(db)).toEqual([]);
    expect((await call(db, '/api/me/tea-credit', { as: HOST, open: false })).status).toBe(404);
    expect((await call(db, '/api/host-credit', { open: false })).status).toBe(404);
    expect((await call(db, '/api/host-credit/invoices/inv/approve', { method: 'POST', open: false })).status).toBe(404);
    expect((await call(db, '/api/host-credit/spend-requests/x/approve', { method: 'POST', open: false })).status).toBe(404);
  });
});

describe('tea credit for hosts: spending waits for the owner', () => {
  async function withCredit(db: Db, credit: number) {
    // credit = 10 percent of the tea line; stays under the ceiling when it is at most 10.
    order(db, { invoice: `earn-${credit}`, lines: [[`earn-${credit}-tea`, 'tea', credit * 20, 0.5]] });
    await pay(db, `earn-${credit}`, credit * 10);
    expect((await fill(db, `earn-${credit}`)).status).toBe(200);
    if (!db.sqlite.prepare("SELECT 1 FROM invoices WHERE id = 'host-order'").get()) {
      order(db, { invoice: 'host-order', via: 'none', customer: 'host-buyer', lines: [['ho-tea', 'tea', 100, 1]] });
    }
  }

  it('a hold is refused beyond the balance, two holds cannot both take the same credit, and approval spends once', async () => {
    const db = seed();
    await withCredit(db, 8);
    const e = env(db);
    expect(await holdHostCreditSpend(e, { accountId: SHOP, hostUserId: HOST, invoiceId: 'host-order', amount: 9 })).toEqual({ error: 'not_covered' });
    const first = await holdHostCreditSpend(e, { accountId: SHOP, hostUserId: HOST, invoiceId: 'host-order', amount: 5 }) as { id: string };
    expect(first.id).toMatch(/^hcs_/);
    expect(await holdHostCreditSpend(e, { accountId: SHOP, hostUserId: HOST, invoiceId: 'host-order', amount: 5 })).toEqual({ error: 'not_covered' });
    expect((await call(db, '/api/me/tea-credit', { as: HOST })).data.balances[0]).toMatchObject({ earned: 8, held: 5, available: 3, spent: 0 });

    expect((await call(db, `/api/host-credit/spend-requests/${first.id}/approve`, { method: 'POST', as: 'staff' })).status).toBe(403);
    const approved = await call(db, `/api/host-credit/spend-requests/${first.id}/approve`, { method: 'POST' });
    expect(approved.status, JSON.stringify(approved.data)).toBe(200);
    expect((await call(db, `/api/host-credit/spend-requests/${first.id}/approve`, { method: 'POST' })).data.idempotent).toBe(true);
    expect(kinds(db).filter(k => k.startsWith('spent'))).toEqual(['spent:null:5']);
    expect((await call(db, '/api/me/tea-credit', { as: HOST })).data.balances[0]).toMatchObject({ earned: 8, held: 0, spent: 5, available: 3 });
  });

  it('approval is one guarded statement: it cannot take the balance below zero', async () => {
    const db = seed();
    await withCredit(db, 8);
    const e = env(db);
    const hold = await holdHostCreditSpend(e, { accountId: SHOP, hostUserId: HOST, invoiceId: 'host-order', amount: 6 }) as { id: string };
    // Something takes the credit away after the hold (a correction written by hand).
    db.sqlite.exec(`INSERT INTO host_credit_entries (id, account_id, host_user_id, kind, amount, currency, invoice_id, spend_request_id, created_by)
      VALUES ('other-spend', '${SHOP}', '${HOST}', 'spent', 4, 'USD', 'host-order', 'other', 'adrian')`);
    const refused = await call(db, `/api/host-credit/spend-requests/${hold.id}/approve`, { method: 'POST' });
    expect(refused.status).toBe(409);
    expect(refused.data.code ?? refused.data.error).toBeTruthy();
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM host_credit_entries WHERE spend_request_id = ?`).get(hold.id)).toEqual({ n: 0 });
  });

  it('above the ceiling the owner must say so, in words, before it is spent; declining releases the hold', async () => {
    const db = seed();
    await withCredit(db, 10);
    await withCredit(db, 9.5);
    const e = env(db);
    expect(kinds(db).filter(k => k.startsWith('earned'))).toEqual(['earned:earn-10-tea:10', 'earned:earn-9.5-tea:9.5']);
    const hold = await holdHostCreditSpend(e, { accountId: SHOP, hostUserId: HOST, invoiceId: 'host-order', amount: 15 }) as { id: string };
    const asked = await call(db, `/api/host-credit/spend-requests/${hold.id}/approve`, { method: 'POST' });
    expect(asked.status).toBe(409);
    expect(JSON.stringify(asked.data)).toContain('more than the shop');
    expect((await call(db, `/api/host-credit/spend-requests/${hold.id}/approve`, { method: 'POST', body: { confirm_over_ceiling: true } })).status).toBe(200);

    const second = await holdHostCreditSpend(e, { accountId: SHOP, hostUserId: HOST, invoiceId: 'host-order', amount: 2 }) as { id: string };
    expect((await call(db, `/api/host-credit/spend-requests/${second.id}/decline`, { method: 'POST' })).data.status).toBe('declined');
    expect((await call(db, `/api/host-credit/spend-requests/${second.id}/approve`, { method: 'POST' })).status).toBe(409);
    expect((await call(db, '/api/me/tea-credit', { as: HOST })).data.balances[0]).toMatchObject({ earned: 19.5, spent: 15, held: 0, available: 4.5 });
  });

  it('a hold is only for tea on an open order to this shop', async () => {
    const db = seed();
    await withCredit(db, 8);
    const e = env(db);
    order(db, { invoice: 'ware-order', via: 'none', customer: 'host-buyer', lines: [['wo', 'ware', 1, 30]] });
    expect(await holdHostCreditSpend(e, { accountId: SHOP, hostUserId: HOST, invoiceId: 'ware-order', amount: 2 })).toEqual({ error: 'not_covered' });
    expect(await holdHostCreditSpend(env(db, false), { accountId: SHOP, hostUserId: HOST, invoiceId: 'host-order', amount: 2 })).toEqual({ error: 'closed' });
    expect(await approveHostCreditSpend(e, { accountId: SHOP, requestId: 'nope', approverUserId: OWNER, confirmOverCeiling: false }))
      .toMatchObject({ ok: false, error: 'not_found' });
  });

  it('credit earned and asked for the same day is filed for the builder', async () => {
    const db = seed();
    await withCredit(db, 8);
    await holdHostCreditSpend(env(db), { accountId: SHOP, hostUserId: HOST, invoiceId: 'host-order', amount: 1 });
    expect(incidents(db)).toContain('host_credit_earned_and_requested_same_day');
  });
});

describe('tea credit for hosts: oddities go to the builder', () => {
  it('files an award without a source, a reversal without an award and a balance below zero', async () => {
    const db = seed();
    expect(await checkHostCreditIntegrity(db as any, SHOP)).toEqual([]);
    db.sqlite.exec(`
      INSERT INTO host_credit_entries (id, account_id, host_user_id, kind, amount, currency, source_inquiry_id, event_id,
        invoice_id, invoice_line_id, basis_amount, basis_currency, created_by)
        VALUES ('ghost', '${SHOP}', '${HOST}', 'pending', 3, 'USD', 'no-such-request', 'event', 'x', 'x1', 30, 'USD', 'system');
      INSERT INTO host_credit_entries (id, account_id, host_user_id, kind, amount, currency, invoice_id, invoice_line_id, reverses_entry_id, reason, created_by)
        VALUES ('orphan-reversal', '${SHOP}', '${HOST}', 'reversed', 3, 'USD', 'x', 'x2', 'ghost', 'void', 'system');
    `);
    const found = await checkHostCreditIntegrity(db as any, SHOP);
    expect(found).toEqual(['award_without_source', 'reversal_without_award', 'balance_below_zero']);
    const text = incidents(db);
    for (const name of found) expect(text).toContain(`host_credit_${name}`);
  });

  it('the ledger refuses a second award for one line and an amount without a currency', async () => {
    const db = seed();
    order(db, { invoice: 'inv' });
    await settleHostCredit(env(db), 'inv');
    expect(() => db.sqlite.exec(`INSERT INTO host_credit_entries (id, account_id, host_user_id, kind, amount, currency, source_inquiry_id, event_id,
      invoice_id, invoice_line_id, basis_amount, basis_currency, created_by)
      VALUES ('dup', '${SHOP}', '${HOST}', 'pending', 2.5, 'USD', 'inq-inv', 'event', 'inv', 'inv-tea', 25, 'USD', 'system')`)).toThrow(/UNIQUE/);
    expect(() => db.sqlite.exec(`INSERT INTO host_credit_entries (id, account_id, host_user_id, kind, amount, currency, created_by)
      VALUES ('nounit', '${SHOP}', '${HOST}', 'spent', 2.5, 'UNK', 'system')`)).toThrow(/CHECK/);
  });
});
