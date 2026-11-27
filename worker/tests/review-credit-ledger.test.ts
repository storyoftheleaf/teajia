import { afterEach, beforeEach, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

let db: SqliteD1;
const secret = 'a8-local-review';
const tokens = new Map<string, string>();

beforeEach(async () => {
  db = new SqliteD1('migrations');
  for (const [userId, accountId] of [['owner', 'shop'], ['host', 'home'], ['guest', 'guest-home'], ['seller', 'shop']]) {
    seedIdentity(db, { userId, accountId, role: userId === 'seller' ? 'staff' : 'owner', bundles: ['sell'] });
    tokens.set(userId, await signedToken(secret, { sub: userId, active_account_id: accountId, email: userId + '@example.test' }));
  }
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg=0, default_shipping_rate_currency='USD' WHERE id='shop';
    INSERT INTO products (id,account_id,type,product_name,cost_amount,cost_currency,form,quantity_purchased,stock_grams)
      VALUES ('tea','shop','Oolong','Tea',20,'USD','Loose',300,1000);
    INSERT INTO customers (id,account_id,name,user_id) VALUES ('buyer','shop','Host','host'),('other','shop','Guest','guest');
    INSERT INTO events (id,account_id,slug,title,event_date) VALUES ('sit','shop','sit','Tea','2020-01-01');
  `);
  order('sale', true);
  order('redeem');
  order('other-order');
});
afterEach(() => db.close());

function order(id: string, referral = false) {
  db.sqlite.prepare(`INSERT INTO invoices (id,account_id,invoice_number,customer_name,customer_id,status,payment_status)
    VALUES (?,'shop',?,'Buyer',?,'Pending',?)`).run(id, id, referral ? 'other' : 'buyer', referral ? 'paid' : 'unpaid');
  db.sqlite.prepare(`INSERT INTO invoice_line_items (id,account_id,invoice_id,product_id,quantity,price_at_sale)
    VALUES (?,'shop',?,'tea',1,?)`).run('line-' + id, id, referral ? 100 : 10);
  if (referral) {
    db.sqlite.prepare(`INSERT INTO inquiries (id,account_id,name,email,items,converted_invoice_id)
      VALUES (?,'shop','Guest','test@example.test','[]',?)`).run('q-' + id, id);
    db.sqlite.prepare(`INSERT INTO order_session_sources (inquiry_id,account_id,event_id,host_user_id)
      VALUES (?,'shop','sit','host')`).run('q-' + id);
  }
}

function bindings(open = true) {
  return {
    DB: db as unknown as D1Database, JWT_SECRET: secret, HOST_CREDIT_OPEN: String(open),
    INQUIRY_LIMITER: { limit: async () => ({ success: true }) }
  };
}

type Options = { as?: string; open?: boolean; key?: string; body?: unknown };
async function call(method: string, path: string, options: Options = {}) {
  const user = options.as ?? 'owner';
  const headers = new Headers({
    Authorization: 'Bearer ' + tokens.get(user), 'Content-Type': 'application/json',
    'X-Teajia-Account': user === 'host' ? 'home' : 'shop'
  });
  if (options.key) headers.set('Idempotency-Key', options.key);
  const tasks: Promise<unknown>[] = [];
  const response = await worker.fetch(new Request('https://local.test/api/' + path, {
    method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), bindings(options.open) as never, { waitUntil: (task: Promise<unknown>) => tasks.push(task) } as never);
  await Promise.all(tasks);
  return { status: response.status, data: await response.json() as any };
}

const update = (id: string, body: object, options?: Options) => call('PUT', 'invoices/' + id, { ...options, body });
const edit = (id: string, price: number) => call('PUT', 'invoices/' + id + '/items', {
  body: { lineItems: [{ product_id: 'tea', quantity: 1, price_at_sale: price }] },
});
const fill = (id = 'sale', options?: Options) => update(id, { status: 'Filled' }, options);
const voidOrder = (id: string, options?: Options) => update(id, { status: 'Void' }, options);
const ask = (id = 'redeem', options?: Options) => call('POST', 'me/tea-credit/orders/' + id + '/use', { as: 'host', ...options });
const decide = (id: string, action = 'approve', options?: Options) => call('POST', 'host-credit/spend-requests/' + id + '/' + action, options);
const rows = (sql: string) => db.sqlite.prepare(sql).all();
const ledger = () => rows('SELECT * FROM host_credit_entries ORDER BY rowid');
const requests = () => rows('SELECT * FROM host_credit_spend_requests ORDER BY rowid');
async function mine() {
  const result = await call('GET', 'me/tea-credit', { as: 'host' });
  expect(result.status).toBe(200);
  return result.data;
}
async function held() {
  expect((await fill()).status).toBe(200);
  const result = await ask('redeem', { body: { amount: 900 } });
  expect(result.status).toBe(201);
  expect(result.data.request.amount).toBe(10);
  return String(requests()[0].id);
}

it('Fill, Pending, Fill leaves the original award untouched', async () => {
  expect((await fill()).status).toBe(200);
  const original = ledger();
  expect(original.map(r => [r.kind, r.amount])).toEqual([['pending', 10], ['earned', 10]]);
  expect((await update('sale', { status: 'Pending' })).status).toBe(200);
  expect((await fill()).status).toBe(200);
  expect(ledger()).toEqual(original);
});

it('Fill then Void reverses exactly the award, including on retry', async () => {
  expect((await fill()).status).toBe(200);
  expect((await voidOrder('sale')).status).toBe(200);
  expect((await voidOrder('sale')).status).toBe(200);
  const [pending, earned, reversed] = ledger();
  expect(ledger()).toHaveLength(3);
  expect(pending.kind).toBe('pending');
  expect(reversed).toMatchObject({ kind: 'reversed', amount: earned.amount, reverses_entry_id: earned.id });
  expect((await mine()).balances[0].available).toBe(0);
});

it('a Filled order refuses replacement lines and a new price', async () => {
  expect((await fill()).status).toBe(200);
  const original = ledger();
  expect((await edit('sale', 150)).status).toBe(400);
  expect(ledger()).toEqual(original);
});

it('reopening, correcting and refilling one sale cannot earn it twice', async () => {
  expect((await fill()).status).toBe(200);
  expect((await update('sale', { status: 'Pending', payment_status: 'unpaid' })).status).toBe(200);
  const replacement = await edit('sale', 100);
  expect(replacement.status, JSON.stringify(replacement.data)).toBe(200);
  expect((await update('sale', { status: 'Filled', payment_status: 'paid' })).status).toBe(200);
  expect((await mine()).balances[0].earned).toBe(10);
});

it('reopened with new lines, two Fills at once still award the sale once', async () => {
  expect((await fill()).status).toBe(200);
  expect((await update('sale', { status: 'Pending', payment_status: 'unpaid' })).status).toBe(200);
  expect((await edit('sale', 100)).status).toBe(200);
  await Promise.all([update('sale', { status: 'Filled', payment_status: 'paid' }), update('sale', { status: 'Filled', payment_status: 'paid' })]);
  expect(ledger().filter(r => r.kind === 'earned').map(r => r.amount)).toEqual([10]);
  expect((await mine()).balances[0]).toMatchObject({ earned: 10, pending: 0 });
});

it('two simultaneous Fill requests award one sale once', async () => {
  const replies = await Promise.all([fill(), fill()]);
  expect(replies.some(r => r.status === 200)).toBe(true);
  expect(replies.every(r => [200, 409].includes(r.status))).toBe(true);
  expect(ledger().filter(r => r.kind === 'earned').map(r => r.amount)).toEqual([10]);
});

it('two orders competing for the same balance can reserve it only once', async () => {
  expect((await fill()).status).toBe(200);
  const replies = await Promise.all([ask(), ask('other-order')]);
  expect(replies.map(r => r.status).sort()).toEqual([201, 409]);
  expect(requests().map(r => r.amount)).toEqual([10]);
  expect((await mine()).balances[0]).toMatchObject({ held: 10, spent: 0, available: 0 });
});

it('two approvals apply a spend only once', async () => {
  const id = await held();
  expect((await Promise.all([decide(id), decide(id)])).map(r => r.status)).toEqual([200, 200]);
  expect(ledger().filter(r => r.kind === 'spent').map(r => r.spend_request_id)).toEqual([id]);
});
it('approval and decline overlap with one consistent decision', async () => {
  const id = await held();
  const replies = await Promise.all([decide(id), decide(id, 'decline')]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 409]);
  const approved = requests()[0].status === 'approved';
  expect(replies[0].status === 200).toBe(approved);
  expect(ledger().filter(r => r.kind === 'spent')).toHaveLength(approved ? 1 : 0);
});

it('approving tea credit reduces the amount due for the tea', async () => {
  const id = await held();
  expect((await decide(id)).status).toBe(200);
  const order = await call('GET', 'me/orders/redeem', { as: 'host' });
  expect(order.status).toBe(200);
  expect(order.data.payment.outstanding_usd).toBe(0);
  // Credit stays apart from cash, and the order's own status says settled.
  expect(order.data.payment).toMatchObject({ paid_usd: 0, credit_usd: 10 });
  expect(rows("SELECT payment_status FROM invoices WHERE id='redeem'")).toEqual([{ payment_status: 'paid' }]);
  expect(rows("SELECT COUNT(*) AS n FROM invoice_payments WHERE invoice_id='redeem'")).toEqual([{ n: 0 }]);
});

it('credit on part of an order leaves the rest owing, in cash', async () => {
  db.sqlite.exec("UPDATE invoices SET shipping_cost_usd=5 WHERE id='redeem'");
  const id = await held();
  expect((await decide(id)).status).toBe(200);
  const order = await call('GET', 'me/orders/redeem', { as: 'host' });
  expect(order.data.payment).toMatchObject({ total_usd: 15, paid_usd: 0, credit_usd: 10, outstanding_usd: 5 });
  expect(rows("SELECT payment_status FROM invoices WHERE id='redeem'")).toEqual([{ payment_status: 'partial' }]);
});

it('approval checks the tea still on an edited redemption order', async () => {
  const id = await held();
  const result = await edit('redeem', 1);
  expect(result.status, JSON.stringify(result.data)).toBe(200);
  const refused = await decide(id);
  expect(refused).toMatchObject({ status: 409, data: { code: 'host_credit_order_changed' } });
  expect((await mine()).balances[0].spent).toBeLessThanOrEqual(1);
  // The stale hold is released with its history kept, and the host can ask for what the order now holds.
  expect(requests()[0]).toMatchObject({ status: 'declined', decided_by_user_id: 'system', release_reason: 'order_changed' });
  expect((await mine()).balances[0]).toMatchObject({ held: 0, available: 10 });
  const again = await ask();
  expect(again.status).toBe(201);
  expect(again.data.request.amount).toBe(1);
  expect((await decide(String(again.data.request.id))).status).toBe(200);
  expect((await mine()).balances[0]).toMatchObject({ spent: 1, available: 9 });
});

it('approval checks the buyer is still the host', async () => {
  const id = await held();
  db.sqlite.exec("UPDATE invoices SET customer_id='other' WHERE id='redeem'");
  expect((await decide(id)).status).toBe(409);
  expect(ledger().filter(r => r.kind === 'spent')).toEqual([]);
});

it('approval checks what is still owed, not only the tea', async () => {
  const id = await held();
  db.sqlite.exec(`INSERT INTO invoice_payments (id,invoice_id,account_id,amount_usd,currency,status,claimed_by,claimed_at,confirmed_at)
    VALUES ('cash','redeem','shop',6,'USD','confirmed','operator',datetime('now'),datetime('now'))`);
  expect((await decide(id)).status).toBe(409);
  expect(ledger().filter(r => r.kind === 'spent')).toEqual([]);
  const again = await ask();
  expect(again.data.request.amount).toBe(4);
});

it('voiding an order releases its unapproved hold', async () => {
  const id = await held();
  expect((await voidOrder('redeem')).status).toBe(200);
  expect((await decide(id)).status).toBe(409);
  expect((await mine()).balances[0]).toMatchObject({ held: 0, spent: 0, available: 10 });
  expect(requests()[0]).toMatchObject({ status: 'declined', decided_by_user_id: 'system', release_reason: 'order_void' });
});

it('a hold left on a voided order before the fix is released when credit is next read', async () => {
  expect((await fill()).status).toBe(200);
  // The old shape: a held request on an order already Void, written as the old code left it.
  db.sqlite.exec(`UPDATE invoices SET status='Void' WHERE id='redeem';
    INSERT INTO host_credit_spend_requests (id,account_id,host_user_id,invoice_id,amount,currency,status)
      VALUES ('old-hold','shop','host','redeem',10,'USD','held')`);
  expect((await mine()).balances[0]).toMatchObject({ held: 0, available: 10 });
  expect(requests()[0]).toMatchObject({ id: 'old-hold', status: 'declined', release_reason: 'order_void' });
  expect((await ask('other-order')).status).toBe(201);
});

it('Void of the redemption order currently leaves approved credit spent', async () => {
  const id = await held();
  expect((await decide(id)).status).toBe(200);
  expect((await voidOrder('redeem')).status).toBe(200);
  expect((await mine()).balances[0]).toMatchObject({ available: 0, spent: 10, debt: 0 });
});

it('Void of an already spent earning leaves a nonnegative signed ledger', async () => {
  const id = await held();
  expect((await decide(id)).status).toBe(200);
  expect((await voidOrder('sale')).status).toBe(200);
  const balance = (await mine()).balances[0];
  expect(balance.earned - balance.reversed - balance.spent).toBeGreaterThanOrEqual(0);
});

it('a linked self-order earns nothing', async () => {
  expect((await update('sale', { customer_id: 'buyer', status: 'Filled' })).status).toBe(200);
  expect(ledger()).toEqual([]);
});
it('a guest who hosts elsewhere earns only for the referring host', async () => {
  db.sqlite.exec("INSERT INTO events (id,account_id,slug,title,event_date) VALUES ('elsewhere','guest-home','more','Tea','2020-01-01')");
  db.sqlite.exec("INSERT INTO contributors (id,account_id,display_name,user_id,is_published) VALUES ('pourer','guest-home','Guest','guest',1)");
  db.sqlite.exec("INSERT INTO contributor_accounts (contributor_id,account_id) VALUES ('pourer','guest-home')");
  db.sqlite.exec("INSERT INTO event_contributors (id,account_id,event_id,contributor_id,role,is_public) VALUES ('lead','guest-home','elsewhere','pourer','lead_host',1)");
  expect((await fill()).status).toBe(200);
  expect(ledger().filter(r => r.kind === 'earned').map(r => r.host_user_id)).toEqual(['host']);
});

it('an order displayed in Yuan earns on its frozen USD line', async () => {
  db.sqlite.exec("INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('Yuan',0.14)");
  expect((await update('sale', { display_currency: 'Yuan', status: 'Filled' })).status).toBe(200);
  expect(ledger()[1]).toMatchObject({ kind: 'earned', basis_currency: 'USD', basis_amount: 100, amount: 10 });
});
it('a missing catalogue rate cannot become a USD line or earn credit', async () => {
  db.sqlite.exec("UPDATE products SET cost_currency='Yuan'; DELETE FROM exchange_rates WHERE currency IN ('CNY','Yuan')");
  const result = await call('POST', 'inquiries', {
    body: {
      source: 'website', store_slug: 'shop', tracking_token: 'reviewcreditmissingrate0000000000000001', ref_number: 'A8', total_estimate_usd: 1000,
      customer_name: 'Guest', customer_contact: 'guest@example.test', customer_location: 'Ubud, Indonesia', currency: 'Yuan',
      items: [{ id: 'tea', name: 'Tea', category: 'tea', storeSlug: 'shop', quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 20, totalPrice: 1000 }],
    }
  });
  expect(result).toMatchObject({ status: 400, data: { error: 'Product price is unavailable' } });
  expect(rows('SELECT id FROM invoices')).toHaveLength(3);
  expect(ledger()).toEqual([]);
});

it('closing the switch freezes the hold and reopening permits one approval', async () => {
  const id = await held();
  expect((await decide(id, 'approve', { open: false })).status).toBe(404);
  expect((await decide(id, 'decline', { open: false })).status).toBe(404);
  expect(requests()[0].status).toBe('held');
  expect((await decide(id)).status).toBe(200);
  expect((await mine()).balances[0]).toMatchObject({ held: 0, spent: 10 });
});

it('a sale Filled while closed never earns, even reopened and Filled again while open', async () => {
  expect((await fill('sale', { open: false })).status).toBe(200);
  expect(rows("SELECT credit_open FROM host_credit_fills WHERE invoice_id='sale'")).toEqual([{ credit_open: 0 }]);
  expect((await update('sale', { status: 'Pending' })).status).toBe(200);
  expect((await fill()).status).toBe(200);
  expect(ledger()).toEqual([]);
});

it('a sale Filled before the record began does not earn on a later edit', async () => {
  // The old shape: Filled with no first-Fill row, as every order Filled before 0148 is.
  db.sqlite.exec("UPDATE invoices SET status='Filled' WHERE id='sale'; DELETE FROM host_credit_fills");
  expect((await update('sale', { notes: 'Packed' })).status).toBe(200);
  expect(ledger()).toEqual([]);
});

it('a sale Filled before the record began, already held as pending, still earns once paid', async () => {
  // The old shape where credit was open: pending at Fill, unpaid, no first-Fill row.
  db.sqlite.exec(`UPDATE invoices SET status='Filled', payment_status='unpaid' WHERE id='sale'; DELETE FROM host_credit_fills;
    INSERT INTO host_credit_entries (id,account_id,host_user_id,kind,amount,currency,source_inquiry_id,event_id,invoice_id,
      invoice_line_id,product_id,basis_amount,basis_currency,created_by)
    VALUES ('old-pending','shop','host','pending',10,'USD','q-sale','sit','sale','line-sale','tea',100,'USD','system')`);
  expect((await update('sale', { payment_status: 'paid' })).status).toBe(200);
  expect(ledger().filter(r => r.kind === 'earned').map(r => r.amount)).toEqual([10]);
});

it('identical sales Filled while closed have equal credit after reopening', async () => {
  order('twin', true);
  for (const id of ['sale', 'twin']) expect((await fill(id, { open: false })).status).toBe(200);
  expect(ledger()).toEqual([]);
  expect((await mine()).balances).toEqual([]);
  expect((await update('twin', { notes: 'Packed' })).status).toBe(200);
  const amount = (id: string) => ledger().filter(r => r.invoice_id === id && r.kind === 'earned').reduce((n, r) => n + Number(r.amount), 0);
  expect(amount('twin')).toBe(amount('sale'));
});

it('a Void while closed cannot leave the cancelled award spendable on reopening', async () => {
  expect((await fill()).status).toBe(200);
  expect((await voidOrder('sale', { open: false })).status).toBe(200);
  expect(ledger().map(r => r.kind)).toEqual(['pending', 'earned', 'reversed']);
  expect((await ask()).status).toBe(409);
});

it('a Void while closed releases a hold on that order', async () => {
  const id = await held();
  expect((await voidOrder('redeem', { open: false })).status).toBe(200);
  expect(requests()[0]).toMatchObject({ id, status: 'declined', release_reason: 'order_void' });
});

it('an award left unreversed on a Void order before the fix cannot be spent', async () => {
  expect((await fill()).status).toBe(200);
  // The old shape: Void with no reversal, as the closed early return left it.
  db.sqlite.exec("UPDATE invoices SET status='Void' WHERE id='sale'");
  expect(ledger().map(r => r.kind)).toEqual(['pending', 'earned']);
  expect((await ask()).status).toBe(409);
  expect(ledger().map(r => r.kind)).toEqual(['pending', 'earned', 'reversed']);
  expect((await mine()).balances[0]).toMatchObject({ available: 0, debt: 0 });
});

it('stopping a host today preserves their balance and permits later referral earnings and spending', async () => {
  expect((await fill()).status).toBe(200);
  db.sqlite.exec("UPDATE users SET hosting_stopped_at=datetime('now'),hosting_stopped_by='owner' WHERE id='host'");
  order('later', true);
  expect((await fill('later')).status).toBe(200);
  expect((await mine()).balances[0].available).toBe(20);
  expect((await ask()).status).toBe(201);
});

it('replaying a use request without a key while held cannot reserve twice', async () => {
  expect((await fill()).status).toBe(200);
  expect((await ask('redeem')).status).toBe(201);
  expect((await ask('redeem')).status).toBe(409);
  expect(requests()).toHaveLength(1);
});

// A8-8 fixed: a keyed replay returns the request the key first made (200), never a second hold.
it('replaying a use request with a key while held returns the original request', async () => {
  expect((await fill()).status).toBe(200);
  const first = await ask('redeem', { key: 'review-ask-once' });
  expect(first.status).toBe(201);
  const again = await ask('redeem', { key: 'review-ask-once' });
  expect(again.status).toBe(200);
  expect(again.data).toMatchObject({ replayed: true, request: { id: first.data.request.id, amount: 10, status: 'held' } });
  expect(requests()).toHaveLength(1);
});

it('two keyed replays at once make one request', async () => {
  expect((await fill()).status).toBe(200);
  const replies = await Promise.all([ask('redeem', { key: 'twice' }), ask('redeem', { key: 'twice' })]);
  expect(replies.map(r => r.status).sort()).toEqual([200, 201]);
  expect(new Set(replies.map(r => r.data.request.id)).size).toBe(1);
  expect(requests()).toHaveLength(1);
});

it('a delayed keyed retry cannot reopen a declined spend', async () => {
  expect((await fill()).status).toBe(200);
  const options = { key: 'ask-1' };
  expect((await ask('redeem', options)).status).toBe(201);
  expect((await decide(String(requests()[0].id), 'decline')).status).toBe(200);
  const replay = await ask('redeem', options);
  expect(replay).toMatchObject({ status: 200, data: { replayed: true, request: { status: 'declined' } } });
  expect(requests().map(r => r.status)).toEqual(['declined']);
  // A deliberate new request carries its own key and is a new request.
  expect((await ask('redeem', { key: 'ask-2' })).status).toBe(201);
  expect(requests().map(r => r.status)).toEqual(['declined', 'held']);
});

it('an approved shop seller cannot award credit without the owner marking Filled', async () => {
  const result = await fill('sale', { as: 'seller' });
  expect([200, 403]).toContain(result.status);
  expect(ledger().filter(r => r.kind === 'earned')).toHaveLength(0);
});
it('an unpaid Fill and a paid sale without attribution cannot earn', async () => {
  expect((await update('sale', { status: 'Filled', payment_status: 'unpaid' })).status).toBe(200);
  expect((await update('other-order', { status: 'Filled', payment_status: 'paid' })).status).toBe(200);
  expect(ledger().map(r => r.kind)).toEqual(['pending']);
});
it('an unapproved request never spends and only the owner may decide it', async () => {
  const id = await held();
  expect((await decide(id, 'approve', { as: 'seller' })).status).toBe(403);
  expect(requests()[0].status).toBe('held');
  expect(ledger().filter(r => r.kind === 'spent')).toEqual([]);
});
it('years-old unspent credit remains available at its original amount', async () => {
  // Restore a historical award without changing the clock or updating an immutable row.
  db.sqlite.exec("UPDATE invoices SET status='Filled' WHERE id='sale'");
  for (const kind of ['pending', 'earned']) {
    db.sqlite.prepare(`INSERT INTO host_credit_entries
      (id,account_id,host_user_id,kind,amount,currency,source_inquiry_id,event_id,invoice_id,
       invoice_line_id,product_id,basis_amount,basis_currency,created_by,created_at)
      VALUES (?,'shop','host',?,10,'USD','q-sale','sit','sale','line-sale','tea',100,'USD','system','2020-01-01')`)
      .run(kind, kind);
  }
  expect((await mine()).balances[0].available).toBe(10);
  expect((await ask()).status).toBe(201);
  expect(requests()[0].amount).toBe(10);
});
it('a zero share earns zero and posted entries resist updates and deletes', async () => {
  db.sqlite.exec("UPDATE accounts SET host_credit_percent=0 WHERE id='shop'");
  expect((await fill()).status).toBe(200);
  expect(ledger()).toEqual([]);
  db.sqlite.exec("UPDATE accounts SET host_credit_percent=10 WHERE id='shop'");
  order('next', true);
  expect((await fill('next')).status).toBe(200);
  expect(ledger()).toHaveLength(2);
  expect(() => db.sqlite.exec('UPDATE host_credit_entries SET amount=1')).toThrow(/append-only/);
  expect(() => db.sqlite.exec('DELETE FROM host_credit_entries')).toThrow(/append-only/);
});

it('checks every step of 320 seeded schedules across three orders', async () => {
  const seed = Number(process.env.A8_SEED ?? 812345);
  let state = seed >>> 0;
  function pick(limit: number) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor(state / 4294967296 * limit);
  }
  let firstFailure = '';
  // The normal D1 adapter opens a top-level transaction for each batch. A nested
  // SQLite savepoint gives it the same atomic commit/rollback inside our replay.
  db.batch = statements => {
    db.sqlite.exec('SAVEPOINT worker_batch');
    try {
      const results = statements.map(statement => statement.run());
      db.sqlite.exec('RELEASE worker_batch');
      return results;
    } catch (error) {
      db.sqlite.exec('ROLLBACK TO worker_batch; RELEASE worker_batch');
      throw error;
    }
  };
  const operations = ['fill', 'void', 'edit', 'ask', 'approve', 'decline'] as const;
  for (let trial = 0; trial < 320; trial++) {
    db.sqlite.exec('SAVEPOINT scenario');
    const trace: string[] = [];
    // Start from an earned sale so even very short schedules can actually spend.
    expect((await fill()).status).toBe(200);
    for (let step = 0; step < 8; step++) {
      const action = operations[pick(operations.length)];
      const id = action === 'ask' ? ['redeem', 'other-order'][pick(2)] : ['sale', 'redeem', 'other-order'][pick(3)];
      const prior = ledger();
      const allRequests = requests();
      const request = allRequests.length ? String(allRequests[pick(allRequests.length)].id) : 'missing';
      let result;
      switch (action) {
        case 'fill': result = await fill(id); break;
        case 'void': result = await voidOrder(id); break;
        case 'edit': result = await edit(id, 1 + pick(20)); break;
        case 'ask': result = await ask(id); break;
        default: result = await decide(request, action);
      }
      trace.push(action + ' ' + (['approve', 'decline'].includes(action) ? 'request' : id) + ' ' + result.status);
      try {
        expect([200, 201, 400, 404, 409]).toContain(result.status);
        const entries = ledger();
        expect(entries.slice(0, prior.length)).toEqual(prior);
        const awards = entries.filter(r => r.kind === 'earned');
        expect(awards.map(r => [r.invoice_id, r.amount])).toEqual([['sale', 10]]);
        const asks = requests();
        const approved = asks.filter(r => r.status === 'approved').map(r => [r.id, r.amount]);
        const spent = entries.filter(r => r.kind === 'spent').map(r => [r.spend_request_id, r.amount]);
        expect(spent.sort()).toEqual(approved.sort());
        const total = (kind: string) => entries.filter(r => r.kind === kind).reduce((n, r) => n + Number(r.amount), 0);
        const reserved = asks.filter(r => r.status === 'held').reduce((n, r) => n + Number(r.amount), 0);
        const net = total('earned') - total('spent') - total('reversed');
        const balance = (await mine()).balances[0];
        expect(balance).toMatchObject({
          earned: total('earned'), spent: total('spent'), reversed: total('reversed'),
          held: reserved, debt: Math.max(0, -net), available: Math.max(0, net - reserved)
        });
        expect(net).toBeGreaterThanOrEqual(0);
      } catch (error) {
        if (!firstFailure) firstFailure = 'seed=' + seed + ' schedule=' + trial + ' steps=' + trace.join(', ') + '\n' + String(error);
      }
    }
    db.sqlite.exec('ROLLBACK TO scenario; RELEASE scenario');
  }
  expect(firstFailure, firstFailure).toBe('');
}, 120000);
