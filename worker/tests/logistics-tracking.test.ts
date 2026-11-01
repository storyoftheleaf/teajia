import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { attachLogisticsTracking, recordLogisticsTrackingUpdate } from '../src/logisticsTracking';
import type { RecordLogisticsTrackingInput } from '../../src/lib/logisticsTrackingUpdate';
const databases: SqliteD1[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); vi.unstubAllGlobals(); });
function setup() {
  const db = new SqliteD1('migrations', '0054'); databases.push(db); seedIdentity(db, { accountId: 'shop' });
  db.exec(`INSERT INTO purchase_orders(id,account_id,status,tracking_number,created_at,updated_at) VALUES('p','shop','shipped','RR123465789CN',datetime('now'),datetime('now'));
    INSERT INTO logistics_shipments(id,account_id,logistics_company_name,mode,state,tracking_number,idempotency_key,request_fingerprint,created_at) VALUES('s','shop','Forwarder','sea','in_transit',NULL,'s','{}',datetime('now'));`);
  const env = { DB: db as unknown as D1Database }, scope = { accountId: 'shop', userId: 'owner' };
  const data = { orders: [{ purchase_id: 'p', inbound_tracking_number: 'RR123465789CN', inbound_courier: null }], shipments: [{ id: 's', tracking_number: null, outbound_courier: null }] };
  const input: RecordLogisticsTrackingInput = { kind: 'purchase', entity_id: 'p', tracking_number: 'RR123465789CN', status: 'At logistics warehouse', location: 'Guangzhou', description: 'Waiting for the rest of the parcels', reported_at: '2026-10-01T09:30:00+08:00', source_text: '10月1日 09:30 包裹已到广州仓库，等待其他包裹。', idempotency_key: 'message-one' };
  return { db, env, scope, data, input };
}
describe('logistics updates recorded from company messages', () => {
  it('previews without writing; stores the original message, author and report time without any provider call', async () => {
    const f = setup(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await recordLogisticsTrackingUpdate(f.env, f.scope, f.input, true)).toMatchObject({ preview: true, will_replace_current: true });
    expect(f.db.prepare('SELECT COUNT(*) n FROM logistics_tracking_updates').first()).toEqual({ n: 0 });
    expect(await recordLogisticsTrackingUpdate(f.env, f.scope, f.input)).toMatchObject({ applied: true, replayed: false, tracking: { status: 'At logistics warehouse', source: 'agent_update', location: 'Guangzhou', reported_at: '2026-10-01T01:30:00.000Z', recorded_by: 'owner', source_text: f.input.source_text } });
    const attached = await attachLogisticsTracking(f.env, 'shop', f.data);
    expect(attached.orders[0].tracking_update?.history).toHaveLength(1); expect(attached.shipments[0].tracking_update).toBeNull(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects other accounts and mismatched tracking numbers before saving', async () => {
    const f = setup();
    await expect(recordLogisticsTrackingUpdate(f.env, { ...f.scope, accountId: 'other' }, f.input)).rejects.toMatchObject({ status: 404 });
    await expect(recordLogisticsTrackingUpdate(f.env, f.scope, { ...f.input, tracking_number: 'WRONG' })).rejects.toMatchObject({ status: 409 });
    expect(f.db.prepare('SELECT COUNT(*) n FROM logistics_tracking_updates').first()).toEqual({ n: 0 });
  });
  it('makes repeated pasted messages idempotent and rejects reusing a key for changed content', async () => {
    const f = setup(); await recordLogisticsTrackingUpdate(f.env, f.scope, f.input);
    expect(await recordLogisticsTrackingUpdate(f.env, f.scope, f.input)).toMatchObject({ replayed: true, applied: true });
    await expect(recordLogisticsTrackingUpdate(f.env, f.scope, { ...f.input, status: 'Different' })).rejects.toMatchObject({ status: 409 });
    expect(f.db.prepare('SELECT COUNT(*) n FROM logistics_tracking_updates').first()).toEqual({ n: 1 });
  });
  it('keeps older pasted messages in history without replacing the latest location or status', async () => {
    const f = setup(); await recordLogisticsTrackingUpdate(f.env, f.scope, f.input);
    const older = { ...f.input, idempotency_key: 'older', reported_at: '2026-09-30T09:30:00+08:00', status: 'On the way', location: 'Shenzhen' };
    expect(await recordLogisticsTrackingUpdate(f.env, f.scope, older, true)).toMatchObject({ will_replace_current: false });
    const result = await recordLogisticsTrackingUpdate(f.env, f.scope, older);
    expect(result).toMatchObject({ applied: false, tracking: { status: 'At logistics warehouse', location: 'Guangzhou' } });
    expect('tracking' in result && result.tracking?.history.map(e => e.status)).toEqual(['At logistics warehouse', 'On the way']);
  });
  it('hides old observations when tracking identity changes, including courier changes', async () => {
    const f = setup(); await recordLogisticsTrackingUpdate(f.env, f.scope, f.input);
    f.data.orders[0].inbound_tracking_number = 'NEW123456';
    expect((await attachLogisticsTracking(f.env, 'shop', f.data)).orders[0].tracking_update).toBeNull();
    f.data.orders[0].inbound_tracking_number = f.input.tracking_number!;
    const data = { ...f.data, orders: [{ ...f.data.orders[0], inbound_courier: 'Different courier' }] };
    expect((await attachLogisticsTracking(f.env, 'shop', data)).orders[0].tracking_update).toBeNull();
    expect(f.db.prepare('SELECT COUNT(*) n FROM logistics_tracking_updates').first()).toEqual({ n: 1 });
  });
  it('accepts an explicitly selected shipment without a tracking number and never receives stock from Delivered', async () => {
    const f = setup(); const input: RecordLogisticsTrackingInput = { ...f.input, kind: 'shipment', entity_id: 's', tracking_number: null, status: 'Delivered to studio' };
    expect(await recordLogisticsTrackingUpdate(f.env, f.scope, input)).toMatchObject({ applied: true, tracking: { tracking_number: null } });
    expect(f.db.prepare("SELECT state FROM logistics_shipments WHERE id='s'").first()).toEqual({ state: 'in_transit' });
    expect(f.db.prepare('SELECT COUNT(*) n FROM stock_ledger').first()).toEqual({ n: 0 });
  });
  it.each([{ reported_at: '2026-10-01' }, { reported_at: '2099-01-01T00:00:00Z' }, { status: '' }, { source_text: '' }, { tracking_number: undefined }])('validates meaningful report fields %j', async patch => {
    const f = setup(); const input = { ...f.input, ...patch } as RecordLogisticsTrackingInput;
    if (patch.tracking_number === undefined && 'tracking_number' in patch) delete (input as any).tracking_number;
    await expect(recordLogisticsTrackingUpdate(f.env, f.scope, input)).rejects.toMatchObject({ status: 400 });
  });
  it('keeps undated messages undated and sorts them by their saved time', async () => {
    const f = setup(); await recordLogisticsTrackingUpdate(f.env, f.scope, f.input);
    const result = await recordLogisticsTrackingUpdate(f.env, f.scope, { ...f.input, idempotency_key: 'undated', reported_at: null, status: 'At destination port' });
    expect(result).toMatchObject({ applied: true, tracking: { reported_at: null, recorded_at: expect.any(String), status: 'At destination port' } });
    expect((await attachLogisticsTracking(f.env, 'shop', f.data)).orders[0].tracking_update?.reported_at).toBeNull();
  });
  it('checks the saved number again inside the write, preventing a concurrent record edit', async () => {
    const f = setup(); let changed = false;
    const DB = { prepare(sql: string) { if (!changed && sql.startsWith('INSERT INTO logistics_tracking_updates')) { changed = true; f.db.exec("UPDATE purchase_orders SET tracking_number='NEW123456' WHERE id='p'"); } return f.db.prepare(sql); } } as unknown as D1Database;
    await expect(recordLogisticsTrackingUpdate({ DB }, f.scope, f.input)).rejects.toMatchObject({ status: 409 });
    expect(f.db.prepare('SELECT COUNT(*) n FROM logistics_tracking_updates').first()).toEqual({ n: 0 });
  });
  it('reads report history only from the selected account', async () => {
    const f = setup(); await recordLogisticsTrackingUpdate(f.env, f.scope, f.input);
    expect((await attachLogisticsTracking(f.env, 'other', f.data)).orders[0].tracking_update).toBeNull();
  });
});
