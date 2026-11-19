import {afterEach,describe,expect,it,vi} from 'vitest';
import worker from '../src/index';
import {SqliteD1,seedIdentity,signedToken} from './helpers/sqliteD1';
const secret='paypal-test-only';const dbs:SqliteD1[]=[];
afterEach(()=>{vi.unstubAllGlobals();for(const db of dbs.splice(0))db.close();});
async function fixture(shippingLater=false){
 const db=new SqliteD1('migrations');dbs.push(db);seedIdentity(db,{userId:'owner',accountId:'shop',accountSlug:'teajia-bali',bundles:['sell']});seedIdentity(db,{userId:'other',accountId:'foreign',bundles:['sell']});
 db.exec(`UPDATE accounts SET owner_user_id='owner',default_shipping_rate_per_kg=0,default_shipping_rate_currency='USD' WHERE id='shop';INSERT INTO exchange_rates(currency,rate_to_usd) VALUES('USD',1);INSERT INTO products(id,account_id,type,product_name,form,cost_amount,cost_currency,quantity_purchased,stock_grams,is_public,shown_in_shop,status,stock_known_at) VALUES('tea','shop','Red','Sandbox tea','Loose',20,'USD',300,1000,1,1,'Active',datetime('now'));`);
 const env={DB:db,JWT_SECRET:secret,APP_URL:'http://127.0.0.1:17926',PAYPAL_SANDBOX_ENABLED:'true',PAYPAL_SANDBOX_ACCOUNT_ID:'shop',PAYPAL_SANDBOX_CLIENT_ID:'test-client',PAYPAL_SANDBOX_CLIENT_SECRET:'test-secret',PAYPAL_SANDBOX_MERCHANT_ID:'TESTMERCHANT',INQUIRY_LIMITER:{limit:async()=>({success:true})}};
 const auth=await signedToken(secret,{sub:'owner',email:'owner@example.test',active_account_id:'shop',role:'owner'});
 const request=(path:string,body?:object,admin=false,method=body?'POST':'GET')=>worker.fetch(new Request('http://127.0.0.1:18899'+path,{method,headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer '+auth,'X-Teajia-Account':'shop'}:{})},body:body&&JSON.stringify(body)}),env as any,{} as any);
 const token='sandboxprivateordertoken'+crypto.randomUUID().replaceAll('-','');
 const created=await request('/api/inquiries',{source:'website',store_slug:'teajia-bali',tracking_token:token,ref_number:'TEST-'+crypto.randomUUID().slice(0,8),customer_name:'Sandbox buyer',customer_contact:'test@example.test',customer_location:'Ubud, Bali, Indonesia',delivery_address:'TEST ADDRESS ONLY',currency:'USD',total_estimate_usd:14,items:[{id:'tea',name:'Sandbox tea',category:'tea',storeSlug:'teajia-bali',quantityGrams:50,packGrams:25,packs:2,pricePerGram:.28,totalPrice:14}]});expect(created.status).toBe(201);const id=(await created.json() as any).invoice_id;
 expect((await request('/api/invoices/'+id,shippingLater?{status:'Pending'}:{shipping_cost_usd:4,status:'Pending'},true,'PUT')).status).toBe(200);
 let attempt='';let captured=false;let receiptStatus='COMPLETED';let capturedAmount=shippingLater?'14.00':'18.00';let captureCalls=0;let orderCount=0;let providerAmount=capturedAmount;let currentOrder='TESTORDER123456789';
 const order=()=>({id:currentOrder,status:captured?'COMPLETED':'APPROVED',purchase_units:[{custom_id:attempt,payee:{merchant_id:'TESTMERCHANT'},amount:{currency_code:'USD',value:providerAmount},...(captured?{payments:{captures:[{id:orderCount>1?'TESTCAPTURE2234567':'TESTCAPTURE1234567',status:receiptStatus,amount:{currency_code:'USD',value:capturedAmount}}]}}:{})}]});
 const provider=vi.fn(async(url:any,options?:RequestInit)=>{const path=new URL(String(url));expect(path.origin).toBe('https://api-m.sandbox.paypal.com');if(path.pathname.endsWith('/token'))return Response.json({access_token:'test-access'});if(path.pathname==='/v2/checkout/orders'){const payload=JSON.parse(String(options?.body));attempt=payload.purchase_units[0].custom_id;if(shippingLater&&orderCount===0)expect(payload.purchase_units[0].description).toContain('Shipping is quoted and charged separately later.');expect(payload.purchase_units[0].amount.value).toBe(shippingLater?(orderCount===0?'14.00':'4.00'):'18.00');providerAmount=payload.purchase_units[0].amount.value;capturedAmount=providerAmount;captured=false;orderCount++;currentOrder=orderCount>1?'TESTORDER223456789':'TESTORDER123456789';return Response.json({id:currentOrder,links:[{rel:'payer-action',href:'https://www.sandbox.paypal.com/checkoutnow?token='+currentOrder}]});}if(path.pathname.endsWith('/capture')){captureCalls++;captured=true;}return Response.json(order());});vi.stubGlobal('fetch',provider);
 const path='/api/orders/'+token+'/paypal-sandbox';
 const create=()=>request(path,{invoice_id:id,amount:0.01});const capture=(orderId='TESTORDER123456789')=>request(path+'/capture',{invoice_id:id,order_id:orderId});
 return{db,env,request,id,token,path,create,capture,provider,captureCalls:()=>captureCalls,setReceipt:(status:string,amount='18.00')=>{receiptStatus=status;capturedAmount=amount;}};
}
describe('sandbox PayPal to the real invoice ledger',()=>{
 it('pays tea first and later shipping through separate PayPal captures without a second stock deduction',async()=>{
  const f=await fixture(true);expect(await(await f.request(f.path)).json()).toMatchObject({enabled:true,outstanding_usd:14});await f.create();
  expect(await(await f.capture()).json()).toMatchObject({state:'completed',paid_usd:14,outstanding_usd:0});
  expect((await f.request('/api/rpc/ship-invoice',{invoice_id:f.id},true)).status).toBe(409);
  expect((await f.request('/api/invoices/'+f.id,{shipping_cost_usd:4},true,'PUT')).status).toBe(200);
  expect(await(await f.request(f.path)).json()).toMatchObject({enabled:true,outstanding_usd:4});
  expect(await(await f.create()).json()).toMatchObject({order_id:'TESTORDER223456789'});
  for(let i=0;i<2;i++)expect(await(await f.capture('TESTORDER223456789')).json()).toMatchObject({state:'completed',paid_usd:18,outstanding_usd:0});
  expect(f.captureCalls()).toBe(2);expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoice_payments').get()!.n).toBe(2);
  expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id=?').get(f.id)!.n).toBe(1);
  expect(f.db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea'").get()!.stock_grams).toBe(950);
 });

 it('automatically confirms a verified capture and deducts test stock once, including repeat return',async()=>{
  const f=await fixture();expect(await (await f.request(f.path)).json()).toMatchObject({enabled:true,outstanding_usd:18});expect((await f.create()).status).toBe(201);
  for(let i=0;i<2;i++){const r=await f.capture();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({state:'completed',payment_status:'paid',paid_usd:18,outstanding_usd:0});}
  expect(f.captureCalls()).toBe(1);expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoice_payments WHERE invoice_id=? AND status=\'confirmed\'').get(f.id)!.n).toBe(1);
  expect(f.db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea'").get()!.stock_grams).toBe(950);
  expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id=?').get(f.id)!.n).toBe(1);
  const view=await (await f.request('/api/inquiries/'+f.token)).json() as any;expect(view.payment).toMatchObject({paid_usd:18,outstanding_usd:0});expect(JSON.stringify(view)).not.toContain('test-secret');
 });
 it.each(['quote','expired','cancelled'])('refuses capture after %s without moving money',async change=>{
  const f=await fixture();await f.create();
  if(change==='quote')expect((await f.request('/api/invoices/'+f.id,{shipping_cost_usd:8},true,'PUT')).status).toBe(200);
  if(change==='expired')f.db.exec(`UPDATE stock_holds SET expires_at='2000-01-01';UPDATE invoices SET order_payment_deadline='2000-01-01' WHERE id='${f.id}'`);
  if(change==='cancelled')f.db.exec(`UPDATE invoices SET status='Void' WHERE id='${f.id}'`);
  expect((await f.capture()).status).toBe(409);expect(f.captureCalls()).toBe(0);expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoice_payments').get()!.n).toBe(0);
 });
 it('leaves pending provider money unpaid, then reconciles a completed receipt on retry',async()=>{
  const f=await fixture();await f.create();f.setReceipt('PENDING');expect(await (await f.capture()).json()).toMatchObject({state:'pending'});expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoice_payments').get()!.n).toBe(0);
  f.setReceipt('COMPLETED');expect(await (await f.capture()).json()).toMatchObject({state:'completed',payment_status:'paid'});expect(f.captureCalls()).toBe(1);
 });
 it('reconciles an already completed provider receipt after the local hold expires',async()=>{
  const f=await fixture();await f.create();f.setReceipt('PENDING');expect(await (await f.capture()).json()).toMatchObject({state:'pending'});
  f.db.exec(`UPDATE stock_holds SET expires_at='2000-01-01';UPDATE invoices SET order_payment_deadline='2000-01-01' WHERE id='${f.id}'`);
  f.setReceipt('COMPLETED');expect(await (await f.request(f.path+'?invoice='+f.id+'&order_id=TESTORDER123456789')).json()).toMatchObject({enabled:true});
  expect(await (await f.capture()).json()).toMatchObject({state:'completed',payment_status:'paid'});expect(f.captureCalls()).toBe(1);
 });
 it('does not settle a wrong captured amount',async()=>{
  const f=await fixture();await f.create();f.setReceipt('COMPLETED','0.01');expect((await f.capture()).status).toBe(409);expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoice_payments').get()!.n).toBe(0);
 });
 it('rejects foreign selection and unknown order without provider calls',async()=>{
  const f=await fixture();expect((await f.request(f.path,{invoice_id:'foreign-invoice'})).status).toBe(404);expect((await f.capture()).status).toBe(404);expect(f.provider).not.toHaveBeenCalled();
 });
 it('stays disabled on live origins even when sandbox configuration is present',async()=>{
  const f=await fixture();const r=await worker.fetch(new Request('https://api.teajia.com'+f.path),f.env as any,{} as any);expect(await r.json()).toEqual({enabled:false});expect(f.provider).not.toHaveBeenCalled();
 });
});
