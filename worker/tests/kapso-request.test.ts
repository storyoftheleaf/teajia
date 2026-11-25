import {afterEach,describe,expect,it,vi} from 'vitest';
import {SqliteD1,seedIdentity} from './helpers/sqliteD1';
import {refreshShippingWhatsAppApproval,type ShippingWhatsAppApprovalEnv} from '../src/shippingWhatsAppApproval';
import {cleanSecret,buildRequestHeaders,InvalidRequestError} from '../src/kapsoRequest';
const dbs:SqliteD1[]=[];
afterEach(()=>{for(const db of dbs.splice(0))db.close();});
/** Behaves like real fetch: a header value with CR/LF is rejected locally with a TypeError, before any network time. */
const realisticFetch=vi.fn(async(_url:string,init:RequestInit)=>{
 new Headers(init.headers as Record<string,string>);
 return Response.json({data:[{name:'teajia_shipping_payment_v1',language:'en_US',category:'UTILITY',status:'APPROVED',components:[{type:'BODY',text:'{{1}} {{2}} {{3}} {{4}} {{5}}'}]}]});
});
function setup(key:string){
 const db=new SqliteD1('schema');dbs.push(db);seedIdentity(db,{accountId:'shop',userId:'owner'});
 const env:ShippingWhatsAppApprovalEnv={SHIPPING_PAYMENT_NOTIFICATIONS_ENABLED:'true',SHIPPING_PAYMENT_NOTIFICATIONS_ACCOUNT_ID:'shop',SHIPPING_PAYMENT_BUSINESS_ACCOUNT_ID:'1234567890',SHIPPING_PAYMENT_TEMPLATE_NAME:'teajia_shipping_payment_v1',WHATSAPP_ORDER_ACCOUNT_ID:'shop',WHATSAPP_TRANSPORT:'kapso',KAPSO_API_KEY:key,WHATSAPP_GRAPH_API_VERSION:'v24.0',WHATSAPP_ORDER_TEMPLATE_LANGUAGE:'en_US'};
 return{db,env};
}
describe('kapso request building',()=>{
 it('a saved key with an invisible trailing character still sends and is approved',async()=>{
  realisticFetch.mockClear();
  const {db,env}=setup('test-only-key﻿\n');
  const onAttempt=vi.fn();
  const result=await refreshShippingWhatsAppApproval(db as any,env,{fetcher:realisticFetch as any,onAttempt});
  expect(onAttempt.mock.calls.map(c=>c[0].outcome)).toEqual(['http_response']);
  expect(result.state).toBe('approved');
  expect(((realisticFetch.mock.calls[0] as any)[1].headers as any)['X-API-Key']).toBe('test-only-key');
 });
 it('an unfixable header is reported as invalid_request, not transport_error, and leaks nothing',async()=>{
  realisticFetch.mockClear();
  const {db,env}=setup('bad\nkey');
  const onAttempt=vi.fn();
  const result=await refreshShippingWhatsAppApproval(db as any,env,{fetcher:realisticFetch as any,onAttempt});
  expect(result.state).toBe('unavailable');
  expect(realisticFetch).not.toHaveBeenCalled();
  expect(onAttempt.mock.calls.map(c=>c[0].outcome)).toEqual(['invalid_request','invalid_request']);
  expect(JSON.stringify(onAttempt.mock.calls)).not.toContain('bad');
 });
 it('helpers trim secrets and refuse control characters without echoing the value',()=>{
  expect(cleanSecret('  abc ​\r\n')).toBe('abc');
  expect(cleanSecret(undefined)).toBeUndefined();
  expect(cleanSecret('   ')).toBeUndefined();
  let message='';
  try{buildRequestHeaders({'X-API-Key':'sec\nret'});}catch(e){expect(e).toBeInstanceOf(InvalidRequestError);message=(e as Error).message;}
  expect(message).not.toContain('sec');
 });
});
