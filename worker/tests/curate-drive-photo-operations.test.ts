import {afterEach,describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {SqliteD1} from './helpers/sqliteD1';
import {curateDrivePhoto} from '../src/mcpTools/curateDrivePhotos';
import {savePhotosToDrive,driveSeal,teaDriveFiles} from '../src/curateDrive';
const auth={accountId:'a',userId:'owner',tokenId:'t',userEmail:'x',creatorTier:'admin'};
const dbs:SqliteD1[]=[];
afterEach(()=>{vi.unstubAllGlobals();for(const db of dbs.splice(0))db.close();});
async function setup() {
 const db=new SqliteD1(false);dbs.push(db);
 db.exec(`CREATE TABLE account_members(account_id TEXT,user_id TEXT,role TEXT,permissions TEXT,status TEXT);
 CREATE TABLE tea_compass_entries(id TEXT,account_id TEXT,name TEXT,photos TEXT,year TEXT,vendor_id TEXT,vendor_name TEXT);
 CREATE TABLE curate_drive_links(account_id TEXT,google_email TEXT,refresh_token_encrypted TEXT,root_folder_id TEXT,last_error TEXT);
 CREATE TABLE curate_drive_files(id TEXT PRIMARY KEY,account_id TEXT,compass_entry_id TEXT,photo_url TEXT,drive_file_id TEXT,web_view_link TEXT);
 CREATE TABLE mcp_confirmation_tickets(token_hash TEXT PRIMARY KEY,account_id TEXT,kind TEXT,payload_json TEXT,expires_at INTEGER,token_id TEXT,consumed_at INTEGER);
 INSERT INTO account_members VALUES('a','owner','owner','{}','active');
 INSERT INTO tea_compass_entries VALUES('tea','a','Yiwu','[]',NULL,NULL,NULL);
 INSERT INTO tea_compass_entries VALUES('foreign','b','Foreign','[]',NULL,NULL,NULL);
 INSERT INTO curate_drive_files VALUES('mapping','a','tea','https://media.teajia.co/photo.jpg','exact-file','https://drive.google.com/file/d/exact-file/view');`);
 db.exec(readFileSync('worker/migrations/0038_curate_drive_photo_operations.sql','utf8'));
 db.exec("ALTER TABLE curate_drive_files ADD COLUMN created_at TEXT; CREATE TABLE curate_drive_folders(account_id TEXT,folder_key TEXT,folder_id TEXT)");
 const env={DB:db as any,KEY_ENCRYPTION_SECRET:'test-secret',GOOGLE_CLIENT_ID:'client',GOOGLE_CLIENT_SECRET:'clientsecret'};
 db.prepare('INSERT INTO curate_drive_links VALUES(?,?,?,?,?)').bind('a','owner@gmail.test',await driveSeal(env).encrypt('refresh'),'root',null).run();
 let trashed=false;let timeout=false;let unavailable=false;let patchFails=false;let version='1';
 const fetcher=vi.fn(async(url:any,init:any={})=>{
  if(String(url).includes('oauth2.googleapis.com'))return Response.json({access_token:'at'});
  expect(String(url)).toContain('/drive/v3/files/exact-file?');
  if(init.method==='PATCH'){
   // The durable intent MUST already exist before any remote write.
   expect(db.prepare("SELECT * FROM curate_drive_photo_operations WHERE status='pending'").all().results).toHaveLength(1);
   if(patchFails)return new Response(null,{status:403});
   trashed=JSON.parse(init.body).trashed;version=String(Number(version)+1);
   if(timeout)throw new Error('connection timed out after Google applied change');
  }else if(unavailable)throw new Error('read unavailable');
  return Response.json({id:'exact-file',name:'Yiwu photo.jpg',mimeType:'image/jpeg',trashed,explicitlyTrashed:trashed,version,capabilities:{canTrash:true,canUntrash:true}});
 });vi.stubGlobal('fetch',fetcher);
 const preview=()=>curateDrivePhoto(env,auth,{tea_id:'tea',photo:'https://media.teajia.co/photo.jpg',action:'trash',agent:'test'}) as Promise<any>;
 const confirm=(p:any)=>curateDrivePhoto(env,auth,{confirmation_token:p.confirmation_token}) as Promise<any>;
 return {db,env,fetcher,preview,confirm,setTimeout:()=>{timeout=true;},setUnavailable:(v:boolean)=>{unavailable=v;},setPatchFails:()=>{patchFails=true;},setVersion:()=>{version='99';},trashed:()=>trashed};
}
describe('exact account-scoped Drive backup changes',()=>{
 it('previews a detached photo, trashes only after confirmation, restores same ID and keeps mapping/media',async()=>{
  const s=await setup();const p=await s.preview();expect(p.preview).toMatchObject({tea:'Yiwu',file_id:'exact-file',action:'trash'});expect(s.trashed()).toBe(false);
  expect(await s.confirm(p)).toMatchObject({status:'succeeded'});expect(s.trashed()).toBe(true);
  expect(s.db.prepare('SELECT * FROM curate_drive_files').all().results).toHaveLength(1);
  s.db.exec(`UPDATE tea_compass_entries SET photos='["https://media.teajia.co/photo.jpg"]' WHERE id='tea'`);
  const before=s.fetcher.mock.calls.length;expect(await savePhotosToDrive(s.env,driveSeal(s.env),'a','tea')).toBe(0);expect(s.fetcher).toHaveBeenCalledTimes(before);
  const restore:any=await curateDrivePhoto(s.env,auth,{tea_id:'tea',photo:'https://media.teajia.co/photo.jpg',action:'restore'});
  expect(await s.confirm(restore)).toMatchObject({status:'succeeded'});expect(s.trashed()).toBe(false);
  const history=s.db.prepare('SELECT * FROM curate_drive_photo_operations').all().results as any[];
  expect(history).toHaveLength(2);expect(history[0]).toMatchObject({actor_user_id:'owner',actor_token_id:'t',agent_name:'test',drive_file_id:'exact-file',status:'succeeded'});
  expect(s.fetcher.mock.calls.filter(([,init]:any)=>init?.method==='DELETE')).toHaveLength(0);
  const drive=await teaDriveFiles(s.env,'a','tea');expect(drive.operations).toHaveLength(2);expect(drive.operations[1]).toMatchObject({action:'trash',actor_user_id:'owner',actor_token_id:'t',agent_name:'test'});expect(JSON.stringify(drive.operations)).not.toContain('connection_fingerprint');
  expect((await teaDriveFiles(s.env,'b','tea')).operations).toEqual([]);
 });
 it('requires real membership and exact shop mapping; refuses shared backup',async()=>{
  const s=await setup();await expect(curateDrivePhoto(s.env,{...auth,userId:'outsider'},{tea_id:'tea',photo:'https://media.teajia.co/photo.jpg',action:'trash'})).rejects.toThrow('ownership');
  await expect(curateDrivePhoto(s.env,auth,{tea_id:'foreign',photo:'https://media.teajia.co/photo.jpg',action:'trash'})).rejects.toThrow('exact synced');
  s.db.exec("INSERT INTO curate_drive_files VALUES('shared','b','foreign','else','exact-file',NULL,NULL)");await expect(s.preview()).rejects.toThrow('shared');expect(s.fetcher).not.toHaveBeenCalled();
 });
 it('binds confirmation to user/token and refuses stale mapping, connection or remote state',async()=>{
  for(const change of ['token','user','mapping','connection','remote','membership']){
   const s=await setup();const p=await s.preview();
   if(change==='token'){expect(await curateDrivePhoto(s.env,{...auth,tokenId:'sibling'},{confirmation_token:p.confirmation_token})).toMatchObject({error:'invalid_or_expired_confirmation_token'});}
   else if(change==='user'){s.db.exec("INSERT INTO account_members VALUES('a','sibling','owner','{}','active')");expect(await curateDrivePhoto(s.env,{...auth,userId:'sibling'},{confirmation_token:p.confirmation_token})).toMatchObject({error:'invalid_or_expired_confirmation_token'});}
   else if(change==='membership'){s.db.exec("UPDATE account_members SET status='inactive'");await expect(s.confirm(p)).rejects.toThrow('ownership');}
   else {if(change==='mapping')s.db.exec("UPDATE curate_drive_files SET drive_file_id='new-file'");if(change==='connection')s.db.exec("UPDATE curate_drive_links SET google_email='different'");if(change==='remote')s.setVersion();expect(await s.confirm(p)).toHaveProperty('error');}
   expect(s.fetcher.mock.calls.filter(([,init]:any)=>init?.method==='PATCH')).toHaveLength(0);
  }
 });
 it('reconciles a timed-out write via readback; uncertain retry never writes twice',async()=>{
  const s=await setup();const p=await s.preview();s.setTimeout();s.setUnavailable(true);
  // Allow pre-write state read, then block only verification after PATCH.
  const real=s.fetcher.getMockImplementation()!;s.fetcher.mockImplementation(async(u:any,i:any={})=>{if(i.method!=='PATCH')s.setUnavailable(s.trashed());return real(u,i);});
  const result=await s.confirm(p);expect(result).toMatchObject({status:'unknown'});
  expect(await s.preview()).toMatchObject({error:'unverified_drive_operation'});
  s.fetcher.mockImplementation(real);s.setUnavailable(false);
  expect(await curateDrivePhoto(s.env,auth,{operation_id:result.operation_id})).toMatchObject({status:'succeeded'});
  expect(s.fetcher.mock.calls.filter(([,i]:any)=>i?.method==='PATCH')).toHaveLength(1);
  expect(await s.confirm(p)).toMatchObject({error:'invalid_or_expired_confirmation_token'});
 });
 it('recovers a crashed intent through fresh approval of the same action; token rotation can reconcile',async()=>{
  const s=await setup();const p=await s.preview();s.setTimeout();
  const real=s.fetcher.getMockImplementation()!;
  s.fetcher.mockImplementation(async(u:any,i:any={})=>{if(i.method==='PATCH')throw new Error('not sent');return real(u,i);});
  const result=await s.confirm(p);expect(result.status).toBe('unknown');
  const rotated={...auth,tokenId:'rotated'};
  expect(await curateDrivePhoto(s.env,rotated,{operation_id:result.operation_id})).toMatchObject({status:'unknown'});
  expect(await curateDrivePhoto(s.env,rotated,{operation_id:result.operation_id,retry:true})).toMatchObject({error:'operation_still_running'});
  s.db.exec("UPDATE curate_drive_photo_operations SET updated_at=datetime('now','-2 minutes')");
  const retry:any=await curateDrivePhoto(s.env,rotated,{operation_id:result.operation_id,retry:true,action:'restore',agent:'recovery'});
  expect(retry.preview).toMatchObject({action:'trash',retry_of:result.operation_id});
  const writes=s.fetcher.mock.calls.filter(([,i]:any)=>i?.method==='PATCH').length;
  expect(s.fetcher.mock.calls.filter(([,i]:any)=>i?.method==='PATCH')).toHaveLength(writes);
  s.fetcher.mockImplementation(real);
  const done=await curateDrivePhoto(s.env,rotated,{confirmation_token:retry.confirmation_token});expect(done).toMatchObject({status:'succeeded',operation_id:result.operation_id});
  const op=s.db.prepare('SELECT * FROM curate_drive_photo_operations').first<any>();expect(op.actor_token_id).toBe('t');expect(JSON.parse(op.attempts_json)).toMatchObject([{actor_token_id:'rotated',agent_name:'recovery'}]);
  expect(s.db.prepare('SELECT * FROM curate_drive_photo_operations').all().results).toHaveLength(1);
 });
 it('a delayed old read cannot overwrite the state proved by a newer retry',async()=>{
  const s=await setup();const p=await s.preview();const real=s.fetcher.getMockImplementation()!;
  s.fetcher.mockImplementation(async(u:any,i:any={})=>{if(i.method==='PATCH')throw new Error('not sent');return real(u,i);});
  const result=await s.confirm(p);expect(result.status).toBe('unknown');
  s.db.exec("UPDATE curate_drive_photo_operations SET updated_at=datetime('now','-2 minutes')");
  const before=s.db.prepare('SELECT attempt_id FROM curate_drive_photo_operations').first<any>().attempt_id;
  let release:()=>void=()=>{};let entered:()=>void=()=>{};
  const enteredPromise=new Promise<void>(resolve=>{entered=resolve;});
  let hold=true;
  s.fetcher.mockImplementation(async(u:any,i:any={})=>{
   if(hold&&i.method!=='PATCH'&&String(u).includes('/drive/v3/files/')){
    hold=false;const response=await real(u,i);entered();await new Promise<void>(resolve=>{release=resolve;});return response;
   }
   return real(u,i);
  });
  const oldRead=curateDrivePhoto(s.env,auth,{operation_id:result.operation_id});await enteredPromise;
  const retry:any=await curateDrivePhoto(s.env,auth,{operation_id:result.operation_id,retry:true});
  expect(await s.confirm(retry)).toMatchObject({status:'succeeded'});
  const after=s.db.prepare('SELECT attempt_id FROM curate_drive_photo_operations').first<any>().attempt_id;expect(after).not.toBe(before);
  release();expect(await oldRead).toMatchObject({status:'succeeded'});
  expect(s.db.prepare('SELECT status,attempt_id FROM curate_drive_photo_operations').first<any>()).toEqual({status:'succeeded',attempt_id:after});
 });
 it('records a definite Google refusal and returns it without changing the tea',async()=>{
  const s=await setup();const p=await s.preview();s.setPatchFails();expect(await s.confirm(p)).toMatchObject({status:'failed'});expect(s.trashed()).toBe(false);expect(s.db.prepare('SELECT photos FROM tea_compass_entries WHERE id=?').bind('tea').first<any>().photos).toBe('[]');
 });
});
