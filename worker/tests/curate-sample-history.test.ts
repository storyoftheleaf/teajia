import {describe,it,expect} from 'vitest';
import {SqliteD1,seedIdentity} from './helpers/sqliteD1';
import {prepareCompassSampleWrite} from '../src/curateSampleBridge';
import {prepareCurateRecordedWrite,previewCurateUndo,confirmCurateMutation,readCurateHistory} from '../src/curateMutations';
import {curateIntakeTools} from '../src/mcpTools/curateIntake';
const auth={accountId:'a',userId:'owner',tokenId:'token',creatorTier:'account_owner',userEmail:'owner@test.dev'};
function setup(shape:'schema'|'migrations'='schema') {
 const db=new SqliteD1(shape);seedIdentity(db,{accountId:'a',userId:'owner'});
 db.prepare("INSERT INTO customers(id,account_id,name,tags) VALUES('vendor','a','Vendor','[\"vendor\"]')").run();
 return {db,env:{DB:db as any}};
}
const get=(db:SqliteD1,table:string,id:string)=>db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first<any>();
async function add(env:any,input:any) {
 const handler=curateIntakeTools.handlers.curate_add_tea;
 const p:any=await handler(env,auth,input);return handler(env,auth,{...input,confirm:p.confirmation_token}) as Promise<any>;
}
async function undo(env:any) {const p=await previewCurateUndo(env,auth);return confirmCurateMutation(env,auth,p.confirmation_token);}
describe('one recorded change contains the complete Curate sample bridge',()=>{
 it.each(['schema','migrations'] as const)('predicts exact stored bridge snapshots on %s',async shape=>{
  const {db}=setup(shape);
  const entry={id:'tea',account_id:'a',user_id:'owner',name:'Tea',vendor_id:'vendor',vendor_name:'Vendor',sample_state:'received',photos:'[]'};
  const bridge=await prepareCompassSampleWrite(db as any,auth,entry,{entryId:'tea',grams:25});
  const write=prepareCurateRecordedWrite(db as any,auth,{commandType:'tea:create',changes:bridge.changes,guards:bridge.guards});
  db.batch([...write.statements,write.assertion] as any);
  for(const c of bridge.changes) {
   const table=c.entityType==='tea'?'tea_compass_entries':c.entityType==='sample'?'tea_samples':'tea_sample_sets';
   const actual=get(db,table,c.entityId);
   for(const [key,value] of Object.entries(c.after!)) expect(actual[key],`${c.entityType}.${key}`).toEqual(value);
  }
 });
 it('undo archives a pristine new portion and set, reverses exact said and todo, and retains all historical rows',async()=>{
  const {db,env}=setup();
  const result=await add(env,{name:'Tea',vendor_id:'vendor',sample_state:'received',sample_grams:25,said:'Exact original words',todo:'Ask vendor'});
  const tea=result.tea.id;const sample=db.prepare('SELECT * FROM tea_samples').first<any>();const set=get(db,'tea_sample_sets',sample.set_id);
  const history=await readCurateHistory(env,auth);expect(history.history[0].command_type).toBe('tea:create');
  expect(history.history[0].records.map((r:any)=>r.entity_type).sort()).toEqual(['sample','sample_set','tea','todo','transcript']);
  expect(await undo(env)).toMatchObject({confirmed:true});
  expect(get(db,'tea_compass_entries',tea).archived_at).not.toBeNull();
  expect(get(db,'tea_samples',sample.id)).toMatchObject({grams:25,status:'received'});
  expect(get(db,'tea_samples',sample.id).archived_at).not.toBeNull();expect(get(db,'tea_sample_sets',set.id).archived).toBe(1);
  expect(db.prepare('SELECT text,source_type,deleted FROM notes').first()).toMatchObject({text:'Exact original words',source_type:'voice',deleted:1});
  expect(db.prepare('SELECT deleted_at FROM curate_todos').first<any>().deleted_at).not.toBeNull();
  expect((await readCurateHistory(env,auth)).history).toHaveLength(2);
 });
 it('undo removes only the new portion while an existing vendor batch and unrelated sample stay active',async()=>{
  const {db,env}=setup();await add(env,{name:'First',vendor_id:'vendor',sample_state:'received',sample_grams:20});
  const first=db.prepare('SELECT * FROM tea_samples').first<any>();
  await add(env,{name:'Second',vendor_id:'vendor',sample_state:'received',sample_grams:7});
  const second=db.prepare('SELECT * FROM tea_samples WHERE id <> ?').bind(first.id).first<any>();
  expect(second.set_id).toBe(first.set_id);await undo(env);
  expect(get(db,'tea_sample_sets',first.set_id).archived).toBe(0);
  expect(get(db,'tea_samples',first.id)).toMatchObject({grams:20,archived_at:null});expect(get(db,'tea_samples',second.id).archived_at).not.toBeNull();
 });
 it('rejects undo after another tasting is filed without discarding the tasting history',async()=>{
  const {db,env}=setup();await add(env,{name:'Tea',vendor_id:'vendor',sample_state:'tasted',sample_grams:25});
  const sample=db.prepare('SELECT * FROM tea_samples').first<any>();
  db.prepare("INSERT INTO tea_sample_tastings(id,account_id,sample_id,taster_id,tasting) VALUES('later','a',?,'owner','{}')").bind(sample.id).run();
  const p=await previewCurateUndo(env,auth);expect(await confirmCurateMutation(env,auth,p.confirmation_token)).toMatchObject({error:'stale_preview'});
  expect(get(db,'tea_samples',sample.id).archived_at).toBeNull();expect(get(db,'tea_sample_tastings','later')).not.toBeNull();
 });
 it('undo restores sample edits and tea links together, then refuses a later consumed portion',async()=>{
  const {db,env}=setup();const added=await add(env,{name:'Tea',vendor_id:'vendor',sample_state:'received',sample_grams:25});
  const handler=curateIntakeTools.handlers.curate_update_tea;const args={tea_id:added.tea.id,name:'Corrected',sample_grams:30};
  const p:any=await handler(env,auth,args);await handler(env,auth,{...args,confirm:p.confirmation_token});
  await undo(env);expect(db.prepare('SELECT grams,name FROM tea_samples').first()).toMatchObject({grams:25,name:'Tea'});
  const again:any=await handler(env,auth,args);await handler(env,auth,{...args,confirm:again.confirmation_token});
  db.prepare('UPDATE tea_samples SET grams=20').run();await expect(previewCurateUndo(env,auth)).rejects.toThrow('changed after confirmation');
 });
});
