import {describe,it,expect,vi} from 'vitest';
import {SqliteD1,seedIdentity} from './helpers/sqliteD1';
import {decodeAttachment,uploadCurateAttachment,listCurateAttachments,readCurateAttachment} from '../src/curateAttachments';
import {previewCurateMutation,confirmCurateMutation,previewCurateUndo,readCurateHistory} from '../src/curateMutations';
import {handleCurateWorkspace} from '../src/curateWorkspaceRoutes';
const auth={accountId:'a',userId:'owner',tokenId:'token',creatorTier:'account_owner',userEmail:'owner@test.dev'};
const input={entity_type:'tea' as const,entity_id:'tea',role:'label' as const,filename:'label.png',mime_type:'image/png',data_base64:btoa(String.fromCharCode(137,80,78,71,13,10,26,10,1,2,3)),agent:'GrokBot'};
function setup(shape:'schema'|'migrations'='schema') {
 const db=new SqliteD1(shape);seedIdentity(db,{accountId:'a',userId:'owner'});
 db.exec("INSERT INTO tea_compass_entries(id,account_id,user_id,name) VALUES('tea','a','owner','LKY-PE3')");
 const objects=new Map<string,Uint8Array>();
 const bucket={put:vi.fn(async(key:string,bytes:Uint8Array)=>{objects.set(key,bytes);}),get:vi.fn(async(key:string)=>objects.has(key)?{body:objects.get(key)}:null)};
 return {db,env:{DB:db as any,ATLAS_BUCKET:bucket as any},bucket};
}
async function attach(env:any){const p:any=await uploadCurateAttachment(env,auth,input);return uploadCurateAttachment(env,auth,{...input,confirm:p.confirmation_token}) as Promise<any>;}
describe('private Curate source evidence',()=>{
 it.each(['schema','migrations'] as const)('uploads only confirmed bytes and keeps authenticated evidence off public URLs on %s',async shape=>{
  const {db,env,bucket}=setup(shape);const p:any=await uploadCurateAttachment(env,auth,input);
  expect(bucket.put).not.toHaveBeenCalled();expect(db.prepare('SELECT * FROM curate_attachments').all().results).toHaveLength(0);
  const result:any=await uploadCurateAttachment(env,auth,{...input,confirm:p.confirmation_token});expect(result.confirmed).toBe(true);
  expect(bucket.put).toHaveBeenCalledTimes(1);expect(bucket.put.mock.calls[0][0]).toMatch(/^curate\/attachments\/a\//);
  const files:any[]=await listCurateAttachments(env.DB,auth,'tea','tea');expect(files).toHaveLength(1);expect(files[0]).toMatchObject({filename:'label.png',role:'label'});expect(files[0].object_key).toBeUndefined();
  expect((await readCurateHistory(env,auth,{entity_type:'tea',entity_id:'tea'})).history).toHaveLength(1);
  const response=await readCurateAttachment(env,auth,files[0].id);expect(response.status).toBe(200);expect(response.headers.get('Cache-Control')).toContain('no-store');expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.from(atob(input.data_base64),c=>c.charCodeAt(0)));
  expect((await readCurateAttachment(env,{accountId:'other'},files[0].id)).status).toBe(404);
  expect(db.prepare('SELECT agent_name FROM curate_mutations').first()).toMatchObject({agent_name:'GrokBot'});
  expect(db.prepare('SELECT * FROM notes').all().results).toHaveLength(0);
  expect(await uploadCurateAttachment(env,auth,{...input,confirm:p.confirmation_token})).toMatchObject({error:expect.any(String)});
 });
 it('rejects changed bytes, malformed content, wrong targets and nonmembers before writing bytes',async()=>{
  const {env,bucket}=setup();const p:any=await uploadCurateAttachment(env,auth,input);
  await expect(uploadCurateAttachment(env,auth,{...input,filename:'another.png',confirm:p.confirmation_token})).rejects.toThrow('changed since preview');
  await expect(uploadCurateAttachment(env,{...auth,accountId:'elsewhere'},input)).rejects.toThrow();
  await expect(uploadCurateAttachment(env,auth,{...input,entity_id:'missing'})).rejects.toThrow('target not found');
  expect(()=>decodeAttachment({...input,mime_type:'application/pdf'})).toThrow('bytes match');
  expect(()=>decodeAttachment({...input,data_base64:'invalid!'})).toThrow('base64');
  expect(()=>decodeAttachment({...input,filename:'../label.png'})).toThrow('filename');
  expect(bucket.put).not.toHaveBeenCalled();
 });
 it('removes one attachment and safely undoes it without losing immutable bytes',async()=>{
  const {env,bucket}=setup();const one=await attach(env);const two=await attach(env);
  const p:any=await previewCurateMutation(env,auth,{entity:'attachment',action:'delete',id:one.attachment.id});
  expect((await confirmCurateMutation(env,auth,p.confirmation_token)).confirmed).toBe(true);
  expect((await listCurateAttachments(env.DB,auth,'tea','tea')).map((f:any)=>f.id)).toEqual([two.attachment.id]);
  expect((await readCurateAttachment(env,auth,one.attachment.id)).status).toBe(404);
  const undo:any=await previewCurateUndo(env,auth);await confirmCurateMutation(env,auth,undo.confirmation_token);
  expect(await listCurateAttachments(env.DB,auth,'tea','tea')).toHaveLength(2);expect(bucket.put).toHaveBeenCalledTimes(2);
 });
 it('retries a quote creation by request id without creating another quote or overwriting it',async()=>{
  const {db,env}=setup();db.exec(`INSERT INTO customers(id,account_id,name,tags) VALUES('vendor','a','Vendor','["vendor"]')`);
  const request=(reference:string)=>new Request('https://test/api/curate/quotes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'quote-request-001',vendor_id:'vendor',reference})});
  const first=await handleCurateWorkspace(request('QT02'),env,auth);expect(first.status).toBe(200);
  const retry=await handleCurateWorkspace(request('Do not overwrite'),env,auth);expect(retry.status).toBe(200);
  expect(await retry.json()).toMatchObject({id:'quote-request-001',reference:'QT02'});
  expect(db.prepare('SELECT COUNT(*) AS count FROM curate_quotes').first()).toMatchObject({count:1});
 });
 it('requires manager authentication and the correct HTTP method',async()=>{
  const {env}=setup();
  expect((await handleCurateWorkspace(new Request('https://test/api/curate/undo'),env,auth)).status).toBe(405);
  expect((await handleCurateWorkspace(new Request('https://test/api/curate/holdings'),env,{...auth,userId:'stranger'})).status).toBe(403);
 });
});
