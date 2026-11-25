/** Fixed-origin provider metadata gate; approval never depends on a browser or a send failure. */
import {cleanSecret,buildRequestHeaders,InvalidRequestError} from './kapsoRequest';
export interface ShippingWhatsAppApprovalEnv {
 SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED?: string;
 SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID?: string;
 SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID?: string;
 SHIPPING_PAYMENT_TEMPLATE_NAME?: string;
 WHATSAPP_ORDER_ACCOUNT_ID?: string;
 WHATSAPP_TRANSPORT?: string;
 KAPSO_API_KEY?: string;
 WHATSAPP_ACCESS_TOKEN?: string;
 WHATSAPP_GRAPH_API_VERSION?: string;
 WHATSAPP_ORDER_TEMPLATE_LANGUAGE?: string;
}
export interface ShippingWhatsAppApproval {
 state: 'approved'|'pending'|'rejected'|'unavailable'|'config_required';
 code: string|null;
 checked_at: string|null;
}
interface Row extends ShippingWhatsAppApproval { business_account_id:string; transport:string; graph_version:string }
interface Config { accountId:string; businessId:string; template:string; language:string; transport:'kapso'|'meta'; version:string; credential:string }
const CACHE_MS=15*60*1000;
const active=new WeakMap<object,Map<string,Promise<ShippingWhatsAppApproval>>>();
function configuration(env:ShippingWhatsAppApprovalEnv):Config|null {
 const transport=env.WHATSAPP_TRANSPORT||'meta';
 const accountId=env.SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID;
 const businessId=env.SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID;
 const template=env.SHIPPING_PAYMENT_TEMPLATE_NAME;
 const language=env.WHATSAPP_ORDER_TEMPLATE_LANGUAGE;
 const version=env.WHATSAPP_GRAPH_API_VERSION;
 const credential=cleanSecret(transport==='kapso'?env.KAPSO_API_KEY:transport==='meta'?env.WHATSAPP_ACCESS_TOKEN:null);
 if(env.SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED!=='true'||!accountId||env.WHATSAPP_ORDER_ACCOUNT_ID!==accountId||
  !/^\d{5,32}$/.test(businessId||'')||!/^\w{1,128}$/.test(template||'')||language!=='en_US'||
  !/^v\d+\.\d+$/.test(version||'')||!credential||(transport!=='kapso'&&transport!=='meta'))return null;
 return{accountId,businessId:businessId!,template:template!,language,version:version!,transport,credential};
}
function checkedTime(value:string|null):number {
 if(!value)return NaN;return Date.parse(value.endsWith('Z')||/[+-]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'Z');
}
function publicStatus(row:ShippingWhatsAppApproval):ShippingWhatsAppApproval {
 return {state:row.state,code:row.code,checked_at:row.checked_at};
}
async function cached(db:D1Database,c:Config):Promise<Row|null> {
 return db.prepare(`SELECT state,code,checked_at,business_account_id,transport,graph_version FROM shipping_whatsapp_approval
 WHERE account_id=? AND template_name=? AND language=?`).bind(c.accountId,c.template,c.language).first<Row>();
}
function fresh(row:Row|null,c:Config):boolean {
 if(!row||row.business_account_id!==c.businessId||row.transport!==c.transport||row.graph_version!==c.version)return false;
 const age=Date.now()-checkedTime(row.checked_at);return Number.isFinite(age)&&age>=0&&age<CACHE_MS;
}
function classify(data:any,c:Config):Pick<ShippingWhatsAppApproval,'state'|'code'> {
 if(!Array.isArray(data?.data))return{state:'unavailable',code:'whatsapp_template_response_invalid'};
 const template=data.data.find((t:any)=>t?.name===c.template&&t?.language===c.language);
 if(!template)return{state:'pending',code:'whatsapp_template_not_found'};
 if(template.category!=='UTILITY')return{state:'rejected',code:'whatsapp_template_category_mismatch'};
 if(template.status==='PENDING'||template.status==='IN_APPEAL')return{state:'pending',code:'whatsapp_template_pending'};
 if(template.status!=='APPROVED')return{state:'rejected',code:'whatsapp_template_not_approved'};
 const parts=template.components;
 if(!Array.isArray(parts)||parts.length!==1||parts[0]?.type!=='BODY'||typeof parts[0]?.text!=='string')return{state:'rejected',code:'whatsapp_template_shape_mismatch'};
 const params=[...parts[0].text.matchAll(/{{(.*?)}}/g)].map((m:RegExpMatchArray)=>m[1].trim()).sort();
 if(params.length!==5||params.some((n:string,i:number)=>n!==String(i+1)))return{state:'rejected',code:'whatsapp_template_parameters_mismatch'};
 return{state:'approved',code:null};
}
interface ApprovalAttempt {
 attempt: number;
 transport: 'kapso' | 'meta';
 outcome: 'http_response' | 'timeout' | 'transport_error' | 'invalid_request' | 'response_read_error';
 httpStatus: number | null;
 elapsedMs: number;
}

async function readTemplateApproval(c: Config, fetcher: typeof fetch, onAttempt?: (attempt: ApprovalAttempt) => void): Promise<Pick<ShippingWhatsAppApproval, 'state' | 'code'>> {
 const origin = c.transport === 'kapso' ? 'https://api.kapso.ai/meta/whatsapp' : 'https://graph.facebook.com';
 const url = new URL(`${origin}/${c.version}/${c.businessId}/message_templates`);
 url.searchParams.set('name', c.template);
 url.searchParams.set('fields', 'name,status,category,language,components');
 const headers: Record<string, string> = c.transport === 'kapso'
  ? { 'X-API-Key': c.credential }
  : { Authorization: 'Bearer ' + c.credential };
 const unavailable = { state: 'unavailable', code: 'whatsapp_template_verification_unavailable' } as const;

 // Only retry the read. Sending a message has its own receipt and retry rules.
 for (let attempt = 1; attempt <= 2; attempt++) {
  const startedAt = Date.now();
  const signal = AbortSignal.timeout(5000);
  let httpStatus: number | null = null;
  let outcome: ApprovalAttempt['outcome'] = 'http_response';
  try {
   const response = await fetcher(url.href, { headers: buildRequestHeaders(headers), redirect: 'manual', signal });
   httpStatus = response.status;
   if (response.ok) return classify(await response.json(), c);
   if (response.status === 401 || response.status === 403) {
    return { state: 'unavailable', code: 'whatsapp_template_authentication_required' };
   }
   if (response.status < 500) return unavailable;
   await response.body?.cancel();
  } catch (e) {
   // Use a fixed class. Errors and responses can contain provider identifiers.
   outcome = e instanceof InvalidRequestError ? 'invalid_request' : signal.aborted ? 'timeout' : httpStatus === null ? 'transport_error' : 'response_read_error';
  } finally {
   onAttempt?.({ attempt, transport: c.transport, outcome, httpStatus, elapsedMs: Math.max(0, Date.now() - startedAt) });
  }
 }
 return unavailable;
}

async function check(db:D1Database,c:Config,fetcher:typeof fetch,onAttempt?: (attempt: ApprovalAttempt) => void):Promise<ShippingWhatsAppApproval> {
 const result = await readTemplateApproval(c, fetcher, onAttempt);
 const checked_at=new Date().toISOString();
 await db.prepare(`INSERT INTO shipping_whatsapp_approval(account_id,template_name,language,business_account_id,transport,graph_version,state,code,checked_at,last_approved_at)
 VALUES(?,?,?,?,?,?,?,?,?,CASE WHEN ?='approved' THEN ? ELSE NULL END)
 ON CONFLICT(account_id,template_name,language) DO UPDATE SET business_account_id=excluded.business_account_id,transport=excluded.transport,
 graph_version=excluded.graph_version,state=excluded.state,code=excluded.code,checked_at=excluded.checked_at,
 last_approved_at=CASE WHEN excluded.state='approved' THEN excluded.checked_at ELSE shipping_whatsapp_approval.last_approved_at END`)
 .bind(c.accountId,c.template,c.language,c.businessId,c.transport,c.version,result.state,result.code,checked_at,result.state,checked_at).run();
 return{...result,checked_at};
}
/** Called by the existing hourly tick even without queued orders; a quote can also refresh stale evidence. */
export async function refreshShippingWhatsAppApproval(db:D1Database,env:ShippingWhatsAppApprovalEnv,options:{force?:boolean;fetcher?:typeof fetch;onAttempt?: (attempt: ApprovalAttempt) => void}={}):Promise<ShippingWhatsAppApproval> {
 const c=configuration(env);if(!c)return{state:'config_required',code:'whatsapp_template_setup_required',checked_at:null};
 const row=await cached(db,c);if(!options.force&&fresh(row,c))return publicStatus(row!);
 let requests=active.get(db);if(!requests){requests=new Map();active.set(db,requests);}
 const key=JSON.stringify([c.accountId,c.businessId,c.template,c.language,c.transport,c.version]);
 const inFlight=requests.get(key);if(inFlight)return inFlight;
 const promise=check(db,c,options.fetcher||fetch,options.onAttempt);requests.set(key,promise);
 try{return await promise;}finally{requests.delete(key);}
}
export async function isShippingWhatsAppApproved(db:D1Database,env:ShippingWhatsAppApprovalEnv,accountId:string,options:{fetcher?:typeof fetch}={}):Promise<boolean> {
 if(accountId!==env.SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID)return false;
 const result=await refreshShippingWhatsAppApproval(db,env,options);return result.state==='approved';
}
