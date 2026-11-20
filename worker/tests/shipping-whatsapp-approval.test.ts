import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {SqliteD1,seedIdentity} from './helpers/sqliteD1';
import {refreshShippingWhatsAppApproval,isShippingWhatsAppApproved,type ShippingWhatsAppApprovalEnv} from '../src/shippingWhatsAppApproval';
const dbs:SqliteD1[]=[];
afterEach(()=>{vi.useRealTimers();for(const db of dbs.splice(0))db.close();});
function fixture(){
 const db=new SqliteD1('schema');dbs.push(db);seedIdentity(db,{accountId:'shop',userId:'owner'});
 const env:ShippingWhatsAppApprovalEnv={SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED:'true',SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID:'shop',SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID:'1234567890',SHIPPING_PAYMENT_TEMPLATE_NAME:'teajia_shipping_payment_v1',WHATSAPP_ORDER_ACCOUNT_ID:'shop',WHATSAPP_TRANSPORT:'kapso',KAPSO_API_KEY:'test-only-key',WHATSAPP_GRAPH_API_VERSION:'v24.0',WHATSAPP_ORDER_TEMPLATE_LANGUAGE:'en_US'};
 const template=(overrides:Record<string,unknown>={})=>({name:'teajia_shipping_payment_v1',language:'en_US',category:'UTILITY',status:'APPROVED',components:[{type:'BODY',text:'Hi {{1}}, shipping for {{2}} is {{3}}. Balance {{4}}. Pay {{5}}.'}],...overrides});
 const fetcher=vi.fn(async()=>Response.json({data:[template()]}));
 const refresh=(force=false)=>refreshShippingWhatsAppApproval(db as any,env,{fetcher:fetcher as any,force});
 const approved=(account='shop')=>isShippingWhatsAppApproved(db as any,env,account,{fetcher:fetcher as any});
 return{db,env,template,fetcher,refresh,approved};
}
describe('shipping WhatsApp provider approval',()=>{
 it('keeps pending WhatsApp unsent, then automatically recognizes approved metadata after cache expiry',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-20T00:00:00Z'));
  const f=fixture();f.fetcher.mockResolvedValueOnce(Response.json({data:[f.template({status:'PENDING'})]}));
  expect(await f.approved()).toBe(false);expect(await f.refresh()).toMatchObject({state:'pending',code:'whatsapp_template_pending'});expect(f.fetcher).toHaveBeenCalledTimes(1);
  vi.setSystemTime(new Date('2026-11-20T00:16:00Z'));expect(await f.approved()).toBe(true);expect(f.fetcher).toHaveBeenCalledTimes(2);
  expect(f.db.sqlite.prepare('SELECT state,last_approved_at FROM shipping_whatsapp_approval').get()).toEqual({state:'approved',last_approved_at:'2026-11-20T00:16:00.000Z'});
 });
 it('binds approval to the configured account and does not fetch for a different tenant',async()=>{const f=fixture();expect(await f.approved('foreign')).toBe(false);expect(f.fetcher).not.toHaveBeenCalled();expect(await f.approved()).toBe(true);});
 it.each(['REJECTED','PAUSED','DISABLED','PENDING','IN_APPEAL'])('does not send with provider status %s',async status=>{const f=fixture();f.fetcher.mockResolvedValue(Response.json({data:[f.template({status})]}));expect(await f.approved()).toBe(false);});
 it.each([{name:'unrelated_template'},{language:'id'},{category:'MARKETING'}])('does not accept a different template identity or category %j',async override=>{const f=fixture();f.fetcher.mockResolvedValue(Response.json({data:[f.template(override)]}));expect(await f.approved()).toBe(false);});
 it.each([
  [{type:'BODY',text:'{{1}} {{2}} {{3}} {{4}}'}],
  [{type:'BODY',text:'{{1}} {{2}} {{3}} {{4}} {{4}}'}],
  [{type:'BODY',text:'{{1}} {{2}} {{3}} {{4}} {{5}} {{name}}'}],
  [{type:'BODY',text:'{{1}} {{2}} {{3}} {{4}} {{5}} {{ }}'}],
  [{type:'HEADER',text:'{{1}}'},{type:'BODY',text:'{{1}} {{2}} {{3}} {{4}} {{5}}'}],
 ])('refuses incompatible approved template components %j',async components=>{const f=fixture();f.fetcher.mockResolvedValue(Response.json({data:[f.template({components})]}));expect(await f.approved()).toBe(false);});
 it('uses fixed Kapso metadata host, rejects redirects and never puts keys in URLs or persisted state',async()=>{
  const f=fixture();await f.refresh();const [url,options]=f.fetcher.mock.calls[0] as unknown as [string,RequestInit];
  expect(new URL(url).origin).toBe('https://api.kapso.ai');expect(new URL(url).pathname).toBe('/meta/whatsapp/v24.0/1234567890/message_templates');expect(new URL(url).searchParams.get('name')).toBe('teajia_shipping_payment_v1');expect(options.redirect).toBe('error');expect((options.headers as any)['X-API-Key']).toBe('test-only-key');
  expect(url).not.toContain('test-only-key');expect(JSON.stringify(f.db.sqlite.prepare('SELECT * FROM shipping_whatsapp_approval').get())).not.toContain('test-only-key');
  f.fetcher.mockResolvedValue(new Response(null,{status:302,headers:{Location:'https://other.example'}}));expect((await f.refresh(true)).state).toBe('unavailable');
 });
 it('fails closed when refresh is unavailable without erasing historical approval evidence',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-20T00:00:00Z'));const f=fixture();expect(await f.approved()).toBe(true);
  vi.setSystemTime(new Date('2026-11-20T00:16:00Z'));f.fetcher.mockRejectedValue(new Error('provider key must not appear in state'));
  expect(await f.approved()).toBe(false);const row=f.db.sqlite.prepare('SELECT state,code,last_approved_at FROM shipping_whatsapp_approval').get()!;expect(row).toEqual({state:'unavailable',code:'whatsapp_template_verification_unavailable',last_approved_at:'2026-11-20T00:00:00.000Z'});
 });
 it('does not reuse a cached approval after business account or transport changes',async()=>{const f=fixture();expect(await f.approved()).toBe(true);f.env.SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID='9876543210';f.fetcher.mockResolvedValue(Response.json({data:[]}));expect(await f.approved()).toBe(false);expect(f.fetcher).toHaveBeenCalledTimes(2);});
 it('deduplicates concurrent metadata checks in an execution',async()=>{const f=fixture();await Promise.all([f.refresh(),f.refresh(),f.approved()]);expect(f.fetcher).toHaveBeenCalledTimes(1);});
 it('checks Meta directly only for explicitly selected meta transport',async()=>{const f=fixture();f.env.WHATSAPP_TRANSPORT='meta';f.env.WHATSAPP_ACCESS_TOKEN='meta-test-key';expect(await f.approved()).toBe(true);const [url,options]=f.fetcher.mock.calls[0]as unknown as[string,RequestInit];expect(new URL(url).origin).toBe('https://graph.facebook.com');expect((options.headers as any).Authorization).toBe('Bearer meta-test-key');expect((options.headers as any)['X-API-Key']).toBeUndefined();});
 it.each([{SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED:'false'},{SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID:'https://other.example'},{WHATSAPP_ORDER_ACCOUNT_ID:'foreign'},{WHATSAPP_ORDER_TEMPLATE_LANGUAGE:'id'},{KAPSO_API_KEY:undefined},{WHATSAPP_TRANSPORT:'unrecognized'}])('does not contact a provider with incomplete or unsupported configuration %j',async override=>{const f=fixture();Object.assign(f.env,override);expect(await f.approved()).toBe(false);expect(f.fetcher).not.toHaveBeenCalled();});
 it('adds approval evidence to the prior migration ledger without changing existing notification records',()=>{
  const db=new SqliteD1('migrations','0071');dbs.push(db);seedIdentity(db,{accountId:'shop',userId:'owner'});
  const before=db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shipping_payment_notifications'").get();expect(before).toBeTruthy();
  const sql=readFileSync(new URL('../migrations/0072_shipping_whatsapp_approval.sql',import.meta.url),'utf8');db.exec(sql);db.exec(sql);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM shipping_whatsapp_approval').get()!.n).toBe(0);
  expect(db.sqlite.prepare("SELECT id FROM accounts WHERE id='shop'").get()!.id).toBe('shop');
 });
});
