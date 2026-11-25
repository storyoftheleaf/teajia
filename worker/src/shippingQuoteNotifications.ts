import { refreshShippingWhatsAppApproval, type ShippingWhatsAppApprovalEnv } from './shippingWhatsAppApproval';
import { encryptSecret, decryptSecret, type SealEnv } from './secretSeal';
import { internationalWhatsAppNumber } from '../../src/lib/whatsappContact';
import { invoiceMoney, loadInvoiceLedgerTotals, loadLedgerInvoice, claimInvoiceLinkLease, releaseInvoiceLinkLease } from './invoiceDomain';
import { suppressVerificationNotifications } from './liveVerificationPolicy';
import type { WhatsAppOrderEnv } from './whatsappOrderNotifications';
import { fallbackEmailFor, whatsappUnavailable } from './shippingEmailFallback';

export interface ShippingNotificationEnv extends SealEnv, WhatsAppOrderEnv, ShippingWhatsAppApprovalEnv {
 APP_URL?: string; RESEND_API_KEY?: string; SENDER_EMAIL?: string; SENDER_NAME?: string;
 SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED?: string;
 SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID?: string;
 SHIPPING_PAYMENT_TEMPLATE_NAME?: string;
}
export type ShippingNotificationState = 'not_requested'|'pending'|'sending'|'accepted'|'retry_scheduled'|'config_required'|'review_required'|'suppressed'|'needs_contact';
export interface ShippingNotificationStatus { state: ShippingNotificationState; channel: 'email'|'whatsapp'|null; code?: string; accepted_at?: string|null }
interface Target { channel: 'email'|'whatsapp'|null; recipient: string|null; consent_at: string|null; tracking_token_sealed: string|null; unavailable_code: string|null; fallback_email?: string|null }
interface Notice { id: string; account_id: string; invoice_id: string; quote_revision: number; quote_usd: number; balance_usd: number|null; state: string; attempts: number; first_attempt_at: string|null; created_at: string }
const pendingStates = "'pending','retry_scheduled','config_required','needs_contact'";
const emailAddress = (value?: string|null) => typeof value === 'string' && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim()) ? value.trim() : null;
const money = (value: number) => `USD ${value.toFixed(2)}`;
const digits = (value?:string|null) => (value || '').replace(/\D/g,'');

/** The caller adds this to the same batch as its new inquiry and invoice. No plaintext link is persisted. */
export async function prepareShippingNotificationTarget(db: D1Database, env: SealEnv, input: {
 accountId:string; inquiryId:string; trackingToken:string; email?:string|null; whatsappNumber?:string|null; whatsappConsentAt?:string|null;
}): Promise<D1PreparedStatement> {
 const whatsapp = internationalWhatsAppNumber(input.whatsappNumber);
 const consent = input.whatsappConsentAt && Number.isFinite(Date.parse(input.whatsappConsentAt)) ? input.whatsappConsentAt : null;
 const email = emailAddress(input.email);
 const channel = whatsapp && consent ? 'whatsapp' : email ? 'email' : null;
 const recipient = channel === 'whatsapp' ? whatsapp : email;
 let sealed: string|null = null;
 if (channel && /^[A-Za-z0-9_-]{32,128}$/.test(input.trackingToken) && env.KEY_ENCRYPTION_SECRET) {
  sealed = await encryptSecret(input.trackingToken,env);
 }
 const code = !channel ? 'customer_contact_missing' : !sealed ? 'secure_link_unavailable' : null;
 return db.prepare(`INSERT INTO order_shipping_notification_targets(account_id,inquiry_id,channel,recipient,consent_at,tracking_token_sealed,unavailable_code,fallback_email)
 VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(account_id,inquiry_id) DO UPDATE SET
 tracking_token_sealed=COALESCE(order_shipping_notification_targets.tracking_token_sealed,excluded.tracking_token_sealed),
 unavailable_code=CASE WHEN COALESCE(order_shipping_notification_targets.tracking_token_sealed,excluded.tracking_token_sealed) IS NOT NULL THEN NULL ELSE order_shipping_notification_targets.unavailable_code END`)
 .bind(input.accountId,input.inquiryId,channel,recipient,channel==='whatsapp'?consent:null,sealed,code,fallbackEmailFor(channel,email));
}

/** Append after the guarded quote UPDATE, which increments revision only for a changed/first confirmed quote. */
export function buildShippingQuoteNotificationInsert(db:D1Database,input:{accountId:string;invoiceId:string;expectedRevision:number}):D1PreparedStatement {
 return db.prepare(`INSERT OR IGNORE INTO shipping_payment_notifications(id,account_id,invoice_id,quote_revision,quote_usd)
 SELECT ?,account_id,id,shipping_quote_revision,shipping_cost_usd FROM invoices
 WHERE account_id=? AND id=? AND shipping_quote_revision=? AND shipping_quote_status='confirmed'
 AND shipping_cost_usd>0 AND source_inquiry_id IS NOT NULL AND status IN ('Draft','Pending') AND deleted_at IS NULL
 AND COALESCE(fulfillment_method,'')!='bali_pickup'`)
 .bind(crypto.randomUUID(),input.accountId,input.invoiceId,input.expectedRevision);
}

export async function getShippingQuoteNotificationStatus(db:D1Database,accountId:string,invoiceId:string):Promise<ShippingNotificationStatus> {
 const invoice=await db.prepare('SELECT source_inquiry_id,shipping_quote_revision,shipping_quote_status,shipping_cost_usd,status,fulfillment_method FROM invoices WHERE id=? AND account_id=? AND deleted_at IS NULL').bind(invoiceId,accountId).first<any>();
 if(!invoice)return{state:'not_requested',channel:null};
 const target=await db.prepare('SELECT channel,unavailable_code FROM order_shipping_notification_targets WHERE account_id=? AND inquiry_id=?').bind(accountId,invoice.source_inquiry_id).first<Target>();
 if(invoice.shipping_quote_status!=='confirmed')return{state:'not_requested',channel:target?.channel||null};
 if(!(invoice.shipping_cost_usd>0)||invoice.fulfillment_method==='bali_pickup'||['Void','Filled'].includes(invoice.status))return{state:'suppressed',channel:target?.channel||null};
 const row=await db.prepare('SELECT state,code,accepted_at,sent_channel FROM shipping_payment_notifications WHERE account_id=? AND invoice_id=? AND quote_revision=?').bind(accountId,invoiceId,invoice.shipping_quote_revision).first<any>();
 if(row)return{state:row.state,channel:row.sent_channel||target?.channel||null,...(row.code?{code:row.code}:{}),accepted_at:row.accepted_at};
 return{state:target?.channel?'config_required':'needs_contact',channel:target?.channel||null,code:target?.unavailable_code||'notification_not_queued'};
}

async function settle(db:D1Database,id:string,claim:string,state:ShippingNotificationState,code:string|null,providerId?:string,channel?:'email'|'whatsapp') {
 await db.prepare(`UPDATE shipping_payment_notifications SET state=?,code=?,provider_message_id=COALESCE(?,provider_message_id),sent_channel=COALESCE(?,sent_channel),
 accepted_at=CASE WHEN ?='accepted' THEN CURRENT_TIMESTAMP ELSE accepted_at END,
 lease_token=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=?`)
 .bind(state,code,providerId||null,channel||null,state,id,claim).run();
}
function appOrigin(env:ShippingNotificationEnv):string|null {
 try {const url=new URL(env.APP_URL||'https://www.teajia.com');
  if(url.username||url.password)return null;
  if(url.protocol==='https:'&&['teajia.com','www.teajia.com'].includes(url.hostname)&&!url.port)return url.origin;
  if(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))return url.origin;
 }catch{}return null;
}
async function setupCode(db:D1Database,env:ShippingNotificationEnv,row:Notice,target:Target,fetcher?:typeof fetch):Promise<string|null> {
 if(env.SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED!=='true')return 'shipping_notifications_disabled';
 if(row.account_id!==env.SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID)return 'shipping_account_not_enabled';
 if(target.channel==='email')return env.RESEND_API_KEY&&emailAddress(env.SENDER_EMAIL)?null:'email_setup_required';
 const account=await db.prepare('SELECT whatsapp_number,order_whatsapp_notifications_enabled FROM accounts WHERE id=?').bind(row.account_id).first<any>();
 const transport=env.WHATSAPP_TRANSPORT||'meta';
 const provider=transport==='kapso'?Boolean(env.KAPSO_API_KEY):transport==='meta'?Boolean(env.WHATSAPP_ACCESS_TOKEN):false;
 if(!target.consent_at||!internationalWhatsAppNumber(target.recipient))return 'whatsapp_consent_required';
 if(!account?.order_whatsapp_notifications_enabled||env.WHATSAPP_ORDER_ACCOUNT_ID!==row.account_id||
  !provider||!/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID||'')||
  !/^v\d+\.\d+$/.test(env.WHATSAPP_GRAPH_API_VERSION||'')||!env.SHIPPING_PAYMENT_TEMPLATE_NAME?.trim()||
  !env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE?.trim()||!internationalWhatsAppNumber(env.WHATSAPP_SENDER_NUMBER)||
  digits(env.WHATSAPP_SENDER_NUMBER)!==digits(account.whatsapp_number))return 'whatsapp_setup_required';
 if(digits(target.recipient)===digits(env.WHATSAPP_SENDER_NUMBER))return 'customer_matches_sender';
 const approval=await refreshShippingWhatsAppApproval(db,env,{fetcher});
 return approval.state==='approved'?null:approval.state==='pending'?'whatsapp_template_pending':approval.state==='rejected'?'whatsapp_template_rejected':'whatsapp_template_verification_unavailable';
}

/** Cron or waitUntil dispatcher. Provider acceptance is recorded; it is never reported as delivery. */
export async function processShippingQuoteNotifications(db:D1Database,env:ShippingNotificationEnv,options:{accountId?:string;invoiceId?:string;limit?:number;fetcher?:typeof fetch}={}) {
 if(options.invoiceId&&!options.accountId)throw new Error('Targeting an invoice requires its account');
 const result={examined:0,accepted:0,suppressed:0,blocked:0};
 // A lost WhatsApp receipt is not safely replayable. Resend has a 24-hour idempotency window.
 await db.prepare(`UPDATE shipping_payment_notifications SET state='review_required',code='sending_outcome_unknown',lease_token=NULL,lease_expires_at=NULL
 WHERE state='sending' AND lease_expires_at<=CURRENT_TIMESTAMP`).run();
 const rows=await db.prepare(`SELECT n.* FROM shipping_payment_notifications n JOIN invoices i ON i.id=n.invoice_id AND i.account_id=n.account_id
 WHERE n.state IN (${pendingStates}) AND i.status!='Draft' AND (n.next_attempt_at IS NULL OR n.next_attempt_at<=CURRENT_TIMESTAMP)
 AND (? IS NULL OR n.account_id=?) AND (? IS NULL OR n.invoice_id=?) ORDER BY n.created_at,n.id LIMIT ?`)
 .bind(options.accountId||null,options.accountId||null,options.invoiceId||null,options.invoiceId||null,Math.max(1,Math.min(25,options.limit||10))).all<Notice>();
 for(const row of rows.results||[]) {
  result.examined++;
  const lease=await claimInvoiceLinkLease({DB:db},row.account_id,row.invoice_id);if(!lease)continue;
  const claim=crypto.randomUUID();
  try {
   const claimed=await db.prepare(`UPDATE shipping_payment_notifications SET state='sending',lease_token=?,lease_expires_at=datetime('now','+5 minutes'),updated_at=CURRENT_TIMESTAMP WHERE id=? AND state IN (${pendingStates})`).bind(claim,row.id).run();if(!claimed.meta?.changes)continue;
   const invoice=lease.invoice;
   if(await suppressVerificationNotifications(db,row.account_id)){await settle(db,row.id,claim,'suppressed','isolated_live_verification');result.suppressed++;continue;}
   if(invoice.deleted_at||invoice.status!=='Pending'||invoice.fulfillment_method==='bali_pickup'||invoice.shipping_quote_status!=='confirmed'||
    Number(invoice.shipping_quote_revision)!==row.quote_revision||Number(invoice.shipping_cost_usd)!==row.quote_usd){await settle(db,row.id,claim,'suppressed','quote_superseded_or_order_closed');result.suppressed++;continue;}
   const ledgerInvoice=await loadLedgerInvoice({DB:db},row.invoice_id,row.account_id);
   const totals=await loadInvoiceLedgerTotals({DB:db},[row.invoice_id]);
   const balance=ledgerInvoice?invoiceMoney(ledgerInvoice.total_usd,ledgerInvoice.payment_status,totals.get(row.invoice_id)).outstanding_usd:0;
   if(!(balance>0)){await settle(db,row.id,claim,'suppressed','nothing_outstanding');result.suppressed++;continue;}
   if(row.balance_usd!==null&&row.balance_usd!==balance){await settle(db,row.id,claim,'review_required','balance_changed_while_retrying');result.blocked++;continue;}
   let target=await db.prepare('SELECT channel,recipient,consent_at,tracking_token_sealed,unavailable_code,fallback_email FROM order_shipping_notification_targets WHERE account_id=? AND inquiry_id=?').bind(row.account_id,invoice.source_inquiry_id).first<Target>();
   if(!target?.channel||!target.recipient){await settle(db,row.id,claim,'needs_contact','customer_contact_missing');result.blocked++;continue;}
   if(!target.tracking_token_sealed||!env.KEY_ENCRYPTION_SECRET){await settle(db,row.id,claim,'config_required','secure_link_unavailable');result.blocked++;continue;}
   let setup=await setupCode(db,env,row,target,options.fetcher);
   // WhatsApp cannot carry it and nothing has been sent: email them instead.
   if(target.channel==='whatsapp'&&target.fallback_email&&whatsappUnavailable(setup)){
    const emailTarget:Target={...target,channel:'email',recipient:target.fallback_email,consent_at:null};
    const emailSetup=await setupCode(db,env,row,emailTarget,options.fetcher);
    if(!emailSetup){target=emailTarget;setup=null;}
   }
   if(setup){await settle(db,row.id,claim,'config_required',setup);result.blocked++;continue;}
   const origin=appOrigin(env);if(!origin){await settle(db,row.id,claim,'config_required','customer_origin_unavailable');result.blocked++;continue;}
   const sealedLink=target.tracking_token_sealed;if(!sealedLink){await settle(db,row.id,claim,'config_required','secure_link_unavailable');result.blocked++;continue;}
   let token:string;try{token=await decryptSecret(sealedLink,env);}catch{await settle(db,row.id,claim,'config_required','secure_link_unavailable');result.blocked++;continue;}
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
   const inquiry=await db.prepare('SELECT tracking_token_hash FROM inquiries WHERE id=? AND account_id=?').bind(invoice.source_inquiry_id,row.account_id).first<{tracking_token_hash:string}>();
   if(!/^[A-Za-z0-9_-]{32,128}$/.test(token)||digest!==inquiry?.tracking_token_hash){await settle(db,row.id,claim,'review_required','private_link_mismatch');result.blocked++;continue;}
   const url=new URL('/order/'+encodeURIComponent(token),origin);url.searchParams.set('invoice',row.invoice_id);
   const ref=String(invoice.invoice_number||row.invoice_id).replace(/[\r\n]/g,' ').slice(0,80);
   const name=String(invoice.customer_name||'Customer').replace(/[\r\n]/g,' ').slice(0,80);
   const text=`Hello ${name},\n\nThe shipping quote for your Teajia order ${ref} is ${money(row.quote_usd)}.\nTotal remaining balance: ${money(balance)}. Any tea payment already received is included in this balance.\n\nOpen your existing order and choose Pay with PayPal:\n${url.href}\n\nShipping is arranged after the remaining balance is paid.`;
   const firstAt=row.first_attempt_at?Date.parse(row.first_attempt_at+'Z'):Date.now();
   if(row.attempts>=5||Date.now()-firstAt>=23*3600000){await settle(db,row.id,claim,'review_required','retry_window_expired');result.blocked++;continue;}
   await db.prepare(`UPDATE shipping_payment_notifications SET attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,CURRENT_TIMESTAMP),balance_usd=COALESCE(balance_usd,?) WHERE id=? AND lease_token=?`).bind(balance,row.id,claim).run();
   const email=target.channel==='email';
   const endpoint=email?'https://api.resend.com/emails':`${env.WHATSAPP_TRANSPORT==='kapso'?'https://api.kapso.ai/meta/whatsapp':'https://graph.facebook.com'}/${env.WHATSAPP_GRAPH_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
   const headers:Record<string,string>={'Content-Type':'application/json'};
   if(email){headers.Authorization='Bearer '+env.RESEND_API_KEY;headers['Idempotency-Key']='shipping-payment/'+row.id;}
   else if(env.WHATSAPP_TRANSPORT==='kapso')headers['X-API-Key']=env.KAPSO_API_KEY!;
   else headers.Authorization='Bearer '+env.WHATSAPP_ACCESS_TOKEN;
   const body=email?{from:env.SENDER_NAME?`${env.SENDER_NAME} <${env.SENDER_EMAIL}>`:env.SENDER_EMAIL,to:target.recipient,subject:`Shipping payment for Teajia order ${ref}`,text}:
    {messaging_product:'whatsapp',recipient_type:'individual',to:digits(target.recipient),type:'template',template:{name:env.SHIPPING_PAYMENT_TEMPLATE_NAME,language:{code:env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE},components:[{type:'body',parameters:[name,ref,money(row.quote_usd),money(balance),url.href].map(text=>({type:'text',text}))}]}};
   let response:Response;
   try{response=await(options.fetcher||fetch)(endpoint,{method:'POST',headers,body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});}catch{
    await retryOrReview(db,row,claim,email,'network_outcome_unknown');result.blocked++;continue;
   }
   if(response.ok){let id:unknown;try{const data=await response.json() as any;id=email?data.id:data.messages?.[0]?.id;}catch{}
    if(typeof id==='string'&&id){await settle(db,row.id,claim,'accepted',null,id,email?'email':'whatsapp');result.accepted++;}
    else{await retryOrReview(db,row,claim,email,'accepted_without_message_id');result.blocked++;}
   }else if(response.status===429||email&&response.status>=500){await retryOrReview(db,row,claim,true,'provider_retryable');result.blocked++;}
   else{await settle(db,row.id,claim,response.status===401||response.status===403?'config_required':'review_required',response.status===401||response.status===403?'provider_authentication_required':'provider_rejected');result.blocked++;}
  }catch{await settle(db,row.id,claim,'review_required','notification_processing_failed');result.blocked++;}
  finally{await releaseInvoiceLinkLease({DB:db},row.account_id,row.invoice_id,lease.claimToken);}
 }
 return result;
}
async function retryOrReview(db:D1Database,row:Notice,claim:string,retry:boolean,code:string) {
 if(!retry||row.attempts+1>=5){await settle(db,row.id,claim,'review_required',code);return;}
 await db.prepare(`UPDATE shipping_payment_notifications SET state='retry_scheduled',code=?,next_attempt_at=datetime('now','+5 minutes'),lease_token=NULL,lease_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=?`).bind(code,row.id,claim).run();
}

/** Naming alias for the existing scheduled dispatcher integration. */
export async function processPendingShippingQuoteNotifications(db:D1Database,env:ShippingNotificationEnv,options:Parameters<typeof processShippingQuoteNotifications>[2]={}) {
 return processShippingQuoteNotifications(db,env,options);
}

/** Coarse read-only availability for the release observer; no customer identifiers. */
export async function shippingNotificationReadiness(db:D1Database,env:ShippingNotificationEnv) {
 const enabled=env.SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED==='true'&&Boolean(env.SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID&&env.KEY_ENCRYPTION_SECRET);
 const email_enabled=enabled&&Boolean(env.RESEND_API_KEY&&emailAddress(env.SENDER_EMAIL));
 if(!enabled)return{email_enabled:false,whatsapp_state:'disabled',checked_at:null};
 const account=await db.prepare('SELECT whatsapp_number,order_whatsapp_notifications_enabled FROM accounts WHERE id=?').bind(env.SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID).first<any>();
 const transport=env.WHATSAPP_TRANSPORT||'meta';
 const configured=env.WHATSAPP_ORDER_ACCOUNT_ID===env.SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID&&account?.order_whatsapp_notifications_enabled&&
  digits(env.WHATSAPP_SENDER_NUMBER)===digits(account.whatsapp_number)&&Boolean(internationalWhatsAppNumber(env.WHATSAPP_SENDER_NUMBER))&&
  /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID||'')&&Boolean(transport==='kapso'?env.KAPSO_API_KEY:transport==='meta'?env.WHATSAPP_ACCESS_TOKEN:false)&&
  Boolean(env.SHIPPING_PAYMENT_TEMPLATE_NAME&&env.SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID&&env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE&&env.WHATSAPP_GRAPH_API_VERSION);
 if(!configured)return{email_enabled,whatsapp_state:'config_required',checked_at:null};
 const row=await db.prepare(`SELECT state,checked_at FROM shipping_whatsapp_approval WHERE account_id=? AND template_name=? AND language=? AND business_account_id=? AND transport=? AND graph_version=?`)
  .bind(env.SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID,env.SHIPPING_PAYMENT_TEMPLATE_NAME,env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE,env.SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID,transport,env.WHATSAPP_GRAPH_API_VERSION).first<{state:string;checked_at:string}>();
 const age=row?Date.now()-Date.parse(row.checked_at):NaN;
 return{email_enabled,whatsapp_state:row&&Number.isFinite(age)&&age>=0&&age<15*60*1000?row.state:'unavailable',checked_at:row?.checked_at||null};
}
