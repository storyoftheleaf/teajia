import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import {
  buildCustomerOrderNotificationInsert,
  getCustomerOrderNotificationSetupStatus,
  processPendingCustomerOrderNotifications,
  type WhatsAppOrderEnv,
} from '../src/whatsappOrderNotifications';

const ACCOUNT = 'acc_teajia_bali';
const env: WhatsAppOrderEnv = {
  WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED: 'true',
  WHATSAPP_ORDER_ACCOUNT_ID: ACCOUNT,
  WHATSAPP_ACCESS_TOKEN: 'server-secret',
  WHATSAPP_PHONE_NUMBER_ID: '123456789',
  WHATSAPP_SENDER_NUMBER: '+6281339712339',
  WHATSAPP_CUSTOMER_TEMPLATE_NAME: 'teajia_order_confirmation',
  WHATSAPP_ORDER_TEMPLATE_LANGUAGE: 'en_US',
  WHATSAPP_GRAPH_API_VERSION: 'v23.0',
};

function database() {
  const db = new SqliteD1(false);
  db.exec(`
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY, whatsapp_number TEXT,
      order_whatsapp_notifications_enabled INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE order_whatsapp_outbox (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL, invoice_id TEXT NOT NULL,
      order_ref TEXT NOT NULL, customer_name TEXT NOT NULL,
      customer_contact TEXT, delivery_location TEXT, order_summary TEXT,
      invoice_url TEXT NOT NULL,
      message_purpose TEXT NOT NULL DEFAULT 'owner_notification', recipient_number TEXT, consent_at TEXT,
      state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT, lease_token TEXT, lease_expires_at TEXT,
      provider_message_id TEXT, last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, invoice_id)
    );
    INSERT INTO accounts VALUES ('acc_teajia_bali', '+6281339712339', 1);
    INSERT INTO accounts VALUES ('other_shop', '+6281555555555', 1);
  `);
  return db;
}

function queue(db: SqliteD1, accountId = ACCOUNT, invoiceId = 'invoice-1') {
  return buildCustomerOrderNotificationInsert(db as unknown as D1Database, {
    accountId, invoiceId, orderRef: 'TJ-ORDER-1', customerName: 'Customer Name',
    customerContact: '+628111234567', deliveryLocation: 'Denpasar',
    orderSummary: 'Rou Gui 25 g; estimated USD 25',
    invoiceUrl: 'https://teajia.com/order/privateordertoken000000000000000001',
    recipientNumber: '+628111234567', consentAt: '2026-09-28T00:00:00Z',
  }).run();
}

function row(db: SqliteD1, invoiceId = 'invoice-1') {
  return db.sqlite.prepare('SELECT * FROM order_whatsapp_outbox WHERE invoice_id = ?').get(invoiceId) as Record<string, unknown>;
}

afterEach(() => vi.restoreAllMocks());

const kapsoEnv: WhatsAppOrderEnv = {
  ...env, WHATSAPP_TRANSPORT: 'kapso', KAPSO_API_KEY: 'kapso-test-secret',
  WHATSAPP_ACCESS_TOKEN: undefined, WHATSAPP_GRAPH_API_VERSION: 'v24.0',
};

describe('customer WhatsApp order outbox', () => {
  it('uses the fixed Kapso proxy and its own key with the unchanged customer template', async () => {
    const db = database();
    await queue(db);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.kapso' }] }), { status: 200 }));
    const result = await processPendingCustomerOrderNotifications(db as unknown as D1Database, { ...kapsoEnv, WHATSAPP_ACCESS_TOKEN: 'must-not-leave-server' }, { fetcher: fetcher as typeof fetch });
    expect(result.accepted).toBe(1);
    expect(row(db)).toMatchObject({ state: 'accepted', provider_message_id: 'wamid.kapso', attempts: 1 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.kapso.ai/meta/whatsapp/v24.0/123456789/messages');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', 'X-API-Key': 'kapso-test-secret' });
    expect(init.redirect).toBe('error');
    const payload = JSON.parse(init.body);
    expect(payload.to).toBe('628111234567');
    expect(payload.template.name).toBe('teajia_order_confirmation');
    expect(payload.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      'TJ-ORDER-1', 'Customer Name', 'Denpasar', 'Rou Gui 25 g; estimated USD 25',
      'https://teajia.com/order/privateordertoken000000000000000001',
    ]);
    await processPendingCustomerOrderNotifications(db as unknown as D1Database, kapsoEnv, { fetcher: fetcher as typeof fetch });
    expect(fetcher).toHaveBeenCalledOnce();
    db.close();
  });

  it('never falls back from a missing Kapso key or unknown transport to Meta credentials', async () => {
    const db = database();
    await queue(db);
    const fetcher = vi.fn();
    for (const settings of [
      { ...env, WHATSAPP_TRANSPORT: 'kapso' },
      { ...env, WHATSAPP_TRANSPORT: 'kapos', KAPSO_API_KEY: 'key' },
    ]) {
      await processPendingCustomerOrderNotifications(db as unknown as D1Database, settings, { fetcher: fetcher as typeof fetch });
      expect(row(db)).toMatchObject({ state: 'config_required', attempts: 0 });
    }
    expect(fetcher).not.toHaveBeenCalled();
    const ready = await getCustomerOrderNotificationSetupStatus(db as unknown as D1Database, kapsoEnv, ACCOUNT);
    expect(ready.ready).toBe(true);
    db.close();
  });

  it('keeps all account, sender, consent, and customer-link gates in front of Kapso', async () => {
    const cases = [
      { settings: { ...kapsoEnv, WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED: undefined } },
      { settings: { ...kapsoEnv, WHATSAPP_ORDER_ACCOUNT_ID: 'other_shop' } },
      { settings: { ...kapsoEnv, WHATSAPP_SENDER_NUMBER: '+628999999999' } },
      { settings: kapsoEnv, sql: "UPDATE accounts SET order_whatsapp_notifications_enabled=0" },
      { settings: kapsoEnv, sql: "UPDATE order_whatsapp_outbox SET consent_at=NULL" },
      { settings: kapsoEnv, sql: "UPDATE order_whatsapp_outbox SET recipient_number='+6281339712339'" },
      { settings: kapsoEnv, sql: "UPDATE order_whatsapp_outbox SET invoice_url='https://teajia.com/admin/activity'" },
      { settings: kapsoEnv, sql: "UPDATE order_whatsapp_outbox SET message_purpose='owner_notification'" },
    ];
    for (const item of cases) {
      const db = database();
      await queue(db);
      if (item.sql) db.sqlite.exec(item.sql);
      const fetcher = vi.fn();
      await processPendingCustomerOrderNotifications(db as unknown as D1Database, item.settings, { fetcher: fetcher as typeof fetch });
      expect(fetcher).not.toHaveBeenCalled();
      expect(row(db).attempts).toBe(0);
      db.close();
    }
  });

  it('honors Kapso rate limits and holds rejected or ambiguous outcomes without automatic replay', async () => {
    const cases = [
      { response: () => new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'Retry-After': '120' } }), state: 'retry_scheduled' },
      { response: () => new Response('Unauthorized', { status: 401 }), state: 'config_required' },
      { response: () => new Response('Unavailable', { status: 503 }), state: 'review_required' },
      { response: () => new Response('{}', { status: 200 }), state: 'review_required' },
      { response: () => { throw new Error('Unknown connection outcome'); }, state: 'review_required' },
    ];
    for (const item of cases) {
      const db = database();
      await queue(db);
      const fetcher = vi.fn(async () => item.response());
      await processPendingCustomerOrderNotifications(db as unknown as D1Database, kapsoEnv, { fetcher: fetcher as typeof fetch });
      expect(row(db)).toMatchObject({ state: item.state, attempts: 1 });
      if (item.state === 'retry_scheduled') {
        const next = Date.parse(`${row(db).next_attempt_at}Z`);
        expect(next - Date.now()).toBeGreaterThan(118000);
      }
      await processPendingCustomerOrderNotifications(db as unknown as D1Database, kapsoEnv, { fetcher: fetcher as typeof fetch });
      expect(fetcher).toHaveBeenCalledOnce();
      db.close();
    }
  });
  it('adds customer fields without changing the meaning or state of existing owner rows', () => {
    const db = new SqliteD1('migrations', '0027');
    db.sqlite.exec(`INSERT INTO order_whatsapp_outbox
      (id,account_id,invoice_id,order_ref,customer_name,invoice_url,state)
      VALUES ('old','shop','invoice','TJ-OLD','Guest','https://teajia.com/admin/activity','pending')`);
    db.sqlite.exec(readFileSync(new URL('../migrations/0028_customer_whatsapp_confirmation.sql', import.meta.url), 'utf8'));
    expect(db.sqlite.prepare("SELECT message_purpose, recipient_number, consent_at, state, invoice_url FROM order_whatsapp_outbox WHERE id='old'").get()).toEqual({
      message_purpose: 'owner_notification', recipient_number: null, consent_at: null, state: 'pending', invoice_url: 'https://teajia.com/admin/activity',
    });
    db.close();
  });

  it('quarantines legacy owner alerts and invalid customer links without sending', async () => {
    const db = database();
    await queue(db, ACCOUNT, 'legacy');
    await queue(db, ACCOUNT, 'admin-link');
    db.sqlite.prepare("UPDATE order_whatsapp_outbox SET message_purpose='owner_notification', recipient_number=NULL, consent_at=NULL WHERE invoice_id='legacy'").run();
    db.sqlite.prepare("UPDATE order_whatsapp_outbox SET invoice_url='https://teajia.com/admin/activity' WHERE invoice_id='admin-link'").run();
    const fetcher = vi.fn();
    const result = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(result.reviewRequired).toBe(2);
    expect(fetcher).not.toHaveBeenCalled();
    expect(row(db, 'legacy')).toMatchObject({ message_purpose: 'owner_notification', state: 'review_required', attempts: 0 });
    db.close();
  });

  it('holds a customer recipient equal to the sender', async () => {
    const db = database();
    await queue(db);
    db.sqlite.prepare("UPDATE order_whatsapp_outbox SET recipient_number='+6281339712339'").run();
    const fetcher = vi.fn();
    await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(fetcher).not.toHaveBeenCalled();
    expect(row(db)).toMatchObject({ state: 'config_required', last_error: 'customer_matches_sender', attempts: 0 });
    db.close();
  });

  it('queues once per account and invoice, with no provider call during order creation', async () => {
    const db = database();
    await queue(db);
    await queue(db);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM order_whatsapp_outbox').get()).toMatchObject({ n: 1 });
    expect(row(db)).toMatchObject({ account_id: ACCOUNT, state: 'pending', attempts: 0 });
    db.close();
  });

  it('targets the newly created invoice without selecting an older queued order', async () => {
    const db = database();
    await queue(db, ACCOUNT, 'older-invoice');
    await queue(db, ACCOUNT, 'new-invoice');
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.new' }] }), { status: 200 }));
    const result = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, {
      accountId: ACCOUNT, invoiceId: 'new-invoice', limit: 1, fetcher: fetcher as typeof fetch,
    });
    expect(result).toMatchObject({ examined: 1, accepted: 1 });
    expect(row(db, 'older-invoice')).toMatchObject({ state: 'pending', attempts: 0 });
    expect(row(db, 'new-invoice')).toMatchObject({ state: 'accepted', attempts: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    await expect(processPendingCustomerOrderNotifications(db as unknown as D1Database, env, {
      invoiceId: 'older-invoice', fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('account ID is required');
    db.close();
  });

  it('holds unconfigured or non-allowed accounts without sending or retry attempts', async () => {
    const db = database();
    await queue(db, 'other_shop', 'other-invoice');
    const fetcher = vi.fn();
    const result = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(result).toMatchObject({ examined: 1, accepted: 0, configRequired: 1 });
    expect(row(db, 'other-invoice')).toMatchObject({ state: 'config_required', attempts: 0 });
    expect(fetcher).not.toHaveBeenCalled();
    db.close();
  });

  it('requires explicit account opt-in, new enablement, and the same business sending number', async () => {
    const db = database();
    db.sqlite.prepare('UPDATE accounts SET order_whatsapp_notifications_enabled = 0 WHERE id = ?').run(ACCOUNT);
    const disabled = await getCustomerOrderNotificationSetupStatus(db as unknown as D1Database, env, ACCOUNT);
    expect(disabled.missing).toContain('account_opt_in');
    db.sqlite.prepare('UPDATE accounts SET order_whatsapp_notifications_enabled = 1 WHERE id = ?').run(ACCOUNT);
    const sameNumber = await getCustomerOrderNotificationSetupStatus(db as unknown as D1Database, {
      ...env, WHATSAPP_SENDER_NUMBER: '628111111111',
    }, ACCOUNT);
    expect(sameNumber.missing).toContain('sender_must_match_business_number');
    expect(sameNumber.ready).toBe(false);
    const gated = await getCustomerOrderNotificationSetupStatus(db as unknown as D1Database, { ...env, WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED: undefined }, ACCOUNT);
    expect(gated.missing).toContain('customer_confirmations_disabled');
    db.close();
  });

  it('submits approved template variables and records accepted, not delivered', async () => {
    const db = database();
    await queue(db);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.example' }] }), { status: 200 }));
    const result = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(result.accepted).toBe(1);
    expect(row(db)).toMatchObject({ state: 'accepted', provider_message_id: 'wamid.example', attempts: 1 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v23.0/123456789/messages');
    expect(init.headers.Authorization).toBe('Bearer server-secret');
    const payload = JSON.parse(init.body);
    expect(payload.to).toBe('628111234567');
    expect(payload.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      'TJ-ORDER-1', 'Customer Name', 'Denpasar',
      'Rou Gui 25 g; estimated USD 25', 'https://teajia.com/order/privateordertoken000000000000000001',
    ]);
    await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(fetcher).toHaveBeenCalledTimes(1);
    db.close();
  });

  it('backs off explicit rate limits and avoids automatic retries after an ambiguous network outcome', async () => {
    const db = database();
    await queue(db);
    const rateLimited = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    const first = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: rateLimited as typeof fetch });
    expect(first.retryScheduled).toBe(1);
    expect(row(db)).toMatchObject({ state: 'retry_scheduled', attempts: 1 });
    expect(row(db).next_attempt_at).toBeTruthy();
    const noImmediateRetry = vi.fn();
    const second = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: noImmediateRetry as typeof fetch });
    expect(second.examined).toBe(0);
    expect(noImmediateRetry).not.toHaveBeenCalled();
    db.sqlite.prepare("UPDATE order_whatsapp_outbox SET next_attempt_at = '2000-01-01' WHERE invoice_id = ?").run('invoice-1');
    const unknown = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, {
      fetcher: vi.fn(async () => { throw new Error('token and customer secret'); }) as typeof fetch,
    });
    expect(unknown.reviewRequired).toBe(1);
    expect(row(db)).toMatchObject({ state: 'review_required', attempts: 2, last_error: 'network_outcome_unknown' });
    db.close();
  });

  it('holds authentication/template rejection for operator repair without leaking message details', async () => {
    const db = database();
    await queue(db);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, {
      fetcher: vi.fn(async () => new Response('secret failure', { status: 401 })) as typeof fetch,
    });
    expect(result.configRequired).toBe(1);
    expect(row(db)).toMatchObject({ state: 'config_required', last_error: 'provider_http_401' });
    expect(row(db).next_attempt_at).toBe('9999-12-31 23:59:59');
    expect(log).not.toHaveBeenCalled();
    db.close();
  });

  it('bounds and normalizes template text, sets a timeout, and quarantines stale sending claims', async () => {
    const db = database();
    await queue(db);
    db.sqlite.prepare('UPDATE order_whatsapp_outbox SET order_summary = ?, delivery_location = ? WHERE invoice_id = ?')
      .run(`Long tea description\n\t${'words '.repeat(100)}`, 'Bali\n\t Indonesia', 'invoice-1');
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.2' }] }), { status: 200 }));
    await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    const params = payload.template.components[0].parameters.map((p: { text: string }) => p.text);
    expect(params[2]).toBe('Bali Indonesia');
    expect(params[3].length).toBeLessThanOrEqual(300);
    expect(params.join('').length).toBeLessThanOrEqual(900);
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

    await queue(db, ACCOUNT, 'invoice-2');
    db.sqlite.prepare("UPDATE order_whatsapp_outbox SET state = 'sending', lease_expires_at = '2000-01-01' WHERE invoice_id = ?")
      .run('invoice-2');
    const afterCrash = await processPendingCustomerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(afterCrash.examined).toBe(0);
    expect(row(db, 'invoice-2')).toMatchObject({ state: 'review_required', last_error: 'sending_outcome_unknown' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    db.close();
  });
});
