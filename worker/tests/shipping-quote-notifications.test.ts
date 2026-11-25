import {afterEach,describe,expect,it,vi} from 'vitest';
import {SqliteD1,seedIdentity} from './helpers/sqliteD1';
import {prepareShippingNotificationTarget,buildShippingQuoteNotificationInsert,processShippingQuoteNotifications,getShippingQuoteNotificationStatus,type ShippingNotificationEnv} from '../src/shippingQuoteNotifications';
const databases:SqliteD1[]=[];
afterEach(()=>{for(const db of databases.splice(0))db.close();});
const token='private_shipping_tracking_'+ 'a'.repeat(32);
const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
async function fixture(whatsapp=false){
 const db=new SqliteD1('schema');databases.push(db);seedIdentity(db,{accountId:'shop',userId:'owner'});
 db.exec(`INSERT INTO inquiries(id,account_id,name,email,converted_invoice_id) VALUES('inquiry','shop','Test Buyer','buyer@example.test','invoice');
 INSERT INTO invoices(id,account_id,invoice_number,customer_name,source_inquiry_id,status,payment_status,fulfillment_method,shipping_quote_status,shipping_cost_usd,shipping_quote_revision)
 VALUES('invoice','shop','TEST-001','Test Buyer','inquiry','Pending','partial','us_shipping','confirmed',8,1);
 INSERT INTO invoice_line_items(id,account_id,invoice_id,custom_name,quantity,price_at_sale) VALUES('line','shop','invoice','Test tea',1,14);
 UPDATE accounts SET whatsapp_number='+6281339712339',order_whatsapp_notifications_enabled=1 WHERE id='shop';`);
 db.sqlite.prepare('UPDATE inquiries SET tracking_token_hash=?').run(await hash(token));
 db.exec("INSERT INTO invoice_payments(id,account_id,invoice_id,amount_usd,status,claimed_by) VALUES('payment','shop','invoice',14,'confirmed','operator')");
 const env:ShippingNotificationEnv={KEY_ENCRYPTION_SECRET:'test-key-not-live',APP_URL:'https://www.teajia.com',SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED:'true',SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID:'shop',RESEND_API_KEY:'email-test-key',SENDER_EMAIL:'orders@example.test',SENDER_NAME:'Teajia',WHATSAPP_TRANSPORT:'kapso',KAPSO_API_KEY:'kapso-test-key',WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED:'true',WHATSAPP_ORDER_ACCOUNT_ID:'shop',WHATSAPP_PHONE_NUMBER_ID:'1234567890',WHATSAPP_SENDER_NUMBER:'+6281339712339',WHATSAPP_ORDER_TEMPLATE_LANGUAGE:'en_US',WHATSAPP_GRAPH_API_VERSION:'v24.0',SHIPPING_PAYMENT_TEMPLATE_NAME:'teajia_shipping_payment_v1',SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID:'444444444444'};
 const prepare=(overrides:Record<string,unknown>={})=>prepareShippingNotificationTarget(db as any,env,{accountId:'shop',inquiryId:'inquiry',trackingToken:token,email:'buyer@example.test',...(whatsapp?{whatsappNumber:'+14155550100',whatsappConsentAt:new Date().toISOString()}:{}),...overrides});
 if(whatsapp)db.sqlite.prepare(`INSERT INTO shipping_whatsapp_approval(account_id,template_name,language,business_account_id,transport,graph_version,state,checked_at,last_approved_at)
 VALUES('shop','teajia_shipping_payment_v1','en_US','444444444444','kapso','v24.0','approved',?,?)`).run(new Date().toISOString(),new Date().toISOString());
 await(await prepare()).run();
 const enqueue=(revision=1,invoiceId='invoice',accountId='shop')=>buildShippingQuoteNotificationInsert(db as any,{accountId,invoiceId,expectedRevision:revision}).run();
 await enqueue();
 const fetcher=vi.fn(async()=>Response.json(whatsapp?{messages:[{id:'wa-receipt'}]}:{id:'email-receipt'}));
 const process=()=>processShippingQuoteNotifications(db as any,env,{fetcher:fetcher as any,accountId:'shop',invoiceId:'invoice'});
 const row=()=>db.sqlite.prepare('SELECT * FROM shipping_payment_notifications WHERE invoice_id=\'invoice\' ORDER BY quote_revision DESC').get()!;
 return{db,env,prepare,enqueue,fetcher,process,row};
}
describe('shipping payment notifications',()=>{
 it('encrypts private capability at rest and uses the current outstanding ledger balance',async()=>{
  const f=await fixture();expect(JSON.stringify(f.db.sqlite.prepare('SELECT * FROM order_shipping_notification_targets').get())).not.toContain(token);
  expect(await f.process()).toMatchObject({accepted:1});const [url,init]=f.fetcher.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('https://api.resend.com/emails');const body=JSON.parse(String(init.body));expect(body.to).toBe('buyer@example.test');expect(body.text).toContain('shipping quote for your Teajia order TEST-001 is USD 8.00');expect(body.text).toContain('Total remaining balance: USD 8.00');expect(body.text).toContain('/order/'+token+'?invoice=invoice');
  expect(JSON.stringify(f.db.sqlite.prepare('SELECT * FROM shipping_payment_notifications').get())).not.toContain(token);
  const status=await getShippingQuoteNotificationStatus(f.db as any,'shop','invoice');expect(status).toMatchObject({state:'accepted',channel:'email'});expect(JSON.stringify(status)).not.toContain('buyer@');expect(status.accepted_at).toBeTruthy();
 });
 it('does not send twice for repeated saves or concurrent dispatches',async()=>{
  const f=await fixture();await f.enqueue();expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM shipping_payment_notifications').get()!.n).toBe(1);
  await Promise.all([f.process(),f.process()]);await f.process();expect(f.fetcher).toHaveBeenCalledTimes(1);
 });
 it('suppresses an old unsent quote and sends the latest revision only',async()=>{
  const f=await fixture();f.db.exec('UPDATE invoices SET shipping_cost_usd=9,shipping_quote_revision=2');await f.enqueue(2);await f.process();
  expect(f.fetcher).toHaveBeenCalledTimes(1);expect(JSON.parse(String((f.fetcher.mock.calls[0] as any)[1].body)).text).toContain('USD 9.00');
  expect(f.db.sqlite.prepare('SELECT state FROM shipping_payment_notifications WHERE quote_revision=1').get()!.state).toBe('suppressed');
 });
 it('will not enqueue a foreign revision/account or a pickup or free quote',async()=>{
  const f=await fixture();f.db.exec('DELETE FROM shipping_payment_notifications');await f.enqueue(4);await f.enqueue(1,'invoice','foreign');
  f.db.exec("UPDATE invoices SET fulfillment_method='bali_pickup'");await f.enqueue();f.db.exec("UPDATE invoices SET fulfillment_method='us_shipping',shipping_cost_usd=0");await f.enqueue();
  expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM shipping_payment_notifications').get()!.n).toBe(0);expect((await getShippingQuoteNotificationStatus(f.db as any,'shop','invoice')).state).toBe('suppressed');
 });
 it.each(['Void','Filled','paid','pickup'])('suppresses payment requests after %s',async mode=>{
  const f=await fixture();if(mode==='paid')f.db.exec("UPDATE invoice_payments SET amount_usd=22;UPDATE invoices SET payment_status='paid'");else if(mode==='pickup')f.db.exec("UPDATE invoices SET fulfillment_method='bali_pickup'");else f.db.sqlite.prepare('UPDATE invoices SET status=?,refund_required=?').run(mode,mode==='Void'?1:0);
  await f.process();expect(f.fetcher).not.toHaveBeenCalled();expect(f.row().state).toBe('suppressed');
 });
 it('keeps draft quote pending until operator accepts it and includes unpaid tea in remaining balance',async()=>{
  const f=await fixture();f.db.exec("UPDATE invoices SET status='Draft',payment_status='unpaid';DELETE FROM invoice_payments");await f.process();expect(f.fetcher).not.toHaveBeenCalled();expect(f.row().state).toBe('pending');
  f.db.exec("UPDATE invoices SET status='Pending'");await f.process();expect(JSON.parse(String((f.fetcher.mock.calls[0] as any)[1].body)).text).toContain('Total remaining balance: USD 22.00');
 });
 it('selects consented WhatsApp ahead of email and uses the dedicated five-variable template',async()=>{
  const f=await fixture(true);f.env.WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED='false';await f.process();const [url,init]=f.fetcher.mock.calls[0] as any;
  expect(url).toBe('https://api.kapso.ai/meta/whatsapp/v24.0/1234567890/messages');expect(init.headers['X-API-Key']).toBe('kapso-test-key');expect(init.headers.Authorization).toBeUndefined();
  const p=JSON.parse(init.body);expect(p.to).toBe('14155550100');expect(p.template.name).toBe('teajia_shipping_payment_v1');expect(p.template.components[0].parameters.map((p:any)=>p.text)).toEqual(['Test Buyer','TEST-001','USD 8.00','USD 8.00','https://www.teajia.com/order/'+token+'?invoice=invoice']);
 });
 it('uses email when WhatsApp consent was not given and never retargets from a repeat request',async()=>{
  const f=await fixture();await(await f.prepare({email:'attacker@example.test',whatsappNumber:'+14155550100',whatsappConsentAt:new Date().toISOString()})).run();
  await f.process();expect(JSON.parse(String((f.fetcher.mock.calls[0] as any)[1].body)).to).toBe('buyer@example.test');
 });
 it.each([
  ['not set up',(f:any)=>{delete f.env.SHIPPING_PAYMENT_TEMPLATE_NAME;}],
  ['not approved',(f:any)=>{f.db.exec("UPDATE shipping_whatsapp_approval SET state='rejected'");}],
  ['unavailable',(f:any)=>{f.db.exec('DELETE FROM shipping_whatsapp_approval');f.fetcher.mockImplementationOnce(async()=>{throw new TypeError('fetch failed');});}],
 ] as const)('emails them instead when chosen WhatsApp is %s and an email is on file',async(_label,breakWhatsApp)=>{
  const f=await fixture(true);f.fetcher.mockImplementation(async()=>Response.json({id:'email-receipt'}));breakWhatsApp(f);await f.process();
  const [url,init]=f.fetcher.mock.calls.at(-1) as any;expect(url).toBe('https://api.resend.com/emails');expect(JSON.parse(init.body).to).toBe('buyer@example.test');
  expect(await getShippingQuoteNotificationStatus(f.db as any,'shop','invoice')).toMatchObject({state:'accepted',channel:'email'});
 });
 it('waits for WhatsApp when it is unavailable and no email is on file',async()=>{
  const f=await fixture(true);f.db.exec('DELETE FROM order_shipping_notification_targets');await(await f.prepare({email:null})).run();delete f.env.SHIPPING_PAYMENT_TEMPLATE_NAME;await f.process();
  expect(f.fetcher).not.toHaveBeenCalled();expect(await getShippingQuoteNotificationStatus(f.db as any,'shop','invoice')).toMatchObject({state:'config_required',channel:'whatsapp',code:'whatsapp_setup_required'});
 });
 it('never emails after a WhatsApp request may have gone out',async()=>{
  const f=await fixture(true);f.fetcher.mockImplementation(async()=>{throw new TypeError('fetch failed');});await f.process();
  expect(f.fetcher.mock.calls.every((c:any)=>!String(c[0]).includes('resend'))).toBe(true);expect(f.row().state).toBe('review_required');
 });
 it('fails closed nonfatally when sealing key or contact is unavailable',async()=>{
  const f=await fixture();f.db.exec('DELETE FROM order_shipping_notification_targets');delete f.env.KEY_ENCRYPTION_SECRET;await(await f.prepare()).run();await f.process();expect(f.row().code).toBe('secure_link_unavailable');expect(f.fetcher).not.toHaveBeenCalled();
  f.db.exec('DELETE FROM order_shipping_notification_targets');await(await f.prepare({email:null})).run();await f.process();expect(f.row().state).toBe('needs_contact');expect(JSON.stringify(f.db.sqlite.prepare('SELECT * FROM order_shipping_notification_targets').get())).not.toContain(token);
 });
 it('binds the decrypted private link to its original inquiry hash',async()=>{
  const f=await fixture();f.db.exec("UPDATE inquiries SET tracking_token_hash='different'");await f.process();expect(f.row().code).toBe('private_link_mismatch');expect(f.fetcher).not.toHaveBeenCalled();
 });
 it('builds a split-child payment URL with the parent private capability',async()=>{
  const f=await fixture();f.db.exec("INSERT INTO invoices(id,account_id,invoice_number,source_inquiry_id,status,payment_status,fulfillment_method,shipping_quote_status,shipping_cost_usd,shipping_quote_revision) VALUES('child','shop','TEST-002','inquiry','Pending','unpaid','us_shipping','confirmed',5,1)");await f.enqueue(1,'child');
  await processShippingQuoteNotifications(f.db as any,f.env,{accountId:'shop',invoiceId:'child',fetcher:f.fetcher as any});expect(JSON.parse(String((f.fetcher.mock.calls[0] as any)[1].body)).text).toContain('/order/'+token+'?invoice=child');
 });
 it('retries ambiguous email with the same provider idempotency key inside its retry window',async()=>{
  const f=await fixture();f.fetcher.mockRejectedValueOnce(new Error('timeout'));await f.process();expect(f.row().state).toBe('retry_scheduled');f.db.exec('UPDATE shipping_payment_notifications SET next_attempt_at=NULL');await f.process();expect(f.row().state).toBe('accepted');
  expect((f.fetcher.mock.calls[0] as any)[1].headers['Idempotency-Key']).toBe((f.fetcher.mock.calls[1] as any)[1].headers['Idempotency-Key']);expect((f.fetcher.mock.calls[0] as any)[1].body).toBe((f.fetcher.mock.calls[1] as any)[1].body);
 });
 it('holds ambiguous WhatsApp and expired email attempts for review instead of duplicating messages',async()=>{
  const w=await fixture(true);w.fetcher.mockRejectedValueOnce(new Error('timeout'));await w.process();expect(w.row().state).toBe('review_required');await w.process();expect(w.fetcher).toHaveBeenCalledTimes(1);
  const e=await fixture();e.db.exec("UPDATE shipping_payment_notifications SET attempts=1,first_attempt_at=datetime('now','-24 hours')");await e.process();expect(e.row().code).toBe('retry_window_expired');expect(e.fetcher).not.toHaveBeenCalled();
 });
 it('requires explicit account enablement and never sends without it',async()=>{
  const f=await fixture();delete f.env.SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED;await f.process();expect(f.row().code).toBe('shipping_notifications_disabled');expect(f.fetcher).not.toHaveBeenCalled();
 });
});
