import { describe, expect, it } from 'vitest';
import { SqliteD1 } from './helpers/sqliteD1';
import { orderTrackingTools } from '../src/mcpTools/orderTracking';
import type { ToolAuth, ToolEnv } from '../src/mcpTools/registry';

/**
 * The agent door to In process (migration 0043), driven against the database
 * the migration ledger builds. A tracking number lands only after a preview
 * Adrian was shown, moves the order to Shipped, never receives it, and never
 * reaches another shop's order.
 */
const A = 'acct-a';
const auth = (accountId = A): ToolAuth => ({ accountId, userId: 'u1', userEmail: 'u1@example.invalid', tokenId: 't1', creatorTier: 'owner' });

function setup() {
  const db = new SqliteD1('migrations');
  const env = { DB: db as unknown as D1Database } as ToolEnv;
  const po = (id: string, status: string, account = A, mode: string | null = 'air') => db.prepare(
    `INSERT INTO purchase_orders (id, account_id, vendor_name, items_json, display_currency, status, ship_mode, created_at, updated_at)
     VALUES (?, ?, 'Boyuan Tea Shop', '[{"name":"1958 Aged Raw","quantity":1}]', 'Yuan', ?, ?, '2026-10-10', '2026-10-10')`,
  ).bind(id, account, status, mode).run();
  return { db, env, po };
}
const call = (env: ToolEnv, name: string, args: Record<string, unknown>, who = auth()) =>
  orderTrackingTools.handlers[name](env, who, args) as Promise<Record<string, any>>;

describe('order tracking for agents', () => {
  it('lists only orders on their way, with their route and step', async () => {
    const { env, po } = setup();
    await po('p1', 'confirmed');
    await po('p2', 'sent', A, 'sea');
    await po('p3', 'received');
    await po('p4', 'confirmed', 'acct-b');
    const r = await call(env, 'list_orders_in_process', {});
    expect(r.count).toBe(2);
    expect(r.orders.map((o: any) => [o.order_id, o.route, o.step])).toEqual(expect.arrayContaining([['p1', 'air', 'Placed'], ['p2', 'boat', 'Sent to supplier']]));
    expect(r.orders[0].teas).toEqual(['1958 Aged Raw']);
  });

  it('previews, then on confirm sets the number and marks it Shipped', async () => {
    const { db, env, po } = setup();
    await po('p1', 'sent');
    const preview = await call(env, 'set_order_tracking', { order_id: 'p1', tracking_number: ' SF 1234 5678 90 ' });
    expect(preview.preview.step).toEqual({ from: 'Sent to supplier', to: 'Shipped' });
    const before = await db.prepare('SELECT tracking_number, status FROM purchase_orders WHERE id = ?').bind('p1').first<any>();
    expect(before).toEqual({ tracking_number: null, status: 'sent' });
    const done = await call(env, 'set_order_tracking', { order_id: 'p1', tracking_number: 'SF 1234 5678 90', confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, step: 'Shipped' });
    const after = await db.prepare('SELECT tracking_number, status FROM purchase_orders WHERE id = ?').bind('p1').first<any>();
    expect(after).toEqual({ tracking_number: 'SF 1234 5678 90', status: 'shipped' });
  });

  it('refuses a changed number, a received order, and another shop', async () => {
    const { db, env, po } = setup();
    await po('p1', 'confirmed');
    await po('p9', 'received');
    const preview = await call(env, 'set_order_tracking', { order_id: 'p1', tracking_number: 'A1' });
    expect(await call(env, 'set_order_tracking', { order_id: 'p1', tracking_number: 'B2', confirm: preview.confirmation_token })).toMatchObject({ error: expect.stringMatching(/invalid/) });
    expect(await call(env, 'set_order_tracking', { order_id: 'p9', tracking_number: 'A1' })).toMatchObject({ error: 'order_is_not_in_process' });
    expect(await call(env, 'set_order_tracking', { order_id: 'p1', tracking_number: 'A1' }, auth('acct-b'))).toMatchObject({ error: 'not_found' });
    // Received between preview and confirm: nothing is reopened.
    const p2 = await call(env, 'set_order_tracking', { order_id: 'p1', tracking_number: 'A1' });
    await db.prepare("UPDATE purchase_orders SET status = 'received' WHERE id = 'p1'").run();
    expect(await call(env, 'set_order_tracking', { order_id: 'p1', tracking_number: 'A1', confirm: p2.confirmation_token })).toHaveProperty('error');
    expect(await db.prepare('SELECT tracking_number, status FROM purchase_orders WHERE id = ?').bind('p1').first()).toEqual({ tracking_number: null, status: 'received' });
  });
});
