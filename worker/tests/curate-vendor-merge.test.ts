import {describe,it,expect} from 'vitest';
import {SqliteD1,seedIdentity} from './helpers/sqliteD1';
import {previewCurateMutation,confirmCurateMutation,previewCurateUndo} from '../src/curateMutations';
import {curateSupplyTools} from '../src/mcpTools/curateSupply';
const auth={accountId:'a',userId:'owner',tokenId:'token',creatorTier:'owner',userEmail:'owner@test.dev'};
function setup() {
 const db=new SqliteD1('migrations');seedIdentity(db,{accountId:'a',userId:'owner'});
 db.prepare("INSERT OR REPLACE INTO exchange_rates(currency,rate_to_usd,last_updated) VALUES('Yuan',0.14,datetime('now'))").run();
 db.prepare(`INSERT INTO customers(id,account_id,name,tags,contacts) VALUES('source','a','Duplicate','["vendor"]',?),('target','a','Canonical','["vendor"]',?)`).bind(JSON.stringify([{id:'same',channel:'wechat',handle:'source',person_id:'person'}]),JSON.stringify([{id:'same',channel:'phone',handle:'target',person_id:'person'}])).run();
 db.prepare(`INSERT INTO curate_vendor_profiles(vendor_id,account_id,vendor_code,contact_people,addresses) VALUES('source','a','SOURCE',?,?),('target','a','TARGET',?,?)`).bind(JSON.stringify([{id:'person',name:'Source person'}]),JSON.stringify([{id:'place',label:'Source',address:'Source address'}]),JSON.stringify([{id:'person',name:'Target person'}]),JSON.stringify([{id:'place',label:'Target',address:'Target address'}])).run();
 db.prepare(`INSERT INTO tea_compass_entries(id,account_id,user_id,name,vendor_id,vendor_name,price_amount,price_currency,price_per_unit_grams) VALUES('tea','a','owner','Tea','source','Duplicate',100,'Yuan',500)`).run();
 db.prepare(`INSERT INTO curate_quotes(id,account_id,vendor_id,reference,created_by_user_id) VALUES('quote','a','source','Original quote','owner')`).run();
 db.prepare("INSERT INTO tea_sample_sets(id,account_id,source_id) VALUES('set','a','source')").run();
 db.prepare("INSERT INTO tea_samples(id,account_id,compass_entry_id,source_id,set_id,grams,status) VALUES('portion','a','tea','source','set',25,'received')").run();
 return {db,env:{DB:db as any}};
}
const get=(db:SqliteD1,table:string,id:string,key='id')=>db.prepare(`SELECT * FROM ${table} WHERE ${key}=?`).bind(id).first<any>();
async function merge(env:any) {const p=await previewCurateMutation(env,auth,{action:'merge',entity:'vendor',id:'source',target_id:'target'});return confirmCurateMutation(env,auth,p.confirmation_token);}
describe('vendor merge preserves provenance and makes the canonical card operational',()=>{
 it('keeps both endpoint/person/address lists, target facts win, and active tea/quote point to canonical vendor',async()=>{
  const {db,env}=setup();const sample=get(db,'tea_samples','portion');await merge(env);
  expect(get(db,'tea_compass_entries','tea')).toMatchObject({vendor_id:'target',vendor_name:'Canonical'});expect(get(db,'curate_quotes','quote').vendor_id).toBe('target');
  const profile=get(db,'curate_vendor_profiles','target','vendor_id');expect(profile.vendor_code).toBe('TARGET');
  const people=JSON.parse(profile.contact_people);const contacts=JSON.parse(get(db,'customers','target').contacts);
  expect(people.map((p:any)=>p.name)).toEqual(['Target person','Source person']);expect(contacts.map((c:any)=>c.handle)).toEqual(['target','source']);
  expect(contacts[0].id).toBe('same');expect(contacts[1].id).not.toBe('same');expect(contacts[1].person_id).toBe(people[1].id);
  expect(JSON.parse(profile.addresses).map((p:any)=>p.address)).toEqual(['Target address','Source address']);
  expect(get(db,'tea_samples','portion')).toEqual(sample);
  const order:any=await curateSupplyTools.handlers.curate_order(env,auth,{vendor_id:'target',lines:[{tea_id:'tea',quantity:{amount:500,unit:'g'}}]});expect(order.confirmation_token).toBeTruthy();
  const undo=await previewCurateUndo(env,auth);await confirmCurateMutation(env,auth,undo.confirmation_token);
  expect(get(db,'tea_compass_entries','tea').vendor_id).toBe('source');expect(get(db,'curate_quotes','quote').vendor_id).toBe('source');expect(JSON.parse(get(db,'customers','target').contacts)).toHaveLength(1);
 });
 it('stands down atomically if a new linked tea appears after preview',async()=>{
  const {db,env}=setup();const p=await previewCurateMutation(env,auth,{action:'merge',entity:'vendor',id:'source',target_id:'target'});
  db.prepare("INSERT INTO tea_compass_entries(id,account_id,user_id,name,vendor_id) VALUES('new','a','owner','New','source')").run();
  expect(await confirmCurateMutation(env,auth,p.confirmation_token)).toMatchObject({error:'stale_preview'});
  expect(get(db,'customers','source').merged_into_id).toBeNull();expect(get(db,'tea_compass_entries','tea').vendor_id).toBe('source');expect(get(db,'curate_quotes','quote').vendor_id).toBe('source');
 });
});
