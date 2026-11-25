import { refreshShippingWhatsAppApproval } from '../src/shippingWhatsAppApproval';
import { processPendingShippingQuoteNotifications } from '../src/shippingQuoteNotifications';
import {afterEach,describe,expect,it,vi} from 'vitest';
import worker from '../src/index';
import {SqliteD1,seedIdentity,signedToken} from './helpers/sqliteD1';
const databases:SqliteD1[]=[];
afterEach(()=>{vi.unstubAllGlobals();for(const db of databases.splice(0))db.close();});
async function fixture(contact='customer@example.test',consent=false,extra:Record<string,unknown>={}){
 const db=new SqliteD1('migrations');databases.push(db);seedIdentity(db,{userId:'owner',accountId:'shop',accountSlug:'teajia-bali',bundles:['sell']});seedIdentity(db,{userId:'foreign-owner',accountId:'foreign',bundles:['sell']});
 db.exec(`UPDATE accounts SET owner_user_id='owner',default_shipping_rate_per_kg=0,default_shipping_rate_currency='USD',whatsapp_number='+6281339712339',order_whatsapp_notifications_enabled=1 WHERE id='shop';INSERT INTO exchange_rates(currency,rate_to_usd) VALUES('USD',1);INSERT INTO products(id,account_id,type,product_name,form,cost_amount,cost_currency,quantity_purchased,stock_grams,is_public,shown_in_shop,status,stock_known_at) VALUES('tea','shop','Red','Test tea','Loose',20,'USD',300,1000,1,1,'Active',datetime('now'));`);
 const env:any={DB:db,JWT_SECRET:'notification-test',KEY_ENCRYPTION_SECRET:'test-only-sealing-key',APP_URL:'https://www.teajia.com',SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED:'true',SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID:'shop',RESEND_API_KEY:'test-resend-key',SENDER_EMAIL:'orders@example.test',PAYPAL_LIVE_WEBHOOK_ID:'test-webhook',PAYPAL_LIVE_ENABLED:'true',PAYPAL_LIVE_ACCOUNT_ID:'shop',PAYPAL_LIVE_CLIENT_ID:'test-client',PAYPAL_LIVE_CLIENT_SECRET:'test-secret',PAYPAL_LIVE_MERCHANT_ID:'TESTMERCHANT',INQUIRY_LIMITER:{limit:async()=>({success:true})}};
 const auth=await signedToken(env.JWT_SECRET,{sub:'owner',email:'owner@example.test',active_account_id:'shop',role:'owner'});
 const messages:any[]=[];vi.stubGlobal('fetch',vi.fn(async(url:any,init?:RequestInit)=>{expect(String(url)).toBe('https://api.resend.com/emails');messages.push({body:JSON.parse(String(init?.body)),headers:init?.headers});return Response.json({id:'email-'+messages.length});}));
 const request=(path:string,body?:any,admin=false,method=body?'POST':'GET')=>worker.fetch(new Request('https://api.teajia.com'+path,{method,headers:{'Content-Type':'application/json',...(admin?{Authorization:'Bearer '+auth,'X-Teajia-Account':'shop'}:{})},body:body&&JSON.stringify(body)}),env,{} as any);
 const token='shippingnotice'+crypto.randomUUID().replaceAll('-','');
 const response=await request('/api/inquiries',{source:'website',store_slug:'teajia-bali',tracking_token:token,ref_number:'TEST-'+crypto.randomUUID().slice(0,8),customer_name:'Customer',customer_contact:contact,whatsapp_confirmation_consent:consent,...extra,customer_location:'Austin, TX 78701, United States',delivery_address:'123 Test St',delivery_city:'Austin',delivery_state:'TX',delivery_country:'US',us_shipping_postcode:'78701',delivery_method:'international',currency:'USD',total_estimate_usd:14,items:[{id:'tea',name:'Test tea',category:'tea',storeSlug:'teajia-bali',quantityGrams:50,packGrams:25,packs:2,pricePerGram:.28,totalPrice:14}]});expect(response.status).toBe(201);const created=await response.json()as any;
 const quote=(usd:number)=>request('/api/invoices/'+created.invoice_id,{shipping_cost_usd:usd},true,'PUT');
 return{db,env,request,token,id:created.invoice_id,quote,messages};
}
describe('shipping quote save notifications',()=>{
 it('saves a protected customer target and sends the same private order link after quote save',async()=>{
  const f=await fixture();const target=f.db.sqlite.prepare('SELECT channel,tracking_token_sealed FROM order_shipping_notification_targets').get()!;expect(target.channel).toBe('email');expect(target.tracking_token_sealed).not.toContain(f.token);
  expect((await f.quote(8)).status).toBe(200);expect(f.messages).toHaveLength(1);expect(f.messages[0].body.to).toBe('customer@example.test');expect(f.messages[0].body.text).toContain('/order/'+f.token);expect(f.messages[0].body.text).toContain(encodeURIComponent(f.id));
  const status=await(await f.request('/api/invoices/'+f.id+'/shipping-notification',undefined,true)).json();expect(status).toMatchObject({state:'accepted',channel:'email'});expect(JSON.stringify(status)).not.toContain(f.token);expect(JSON.stringify(status)).not.toContain('customer@example.test');
 });
 it('requests only the shipping balance after tea was paid, without allocating stock twice',async()=>{
  const f=await fixture();expect((await f.request('/api/invoices/'+f.id+'/payments',{amount_usd:14,method_label:'Test tea payment'},true)).status).toBe(201);
  const stock=f.db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea'").get()!.stock_grams;
  await f.quote(8);expect(f.messages).toHaveLength(1);expect(f.messages[0].body.text).toContain('Total remaining balance: USD 8.00');
  expect(f.db.sqlite.prepare("SELECT stock_grams FROM products WHERE id='tea'").get()!.stock_grams).toBe(stock);
 });
 it('does not resend unchanged quotes, but a revised quote creates its own request',async()=>{const f=await fixture();await f.quote(8);await f.quote(8);expect(f.messages).toHaveLength(1);await f.quote(9);expect(f.messages).toHaveLength(2);expect(f.db.sqlite.prepare('SELECT shipping_quote_revision FROM invoices WHERE id=?').get(f.id)!.shipping_quote_revision).toBe(2);});
 it('prefers consented WhatsApp and explicitly holds unsent messages when its setup is missing',async()=>{const f=await fixture('+14155550123',true);await f.quote(8);expect(f.messages).toHaveLength(0);expect(await(await f.request('/api/invoices/'+f.id+'/shipping-notification',undefined,true)).json()).toMatchObject({state:'config_required',channel:'whatsapp',code:'whatsapp_setup_required'});});
 it('recovers a stale unavailable approval and sends the waiting quote once after approval', async () => {
  const f = await fixture('+14155550123', true);
  Object.assign(f.env, {
   WHATSAPP_TRANSPORT: 'kapso', KAPSO_API_KEY: 'test-kapso', WHATSAPP_ORDER_ACCOUNT_ID: 'shop',
   WHATSAPP_SENDER_NUMBER: '+6281339712339', WHATSAPP_PHONE_NUMBER_ID: '1234567890',
   WHATSAPP_GRAPH_API_VERSION: 'v24.0', WHATSAPP_ORDER_TEMPLATE_LANGUAGE: 'en_US',
   SHIPPING_PAYMENT_TEMPLATE_NAME: 'teajia_shipping_payment_v1',
   SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID: '444444444444', WHATSAPP_CUSTOMER_CONFIRMATIONS_ENABLED: 'false',
  });
  let status = 'unavailable';
  let metadataReads = 0;
  let messages = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
   const endpoint = new URL(url);
   expect(endpoint.origin).toBe('https://api.kapso.ai');
   if (endpoint.pathname.endsWith('/message_templates')) {
    metadataReads++;
    if (status === 'unavailable') return new Response(null, { status: 503 });
    return Response.json({ data: [{
     name: 'teajia_shipping_payment_v1', language: 'en_US', category: 'UTILITY', status,
     components: [{ type: 'BODY', text: 'Hi {{1}}, order {{2}} shipping {{3}}, balance {{4}}. Pay: {{5}}' }],
    }] });
   }
   expect(endpoint.pathname).toBe('/meta/whatsapp/v24.0/1234567890/messages');
   expect(init?.method).toBe('POST');
   messages++;
   return Response.json({ messages: [{ id: 'wa-shipping-test' }] });
  }));
  const readiness = async () => (await f.request('/api/public/shipping-notifications')).json();
  const notice = async () => (await f.request('/api/invoices/' + f.id + '/shipping-notification', undefined, true)).json();
  const runNotificationTick = async () => {
   await refreshShippingWhatsAppApproval(f.db as any, f.env);
   await processPendingShippingQuoteNotifications(f.db as any, f.env, { limit: 10 });
  };
  const ageApproval = () => f.db.exec("UPDATE shipping_whatsapp_approval SET checked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-16 minutes')");
  expect((await f.quote(8)).status).toBe(200);
  expect(await readiness()).toMatchObject({ email_enabled: true, whatsapp_state: 'unavailable' });
  expect(await notice()).toMatchObject({ state: 'config_required', code: 'whatsapp_template_verification_unavailable' });
  expect(metadataReads).toBe(2);
  expect(messages).toBe(0);

  status = 'PENDING';
  await runNotificationTick();
  expect(metadataReads).toBe(2);
  ageApproval();
  await runNotificationTick();
  expect(await readiness()).toMatchObject({ email_enabled: true, whatsapp_state: 'pending' });
  expect(await notice()).toMatchObject({ state: 'config_required', code: 'whatsapp_template_pending' });
  expect(messages).toBe(0);

  status = 'APPROVED';
  ageApproval();
  await runNotificationTick();
  expect(await readiness()).toMatchObject({ email_enabled: true, whatsapp_state: 'approved' });
  expect(await notice()).toMatchObject({ state: 'accepted', channel: 'whatsapp' });
  await runNotificationTick();
  expect((await f.quote(8)).status).toBe(200);
  expect(metadataReads).toBe(4);
  expect(messages).toBe(1);
 });
 it('emails the shipping payment to the address left after unticking WhatsApp updates',async()=>{const f=await fixture('+14155550123',false,{update_email:'unticked@example.test'});await f.quote(8);expect(f.messages).toHaveLength(1);expect(f.messages[0].body.to).toBe('unticked@example.test');});
 it('refuses an update email that is not an email',async()=>{await expect(fixture('+14155550123',false,{update_email:'nope'})).rejects.toThrow();});
 it('does not send a shipping payment request for deliberately free shipping',async()=>{const f=await fixture();await f.quote(0);expect(f.messages).toHaveLength(0);expect(f.db.sqlite.prepare('SELECT COUNT(*) AS n FROM shipping_payment_notifications').get()!.n).toBe(0);});
 it('does not expose another store notice or accept unauthenticated status reads',async()=>{const f=await fixture();expect((await f.request('/api/invoices/'+f.id+'/shipping-notification')).status).toBe(401);const foreign=await signedToken(f.env.JWT_SECRET,{sub:'foreign-owner',email:'foreign@example.test',active_account_id:'foreign',role:'owner'});const r=await worker.fetch(new Request('https://api.teajia.com/api/invoices/'+f.id+'/shipping-notification',{headers:{Authorization:'Bearer '+foreign,'X-Teajia-Account':'foreign'}}),f.env,{}as any);expect(r.status).toBe(404);});
 it('recovers an older private order link only after its capability is validated',async()=>{const f=await fixture();f.db.sqlite.prepare('DELETE FROM order_shipping_notification_targets').run();await f.quote(8);expect(f.messages).toHaveLength(0);expect((await f.request('/api/inquiries/'+'x'.repeat(40))).status).toBe(404);expect(f.messages).toHaveLength(0);expect((await f.request('/api/inquiries/'+f.token)).status).toBe(200);expect(f.messages).toHaveLength(1);expect(f.messages[0].body.text).toContain('/order/'+f.token);});
});
