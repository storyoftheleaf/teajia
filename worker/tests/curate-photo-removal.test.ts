import {afterEach,describe,it,expect,vi} from 'vitest';
import {SqliteD1,seedIdentity} from './helpers/sqliteD1';
import {driveSeal} from '../src/curateDrive';
import {previewCuratePhotoRemoval,confirmCuratePhotoRemoval} from '../src/mcpTools/curatePhotoRemoval';
import {previewCurateMutation} from '../src/curateMutations';
const auth={accountId:'a',userId:'owner',tokenId:'token',userEmail:'owner@test.dev',creatorTier:'admin'};
const photo='https://media.teajia.co/test.png';const databases:SqliteD1[]=[];
afterEach(()=>{vi.unstubAllGlobals();for(const db of databases.splice(0))db.close();});
async function setup() {
 const db=new SqliteD1();databases.push(db);seedIdentity(db,{accountId:'a',userId:'owner',role:'owner'});
 db.prepare('INSERT INTO tea_compass_entries(id,account_id,user_id,name,photos) VALUES(?,?,?,?,?)').bind('tea','a','owner','Yiwu',JSON.stringify([photo])).run();
 const env={DB:db as any,KEY_ENCRYPTION_SECRET:'seal-test',GOOGLE_CLIENT_ID:'c',GOOGLE_CLIENT_SECRET:'s'};
 db.prepare('INSERT INTO curate_drive_links(account_id,connected_by_user_id,google_email,refresh_token_encrypted) VALUES(?,?,?,?)').bind('a','owner','owner@gmail.test',await driveSeal(env).encrypt('refresh')).run();
 db.prepare('INSERT INTO curate_drive_files(id,account_id,compass_entry_id,photo_url,drive_file_id) VALUES(?,?,?,?,?)').bind('mapping','a','tea',photo,'drive-photo').run();
 let trashed=false;let mode='normal';let version='1';
 const fetcher=vi.fn(async(u:any,i:any={})=>{
  if(String(u).includes('oauth2.googleapis.com')) return Response.json({access_token:'access'});
  expect(String(u)).toContain('/files/drive-photo?');
  if(i.method==='PATCH') {
   expect(db.prepare('SELECT photos FROM tea_compass_entries WHERE id=?').bind('tea').first<any>().photos).toBe('[]');
   if(mode==='refuse')return new Response(null,{status:403});
   trashed=true;version='2';if(mode==='timeout')throw new Error('timed out');
  }else if(mode==='timeout'&&trashed)throw new Error('read unavailable');
  return Response.json({id:'drive-photo',name:'Yiwu test.png',mimeType:'image/png',trashed,explicitlyTrashed:trashed,version,capabilities:{canTrash:true,canUntrash:true}});
 });vi.stubGlobal('fetch',fetcher);
 return {db,env,fetcher,mode:(v:string)=>{mode=v;},version:()=>{version='new';},trashed:()=>trashed,setTrashed:(v:boolean)=>{trashed=v;},preview:()=>previewCuratePhotoRemoval(env,auth,{action:'remove_photo',entity:'tea',id:'tea',photo,trash_drive:true,agent:'tester'}) as Promise<any>};
}
describe('optional combined photo removal',()=>{
 it('previews both exact effects, removes local first, audits each part and safely replays the result',async()=>{
  const s=await setup();const p=await s.preview();expect(p.preview).toMatchObject({trash_drive:true,photo,drive:{file_id:'drive-photo',action:'trash'}});expect(s.trashed()).toBe(false);
  const result=await confirmCuratePhotoRemoval(s.env,auth,p.confirmation_token);expect(result).toMatchObject({confirmed:true,photo_removed:true,completed:true,drive:{status:'succeeded'}});
  expect(s.db.prepare('SELECT * FROM curate_mutations').all().results).toHaveLength(1);expect(s.db.prepare('SELECT * FROM curate_drive_photo_operations').all().results).toHaveLength(1);
  const calls=s.fetcher.mock.calls.length;expect(await confirmCuratePhotoRemoval(s.env,auth,p.confirmation_token)).toEqual(result);expect(s.fetcher).toHaveBeenCalledTimes(calls);
 });
 it('stale local confirmation never attempts remote trash',async()=>{
  const s=await setup();const p=await s.preview();s.db.prepare('UPDATE tea_compass_entries SET name=? WHERE id=?').bind('Changed','tea').run();
  expect(await confirmCuratePhotoRemoval(s.env,auth,p.confirmation_token)).toMatchObject({photo_removed:false,local:{error:'stale_preview'},drive:{status:'not_started'}});
  expect(s.fetcher.mock.calls.filter(([,i]:any)=>i?.method==='PATCH')).toHaveLength(0);expect(s.trashed()).toBe(false);
 });
 it('failed/unknown Google outcomes never claim rollback or full completion',async()=>{
  for(const mode of ['refuse','timeout']) {
   const s=await setup();const p=await s.preview();s.mode(mode);const result=await confirmCuratePhotoRemoval(s.env,auth,p.confirmation_token);
   expect(result).toMatchObject({confirmed:true,photo_removed:true,completed:false,drive:{status:mode==='refuse'?'failed':'unknown'}});
   expect(s.db.prepare('SELECT photos FROM tea_compass_entries WHERE id=?').bind('tea').first<any>().photos).toBe('[]');
   expect(await confirmCuratePhotoRemoval(s.env,auth,p.confirmation_token)).toEqual(result);
  }
 });
 it('binds the combined ticket to the principal and routes ordinary confirmations back to the existing handler',async()=>{
  const s=await setup();const p=await s.preview();expect(await confirmCuratePhotoRemoval(s.env,{...auth,tokenId:'sibling'},p.confirmation_token)).toMatchObject({error:'invalid_or_expired_confirmation_token'});
  expect(s.trashed()).toBe(false);expect(await confirmCuratePhotoRemoval(s.env,auth,p.confirmation_token)).toMatchObject({completed:true});
  const normal=await previewCurateMutation(s.env,auth,{entity:'tea',action:'edit',id:'tea',fields:{name:'Updated'}});expect(await confirmCuratePhotoRemoval(s.env,auth,normal.confirmation_token)).toBeNull();
 });
 it('checks an already-trashed backup again instead of claiming the preview state is still true',async()=>{
  const s=await setup();s.setTrashed(true);const p=await s.preview();expect(p.preview.drive).toMatchObject({unchanged:true});s.setTrashed(false);
  expect(await confirmCuratePhotoRemoval(s.env,auth,p.confirmation_token)).toMatchObject({photo_removed:true,completed:false,drive:{status:'not_applied',error:'drive_file_changed_since_preview'}});
  expect(s.fetcher.mock.calls.filter(([,i]:any)=>i?.method==='PATCH')).toHaveLength(0);
 });
 it('does not unlink a photo when no exact Drive mapping can be previewed',async()=>{
  const s=await setup();s.db.exec('DELETE FROM curate_drive_files');await expect(s.preview()).rejects.toThrow('exact synced photo');expect(s.db.prepare('SELECT photos FROM tea_compass_entries WHERE id=?').bind('tea').first<any>().photos).toBe(JSON.stringify([photo]));
  expect(s.db.prepare('SELECT * FROM curate_mutations').all().results).toHaveLength(0);
 });
 it('rechecks remote state after local removal and does not trash a changed backup',async()=>{
  const s=await setup();const p=await s.preview();s.version();expect(await confirmCuratePhotoRemoval(s.env,auth,p.confirmation_token)).toMatchObject({photo_removed:true,completed:false,drive:{error:'drive_file_changed_since_preview'}});
  expect(s.fetcher.mock.calls.filter(([,i]:any)=>i?.method==='PATCH')).toHaveLength(0);
 });
});
