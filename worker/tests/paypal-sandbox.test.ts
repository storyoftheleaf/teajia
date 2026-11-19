import { afterEach, describe, expect, it, vi } from 'vitest';
import { paypalSandboxRoutes } from '../src/paypalSandbox';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const dbs: SqliteD1[] = [];
afterEach(() => { vi.unstubAllGlobals(); for (const db of dbs.splice(0)) db.close(); });
const invoice = { id: 'invoice', account_id: 'shop', invoice_number: 'TEST-001', amount_usd: 18, quote_key: 'quote-v1', deadline: '2099-01-01T00:00:00.000Z' };
function fixture() {
 const db = new SqliteD1('schema'); dbs.push(db); seedIdentity(db,{userId:'owner',accountId:'shop'}); db.exec("INSERT INTO invoices(id,account_id,invoice_number,status) VALUES('invoice','shop','TEST-001','Pending')");
 const settled = vi.fn(async () => ({ payment_status: 'paid', paid_usd: 18, outstanding_usd: 0 }));
 const load = vi.fn(async () => ({ ...invoice }));
 const env = { DB: db, PAYPAL_SANDBOX_ENABLED: 'true', PAYPAL_SANDBOX_ACCOUNT_ID: 'shop', PAYPAL_SANDBOX_CLIENT_ID: 'test-client', PAYPAL_SANDBOX_CLIENT_SECRET: 'test-secret', PAYPAL_SANDBOX_MERCHANT_ID: 'TESTMERCHANT', APP_URL: 'http://127.0.0.1:17926' };
 const handle = (method = 'GET', body?: object, path = 'http://127.0.0.1:18899/api/orders/private-order/paypal-sandbox') => paypalSandboxRoutes(new Request(path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }), env as any, 'private-order', { load, settle: settled });
 return { db, env, settled, load, handle };
}
function provider(overrides: Record<string, unknown> = {}) {
 let attemptId = '';
 const order = () => ({ id: 'TESTORDER123456789', status: 'APPROVED', purchase_units: [{ custom_id: attemptId, payee: { merchant_id: 'TESTMERCHANT' }, amount: { currency_code: 'USD', value: '18.00' }, payments: { captures: [{ id: 'CAPTURE123456789', status: 'COMPLETED', amount: { currency_code: 'USD', value: '18.00' }, final_capture: true }] } }], ...overrides });
 const fetcher = vi.fn(async (url: string | URL, options?: RequestInit) => {
  const path = new URL(String(url)); expect(path.origin).toBe('https://api-m.sandbox.paypal.com');
  if (path.pathname.endsWith('/token')) return Response.json({ access_token: 'test-access-token' });
  if (path.pathname === '/v2/checkout/orders') {
   const body = JSON.parse(String(options?.body)); attemptId = body.purchase_units[0].custom_id;
   expect(body.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '18.00' });
   return Response.json({ id: 'TESTORDER123456789', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=TESTORDER123456789' }] });
  }
  return Response.json(order());
 }); vi.stubGlobal('fetch', fetcher); return fetcher;
}
describe('PayPal is sandbox only and verified by the server', () => {
 it('has no production activation path, even with all sandbox secrets', async () => {
  const f=fixture(); const spy=provider();
  const r=await f.handle('GET',undefined,'https://api.teajia.com/api/orders/private-order/paypal-sandbox');
  expect(await r.json()).toEqual({enabled:false});expect(spy).not.toHaveBeenCalled();
 });
 it('does not enable without credentials or a matching configured account', async () => {
  const f=fixture();delete (f.env as any).PAYPAL_SANDBOX_CLIENT_SECRET;
  expect(await (await f.handle()).json()).toEqual({enabled:false});
  f.env.PAYPAL_SANDBOX_CLIENT_SECRET='test';f.env.PAYPAL_SANDBOX_ACCOUNT_ID='foreign';
  expect((await f.handle()).status).toBe(404);
 });
 it('creates only the server balance and verifies capture once across browser retries', async () => {
  const f=fixture();provider();
  const create=await f.handle('POST',{amount:0.01,invoice_id:'invoice'});expect(create.status).toBe(201);
  expect(await create.json()).toMatchObject({order_id:'TESTORDER123456789',approval_url:expect.stringContaining('sandbox.paypal.com')});
  for(let i=0;i<2;i++)expect(await (await f.handle('POST',{order_id:'TESTORDER123456789'},'http://127.0.0.1:18899/api/orders/private-order/paypal-sandbox/capture')).json()).toMatchObject({state:'completed'});
  expect(f.settled).toHaveBeenCalledTimes(2); // settlement itself must be idempotent in the existing ledger
  expect(f.settled.mock.calls[0][0]).toMatchObject({capture_id:'CAPTURE123456789',amount_usd:18,invoice_id:'invoice'});
 });
 it.each(['amount','merchant','custom_id','pending','declined'])('never settles an invalid %s provider response',async kind=>{
  const f=fixture();const spy=provider();await f.handle('POST',{});
  spy.mockImplementation(async(url:any)=>{
   if(String(url).endsWith('/token'))return Response.json({access_token:'test'});
   return Response.json({id:'TESTORDER123456789',status:'APPROVED',purchase_units:[{custom_id:kind==='custom_id'?'wrong':f.db.sqlite.prepare('SELECT id FROM paypal_sandbox_orders').get()!.id,payee:{merchant_id:kind==='merchant'?'WRONG':'TESTMERCHANT'},amount:{currency_code:'USD',value:kind==='amount'?'0.01':'18.00'},payments:{captures:[{id:'CAPTURE123456789',status:kind==='pending'?'PENDING':kind==='declined'?'DECLINED':'COMPLETED',amount:{currency_code:'USD',value:'18.00'}}]}}]});
  });
  const r=await f.handle('POST',{order_id:'TESTORDER123456789'},'http://127.0.0.1:18899/api/orders/private-order/paypal-sandbox/capture');
  if(kind==='pending')expect(await r.json()).toMatchObject({state:'pending'});else expect(r.status).toBe(409);
  expect(f.settled).not.toHaveBeenCalled();
  if(kind==='declined')expect(f.db.sqlite.prepare('SELECT state FROM paypal_sandbox_orders').get()!.state).toBe('failed');
 });
 it('retains a failed attempt while allowing a new checkout for the same quote', async()=>{
  const f=fixture();const spy=provider();await f.handle('POST',{});
  f.db.exec("UPDATE paypal_sandbox_orders SET state='failed'");
  spy.mockImplementation(async(url:any,options?:RequestInit)=>{
   if(String(url).endsWith('/token'))return Response.json({access_token:'test'});
   return Response.json({id:'SECONDTESTORDER123',links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token=SECONDTESTORDER123'}]});
  });
  const result=await f.handle('POST',{});expect(result.status).toBe(201);expect(await result.json()).toMatchObject({order_id:'SECONDTESTORDER123'});
  expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM paypal_sandbox_orders').get()!.n).toBe(2);expect(f.settled).not.toHaveBeenCalled();
 });
 it('rejects a stale quote, unknown order and foreign invoice without capturing', async()=>{
  const f=fixture();const spy=provider();await f.handle('POST',{});f.load.mockResolvedValue({...invoice,quote_key:'changed'});
  spy.mockImplementation(async(url:any)=>String(url).endsWith('/token')?Response.json({access_token:'test'}):Response.json({id:'TESTORDER123456789',status:'APPROVED',purchase_units:[{custom_id:f.db.sqlite.prepare('SELECT id FROM paypal_sandbox_orders').get()!.id,payee:{merchant_id:'TESTMERCHANT'},amount:{currency_code:'USD',value:'18.00'}}]}));
  const r=await f.handle('POST',{order_id:'TESTORDER123456789'},'http://127.0.0.1:18899/api/orders/private-order/paypal-sandbox/capture');expect(r.status).toBe(409);expect(f.settled).not.toHaveBeenCalled();
  expect(spy.mock.calls.filter(c=>String(c[0]).endsWith('/capture'))).toHaveLength(0);
 });
});
