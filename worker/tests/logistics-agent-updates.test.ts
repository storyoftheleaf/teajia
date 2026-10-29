import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
function fixture() {
 const db = new SqliteD1('migrations'); databases.push(db);
 seedIdentity(db, { userId: 'owner', accountId: 'shop' });
 seedIdentity(db, { userId: 'other', accountId: 'other' });
 for (const [id, account, user, scopes] of [['write', 'shop', 'owner', ['inventory:read', 'stock:write']], ['read', 'shop', 'owner', ['inventory:read']], ['other', 'other', 'other', ['inventory:read', 'stock:write']]] as const) {
  db.sqlite.prepare('INSERT INTO mcp_tokens(id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, account, user, `${user}@test.dev`, id, createHash('sha256').update(`tjmcp_${id}`).digest('hex'), 'tjmcp_', JSON.stringify(scopes), 'account_owner', Math.floor(Date.now() / 1000) + 3600);
 }
 db.sqlite.exec(`INSERT INTO purchase_orders(id,account_id,vendor_name,status,tracking_number,created_at,updated_at) VALUES
 ('PO-104','shop','Tea supplier','shipped','YT-123',datetime('now'),datetime('now')),
 ('PO-105','shop','Cups supplier','shipped','YT-123',datetime('now'),datetime('now')),
 ('PO-OTHER','other','Private supplier','shipped','OTHER-TRACK',datetime('now'),datetime('now'));
 INSERT INTO purchase_logistics(purchase_id,account_id,logistics_company_name,inbound_courier,inbound_tracking_number,updated_at) VALUES('PO-104','shop','Forwarder','YTO','YT-123',datetime('now'));
 INSERT INTO logistics_shipments(id,account_id,logistics_company_name,mode,state,tracking_number,idempotency_key,request_fingerprint,created_at) VALUES('shipment','shop','Forwarder','sea','in_transit','SEA-456','ship-key','{}',datetime('now'));`);
 const env = { DB: db, JWT_SECRET: 'secret' };
 async function call(name: string, args: any = {}, token = 'write') {
  const response = await worker.fetch(new Request('https://app.test/mcp', { method: 'POST', headers: { Authorization: `Bearer tjmcp_${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }) }), env as never, {} as never);
  const body: any = await response.json();
  expect(response.status).toBe(200);
  return body.error ? { protocol_error: body.error } : JSON.parse(body.result.content[0].text);
 }
 async function read() {
  const token = await signedToken('secret', { sub: 'owner', active_account_id: 'shop' });
  const response = await worker.fetch(new Request('https://app.test/api/logistics', { headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop' } }), env as never, {} as never);
  expect(response.status).toBe(200); return await response.json() as any;
 }
 const update = { kind: 'purchase', entity_id: 'PO-104', tracking_number: 'YT-123', status: 'Delivered to warehouse', location: 'Guangzhou', description: 'Warehouse desk signed for parcel', reported_at: '2026-10-20T12:00:00+08:00', source_text: 'YT-123 已送达广州仓库，前台签收。2026-10-20 12:00 +08:00', idempotency_key: 'message-1' };
 return { db, call, read, update };
}

describe('agent pasted-message tracking through real MCP and REST', () => {
 it('resolves exact references, preserves ambiguity and does not leak another account', async () => {
  const f = fixture();
  const ambiguous = await f.call('resolve_logistics_reference', { reference: 'YT-123' }, 'read');
  expect(ambiguous).toMatchObject({ matched: 2, ambiguous: true });
  expect(ambiguous.candidates.map((c: any) => c.entity_id).sort()).toEqual(['PO-104', 'PO-105']);
  expect((await f.call('resolve_logistics_reference', { reference: 'PO-104' })).candidates[0]).toMatchObject({ kind: 'purchase', entity_id: 'PO-104', logistics_company: 'Forwarder' });
  expect((await f.call('resolve_logistics_reference', { reference: 'SEA-456' })).candidates[0]).toMatchObject({ kind: 'shipment', entity_id: 'shipment' });
  expect((await f.call('resolve_logistics_reference', { reference: 'YT-12' })).matched).toBe(0);
  expect((await f.call('resolve_logistics_reference', { reference: 'OTHER-TRACK' })).matched).toBe(0);
  expect((await f.call('resolve_logistics_reference', { reference: 'PO-104' }, 'other')).matched).toBe(0);
 });
 it('requires write permission and durable confirmation, is idempotent, and shows the same update over REST', async () => {
  const f = fixture();
  const denied = await f.call('record_logistics_tracking_update', f.update, 'read');
  expect(denied.protocol_error ?? denied.error).toBeTruthy();
  const before = await f.read();
  const preview = await f.call('record_logistics_tracking_update', f.update);
  expect(preview.confirmation_token, JSON.stringify(preview)).toEqual(expect.any(String));
  expect(await f.read()).toEqual(before);
  const committed = await f.call('record_logistics_tracking_update', { confirm: preview.confirmation_token });
  expect(committed).toMatchObject({ committed: true, applied: true, replayed: false });
  const rest = await f.read();
  const mcp = await f.call('list_logistics');
  expect(rest).toEqual(mcp);
  expect(JSON.stringify(rest.orders.find((o: any) => o.purchase_id === 'PO-104'))).toContain('Delivered to warehouse');
  const retry = await f.call('record_logistics_tracking_update', f.update);
  expect((await f.call('record_logistics_tracking_update', { confirm: retry.confirmation_token }))).toMatchObject({ committed: true, replayed: true });
  expect(f.db.sqlite.prepare("SELECT logistics_arrived_at FROM purchase_logistics WHERE purchase_id='PO-104'").get()).toEqual({ logistics_arrived_at: null });
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({ n: 0 });
  expect((await f.call('record_logistics_tracking_update', { ...f.update, entity_id: 'PO-OTHER', tracking_number: 'OTHER-TRACK', idempotency_key: 'wrong-account' })).error).toBeTruthy();
 });
 it('records the separate outbound route without changing the supplier parcel or receiving stock', async () => {
  const f = fixture();
  const preview = await f.call('record_logistics_tracking_update', { ...f.update, kind: 'shipment', entity_id: 'shipment', tracking_number: 'SEA-456', status: 'Customs clearance', reported_at: null, location: 'Jakarta', source_text: 'SEA-456 is clearing customs in Jakarta.', idempotency_key: 'outbound-message' });
  expect(preview.confirmation_token, JSON.stringify(preview)).toEqual(expect.any(String));
  await f.call('record_logistics_tracking_update', { confirm: preview.confirmation_token });
  const state = await f.read();
  expect(JSON.stringify(state.shipments[0])).toContain('Customs clearance');
  expect(JSON.stringify(state.orders)).not.toContain('Customs clearance');
  expect(state.shipments[0].state).toBe('in_transit');
  expect(state.shipments[0].tracking_update.reported_at).toBeNull();
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toEqual({ n: 0 });
 });
 it('refuses confirmation if the courier changes after preview even when the number is unchanged', async () => {
  const f = fixture();
  const preview = await f.call('record_logistics_tracking_update', f.update);
  expect(preview.confirmation_token).toEqual(expect.any(String));
  f.db.sqlite.prepare("UPDATE purchase_logistics SET inbound_courier='Different carrier' WHERE purchase_id='PO-104'").run();
  const result = await f.call('record_logistics_tracking_update', { confirm: preview.confirmation_token });
  expect(result.error).toContain('changed after preview');
  expect(result.committed).toBeUndefined();
  expect(f.db.sqlite.prepare('SELECT COUNT(*) n FROM logistics_tracking_updates').get()).toEqual({ n: 0 });
 });

});
