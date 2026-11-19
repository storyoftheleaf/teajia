import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { classifyRequest } from '../src/allowanceGuard.mjs';
const dbs:SqliteD1[]=[];
afterEach(()=>dbs.splice(0).forEach(db=>db.close()));
async function setup(){const db=new SqliteD1('migrations');dbs.push(db);seedIdentity(db,{userId:'owner',accountId:'a',role:'owner'});const token=await signedToken('test-jwt',{sub:'owner',email:'owner@test.dev',active_account_id:'a'});return {db,call:(body:unknown)=>worker.fetch(new Request('https://worker.test/api/compass/entries/tea/save',{method:'POST',headers:{Authorization:`Bearer ${token}`,'X-Teajia-Account':'a','Content-Type':'application/json'},body:JSON.stringify(body)}),{DB:db as any,JWT_SECRET:'test-jwt'} as any)}}
const entry={id:'tea',name:'Source save closure',photos:['https://media.teajia.co/test-leaf.jpg'],audio_clips:[]};
const note={id:'voice',compass_entry_id:'tea',text:'Clear tea capture test phrase',source_type:'voice',author_name:'Owner',visibility:'private'};
it('saves the named tea, photo and transcript through one acknowledged foreground action; retry keeps one of each',async()=>{
 const {db,call}=await setup();
 for(let n=0;n<2;n++){
  const response=await call({entry,notes:[note]});const body=await response.json();expect(response.status,JSON.stringify(body)).toBe(200);expect(body).toMatchObject({syncedIds:['tea'],noteIds:['voice']});
 }
 expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_compass_entries').get()).toMatchObject({n:1});
 expect(db.sqlite.prepare("SELECT text,compass_entry_id,author_id FROM notes WHERE id='voice'").get()).toEqual({text:note.text,compass_entry_id:'tea',author_id:'owner'});
 expect(db.sqlite.prepare("SELECT photos FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({photos:JSON.stringify(entry.photos)});
});
it('keeps explicit Save interactive while periodic synchronization stays background',()=>{
 expect(classifyRequest(new Request('https://worker.test/api/compass/entries/tea/save',{method:'POST'}))).toMatchObject({priority:'interactive'});
 expect(classifyRequest(new Request('https://worker.test/api/compass/sync',{method:'POST'}))).toMatchObject({priority:'background'});
});
it('refuses unrelated notes before creating the tea',async()=>{const {db,call}=await setup();const r=await call({entry,notes:[{...note,compass_entry_id:'other'}]});expect(r.status).toBe(400);expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_compass_entries').get()).toMatchObject({n:0})});
it('refuses foreign or deleted tea IDs without saving their notes',async()=>{const {db,call}=await setup();seedIdentity(db,{userId:'foreign',accountId:'b',role:'owner'});db.sqlite.prepare("INSERT INTO tea_compass_entries(id,account_id,user_id,name) VALUES('tea','b','foreign','Foreign')").run();const r=await call({entry,notes:[note]});expect(r.status).toBe(409);expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM notes').get()).toMatchObject({n:0})});
it('refuses reusing a note ID attached to another tea before changing its words',async()=>{
 const {db,call}=await setup();
 db.sqlite.prepare("INSERT INTO tea_compass_entries(id,account_id,user_id,name) VALUES('other','a','owner','Other tea')").run();
 db.sqlite.prepare("INSERT INTO notes(id,account_id,compass_entry_id,text,source_type,author_id,author_name,visibility,created_at) VALUES('voice','a','other','Original words','voice','owner','Owner','private','2026-11-19')").run();
 const response=await call({entry,notes:[note]});expect(response.status).toBe(409);
 expect(db.sqlite.prepare("SELECT text,compass_entry_id FROM notes WHERE id='voice'").get()).toMatchObject({text:'Original words',compass_entry_id:'other'});
 expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({n:0});
});
