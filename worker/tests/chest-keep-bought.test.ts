import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { boughtLineChestState, boughtLineQuantityUnit, keepBoughtLine, type BoughtOrder } from '../src/chestKeep';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

let db: SqliteD1;
const secret = 'chest-keep-bought-test';
const database = () => db as unknown as D1Database;
const count = () => (db.sqlite.prepare('SELECT COUNT(*) AS n FROM personal_cellar_items').get() as { n: number }).n;
function order(): BoughtOrder {
  return {
    userId: 'buyer', linkedToUser: true,
    invoice: db.sqlite.prepare("SELECT * FROM invoices WHERE id='owned'").get()!,
    lines: db.sqlite.prepare(`SELECT li.*, p.product_name, p.type, p.piece_weight_g, p.year, p.origin_country, p.origin_region
      FROM invoice_line_items li LEFT JOIN products p ON p.id=li.product_id AND p.account_id=li.account_id
      WHERE li.invoice_id='owned'`).all(),
    payment: { total_usd: 8, paid_usd: 8, outstanding_usd: 0, claims_pending: 0 },
  };
}
async function request(id = 'owned', user = 'buyer', method = 'POST', enabled = true, lineId = 'line') {
  const token = await signedToken(secret, { sub: user, email: `${user}@test.dev`, name: user, active_account_id: `${user}-home` });
  return worker.fetch(new Request(`https://app.test/api/me/orders/${id}${method === 'POST' ? '/keep-in-chest' : ''}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify({ lineId }) } : {}),
  }), { DB: db, JWT_SECRET: secret, FIRST_TABLE_OPEN: enabled ? 'true' : 'false' } as never, {} as never);
}

beforeEach(() => {
  db = new SqliteD1();
  seedIdentity(db, { userId: 'buyer', accountId: 'buyer-home' });
  seedIdentity(db, { userId: 'seller', accountId: 'shop' });
  seedIdentity(db, { userId: 'other', accountId: 'other-home' });
  db.exec(`
    INSERT INTO customers(id,account_id,name,user_id,email) VALUES('customer','shop','Buyer','buyer','buyer@test.dev');
    INSERT INTO products(id,account_id,type,product_name,cost_amount,cost_currency,quantity_purchased,stock_grams,year,origin_country,origin_region)
      VALUES('tea','shop','Oolong','Mountain tea',4,'USD',100,100,2024,'China','Fujian');
    INSERT INTO invoices(id,account_id,invoice_number,customer_id,status,payment_status,display_currency,shipping_cost_usd)
      VALUES('owned','shop','S-1','customer','Filled','unpaid','USD',0);
    INSERT INTO invoice_line_items(id,account_id,invoice_id,product_id,quantity,price_at_sale,quantity_unit)
      VALUES('line','shop','owned','tea',2,4,'g');
    INSERT INTO invoice_payments(id,invoice_id,account_id,amount_usd,status,claimed_by)
      VALUES('payment','owned','shop',8,'confirmed','operator');
  `);
});
afterEach(() => db.close());

describe('a buyer keeps one paid tea line by their own tap', () => {
  // Case 1: the database uniqueness constraint arbitrates races, and retry reads the winner.
  it('returns the same row to simultaneous taps and a timeout retry', async () => {
    const input = order();
    expect((await boughtLineChestState(database(), input)).get('line')).toEqual({ chest_item_id: null, can_keep: true });
    expect(count()).toBe(0);
    const [first, second] = await Promise.all([keepBoughtLine(database(), input, 'line'), keepBoughtLine(database(), input, 'line')]);
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(await keepBoughtLine(database(), input, 'line')).toEqual(first);
    expect(count()).toBe(1);
    expect((await boughtLineChestState(database(), input)).get('line')).toEqual({ chest_item_id: first!.id, can_keep: false });
  });

  // Case 2: email/phone match only within proven membership, but neither explicitly links this purchase to this person.
  it.each(['email', 'phone'])('shows a legacy %s order but refuses to copy its books into the chest', async match => {
    db.exec(`UPDATE invoices SET account_id='buyer-home', customer_id=NULL, customer_whatsapp=NULL WHERE id='owned';
      UPDATE invoice_line_items SET account_id='buyer-home' WHERE id='line';
      UPDATE products SET account_id='buyer-home' WHERE id='tea';
      UPDATE invoice_payments SET account_id='buyer-home' WHERE id='payment';`);
    if (match === 'email') {
      db.exec(`INSERT INTO customers(id,account_id,name,email) VALUES('legacy','buyer-home','Legacy','BUYER@test.dev');
        UPDATE invoices SET customer_id='legacy' WHERE id='owned'`);
    } else {
      db.exec(`UPDATE users SET phone='+1 (23)' WHERE id='buyer'; UPDATE invoices SET customer_whatsapp='123' WHERE id='owned'`);
    }
    const detail = await request('owned', 'buyer', 'GET');
    expect(detail.status).toBe(200);
    expect((await detail.json() as any).items[0]).toMatchObject({ can_keep: false, chest_item_id: null });
    expect((await request()).status).toBe(409);
    expect(count()).toBe(0);
  });

  // Case 3: a piece becomes grams only when the product states its piece weight; unknown tea identity or weight is refused.
  it('converts two known 357 gram cakes to 714 grams', async () => {
    db.exec("UPDATE invoice_line_items SET quantity_unit='unit' WHERE id='line'; UPDATE products SET piece_weight_g=357 WHERE id='tea'");
    expect(await keepBoughtLine(database(), order(), 'line')).toMatchObject({ grams: 714, name: 'Mountain tea', type: 'Oolong', year: 2024, origin: 'Fujian, China' });
  });
  it.each(['unweighed piece', 'teaware', 'custom name'])('refuses %s without inventing tea grams', async kind => {
    if (kind === 'unweighed piece') db.exec("UPDATE invoice_line_items SET quantity_unit='unit' WHERE id='line'");
    if (kind === 'teaware') db.exec("UPDATE products SET type='Teaware' WHERE id='tea'");
    if (kind === 'custom name') db.exec("UPDATE invoice_line_items SET product_id=NULL, custom_name='Mystery tea' WHERE id='line'");
    expect((await boughtLineChestState(database(), order())).get('line')?.can_keep).toBe(false);
    expect(await keepBoughtLine(database(), order(), 'line')).toBeNull();
    expect(count()).toBe(0);
  });

  // Case 4: legacy missing units follow the existing order detail rule, with one exported helper for the owner to wire there.
  it('infers older tea rows as grams and older teaware as units', async () => {
    db.exec("UPDATE invoice_line_items SET quantity_unit=NULL WHERE id='line'");
    expect(boughtLineQuantityUnit(order().lines[0])).toBe('g');
    expect((await (await request('owned', 'buyer', 'GET')).json() as any).items[0].quantity_unit).toBe('g');
    expect(await keepBoughtLine(database(), order(), 'line')).toMatchObject({ grams: 2 });
    expect(boughtLineQuantityUnit({ quantity_unit: null, type: 'Teaware' })).toBe('unit');
    expect(boughtLineQuantityUnit({ quantity_unit: 'unit', type: 'Oolong' })).toBe('unit');
  });

  // Case 5: resolved money and live invoice eligibility govern new records; existing private records survive refunds.
  it.each(['unpaid', 'partial', 'draft', 'cancelled', 'refund', 'deleted'])('refuses a new chest row for an %s order', async state => {
    const input = order();
    if (state === 'unpaid') input.payment = { total_usd: 8, paid_usd: 0, outstanding_usd: 8 };
    if (state === 'partial') input.payment = { total_usd: 8, paid_usd: 4, outstanding_usd: 4 };
    if (state === 'draft') input.invoice.status = 'Draft';
    if (state === 'cancelled') Object.assign(input.invoice, { status: 'Void', cancelled_at: '2026-11-25' });
    if (state === 'refund') input.invoice.refund_required = 1;
    if (state === 'deleted') input.invoice.deleted_at = '2026-11-25';
    expect((await boughtLineChestState(database(), input)).get('line')?.can_keep).toBe(false);
    expect(await keepBoughtLine(database(), input, 'line')).toBeNull();
    expect(count()).toBe(0);
  });
  it('rechecks a live cancellation after the order snapshot was loaded', async () => {
    const input = order();
    db.exec("UPDATE invoices SET status='Void',refund_required=1,cancelled_at='2026-11-25' WHERE id='owned'");
    expect(await keepBoughtLine(database(), input, 'line')).toBeNull();
    expect(count()).toBe(0);
  });
  it('keeps a private record unchanged after its purchase is refunded', async () => {
    const kept = await keepBoughtLine(database(), order(), 'line');
    db.exec("UPDATE invoices SET status='Void',refund_required=1,cancelled_at='2026-11-25' WHERE id='owned'");
    const refunded = order();
    expect(await keepBoughtLine(database(), refunded, 'line')).toEqual(kept);
    expect((await boughtLineChestState(database(), refunded)).get('line')).toEqual({ chest_item_id: kept!.id, can_keep: false });
    expect(count()).toBe(1);
  });

  // Case 6: the chest is the person's own record. Deleting it is their choice, and tapping again
  // puts the tea back once: never two rows for one line at the same time.
  it('puts a deleted tea back once when the buyer taps again', async () => {
    const first = await keepBoughtLine(database(), order(), 'line');
    expect(first).not.toBeNull();
    db.sqlite.prepare('DELETE FROM personal_cellar_items WHERE id=?').run(first!.id);
    const again = await keepBoughtLine(database(), order(), 'line');
    expect(again).not.toBeNull();
    expect(await keepBoughtLine(database(), order(), 'line')).toEqual(again);
    expect(count()).toBe(1);
  });

  // Case 7: price_at_sale times quantity is the known USD amount, and zero is a stated cost rather than a blank.
  it.each([4, 0])('stores a stated unit price of %s with USD', async price => {
    db.sqlite.prepare('UPDATE invoice_line_items SET price_at_sale=? WHERE id=?').run(price, 'line');
    expect(await keepBoughtLine(database(), order(), 'line')).toMatchObject({ costAmount: price * 2, costCurrency: 'USD' });
  });
  it('stores neither amount nor currency when cost is unknown', async () => {
    const input = order();
    input.lines[0].price_at_sale = null;
    expect(await keepBoughtLine(database(), input, 'line')).toMatchObject({ costAmount: null, costCurrency: null });
  });

  // Case 8: ownership is checked before any line or chest lookup, so another buyer learns no more than an unknown id.
  it('answers an unrelated buyer exactly like an unknown order', async () => {
    const foreign = await request('owned', 'other');
    const missing = await request('unknown', 'other');
    expect(foreign.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
    expect(count()).toBe(0);
  });
  it('uses resolved confirmed payment despite an unpaid legacy invoice flag, and reads never add tea', async () => {
    expect((await (await request('owned', 'buyer', 'GET')).json() as any).items[0].can_keep).toBe(true);
    expect(count()).toBe(0);
    const response = await request();
    expect(response.status).toBe(200);
    const { item } = await response.json() as any;
    expect(item).toMatchObject({ grams: 2, costAmount: 8, costCurrency: 'USD', source: { kind: 'bought', invoiceId: 'owned' } });
    expect((await (await request('owned', 'buyer', 'GET')).json() as any).items[0]).toMatchObject({ can_keep: false, chest_item_id: item.id });
  });
  it('does not expose or write the feature when the launch flag is closed', async () => {
    const detail = await (await request('owned', 'buyer', 'GET', false)).json() as any;
    expect(detail.items[0]).not.toHaveProperty('can_keep');
    expect((await request('owned', 'buyer', 'POST', false)).status).toBe(404);
    expect(count()).toBe(0);
  });
  it('refuses a line id outside the owned order', async () => {
    expect((await request('owned', 'buyer', 'POST', true, 'other-line')).status).toBe(409);
    expect(count()).toBe(0);
  });
});
