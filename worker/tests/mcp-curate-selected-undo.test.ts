import { describe,it,expect } from 'vitest';
import { SqliteD1,seedIdentity } from './helpers/sqliteD1';
import { curateManageModule } from '../src/mcpTools/curateManage';
import { handleCurateWorkspace } from '../src/curateWorkspaceRoutes';
const auth={accountId:'a',userId:'owner',tokenId:'token',userEmail:'owner@test.dev',creatorTier:'account_owner'};
const call=(db:SqliteD1,name:string,args:any,who=auth)=>curateManageModule.handlers[name]({DB:db} as any,who,args) as Promise<any>;
const row=(db:SqliteD1,table:string,id:string)=>db.sqlite.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id) as any;
function setup() {
 const db=new SqliteD1();seedIdentity(db,{accountId:'a',userId:'owner',role:'owner'});seedIdentity(db,{accountId:'b',userId:'other',role:'owner'});
 db.sqlite.exec(`INSERT INTO customers(id,account_id,name,type,tags) VALUES ('vendor','a','Vendor','vendor','["vendor"]');
 INSERT INTO tea_compass_entries(id,account_id,user_id,name,vendor_id,photos) VALUES ('tea','a','owner','Tea','vendor','["https://example.com/photo.jpg"]');
 INSERT INTO tea_compass_entries(id,account_id,user_id,name) VALUES ('second','a','owner','Second tea');
 INSERT INTO tea_samples(id,account_id,name,source_id,compass_entry_id,set_id,grams) VALUES ('sample','a','Sample','vendor','tea','set',12);`);
 return db;
}
async function edit(db:SqliteD1,id:string,name:string) {
 const p=await call(db,'curate_correct',{action:'edit',entity:'tea',id,fields:{name}});
 return call(db,'curate_correct',{confirmation_token:p.confirmation_token});
}
describe('selected Curate undo',()=>{
 it('the app route selects the requested change instead of silently undoing the latest',async()=>{
  const db=setup();const first=await edit(db,'tea','Changed');await edit(db,'second','Independent');
  const request=(body:any)=>handleCurateWorkspace(new Request('https://test/api/curate/undo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),{DB:db} as any,auth);
  const preview=await (await request({mutation_id:first.mutation_id})).json() as any;
  expect(preview.preview.undo_of).toBe(first.mutation_id);
  expect(await (await request({confirm:preview.confirmation_token})).json()).toMatchObject({confirmed:true,undo_of:first.mutation_id});
  expect(row(db,'tea_compass_entries','second').name).toBe('Independent');
 });
 it('undoes one selected change while retaining newer independent work and append-only history',async()=>{
  const db=setup();const first=await edit(db,'tea','Changed');await edit(db,'second','Independent');
  const preview=await call(db,'curate_undo',{mutation_id:first.mutation_id});
  expect(preview.preview.undo_of).toBe(first.mutation_id);expect(row(db,'tea_compass_entries','tea').name).toBe('Changed');
  const result=await call(db,'curate_undo',{confirmation_token:preview.confirmation_token});expect(result).toMatchObject({confirmed:true,undo_of:first.mutation_id});
  expect(row(db,'tea_compass_entries','tea').name).toBe('Tea');expect(row(db,'tea_compass_entries','second').name).toBe('Independent');
  expect(db.sqlite.prepare('SELECT COUNT(*) n FROM curate_mutations').get()).toMatchObject({n:3});
  const history=await call(db,'curate_history',{});
  expect(history.history.find((entry:any)=>entry.id===first.mutation_id).undone_by).toBe(result.mutation_id);
  expect(history.history.find((entry:any)=>entry.id===result.mutation_id).undone_by).toBeNull();
  await expect(call(db,'curate_undo',{mutation_id:first.mutation_id})).rejects.toThrow('already been undone');
 });
 it('allows unrelated work after selected preview, and prevents two undo confirmations',async()=>{
  const db=setup();const change=await edit(db,'tea','Changed');
  const first=await call(db,'curate_undo',{mutation_id:change.mutation_id});const second=await call(db,'curate_undo',{mutation_id:change.mutation_id});
  await edit(db,'second','New independent');
  expect(await call(db,'curate_undo',{confirmation_token:first.confirmation_token})).toMatchObject({confirmed:true});
  expect(await call(db,'curate_undo',{confirmation_token:second.confirmation_token})).toMatchObject({error:'stale_preview'});
  expect(row(db,'tea_compass_entries','second').name).toBe('New independent');
 });
 it('refuses newer conflicting edits, including a change racing undo confirmation',async()=>{
  const db=setup();const original=await edit(db,'tea','Changed');const undo=await call(db,'curate_undo',{mutation_id:original.mutation_id});
  await edit(db,'tea','Newer');
  expect(await call(db,'curate_undo',{confirmation_token:undo.confirmation_token})).toMatchObject({error:'stale_preview'});
  await expect(call(db,'curate_undo',{mutation_id:original.mutation_id})).rejects.toThrow('changed after confirmation');
  expect(row(db,'tea_compass_entries','tea').name).toBe('Newer');
 });
 it('keeps the omitted latest-change behavior and scopes selected history to the shop',async()=>{
  const db=setup();const first=await edit(db,'tea','Changed');const latest=await edit(db,'second','Latest');
  expect((await call(db,'curate_undo',{})).preview.undo_of).toBe(latest.mutation_id);
  await expect(call(db,'curate_undo',{mutation_id:first.mutation_id},{...auth,accountId:'b',userId:'other'})).rejects.toThrow('not found in this shop');
  await expect(call(db,'curate_undo',{mutation_id:''})).rejects.toThrow('valid mutation_id');
 });
 it('continues to guard physical holdings of the selected change',async()=>{
  const db=setup();const first=await edit(db,'tea','Changed');await edit(db,'second','Independent');
  const undo=await call(db,'curate_undo',{mutation_id:first.mutation_id});db.sqlite.exec("UPDATE tea_samples SET grams=5 WHERE id='sample'");
  expect(await call(db,'curate_undo',{confirmation_token:undo.confirmation_token})).toMatchObject({error:'stale_preview'});
  expect(row(db,'tea_samples','sample').grams).toBe(5);expect(row(db,'tea_compass_entries','tea').name).toBe('Changed');
 });
});
describe('removal previews explain retained records',()=>{
 it.each(['delete','archive'])('vendor %s warns that linked tea and sample remain attached',async action=>{
  const db=setup();const tea=row(db,'tea_compass_entries','tea');const sample=row(db,'tea_samples','sample');
  const preview=await call(db,'curate_correct',{action,entity:'vendor',id:'vendor'});
  expect(preview.preview.vendor_removal).toMatchObject({mode:'soft',linked_records_remain_attached:true,dependencies:{curate_teas:1,samples:1},message:expect.stringContaining('remain attached')});
  expect(row(db,'customers','vendor').deleted_at).toBeNull();
  expect(await call(db,'curate_correct',{confirmation_token:preview.confirmation_token})).toMatchObject({confirmed:true});
  expect(row(db,'tea_compass_entries','tea')).toEqual(tea);expect(row(db,'tea_samples','sample')).toEqual(sample);
  expect(row(db,'customers','vendor')[action==='delete'?'deleted_at':'archived_at']).toBeTruthy();
 });
 it('repreviews a vendor removal when linked dependency counts changed',async()=>{
  const db=setup();const p=await call(db,'curate_correct',{action:'delete',entity:'vendor',id:'vendor'});
  db.sqlite.exec("INSERT INTO tea_compass_entries(id,account_id,user_id,name,vendor_id) VALUES ('new','a','owner','New tea','vendor')");
  expect(await call(db,'curate_correct',{confirmation_token:p.confirmation_token})).toMatchObject({error:'stale_preview'});
  expect(row(db,'customers','vendor').deleted_at).toBeNull();
 });
 it('photo removal says its Drive copy is retained and names the separate tool',async()=>{
  const db=setup();const preview=await call(db,'curate_correct',{action:'remove_photo',entity:'tea',id:'tea',photo:'https://example.com/photo.jpg'});
  expect(preview.preview.photo_removal).toMatchObject({asset_retained:true,drive_photo_retained:true,drive_tool:'curate_drive_photo'});
  expect(row(db,'tea_compass_entries','tea').photos).toContain('photo.jpg');
 });
});
