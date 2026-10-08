import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SqliteD1 } from './helpers/sqliteD1';
import { previewCurateMutation,confirmCurateMutation,previewCurateUndo,readCurateHistory,prepareCurateRecordedWrite } from '../src/curateMutations';
import type { ToolAuth,ToolEnv } from '../src/mcpTools/registry';
const auth:ToolAuth={accountId:'a',userId:'owner',tokenId:'token',userEmail:'owner@example.com',creatorTier:'admin'};
function setup() {
 const db=new SqliteD1(false);
 db.exec(`CREATE TABLE account_members(account_id TEXT,user_id TEXT,role TEXT,permissions TEXT,status TEXT);
 CREATE TABLE tea_compass_entries(id TEXT PRIMARY KEY,account_id TEXT,user_id TEXT,name TEXT,notes TEXT,tasting TEXT,photos TEXT,price_amount REAL,price_currency TEXT,price_per_unit_grams REAL,sample_state TEXT,draft_product_id TEXT,updated_at TEXT);
 CREATE TABLE customers(id TEXT PRIMARY KEY,account_id TEXT,name TEXT,notes TEXT,updated_at TEXT);
 CREATE TABLE curate_todos(id TEXT PRIMARY KEY,account_id TEXT,text TEXT,done_at TEXT);
 CREATE TABLE notes(id TEXT PRIMARY KEY,account_id TEXT,compass_entry_id TEXT,text TEXT,source_type TEXT,author_id TEXT,author_name TEXT,deleted INTEGER);
 CREATE TABLE tea_samples(id TEXT PRIMARY KEY,account_id TEXT,compass_entry_id TEXT,source_id TEXT,grams REAL,status TEXT);
 CREATE TABLE tea_sample_tastings(id TEXT PRIMARY KEY,account_id TEXT,sample_id TEXT,tasting TEXT);
 CREATE TABLE products(id TEXT PRIMARY KEY,account_id TEXT,quantity REAL);
 CREATE TABLE inventory_receipt_lines(id TEXT PRIMARY KEY,account_id TEXT,product_id TEXT,received_quantity REAL);
 CREATE TABLE stock_ledger(id TEXT PRIMARY KEY,account_id TEXT,product_id TEXT,quantity REAL);
 CREATE TABLE curate_attachments(id TEXT PRIMARY KEY,account_id TEXT,entity_id TEXT,entity_type TEXT);
 CREATE TABLE mcp_confirmation_tickets(token_hash TEXT PRIMARY KEY,account_id TEXT,kind TEXT,payload_json TEXT,expires_at INTEGER,token_id TEXT,consumed_at INTEGER);
 INSERT INTO account_members VALUES('a','owner','owner','{}','active');
 INSERT INTO account_members VALUES('b','owner','owner','{}','active');
 INSERT INTO tea_compass_entries VALUES('tea','a','other','Original','notes','{"quality":8,"flavor":["honey","wood"]}','["photo"]',10,'Yuan',100,'received','product','old');
 INSERT INTO tea_compass_entries VALUES('target','a','owner','Target',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'old');
 INSERT INTO tea_compass_entries VALUES('foreign','b','owner','Foreign',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'old');
 INSERT INTO customers VALUES('vendor','a','Vendor','before','old');
 INSERT INTO customers VALUES('vendor2','a','Other',NULL,'old');
 INSERT INTO tea_samples VALUES('sample','a','tea','vendor',25,'untasted');
 INSERT INTO tea_samples VALUES('sample2','a','target','vendor2',10,'tasted');
 INSERT INTO tea_sample_tastings VALUES('tasting','a','sample2','{"quality":7}');
 INSERT INTO products VALUES('product','a',100);
 INSERT INTO notes VALUES('said','a','tea','said original','transcript','other','Other writer',0);
 INSERT INTO curate_todos VALUES('todo','a','Ask vendor',NULL);`);
 db.exec(readFileSync('worker/migrations/0037_curate_history.sql','utf8'));
 return {db,env:{DB:db as unknown as D1Database} as ToolEnv};
}
const row=(db:SqliteD1,table:string,id:string)=>db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<any>();
async function apply(env:ToolEnv,command:any) {const p=await previewCurateMutation(env,auth,command);return confirmCurateMutation(env,auth,p.confirmation_token);}
describe('confirmed Curate corrections',()=>{
 it('scopes to the authorized shop, checks real membership and supports cross-author tea notes',async()=>{
  const {db,env}=setup();
  await expect(previewCurateMutation(env,auth,{action:'edit',entity:'tea',id:'foreign',fields:{notes:null}})).rejects.toThrow('not found');
  await expect(previewCurateMutation(env,{...auth,userId:'stranger'},{action:'delete',entity:'tea',id:'tea'})).rejects.toThrow('ownership');
  const p=await previewCurateMutation(env,auth,{action:'edit',entity:'note',id:'said',fields:{text:'correct transcript'}});
  expect(row(db,'notes','said').text).toBe('said original');
  await confirmCurateMutation(env,auth,p.confirmation_token);
  expect(row(db,'notes','said')).toMatchObject({text:'correct transcript',author_id:'other',author_name:'Other writer'});
  const history=await readCurateHistory(env,auth);expect(history.history[0].actor_user_id).toBe('owner');
  expect(history.history[0].records[0].before_json).toContain('said original');
 });
 it('makes a stale preview an atomic no-op including audit and merge target',async()=>{
  const {db,env}=setup();
  const p=await previewCurateMutation(env,auth,{action:'merge',entity:'tea',id:'tea',target_id:'target'});
  db.prepare('UPDATE tea_compass_entries SET name = ? WHERE id = ?').bind('changed','target').run();
  expect(await confirmCurateMutation(env,auth,p.confirmation_token)).toMatchObject({error:'stale_preview'});
  expect(row(db,'tea_compass_entries','tea').merged_into_id).toBeNull();
  expect((await readCurateHistory(env,auth)).history).toEqual([]);
 });
 it('merge only redirects the duplicate, keeps distinct physical grams and tasting rows',async()=>{
  const {db,env}=setup();
  const samples=db.prepare('SELECT * FROM tea_samples ORDER BY id').all().results;
  const tastings=db.prepare('SELECT * FROM tea_sample_tastings').all().results;
  await apply(env,{action:'merge',entity:'tea',id:'tea',target_id:'target'});
  expect(row(db,'tea_compass_entries','tea').merged_into_id).toBe('target');
  expect(db.prepare('SELECT * FROM tea_samples ORDER BY id').all().results).toEqual(samples);
  expect(db.prepare('SELECT * FROM tea_sample_tastings').all().results).toEqual(tastings);
  const p=await previewCurateUndo(env,auth);await confirmCurateMutation(env,auth,p.confirmation_token);
  expect(row(db,'tea_compass_entries','tea').merged_into_id).toBeNull();
  expect((await readCurateHistory(env,auth)).history).toHaveLength(2);
 });
 it('declines undo after physical consumption, receipt or stock change since original confirmation',async()=>{
  for(const mutation of ["UPDATE tea_samples SET grams = 12 WHERE id='sample'","UPDATE products SET quantity=50 WHERE id='product'","INSERT INTO inventory_receipt_lines VALUES('receipt','a','product',40)"]) {
   const {db,env}=setup();await apply(env,{action:'delete',entity:'tea',id:'tea'});db.exec(mutation);
   const p=await previewCurateUndo(env,auth);
   expect(await confirmCurateMutation(env,auth,p.confirmation_token)).toMatchObject({error:'stale_preview'});
   expect(row(db,'tea_compass_entries','tea').deleted_at).not.toBeNull();
   expect((await readCurateHistory(env,auth)).history).toHaveLength(1);
  }
 });
 it('rejects undo of a newer edit and refuses changes racing its confirmation',async()=>{
  const {db,env}=setup();await apply(env,{action:'edit',entity:'tea',id:'tea',fields:{notes:null}});
  const p=await previewCurateUndo(env,auth);db.exec("UPDATE tea_compass_entries SET notes='newer' WHERE id='tea'");
  expect(await confirmCurateMutation(env,auth,p.confirmation_token)).toMatchObject({error:'stale_preview'});
  await expect(previewCurateUndo(env,auth)).rejects.toThrow('changed after confirmation');
 });
 it('clears nullable fields, removes only chosen tasting/score/photo and closes/deletes todos',async()=>{
  const {db,env}=setup();
  await apply(env,{action:'edit',entity:'tea',id:'tea',fields:{notes:null}});expect(row(db,'tea_compass_entries','tea').notes).toBeNull();
  await apply(env,{action:'remove_tasting',entity:'tea',id:'tea',category:'flavor',term:'honey'});
  await apply(env,{action:'remove_score',entity:'tea',id:'tea'});
  expect(JSON.parse(row(db,'tea_compass_entries','tea').tasting)).toEqual({flavor:['wood']});
  await apply(env,{action:'remove_photo',entity:'tea',id:'tea',photo:'photo'});expect(row(db,'tea_compass_entries','tea').photos).toBe('[]');
  await apply(env,{action:'close',entity:'todo',id:'todo'});expect(row(db,'curate_todos','todo').done_at).not.toBeNull();
  await apply(env,{action:'delete',entity:'todo',id:'todo'});expect(row(db,'curate_todos','todo').deleted_at).not.toBeNull();
 });
 it('does not treat an agent tier as membership or allow arbitrary fields',async()=>{
  const {db,env}=setup();db.exec("INSERT INTO account_members VALUES('a','staff','staff','{}','active')");
  await expect(previewCurateMutation(env,{...auth,userId:'staff'},{action:'delete',entity:'vendor',id:'vendor'})).rejects.toThrow('ownership');
  await expect(previewCurateMutation(env,auth,{action:'edit',entity:'tea',id:'tea',fields:{quantity:999}})).rejects.toThrow('not editable');
 });
 it('shared recorded insert and its audit both stand down after membership revocation',()=>{
  const {db}=setup();const p=prepareCurateRecordedWrite(db as any,auth,{commandType:'todo:create',changes:[{entityType:'todo',entityId:'new',before:null,after:{id:'new',account_id:'a',text:'Ask',done_at:null,deleted_at:null}}]});
  db.exec("UPDATE account_members SET status='inactive' WHERE user_id='owner'");
  db.batch(p.statements as any);expect(row(db,'curate_todos','new')).toBeNull();expect(db.prepare('SELECT * FROM curate_mutations').all().results).toEqual([]);
 });
 it('rollback assertion prevents every legacy side write after a stale audited gate',()=>{
  const {db}=setup();const before=row(db,'tea_compass_entries','tea');
  const p=prepareCurateRecordedWrite(db as any,auth,{commandType:'tea:edit',changes:[{entityType:'tea',entityId:'tea',before,after:{...before,name:'Correction'}}]});
  db.exec("UPDATE tea_compass_entries SET name='newer' WHERE id='tea'");
  const side=db.prepare("INSERT INTO notes VALUES('side','a','tea','must rollback','manual','owner','Owner',0)");
  expect(()=>db.batch([...p.statements,side,p.assertion] as any)).toThrow('malformed JSON');
  expect(row(db,'notes','side')).toBeNull();expect(row(db,'tea_compass_entries','tea').name).toBe('newer');
  expect(db.prepare('SELECT * FROM curate_mutations').all().results).toEqual([]);
 });

 it('tastes and consumes exact sample grams atomically, records terms and leaves inventory alone',async()=>{
  const {db,env}=setup();
  await expect(previewCurateMutation(env,auth,{action:'taste_sample',entity:'sample',id:'sample',consumed_grams:26})).rejects.toThrow('exceeds');
  await expect(previewCurateMutation(env,auth,{action:'taste_sample',entity:'sample',id:'sample',consumed_grams:-1})).rejects.toThrow('nonnegative');
  await apply(env,{action:'taste_sample',entity:'sample',id:'sample',consumed_grams:5,tasting:{flavor:['honey']},score:9});
  expect(row(db,'tea_samples','sample')).toMatchObject({grams:20,status:'tasted'});
  expect(row(db,'products','product').quantity).toBe(100);
  expect(row(db,'tea_compass_entries','tea').sample_state).toBe('tasted');
  expect(JSON.parse(row(db,'tea_compass_entries','tea').tasting).quality).toBe(9);
  const undo=await previewCurateUndo(env,auth);await confirmCurateMutation(env,auth,undo.confirmation_token);
  expect(row(db,'tea_samples','sample')).toMatchObject({grams:25,status:'untasted'});
 });
 it('records deliberate zero consumption and refuses another taster changing the sample after preview',async()=>{
  const {db,env}=setup();
  await apply(env,{action:'taste_sample',entity:'sample',id:'sample',consumed_grams:0});
  expect(row(db,'tea_samples','sample').grams).toBe(25);
  const p=await previewCurateMutation(env,auth,{action:'taste_sample',entity:'sample',id:'sample',consumed_grams:2});
  db.exec("UPDATE tea_samples SET grams=20 WHERE id='sample'");
  expect(await confirmCurateMutation(env,auth,p.confirmation_token)).toMatchObject({error:'stale_preview'});
  expect(row(db,'tea_samples','sample').grams).toBe(20);
 });

 it('distinguishes blank quote price from deliberate zero with a stated currency',async()=>{
  const {db,env}=setup();
  await apply(env,{action:'edit',entity:'tea',id:'tea',fields:{price_amount:0,price_currency:'cny'}});
  expect(row(db,'tea_compass_entries','tea')).toMatchObject({price_amount:0,price_currency:'Yuan'});
  await expect(previewCurateMutation(env,auth,{action:'edit',entity:'tea',id:'tea',fields:{price_currency:null}})).rejects.toThrow('requires a currency');
  await apply(env,{action:'edit',entity:'tea',id:'tea',fields:{price_amount:null}});
  expect(row(db,'tea_compass_entries','tea')).toMatchObject({price_amount:null,price_currency:null});
 });

 it('corrects and deletes only an existing exact said voice transcript, retaining attribution',async()=>{
  const {db,env}=setup();
  await expect(previewCurateMutation(env,auth,{action:'edit',entity:'transcript',id:'said',fields:{text:'Correction'}})).rejects.toThrow('not an exact said');
  db.exec("UPDATE notes SET source_type='voice' WHERE id='said'");
  await apply(env,{action:'edit',entity:'transcript',id:'said',fields:{text:'Corrected exact words'}});
  expect(row(db,'notes','said')).toMatchObject({text:'Corrected exact words',author_id:'other',source_type:'voice'});
  await apply(env,{action:'delete',entity:'transcript',id:'said'});expect(row(db,'notes','said').deleted).toBe(1);
  expect((await readCurateHistory(env,auth,{entity_type:'transcript',entity_id:'said'})).history).toHaveLength(2);
 });

 it('tastes a merged source portion against the canonical tea without moving its historical source',async()=>{
  const {db,env}=setup();await apply(env,{action:'merge',entity:'tea',id:'tea',target_id:'target'});
  await apply(env,{action:'taste_sample',entity:'sample',id:'sample',consumed_grams:5,score:9});
  expect(row(db,'tea_samples','sample')).toMatchObject({grams:20,compass_entry_id:'tea'});
  expect(JSON.parse(row(db,'tea_compass_entries','target').tasting).quality).toBe(9);
  expect(JSON.parse(row(db,'tea_compass_entries','tea').tasting).quality).toBe(8);
  const p=await previewCurateUndo(env,auth);await confirmCurateMutation(env,auth,p.confirmation_token);
  expect(row(db,'tea_samples','sample')).toMatchObject({grams:25,compass_entry_id:'tea'});
  expect(row(db,'tea_compass_entries','tea').merged_into_id).toBe('target');
 });

 it('refuses unknown consumption and records a deliberate zero measurement through preview/confirm',async()=>{
  const {db,env}=setup();db.exec("UPDATE tea_samples SET grams_known=0 WHERE id='sample'");
  await expect(previewCurateMutation(env,auth,{action:'taste_sample',entity:'sample',id:'sample',consumed_grams:0})).rejects.toThrow('remaining weight is unknown');
  await expect(previewCurateMutation(env,auth,{action:'edit',entity:'sample',id:'sample',fields:{grams:-1}})).rejects.toThrow('nonnegative');
  const p=await previewCurateMutation(env,auth,{action:'edit',entity:'sample',id:'sample',fields:{grams:0}});
  expect(row(db,'tea_samples','sample').grams_known).toBe(0);
  await confirmCurateMutation(env,auth,p.confirmation_token);
  expect(row(db,'tea_samples','sample')).toMatchObject({grams:0,grams_known:1,status:'untasted'});
  expect(row(db,'products','product').quantity).toBe(100);
  await apply(env,{action:'taste_sample',entity:'sample',id:'sample',consumed_grams:0});
  expect(row(db,'tea_samples','sample')).toMatchObject({grams:0,grams_known:1,status:'tasted'});
 });

});
