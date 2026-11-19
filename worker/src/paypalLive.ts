/** Production PayPal transport. Fixed provider origin, separate receipts and credentials. */
export interface PayPalLiveEnv {
 DB: D1Database; APP_URL?: string;
 PAYPAL_LIVE_ENABLED?: string; PAYPAL_LIVE_ACCOUNT_ID?: string;
 PAYPAL_LIVE_WEBHOOK_ID?: string;
 PAYPAL_LIVE_CLIENT_ID?: string; PAYPAL_LIVE_CLIENT_SECRET?: string; PAYPAL_LIVE_MERCHANT_ID?: string;
}
export interface LiveInvoice {
 id: string; account_id: string; invoice_number: string | null; amount_usd: number; quote_key: string; deadline: string; capture_allowed?: boolean; shipping_later?: boolean; pickup?: boolean; shipping?: { name: { full_name: string }; address: { address_line_1: string; address_line_2?: string; admin_area_2: string; admin_area_1: string; postal_code: string; country_code: string } };
}
export interface LiveCapture {
 invoice_id: string; account_id: string; capture_id: string; amount_usd: number; order_id: string;
}
interface LiveDependencies {
 load: (invoiceId?: string, allowSettled?: boolean) => Promise<LiveInvoice | Response>;
 settle: (capture: LiveCapture) => Promise<Record<string, unknown>>;
}
interface Attempt { id: string; invoice_id: string; account_id: string; quote_key: string; amount_usd: number; paypal_order_id: string | null; approval_url: string | null; capture_id: string | null; state: string }
function reply(body: unknown, status = 200) { return Response.json(body, {status}); }
function trustedHost(url: string, app = false) { try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && (app ? ['teajia.com','www.teajia.com'] : ['teajia.com','www.teajia.com','api.teajia.com','teajia-api.lightcodes.workers.dev']).includes(u.hostname) && !u.port; } catch { return false; } }
export function paypalLiveEnabled(request: Request, env: PayPalLiveEnv): boolean {
 return trustedHost(request.url) && trustedHost(env.APP_URL || '', true) && env.PAYPAL_LIVE_ENABLED === 'true' &&
 Boolean(env.PAYPAL_LIVE_ACCOUNT_ID && env.PAYPAL_LIVE_CLIENT_ID && env.PAYPAL_LIVE_CLIENT_SECRET && env.PAYPAL_LIVE_MERCHANT_ID && env.PAYPAL_LIVE_WEBHOOK_ID);
}
export async function paypalLiveRequest(env: PayPalLiveEnv, path: string, body?: unknown, requestId?: string): Promise<any> {
 const token=await fetch('https://api-m.paypal.com/v1/oauth2/token',{
  method:'POST',headers:{Authorization:'Basic '+btoa(env.PAYPAL_LIVE_CLIENT_ID+':'+env.PAYPAL_LIVE_CLIENT_SECRET),'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',redirect:'error',signal:AbortSignal.timeout(10000),
 });
 if(!token.ok)throw new Error('paypal_provider_unavailable');const credentials=await token.json() as {access_token?:string};if(!credentials.access_token)throw new Error('paypal_provider_unavailable');
 const response=await fetch('https://api-m.paypal.com'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+credentials.access_token,'Content-Type':'application/json',...(requestId?{'PayPal-Request-Id':requestId}:{}),'Prefer':'return=representation'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('paypal_provider_unavailable');return response.json();
}
function validApproval(url: unknown): url is string { try { const u=new URL(String(url));return u.protocol==='https:'&&['www.paypal.com','paypal.com'].includes(u.hostname)&&u.pathname==='/checkoutnow'; }catch{return false;} }
function cents(value: unknown) { if(typeof value!=='string'||!/^\d+\.\d{2}$/.test(value))return null;const n=Math.round(Number(value)*100);return Number.isSafeInteger(n)?n:null; }
function verifiedUnit(order: any, attempt: Attempt, env: PayPalLiveEnv) {
 const units=order?.purchase_units;if(order?.id!==attempt.paypal_order_id||!Array.isArray(units)||units.length!==1)return null;
 const unit=units[0];return unit.custom_id===attempt.id&&unit.payee?.merchant_id===env.PAYPAL_LIVE_MERCHANT_ID&&unit.amount?.currency_code==='USD'&&cents(unit.amount.value)===Math.round(attempt.amount_usd*100)?unit:null;
}
export async function paypalLiveRoutes(request: Request, env: PayPalLiveEnv, trackingToken: string, dependencies: LiveDependencies): Promise<Response> {
 const enabled=paypalLiveEnabled(request,env);
 if(!enabled)return request.method==='GET'?reply({enabled:false}):reply({error:'PayPal checkout is not configured.',code:'paypal_disabled'},404);
 try {
  const input=request.method==='POST'?await request.json().catch(()=>null) as Record<string,unknown>|null:null;
  if(request.method==='POST'&&(!input||typeof input!=='object'||Array.isArray(input)))return reply({error:'Invalid checkout request.'},400);
  const invoiceId=input?.invoice_id??new URL(request.url).searchParams.get('invoice')??undefined;
  if(invoiceId!==undefined&&(typeof invoiceId!=='string'||invoiceId.length>128))return reply({error:'Order not found.'},404);
  const capture=new URL(request.url).pathname.endsWith('/capture');
  const invoice=await dependencies.load(invoiceId as string|undefined,capture);if(invoice instanceof Response)return invoice;
  if(invoice.account_id!==env.PAYPAL_LIVE_ACCOUNT_ID)return reply({error:'Order not found.'},404);
  if(request.method==='GET')return reply({enabled:invoice.amount_usd>0||new URL(request.url).searchParams.has('order_id'),outstanding_usd:invoice.amount_usd,shipping_later:invoice.shipping_later===true});
  if(!capture){
   if(!invoice.pickup&&!invoice.shipping)return reply({error:'Add a complete US shipping address before paying.',code:'paypal_address_required'},409);
   if(!Number.isFinite(invoice.amount_usd)||!Number.isSafeInteger(Math.round(invoice.amount_usd*100))||invoice.amount_usd<=0)return reply({error:'Nothing outstanding.'},409);
   const id=crypto.randomUUID();
   await env.DB.prepare(`INSERT OR IGNORE INTO paypal_live_orders(id,account_id,invoice_id,quote_key,amount_usd) VALUES(?,?,?,?,?)`).bind(id,invoice.account_id,invoice.id,invoice.quote_key,invoice.amount_usd).run();
   let attempt=await env.DB.prepare("SELECT * FROM paypal_live_orders WHERE account_id=? AND invoice_id=? AND quote_key=? AND state!='failed'").bind(invoice.account_id,invoice.id,invoice.quote_key).first<Attempt>();if(!attempt)throw new Error('paypal_attempt_missing');
   if(!attempt.paypal_order_id){
    const returnUrl=new URL('/order/'+encodeURIComponent(trackingToken),env.APP_URL);returnUrl.searchParams.set('invoice',invoice.id);returnUrl.searchParams.set('paypal_live_return','1');
    const cancelUrl=new URL(returnUrl);cancelUrl.searchParams.delete('paypal_live_return');cancelUrl.searchParams.set('paypal_live_cancel','1');
    const created=await paypalLiveRequest(env,'/v2/checkout/orders',{intent:'CAPTURE',purchase_units:[{description:invoice.shipping_later?'Tea payment only. Shipping is quoted and charged separately later.':'Payment for invoice '+(invoice.invoice_number||invoice.id),...(invoice.shipping?{shipping:invoice.shipping}:{}),custom_id:attempt.id,invoice_id:'live-'+attempt.id,payee:{merchant_id:env.PAYPAL_LIVE_MERCHANT_ID},amount:{currency_code:'USD',value:invoice.amount_usd.toFixed(2)}}],payment_source:{paypal:{experience_context:{return_url:returnUrl.href,cancel_url:cancelUrl.href,user_action:'PAY_NOW',shipping_preference:invoice.pickup?'NO_SHIPPING':'SET_PROVIDED_ADDRESS'}}}},attempt.id);
    const link=created.links?.find((l:any)=>l.rel==='payer-action'||l.rel==='approve')?.href;
    if(!/^[A-Z0-9]{8,32}$/.test(created.id||'')||!validApproval(link))throw new Error('paypal_invalid_provider_order');
    await env.DB.prepare('UPDATE paypal_live_orders SET paypal_order_id=?,approval_url=? WHERE id=? AND paypal_order_id IS NULL').bind(created.id,link,attempt.id).run();
    attempt={...attempt,paypal_order_id:created.id,approval_url:link};
   }
   return reply({order_id:attempt.paypal_order_id,approval_url:attempt.approval_url},201);
  }
  const orderId=input?.order_id;if(typeof orderId!=='string'||!/^[A-Z0-9]{8,32}$/.test(orderId))return reply({error:'Unknown payment.'},404);
  const attempt=await env.DB.prepare('SELECT * FROM paypal_live_orders WHERE paypal_order_id=? AND invoice_id=? AND account_id=?').bind(orderId,invoice.id,invoice.account_id).first<Attempt>();
  if(!attempt)return reply({error:'Unknown payment.'},404);
  // Always read back from PayPal. Neither the return URL nor a browser success message proves payment.
  let order=await paypalLiveRequest(env,'/v2/checkout/orders/'+encodeURIComponent(orderId));
  let unit=verifiedUnit(order,attempt,env);if(!unit)return reply({error:'PayPal payment does not match this order.',code:'paypal_payment_mismatch'},409);
  const failed = async () => { await env.DB.prepare("UPDATE paypal_live_orders SET state='failed' WHERE id=? AND capture_id IS NULL").bind(attempt.id).run(); return reply({error:'PayPal declined or ended this payment. Start a new checkout.',code:'paypal_payment_failed'},409); };
  if(order.status==='VOIDED')return failed();
  if(!unit.payments?.captures?.length){
   if(invoice.capture_allowed===false||attempt.quote_key!==invoice.quote_key||attempt.amount_usd!==invoice.amount_usd)return reply({error:'Order total or availability changed. Start checkout again.',code:'paypal_quote_changed'},409);
   if(order.status!=='APPROVED')return reply({state:'pending'});
   order=await paypalLiveRequest(env,'/v2/checkout/orders/'+encodeURIComponent(orderId)+'/capture',{},attempt.id);
   unit=verifiedUnit(order,attempt,env);if(!unit)return reply({error:'PayPal payment does not match this order.',code:'paypal_payment_mismatch'},409);
  }
  const captures=unit.payments?.captures;if(!Array.isArray(captures)||captures.length!==1)return reply({state:'pending'});
  const receipt=captures[0];if(receipt.status==='PENDING')return reply({state:'pending'});
  if(receipt.status!=='COMPLETED')return failed();
  if(!/^[A-Z0-9]{8,32}$/.test(receipt.id||'')||receipt.amount?.currency_code!=='USD'||cents(receipt.amount?.value)!==Math.round(attempt.amount_usd*100))return reply({error:'PayPal receipt amount does not match.',code:'paypal_payment_mismatch'},409);
  // Keep the provider receipt before settlement, so a failed local write can safely reconcile on retry.
  await env.DB.prepare("UPDATE paypal_live_orders SET capture_id=?,state='completed' WHERE id=? AND (capture_id IS NULL OR capture_id=?)").bind(receipt.id,attempt.id,receipt.id).run();
  const result=await dependencies.settle({invoice_id:invoice.id,account_id:invoice.account_id,capture_id:receipt.id,order_id:orderId,amount_usd:attempt.amount_usd});
  return reply({state:'completed',...result});
 }catch{return reply({error:'PayPal payment could not be verified. Retry to check its status; do not pay again.',code:'paypal_verification_unavailable'},503);}
}

/** Verify with PayPal, never fetch a caller-supplied certificate URL ourselves. */
export async function verifyPayPalLiveWebhook(request: Request, env: PayPalLiveEnv): Promise<Record<string, any> | null> {
 if (!paypalLiveEnabled(request,env)) return null;
 const text = await request.text(); if (text.length > 262144) return null;
 let event: Record<string, any>; try { event=JSON.parse(text); } catch { return null; }
 const fields = ['paypal-auth-algo','paypal-cert-url','paypal-transmission-id','paypal-transmission-sig','paypal-transmission-time'];
 if(fields.some(name => !request.headers.get(name)))return null;
 try {
  const result=await paypalLiveRequest(env,'/v1/notifications/verify-webhook-signature',{
   auth_algo:request.headers.get(fields[0]),cert_url:request.headers.get(fields[1]),transmission_id:request.headers.get(fields[2]),transmission_sig:request.headers.get(fields[3]),transmission_time:request.headers.get(fields[4]),webhook_id:env.PAYPAL_LIVE_WEBHOOK_ID,webhook_event:event,
  });
  return result.verification_status==='SUCCESS'?event:null;
 } catch { throw new Error('paypal_webhook_verification_unavailable'); }
}
export function paypalUSShipping(fullName: string | null, raw: string | null): LiveInvoice['shipping'] | undefined {
 if(!fullName?.trim() || !raw)return undefined;
 const lines=raw.trim().split('\n').map(line=>line.trim());
 if(lines.pop()!=='United States')return undefined;
 const locality=lines.pop()?.match(/^([^,\n]+), ([A-Z]{2}) (\d{5}(?:-\d{4})?)$/);
 if(!locality || !lines.length || lines.some(line=>!line) || lines.length>2 || lines.some(line=>line.length>300) || fullName.length>300)return undefined;
 return {name:{full_name:fullName.trim()},address:{address_line_1:lines[0],...(lines[1]?{address_line_2:lines[1]}:{}),admin_area_2:locality[1],admin_area_1:locality[2],postal_code:locality[3],country_code:'US'}};
}
