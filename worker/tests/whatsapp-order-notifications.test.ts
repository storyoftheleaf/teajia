import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import {
  buildOwnerOrderNotificationInsert,
  getOwnerOrderNotificationSetupStatus,
  processPendingOwnerOrderNotifications,
  type WhatsAppOrderEnv,
} from '../src/whatsappOrderNotifications';

const ACCOUNT = 'acc_teajia_bali';
const env: WhatsAppOrderEnv = {
  WHATSAPP_ORDER_ACCOUNT_ID: ACCOUNT,
  WHATSAPP_ACCESS_TOKEN: 'server-secret',
  WHATSAPP_PHONE_NUMBER_ID: '123456789',
  WHATSAPP_SENDER_NUMBER: '+628111111111',
  WHATSAPP_ORDER_TEMPLATE_NAME: 'teajia_new_order_owner',
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
  return buildOwnerOrderNotificationInsert(db as unknown as D1Database, {
    accountId, invoiceId, orderRef: 'TJ-ORDER-1', customerName: 'Customer Name',
    customerContact: '+628111234567', deliveryLocation: 'Denpasar',
    orderSummary: 'Rou Gui 25 g; estimated USD 25',
    invoiceUrl: 'https://teajia.pages.dev/invoice/invoice-1',
  }).run();
}

function row(db: SqliteD1, invoiceId = 'invoice-1') {
  return db.sqlite.prepare('SELECT * FROM order_whatsapp_outbox WHERE invoice_id = ?').get(invoiceId) as Record<string, unknown>;
}

afterEach(() => vi.restoreAllMocks());

describe('owner WhatsApp order outbox', () => {
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
    const result = await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, {
      accountId: ACCOUNT, invoiceId: 'new-invoice', limit: 1, fetcher: fetcher as typeof fetch,
    });
    expect(result).toMatchObject({ examined: 1, accepted: 1 });
    expect(row(db, 'older-invoice')).toMatchObject({ state: 'pending', attempts: 0 });
    expect(row(db, 'new-invoice')).toMatchObject({ state: 'accepted', attempts: 1 });
    expect(fetcher).toHaveBeenCalledOnce();
    await expect(processPendingOwnerOrderNotifications(db as unknown as D1Database, env, {
      invoiceId: 'older-invoice', fetcher: fetcher as typeof fetch,
    })).rejects.toThrow('account ID is required');
    db.close();
  });

  it('holds unconfigured or non-allowed accounts without sending or retry attempts', async () => {
    const db = database();
    await queue(db, 'other_shop', 'other-invoice');
    const fetcher = vi.fn();
    const result = await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(result).toMatchObject({ examined: 1, accepted: 0, configRequired: 1 });
    expect(row(db, 'other-invoice')).toMatchObject({ state: 'config_required', attempts: 0 });
    expect(fetcher).not.toHaveBeenCalled();
    db.close();
  });

  it('requires explicit account opt-in and a different sending number', async () => {
    const db = database();
    db.sqlite.prepare('UPDATE accounts SET order_whatsapp_notifications_enabled = 0 WHERE id = ?').run(ACCOUNT);
    const disabled = await getOwnerOrderNotificationSetupStatus(db as unknown as D1Database, env, ACCOUNT);
    expect(disabled.missing).toContain('account_opt_in');
    db.sqlite.prepare('UPDATE accounts SET order_whatsapp_notifications_enabled = 1 WHERE id = ?').run(ACCOUNT);
    const sameNumber = await getOwnerOrderNotificationSetupStatus(db as unknown as D1Database, {
      ...env, WHATSAPP_SENDER_NUMBER: '6281339712339',
    }, ACCOUNT);
    expect(sameNumber.missing).toContain('sender_matches_recipient');
    expect(sameNumber.ready).toBe(false);
    db.close();
  });

  it('submits approved template variables and records accepted, not delivered', async () => {
    const db = database();
    await queue(db);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.example' }] }), { status: 200 }));
    const result = await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(result.accepted).toBe(1);
    expect(row(db)).toMatchObject({ state: 'accepted', provider_message_id: 'wamid.example', attempts: 1 });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v23.0/123456789/messages');
    expect(init.headers.Authorization).toBe('Bearer server-secret');
    const payload = JSON.parse(init.body);
    expect(payload.to).toBe('6281339712339');
    expect(payload.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      'TJ-ORDER-1', 'Customer Name', '+628111234567', 'Denpasar',
      'Rou Gui 25 g; estimated USD 25', 'https://teajia.pages.dev/invoice/invoice-1',
    ]);
    await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(fetcher).toHaveBeenCalledTimes(1);
    db.close();
  });

  it('backs off explicit rate limits and avoids automatic retries after an ambiguous network outcome', async () => {
    const db = database();
    await queue(db);
    const rateLimited = vi.fn(async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }));
    const first = await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, { fetcher: rateLimited as typeof fetch });
    expect(first.retryScheduled).toBe(1);
    expect(row(db)).toMatchObject({ state: 'retry_scheduled', attempts: 1 });
    expect(row(db).next_attempt_at).toBeTruthy();
    const noImmediateRetry = vi.fn();
    const second = await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, { fetcher: noImmediateRetry as typeof fetch });
    expect(second.examined).toBe(0);
    expect(noImmediateRetry).not.toHaveBeenCalled();
    db.sqlite.prepare("UPDATE order_whatsapp_outbox SET next_attempt_at = '2000-01-01' WHERE invoice_id = ?").run('invoice-1');
    const unknown = await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, {
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
    const result = await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, {
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
    await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    const params = payload.template.components[0].parameters.map((p: { text: string }) => p.text);
    expect(params[3]).toBe('Bali Indonesia');
    expect(params[4].length).toBeLessThanOrEqual(300);
    expect(params.join('').length).toBeLessThanOrEqual(900);
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

    await queue(db, ACCOUNT, 'invoice-2');
    db.sqlite.prepare("UPDATE order_whatsapp_outbox SET state = 'sending', lease_expires_at = '2000-01-01' WHERE invoice_id = ?")
      .run('invoice-2');
    const afterCrash = await processPendingOwnerOrderNotifications(db as unknown as D1Database, env, { fetcher: fetcher as typeof fetch });
    expect(afterCrash.examined).toBe(0);
    expect(row(db, 'invoice-2')).toMatchObject({ state: 'review_required', last_error: 'sending_outcome_unknown' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    db.close();
  });
});
