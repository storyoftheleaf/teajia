/** Allowlisted, account-scoped corrections. The history insert is the atomic gate
 * for every write; a stale row makes the whole batch a no-op. Physical holdings,
 * receipts and historical tasting rows are never rewritten during a merge. */
import type { ToolAuth, ToolEnv } from './mcpTools/registry';
import { mergeProductTasting, TASTING_TERM_CATEGORIES } from './curateImportTasting';
import { sha256Hex } from './inquiryDomain';
import { readCompassStructuredPatch, COMPASS_STRUCTURED_COLUMNS } from '../../src/lib/curateStructuredFields';
import { refreshedCurrencyName } from './exchangeRateFeed';
import { validateCompassQuoteLink } from './curateQuotes';
import { issueTicket, consumeTicket, previewEnvelope, INVALID_TICKET } from './mcpTools/tickets';

export type CurateEntity = 'tea' | 'vendor' | 'note' | 'todo' | 'sample' | 'transcript' | 'attachment';
export type CurateRecordedEntity = CurateEntity | 'vendor_profile' | 'quote' | 'quote_line' | 'attachment' | 'asset' | 'sample_set';
export type CurateCommand =
 | { action: 'edit'; entity: CurateEntity; id: string; fields: Record<string, unknown> }
 | { action: 'archive' | 'delete'; entity: 'tea' | 'vendor' | 'note' | 'todo' | 'transcript' | 'attachment'; id: string }
 | { action: 'merge'; entity: 'tea' | 'vendor'; id: string; target_id: string }
 | { action: 'close' | 'reopen'; entity: 'todo'; id: string }
 | { action: 'remove_tasting'; entity: 'tea'; id: string; category: string; term?: string }
 | { action: 'remove_score'; entity: 'tea'; id: string }
 | { action: 'remove_photo'; entity: 'tea'; id: string; photo: string }
 | { action: 'taste_sample'; entity: 'sample'; id: string; consumed_grams: number; tasting?:Record<string,string[]>; score?:number };
type Row = Record<string, any>;
type Change = { entity: CurateRecordedEntity; id: string; before: Row | null; after: Row | null };
export type CurateGuard = { sql: string; values: any[]; confirmationOnly?: boolean };
export interface CurateMutationTicket {
 kind: 'curate:manage'; accountId: string; userId: string; commandType: string;
 agent: string; changes: Change[]; guards: CurateGuard[]; undoOf: string | null;
}
const TABLES: Record<CurateRecordedEntity, string> = { tea: 'tea_compass_entries', vendor: 'customers', note: 'notes', transcript: 'notes', todo: 'curate_todos', vendor_profile:'curate_vendor_profiles',quote:'curate_quotes',quote_line:'curate_quote_lines',attachment:'curate_attachments',asset:'curate_media_assets',sample:'tea_samples',sample_set:'tea_sample_sets' };
const keyColumn=(entity:CurateRecordedEntity)=>entity==='vendor_profile'?'vendor_id':'id';
const FIELDS: Record<CurateEntity, string[]> = {
 tea: ['name','chinese_name','type','form','year','season','storage','origin_country','origin_region','classification','cultivar','description','notes','shop_name','transport_mode','price_amount','price_currency','price_per_unit_grams',...COMPASS_STRUCTURED_COLUMNS],
 vendor: ['name','chinese_name','company','email','phone','whatsapp','address','city','country','notes'],
 note: ['text'],transcript:['text'],attachment:[],todo: ['text'], sample: ['grams'],
};

/** Tier is not authority: membership is checked at preview AND confirmation. */
export async function requireCurateManager(db: D1Database, scope: {accountId:string;userId:string}) {
 const member = await db.prepare(`SELECT role, permissions FROM account_members WHERE account_id = ? AND user_id = ? AND status = 'active'`)
  .bind(scope.accountId, scope.userId).first<{role:string;permissions:string}>();
 let capabilities: Row = {}; try { capabilities = JSON.parse(member?.permissions ?? '{}'); } catch { /* deny */ }
 if (!member || !(member.role === 'owner' || (['staff','admin'].includes(member.role) && capabilities.curate_manage === true))) {
  throw new Error('Curate management requires active shop ownership or an explicit curate_manage capability.');
 }
}
async function load(env: ToolEnv, account: string, entity: CurateRecordedEntity, id: string): Promise<Row> {
 if (!Object.hasOwn(TABLES, entity)) throw new Error('Unsupported Curate entity');
 const row = await env.DB.prepare(`SELECT * FROM ${TABLES[entity]} WHERE ${keyColumn(entity)} = ? AND account_id = ?`).bind(id,account).first<Row>();
 if (!row) throw new Error('Record not found in this shop');
 if(entity==='transcript' && row.source_type!=='voice') throw new Error('The record is not an exact said transcript');
 if (entity === 'note' || entity === 'transcript') {
  if (!row.compass_entry_id) throw new Error('Only notes attached to a shop Curate tea may be corrected here');
  const tea = await env.DB.prepare('SELECT id FROM tea_compass_entries WHERE id = ? AND account_id = ?').bind(row.compass_entry_id,account).first();
  if (!tea) throw new Error('The note is not attached to a tea in this shop');
 }
 return row;
}
function snapshotComparison(keys:string[],alias:string):string {
 // json_each binds one snapshot, avoiding D1's parameter ceiling for full rows.
 // SQLite IS compares numeric values without a JSON 1 versus 1.0 false conflict.
 return `NOT EXISTS(SELECT 1 FROM json_each(?) expected WHERE CASE expected.key ${keys.map(k=>`WHEN '${k}' THEN ${alias}."${k}"`).join(' ')} END IS NOT expected.value)`;
}
function rowGuard(entity: CurateRecordedEntity, row: Row, account: string): CurateGuard {
 const keys=Object.keys(row).sort();
 return {sql:`EXISTS(SELECT 1 FROM ${TABLES[entity]} snap WHERE snap.${keyColumn(entity)} = ? AND snap.account_id = ? AND ${snapshotComparison(keys,'snap')})`,values:[row[keyColumn(entity)],account,JSON.stringify(row)]};
}
async function snapshotQuery(env:ToolEnv,table:string,where:string,values:any[]):Promise<CurateGuard[]> {
 const rows=(await env.DB.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY rowid`).bind(...values).all<Row>()).results??[];
 const guards:CurateGuard[]=[{sql:`(SELECT COUNT(*) FROM ${table} WHERE ${where}) = ?`,values:[...values,rows.length]}];
 if(rows.length) {
  const keys=Object.keys(rows[0]).sort();
  const compare=`NOT EXISTS(SELECT 1 FROM json_each(snapshots.value) expected WHERE CASE expected.key ${keys.map(k=>`WHEN '${k}' THEN physical."${k}"`).join(' ')} END IS NOT expected.value)`;
  guards.push({sql:`NOT EXISTS(SELECT 1 FROM json_each(?) snapshots WHERE NOT EXISTS(SELECT 1 FROM ${table} physical WHERE physical.id = json_extract(snapshots.value,'$.id') AND ${compare}))`,values:[JSON.stringify(rows)]});
 }
 return guards;
}
/** Unchanged operational facts surrounding a sample write, persisted for undo. */
export async function captureCurateSampleGuards(db:D1Database,accountId:string,sampleId:string,productId?:string|null):Promise<CurateGuard[]> {
 const env={DB:db};const guards=await snapshotQuery(env,'tea_sample_tastings','account_id = ? AND sample_id = ?',[accountId,sampleId]);
 if(productId) {
  guards.push(...await snapshotQuery(env,'products','account_id = ? AND id = ?',[accountId,productId]));
  guards.push(...await snapshotQuery(env,'inventory_receipt_lines','account_id = ? AND product_id = ?',[accountId,productId]));
  guards.push(...await snapshotQuery(env,'stock_ledger','account_id = ? AND product_id = ?',[accountId,productId]));
 }
 return guards;
}
/** Original guards are persisted, so undo refuses receipts/stock/sample use
 * since the original confirmation, not merely since the undo preview. */
async function physicalGuards(env:ToolEnv, account:string, entity:CurateEntity,id:string):Promise<CurateGuard[]> {
 if(entity!=='tea'&&entity!=='vendor') return [];
 const column=entity==='tea'?'compass_entry_id':'source_id';
 const where=`account_id = ? AND ${column} = ?`;
 const guards=await snapshotQuery(env,'tea_samples',where,[account,id]);
 guards.push(...await snapshotQuery(env,'tea_sample_tastings',`account_id = ? AND sample_id IN (SELECT id FROM tea_samples WHERE ${where})`,[account,account,id]));
 if(entity==='tea') {
  const entry=await env.DB.prepare('SELECT draft_product_id FROM tea_compass_entries WHERE account_id = ? AND id = ?').bind(account,id).first<Row>();
  if(entry?.draft_product_id) {
   const product=entry.draft_product_id;
   guards.push(...await snapshotQuery(env,'products','account_id = ? AND id = ?',[account,product]));
   guards.push(...await snapshotQuery(env,'inventory_receipt_lines','account_id = ? AND product_id = ?',[account,product]));
   guards.push(...await snapshotQuery(env,'stock_ledger','account_id = ? AND product_id = ?',[account,product]));
  }
 }
 return guards;
}
function storedList(raw:unknown):Row[] {
 if(raw==null||raw==='') return [];
 const parsed=typeof raw==='string'?JSON.parse(raw):raw;
 if(!Array.isArray(parsed)||parsed.some(row=>!row||typeof row!=='object'||Array.isArray(row))) throw new Error('Stored vendor contacts are not readable; correct them before merging');
 return parsed;
}
function mergeList(target:Row[],source:Row[]):{rows:Row[];ids:Map<string,string>} {
 const rows=target.map(row=>({...row}));const ids=new Map<string,string>();
 const meaning=(row:Row)=>JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key])=>key!=='id').sort(([a],[b])=>a.localeCompare(b))));
 for(const original of source) {
  const same=rows.find(row=>meaning(row)===meaning(original));
  if(same) {if(original.id&&same.id)ids.set(original.id,same.id);continue;}
  const row={...original};
  if(row.id&&rows.some(prior=>prior.id===row.id)) {const id=crypto.randomUUID();ids.set(row.id,id);row.id=id;}
  rows.push(row);
 }
 return {rows,ids};
}
async function vendorMergeChanges(env:ToolEnv,auth:ToolAuth,source:Row,target:Row,now:string,agent:string):Promise<{target:Row;changes:Change[];guards:CurateGuard[]}> {
 const changes:Change[]=[];const guards:CurateGuard[]=[];const next={...target};
 for(const field of ['chinese_name','company','email','phone','whatsapp','address','city','country','notes']) if((next[field]==null||next[field]==='') && source[field]!=null) next[field]=source[field];
 const sourceProfile=await env.DB.prepare('SELECT * FROM curate_vendor_profiles WHERE vendor_id = ? AND account_id = ?').bind(source.id,auth.accountId).first<Row>();
 const targetProfile=await env.DB.prepare('SELECT * FROM curate_vendor_profiles WHERE vendor_id = ? AND account_id = ?').bind(target.id,auth.accountId).first<Row>();
 const people=mergeList(storedList(targetProfile?.contact_people),storedList(sourceProfile?.contact_people));
 const endpoints=storedList(source.contacts).map(row=>({...row,...(row.person_id&&people.ids.has(row.person_id)?{person_id:people.ids.get(row.person_id)}:{})}));
 next.contacts=JSON.stringify(mergeList(storedList(target.contacts),endpoints).rows);
 if(Object.hasOwn(next,'updated_at'))next.updated_at=now;
 if(sourceProfile) {
  guards.push(rowGuard('vendor_profile',sourceProfile,auth.accountId));
  const profile:Row=targetProfile?{...targetProfile}:{...sourceProfile,vendor_id:target.id,account_id:auth.accountId};
  for(const field of ['price_currency','storage','story','ships_from','route','lead_time_days','vendor_code']) if(profile[field]==null||profile[field]==='')profile[field]=sourceProfile[field]??null;
  profile.contact_people=JSON.stringify(people.rows);
  profile.addresses=JSON.stringify(mergeList(storedList(targetProfile?.addresses),storedList(sourceProfile.addresses)).rows);
  profile.updated_by_agent=agent;profile.updated_at=now;
  changes.push({entity:'vendor_profile',id:target.id,before:targetProfile,after:profile});
 }
 for(const [entity,table] of [['tea','tea_compass_entries'],['quote','curate_quotes']] as const) {
  const where=entity==='tea'?' AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL':' AND archived_at IS NULL';
  const rows=(await env.DB.prepare(`SELECT * FROM ${table} WHERE account_id = ? AND vendor_id = ?${where}`).bind(auth.accountId,source.id).all<Row>()).results;
  guards.push({sql:`(SELECT COUNT(*) FROM ${table} WHERE account_id = ? AND vendor_id = ?${where}) = ?`,values:[auth.accountId,source.id,rows.length],confirmationOnly:true});
  for(const row of rows) {
   const updated={...row,vendor_id:target.id,...(entity==='tea'?{vendor_name:target.name}:{}),updated_at:now};
   changes.push({entity,id:row.id,before:row,after:updated});

  }
  if(entity==='tea' && rows.length) {
   const ids=JSON.stringify(rows.map(row=>row.id));const products=JSON.stringify([...new Set(rows.map(row=>row.draft_product_id).filter(Boolean))]);
   guards.push(...await snapshotQuery(env,'tea_samples','account_id = ? AND compass_entry_id IN (SELECT value FROM json_each(?))',[auth.accountId,ids]));
   guards.push(...await snapshotQuery(env,'tea_sample_tastings','account_id = ? AND sample_id IN (SELECT id FROM tea_samples WHERE account_id = ? AND compass_entry_id IN (SELECT value FROM json_each(?)))',[auth.accountId,auth.accountId,ids]));
   guards.push(...await snapshotQuery(env,'products','account_id = ? AND id IN (SELECT value FROM json_each(?))',[auth.accountId,products]));
   for(const table of ['inventory_receipt_lines','stock_ledger']) guards.push(...await snapshotQuery(env,table,'account_id = ? AND product_id IN (SELECT value FROM json_each(?))',[auth.accountId,products]));
  }
 }
 return {target:next,changes,guards};
}
function cleanFields(entity:CurateEntity, fields:Record<string,unknown>): Row {
 if (!fields || typeof fields !== 'object' || Array.isArray(fields) || !Object.keys(fields).length) throw new Error('Pass the fields to correct; null explicitly clears a field');
 const output:Row={};
 for(const [key,value] of Object.entries(fields)) {
  if (!FIELDS[entity].includes(key)) throw new Error(`Field ${key} is not editable through Curate management`);
  if(entity==='sample' && key==='grams') { if(typeof value!=='number'||!Number.isFinite(value)||value<0) throw new Error('Measured grams must be a finite nonnegative number; zero is a real measurement'); output.grams=value; continue; }
  if(entity==='tea' && (COMPASS_STRUCTURED_COLUMNS as readonly string[]).includes(key)) continue;
  if(entity==='tea' && ['price_amount','price_per_unit_grams'].includes(key)) {
   if(value!==null && (typeof value!=='number'||!Number.isFinite(value)||value<0||(key==='price_per_unit_grams'&&value===0))) throw new Error(`${key} must be a nonnegative number (unit grams must be positive) or null`);
   output[key]=value;continue;
  }
  if(key==='price_currency') { if(value===null) output[key]=null; else { const currency=typeof value==='string'?refreshedCurrencyName(value):null; if(!currency) throw new Error('A price currency must be supported and stated');output[key]=currency;} continue; }
  if (key==='year') { if(value!==null && (!Number.isInteger(value)|| Number(value)<1 || Number(value)>9999)) throw new Error('Year must be an integer or null'); output[key]=value; continue; }
  if(value !== null && typeof value !== 'string') throw new Error(`${key} must be text or null`);
  if(key==='notes' && typeof value==='string' && value.trim()) throw new Error('Use structured fields, not notes. Notes may only be cleared.');
  if(typeof value==='string' && value.length>20000) throw new Error(`${key} is too long`);
  const next= typeof value==='string' ? value.trim() : null;
  if ((key==='name' && entity==='vendor') || key==='text') { if(!next) throw new Error(`${key} cannot be blank; use delete to remove the record`); }
  output[key]=next || null;
 }
 if(entity==='tea') {
  const structured=readCompassStructuredPatch(fields,refreshedCurrencyName);
  for(const [key,value] of Object.entries(structured)) output[key]=key==='route_quotes'?JSON.stringify(value):value;
 }
 return output;
}
export async function previewCurateMutation(env:ToolEnv,auth:ToolAuth,command:CurateCommand,agent='an agent') {
 await requireCurateManager(env.DB,auth);
 if (!command || typeof command.id !== 'string' || !command.id || command.id.length>100) throw new Error('Record id is required');
 const before=await load(env,auth.accountId,command.entity,command.id);
 if(before.deleted_at || before.merged_into_id || (['note','transcript'].includes(command.entity)&&before.deleted)) throw new Error('Record is already deleted or merged');
 const after={...before}; const changes:Change[]=[]; let guards:CurateGuard[]=[];
 const now=new Date().toISOString();
 switch(command.action) {
  case 'taste_sample': {
   if(before.grams_known===0) throw new Error('Record the sample grams before logging consumption; the remaining weight is unknown.');
   if(command.entity!=='sample') throw new Error('Choose a physical sample to taste');
   if(before.archived_at) throw new Error('This sample portion is archived');
   const consumed=command.consumed_grams;
   if(typeof consumed!=='number'||!Number.isFinite(consumed)||consumed<0) throw new Error('State nonnegative consumed_grams explicitly; zero is allowed');
   if(typeof before.grams!=='number'||!Number.isFinite(before.grams)||before.grams<0) throw new Error('Sample remaining grams are not recorded correctly');
   if(consumed>before.grams) throw new Error('Consumption exceeds the sample grams remaining');
   if(before.status==='requested') throw new Error('A requested sample must be received before tasting');
   let productId=before.product_id;
   after.grams=before.grams-consumed;
   after.status=['requested','received','untasted'].includes(before.status)?'tasted':before.status;
   if(before.compass_entry_id) {
    let tea=await load(env,auth.accountId,'tea',before.compass_entry_id);
    const visited=new Set<string>();
    // A merged identity redirects the tea record, never the physical portion.
    // Guard every redirect row so a changed merge cannot misfile the tasting.
    while(tea.merged_into_id) {
     if(visited.has(tea.id)||visited.size>=20) throw new Error('The tea merge chain is invalid');
     visited.add(tea.id);guards.push(rowGuard('tea',tea,auth.accountId));
     tea=await load(env,auth.accountId,'tea',tea.merged_into_id);
    }
    productId=productId??tea.draft_product_id;
    if(tea.deleted_at||tea.archived_at) throw new Error('Correct the inactive tea link before recording a tasting');
    const next:Row={...tea,sample_state:'tasted'};
    if(command.tasting!==undefined) {
     if(!command.tasting||typeof command.tasting!=='object'||Array.isArray(command.tasting)) throw new Error('Tasting must be categories with term ID arrays');
     for(const [category,terms] of Object.entries(command.tasting)) if(!(TASTING_TERM_CATEGORIES as readonly string[]).includes(category)||!Array.isArray(terms)||terms.some(term=>typeof term!=='string')) throw new Error('Unknown tasting category or invalid terms');
     next.tasting=JSON.stringify(mergeProductTasting(tea.tasting,command.tasting).next);
    }
    if(command.score!==undefined) {
     if(!Number.isInteger(command.score)||command.score<1||command.score>10) throw new Error('Score must be a whole number from 1 to 10');
     const tasted=JSON.parse(next.tasting||'{}');tasted.quality=command.score;next.tasting=JSON.stringify(tasted);
    }
    if(Object.hasOwn(next,'updated_at')) next.updated_at=now;
    changes.push({entity:'tea',id:tea.id,before:tea,after:next});
    guards.push(...await snapshotQuery(env,'tea_samples','account_id = ? AND compass_entry_id = ? AND id <> ?',[auth.accountId,tea.id,before.id]));
   } else if(command.tasting!==undefined||command.score!==undefined) throw new Error('Link the sample to a Curate tea before filing tea tasting terms');
   guards.push(...await snapshotQuery(env,'tea_sample_tastings','account_id = ? AND sample_id = ?',[auth.accountId,before.id]));
   if(productId) {
    guards.push(...await snapshotQuery(env,'products','account_id = ? AND id = ?',[auth.accountId,productId]));
    guards.push(...await snapshotQuery(env,'inventory_receipt_lines','account_id = ? AND product_id = ?',[auth.accountId,productId]));
    guards.push(...await snapshotQuery(env,'stock_ledger','account_id = ? AND product_id = ?',[auth.accountId,productId]));
   }
   break;
  }
  case 'edit': {
   Object.assign(after,cleanFields(command.entity,command.fields));
   if(command.entity==='sample') {if(before.archived_at) throw new Error('This sample portion is archived');after.grams_known=1;}
   if(command.entity==='tea' && Object.hasOwn(command.fields,'price_amount') && command.fields.price_amount===null) after.price_currency=null;
   if(command.entity==='tea') await validateCompassQuoteLink(env.DB,auth.accountId,after);
   if(command.entity==='tea' && after.price_amount!=null && !after.price_currency) throw new Error('An entered price requires a currency; clear price_amount to clear the price');
   break;
  }
  case 'archive': if(command.entity!=='tea'&&command.entity!=='vendor') throw new Error('Only teas and vendors can be archived'); after.archived_at=now; break;
  case 'delete': if(!['tea','vendor','note','todo','transcript','attachment'].includes(command.entity)) throw new Error('Only Curate teas, vendors, notes and todos may be deleted here'); if(command.entity==='note'||command.entity==='transcript') after.deleted=1; else after.deleted_at=now; break;
  case 'close': case 'reopen': if(command.entity!=='todo') throw new Error('Only todos can be closed'); after.done_at=command.action==='close'?now:null; break;
  case 'merge': {
   if(command.entity!=='tea'&&command.entity!=='vendor') throw new Error('Only teas and vendors can be merged');
   if(command.target_id===command.id) throw new Error('Choose a different merge target');
   const target=await load(env,auth.accountId,command.entity,command.target_id);
   if(target.deleted_at||target.archived_at||target.merged_into_id) throw new Error('Merge target must be active');
   if(command.entity==='vendor') {
    const merged=await vendorMergeChanges(env,auth,before,target,now,agent.slice(0,100));
    changes.push({entity:'vendor',id:target.id,before:target,after:merged.target},...merged.changes);guards.push(...merged.guards);
   } else changes.push({entity:command.entity,id:command.target_id,before:target,after:target});
   guards.push(...await physicalGuards(env,auth.accountId,command.entity,command.target_id));
   after.merged_into_id=target.id; after.archived_at=now; break;
  }
  case 'remove_score': case 'remove_tasting': {
   if(command.entity!=='tea') throw new Error('Tasting belongs to a tea');
   const tasting=JSON.parse(before.tasting||'{}');
   if(command.action==='remove_score') delete tasting.quality;
   else { if(!Array.isArray(tasting[command.category])) throw new Error('Tasting category not found');
    tasting[command.category]=command.term ? tasting[command.category].filter((x:unknown)=>x!==command.term):[]; }
   after.tasting=JSON.stringify(tasting); break;
  }
  case 'remove_photo': {
   if(command.entity!=='tea') throw new Error('Photo belongs to a tea');
   const photos=JSON.parse(before.photos||'[]'); if(!Array.isArray(photos)) throw new Error('Malformed stored photos');
   const next=photos.filter((p:any)=>typeof p==='string'?p!==command.photo:p?.url!==command.photo);
   if(next.length===photos.length) throw new Error('Photo not found'); after.photos=JSON.stringify(next); break;
  }
  default: throw new Error('Unsupported Curate action');
 }
 if(command.action!=='taste_sample' && JSON.stringify(before)===JSON.stringify(after)) throw new Error('Nothing to change');
 if(Object.hasOwn(after,'updated_at')) after.updated_at=now;
 changes.unshift({entity:command.entity,id:command.id,before,after});
 guards.push(...await physicalGuards(env,auth.accountId,command.entity,command.id));
 return issuePreview(env,auth,{kind:'curate:manage',accountId:auth.accountId,userId:auth.userId,commandType:`${command.entity}:${command.action}`,agent:agent.slice(0,100),changes,guards,undoOf:null});
}
async function issuePreview(env:ToolEnv,auth:ToolAuth,ticket:CurateMutationTicket) {
 const token=await issueTicket(env,ticket,auth.tokenId);
 return previewEnvelope({action:ticket.commandType,changes:ticket.changes.map(c=>({entity:c.entity,id:c.id,before:c.before,after:c.after})),undo_of:ticket.undoOf,physical_holdings_preserved:ticket.commandType!=='sample:taste_sample',inventory_preserved:true},token);
}
export async function confirmCurateMutation(env:ToolEnv,auth:ToolAuth,token:string) {
 await requireCurateManager(env.DB,auth);
 const ticket=await consumeTicket<CurateMutationTicket,'curate:manage'>(env,token,'curate:manage',auth);
 if(!ticket||ticket.userId!==auth.userId) return INVALID_TICKET;
 return commitCurateMutation(env,auth,ticket,token);
}
export interface CurateRecordedChange { entityType: CurateRecordedEntity; entityId: string; before: Row | null; after: Row | null }
/** Trusted service primitive. It owns the field writes and ledger gate together;
 * callers execute these statements in ONE batch, never append ungated writes. */
export function prepareCurateRecordedWrite(db:D1Database,auth:Pick<ToolAuth,'accountId'|'userId'> & Partial<ToolAuth>,input:{commandType:string;agent?:string;changes:CurateRecordedChange[];guards?:CurateGuard[];undoOf?:string|null;idempotencyKey?:string}) {
 if(!input.changes.length) throw new Error('A recorded write needs at least one change');
 const id=crypto.randomUUID(); const guards=[...(input.guards??[])];
 for(const c of input.changes) {
  if(!Object.hasOwn(TABLES,c.entityType)) throw new Error('Unsupported recorded entity');
  for(const row of [c.before,c.after]) if(row) {
   if(row.account_id!==auth.accountId||row[keyColumn(c.entityType)]!==c.entityId) throw new Error('Snapshot identity does not match this shop');
   if(Object.keys(row).some(k=>!/^[_a-z][_a-z0-9]*$/.test(k))) throw new Error('Invalid snapshot column');
  }
  if(!c.after) throw new Error('Physical deletion is not a Curate correction; supply the soft-deleted snapshot');

 }
 for(const entity of [...new Set(input.changes.map(c=>c.entityType))]) {
  const group=input.changes.filter(c=>c.entityType===entity);const existing=group.filter(c=>c.before).map(c=>c.before!);const added=group.filter(c=>!c.before).map(c=>c.entityId);
  if(existing.length) {
   const keys=[...new Set(existing.flatMap(row=>Object.keys(row)))].sort();
   const comparison=`NOT EXISTS(SELECT 1 FROM json_each(snapshots.value) expected WHERE CASE expected.key ${keys.map(k=>`WHEN '${k}' THEN snap."${k}"`).join(' ')} END IS NOT expected.value)`;
   guards.push({sql:`NOT EXISTS(SELECT 1 FROM json_each(?) snapshots WHERE NOT EXISTS(SELECT 1 FROM ${TABLES[entity]} snap WHERE snap.${keyColumn(entity)} = json_extract(snapshots.value,'$.${keyColumn(entity)}') AND snap.account_id = ? AND ${comparison}))`,values:[JSON.stringify(existing),auth.accountId]});
  }
  if(added.length) guards.push({sql:`NOT EXISTS(SELECT 1 FROM ${TABLES[entity]} WHERE ${keyColumn(entity)} IN (SELECT value FROM json_each(?)) AND account_id = ?)`,values:[JSON.stringify(added),auth.accountId]});
 }
 const memberGuard=`EXISTS(SELECT 1 FROM account_members WHERE account_id = ? AND user_id = ? AND status = 'active' AND (role = 'owner' OR (role IN ('staff','admin') AND json_valid(permissions) AND json_extract(permissions,'$.curate_manage') = 1)))`;
 const insert=db.prepare(`INSERT INTO curate_mutations(id,account_id,command_type,actor_user_id,actor_token_id,agent_name,confirmed_at,undo_of,idempotency_key,guards_json)
 SELECT ?,?,?,?,?,?,?,?,?,? WHERE ${memberGuard} AND ${guards.map(g=>g.sql).join(' AND ')}`)
 .bind(id,auth.accountId,input.commandType,auth.userId,auth.tokenId??null,input.agent??'the app',new Date().toISOString(),input.undoOf??null,input.idempotencyKey??id,JSON.stringify((input.guards??[]).filter(guard=>!guard.confirmationOnly)),auth.accountId,auth.userId,...guards.flatMap(g=>g.values));
 const statements:D1PreparedStatement[]=[insert];
 for(const c of input.changes) {
  const after=c.after!;
  if(!c.before) {
   const keys=Object.keys(after);
   statements.push(db.prepare(`INSERT INTO ${TABLES[c.entityType]} (${keys.map(k=>`"${k}"`).join(',')}) SELECT ${keys.map(()=>'?').join(',')} WHERE EXISTS(SELECT 1 FROM curate_mutations WHERE id = ? AND account_id = ?)`)
    .bind(...keys.map(k=>after[k]),id,auth.accountId));
  } else {
   const changed=Object.keys(after).filter(k=>after[k]!==c.before![k]);
   if(changed.length) statements.push(db.prepare(`UPDATE ${TABLES[c.entityType]} SET ${changed.map(k=>`"${k}" = ?`).join(',')} WHERE ${keyColumn(c.entityType)} = ? AND account_id = ? AND EXISTS(SELECT 1 FROM curate_mutations WHERE id = ? AND account_id = ?)`)
    .bind(...changed.map(k=>after[k]),c.entityId,auth.accountId,id,auth.accountId));
  }
  statements.push(db.prepare(`INSERT INTO curate_mutation_records(mutation_id,account_id,entity_type,entity_id,before_json,after_json)
   SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM curate_mutations WHERE id = ? AND account_id = ?)`)
   .bind(id,auth.accountId,c.entityType,c.entityId,JSON.stringify(c.before),JSON.stringify(after),id,auth.accountId));
 }
 return {mutationId:id,statements,assertion:assertCurateMutationApplied(db,id)};
}
/** Last statement for callers with legacy side writes. Malformed JSON raises a
 * SQLite/D1 error if the gate did not open, rolling back the ENTIRE batch. */
export function assertCurateMutationApplied(db:D1Database,mutationId:string):D1PreparedStatement {
 return db.prepare(`SELECT json(CASE WHEN EXISTS(SELECT 1 FROM curate_mutations WHERE id = ?) THEN 'true' ELSE 'curate_mutation_not_applied' END)`).bind(mutationId);
}
async function commitCurateMutation(env:ToolEnv,auth:ToolAuth,t:CurateMutationTicket,key:string) {
 const prepared=prepareCurateRecordedWrite(env.DB,auth,{commandType:t.commandType,agent:t.agent,changes:t.changes.map(c=>({entityType:c.entity,entityId:c.id,before:c.before,after:c.after})),guards:t.guards,undoOf:t.undoOf,idempotencyKey:await sha256Hex(key)});
 const result=await env.DB.batch(prepared.statements);
 if(!result[0]?.meta?.changes) return {error:'stale_preview',message:'The record or its physical holdings changed. Preview the correction again.'};
 return {confirmed:true,mutation_id:prepared.mutationId,undo_of:t.undoOf};
}
export async function readCurateHistory(env:ToolEnv,auth:ToolAuth,options:{entity_type?:string;entity_id?:string;limit?:number}={}) {
 await requireCurateManager(env.DB,auth);
 if(options.entity_type && options.entity_type!=='arrival' && !Object.hasOwn(TABLES,options.entity_type)) throw new Error('Unsupported history entity');
 const filter=options.entity_id?` AND EXISTS(SELECT 1 FROM curate_mutation_records r WHERE r.mutation_id = m.id AND r.account_id = m.account_id AND ((r.entity_id = ? AND r.entity_type = ?) OR (r.entity_type='attachment' AND EXISTS(SELECT 1 FROM curate_attachments a WHERE a.id=r.entity_id AND a.account_id=m.account_id AND a.entity_id=? AND a.entity_type=?))))`:'';
 const rows=await env.DB.prepare(`SELECT m.* FROM curate_mutations m WHERE m.account_id = ?${filter} ORDER BY m.confirmed_at DESC,m.rowid DESC LIMIT ?`)
 .bind(auth.accountId,...(options.entity_id?[options.entity_id,options.entity_type??'tea',options.entity_id,options.entity_type??'tea']:[]),Math.min(100,Math.max(1,options.limit??20))).all<Row>();
 return {history:await Promise.all((rows.results??[]).map(async m=>({...m,records:(await env.DB.prepare('SELECT entity_type,entity_id,before_json,after_json FROM curate_mutation_records WHERE mutation_id = ? AND account_id = ?').bind(m.id,auth.accountId).all()).results})))};
}
export async function previewCurateUndo(env:ToolEnv,auth:ToolAuth,agent='an agent') {
 await requireCurateManager(env.DB,auth);
 const last=await env.DB.prepare('SELECT * FROM curate_mutations WHERE account_id = ? ORDER BY confirmed_at DESC,rowid DESC LIMIT 1').bind(auth.accountId).first<Row>();
 if(!last) throw new Error('There is no confirmed change to undo');
 if(last.undo_of) throw new Error('The last confirmed change was already an undo');
 if(String(last.command_type).endsWith(':with_side_effects')) throw new Error('This change also filed sample or transcript records. Correct those records explicitly; undo cannot discard their history.');
 const records=await env.DB.prepare('SELECT * FROM curate_mutation_records WHERE mutation_id = ? AND account_id = ?').bind(last.id,auth.accountId).all<Row>();
 const changes:Change[]=[]; const guards:CurateGuard[]=JSON.parse(last.guards_json||'[]');
 for(const r of records.results??[]) {
  const before=JSON.parse(r.after_json); let after=JSON.parse(r.before_json);
  const current=await load(env,auth.accountId,r.entity_type,r.entity_id);
  if(!before || Object.keys(before).some(k=>before[k]!==current[k])) throw new Error('This record changed after confirmation; undo would overwrite newer work');
  if(!after) {
   if(r.entity_type==='sample_set') {
    const createdIds=(records.results??[]).filter(x=>x.entity_type==='sample'&&JSON.parse(x.before_json)===null&&JSON.parse(x.after_json).set_id===r.entity_id).map(x=>x.entity_id);
    const allowed=createdIds.length?` AND id NOT IN (${createdIds.map(()=>'?').join(',')})`:'';
    const dependency:CurateGuard={sql:`NOT EXISTS(SELECT 1 FROM tea_samples WHERE account_id = ? AND set_id = ? AND archived_at IS NULL${allowed})`,values:[auth.accountId,r.entity_id,...createdIds]};
    const present=await env.DB.prepare(`SELECT ${dependency.sql} AS safe`).bind(...dependency.values).first<{safe:number}>();
    if(!present?.safe) throw new Error('Other sample portions now use this set; undo would archive their batch');
    guards.push(dependency);
   }
   if(r.entity_type==='sample') after={...current,archived_at:new Date().toISOString()};
   else if(r.entity_type==='sample_set') after={...current,archived:1};
   else if(['attachment','asset','todo'].includes(r.entity_type)) after={...current,deleted_at:new Date().toISOString()};
   else if(['note','transcript'].includes(r.entity_type)) after={...current,deleted:1};
   else if(r.entity_type==='vendor_profile') after={...current,price_currency:null,storage:null,story:null,ships_from:null,route:null,lead_time_days:null,vendor_code:null,contact_people:'[]',addresses:'[]',updated_by_agent:null};
   else if(['tea','vendor','quote','quote_line'].includes(r.entity_type)) after={...current,archived_at:new Date().toISOString()};
   else throw new Error('This creation has dependent operational records; correct it explicitly instead of undoing it');
  }
  changes.push({entity:r.entity_type,id:r.entity_id,before:current,after});
 }
 // The latest mutation must still be latest when the confirmation runs.
 guards.push({sql:'(SELECT id FROM curate_mutations WHERE account_id = ? ORDER BY confirmed_at DESC,rowid DESC LIMIT 1) = ?',values:[auth.accountId,last.id]});
 return issuePreview(env,auth,{kind:'curate:manage',accountId:auth.accountId,userId:auth.userId,commandType:'undo',agent:agent.slice(0,100),changes,guards,undoOf:last.id});
}
