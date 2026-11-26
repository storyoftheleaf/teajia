import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { checkHostCreditIntegrity, readOwnHostCredit, settleHostCredit } from '../src/hostCreditLedger';
import { sha256Hex } from '../src/inquiryDomain';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

describe('host credit identity and incident audit', () => {
  let db: SqliteD1;
  const trackingRef = 'host-order-audit-000000000000000001';
  const secret = 'audit-signing-fixture';
  const env = () => ({ DB: db as unknown as D1Database, HOST_CREDIT_OPEN: 'true', JWT_SECRET: secret });

  beforeEach(async () => {
    db = new SqliteD1('migrations');
    seedIdentity(db, { userId: 'owner', accountId: 'shop' });
    seedIdentity(db, { userId: 'host', accountId: 'host-home' });
    db.sqlite.exec(`
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, thanks_ref)
        VALUES ('event', 'shop', 'tea', 'Tea', '2026-01-10', 'completed', 'aaaaaaaaaaaaaaaaaa');
      INSERT INTO products (id, account_id, product_name, type, cost_amount, cost_currency, shipping_rate_per_kg, markup_multiplier)
        VALUES ('tea', 'shop', 'Oolong', 'Oolong', 1, 'USD', NULL, NULL);
      INSERT INTO customers (id, account_id, name, email, user_id)
        VALUES ('host-customer', 'shop', 'Host', 'host@test.dev', 'host');
      INSERT INTO invoices (id, account_id, invoice_number, customer_name, display_currency, status, payment_status)
        VALUES ('sale', 'shop', 'TJ-sale', 'Host', 'USD', 'Filled', 'paid');
      INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale)
        VALUES ('line', 'shop', 'sale', 'tea', 5, 4);
    `);
    db.sqlite.prepare(`INSERT INTO inquiries (id, account_id, name, email, items, status, converted_invoice_id, tracking_token_hash)
      VALUES ('inquiry', 'shop', 'Host', 'host@test.dev', '[]', 'replied', 'sale', ?)`).run(await sha256Hex(trackingRef));
    db.sqlite.exec(`INSERT INTO order_session_sources (inquiry_id, account_id, event_id, host_user_id)
      VALUES ('inquiry', 'shop', 'event', 'host')`);
  });
  afterEach(() => db.close());

  function openIncidents() {
    return db.sqlite.prepare("SELECT error_code FROM incident_ledger WHERE status = 'open' ORDER BY error_code")
      .all().map(row => row.error_code);
  }

  it('rejects and reports a self-purchase linked before settlement', async () => {
    db.sqlite.exec("UPDATE invoices SET customer_id = 'host-customer' WHERE id = 'sale'");
    await settleHostCredit(env(), 'sale');
    expect(db.sqlite.prepare('SELECT kind FROM host_credit_entries').all()).toEqual([]);
    expect(openIncidents()).toEqual(['host_credit_self_purchase']);
  });

  it('a host who claims their own signed-out order has zero spendable credit from it', async () => {
    await settleHostCredit(env(), 'sale');
    const token = await signedToken(secret, {
      sub: 'host', email: 'host@test.dev', name: 'Host', active_account_id: 'host-home', platform_role: null,
    });
    const response = await worker.fetch(new Request(`https://worker.test/api/inquiries/${trackingRef}/claim`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` },
    }), env() as Parameters<typeof worker.fetch>[1], { waitUntil() {} } as never);
    expect(response.status, await response.text()).toBe(200);
    expect(db.sqlite.prepare("SELECT customer_id FROM invoices WHERE id = 'sale'").get())
      .toEqual({ customer_id: 'host-customer' });

    await settleHostCredit(env(), 'sale');
    const { balances } = await readOwnHostCredit(env().DB, 'host');
    expect(balances.reduce((sum, row) => sum + row.available, 0)).toBe(0);
  });

  it('reports unusable stored credit terms on a qualifying order', async () => {
    db.sqlite.exec("UPDATE accounts SET host_credit_percent = 101 WHERE id = 'shop'");
    const result = await settleHostCredit(env(), 'sale');
    expect(result.earned).toBe(0);
    expect(openIncidents().length).toBeGreaterThan(0);
  });

  it('keeps an unresolved integrity incident open when a healthy shop is checked', async () => {
    await settleHostCredit(env(), 'sale');
    db.sqlite.exec("DELETE FROM order_session_sources WHERE inquiry_id = 'inquiry'");
    expect(await checkHostCreditIntegrity(env().DB, 'shop')).toEqual(['award_without_source']);
    expect(openIncidents()).toContain('host_credit_award_without_source');
    expect(await checkHostCreditIntegrity(env().DB, 'host-home')).toEqual([]);
    expect(openIncidents()).toContain('host_credit_award_without_source');
  });
});
