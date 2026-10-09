import { captureCurateSampleGuards, type CurateRecordedChange, type CurateGuard } from './curateMutations';
/** Statement builders: callers batch these with the originating Curate/sample write. */
export type CompassSampleState = 'requested' | 'received' | 'tasted';
const SAMPLE_STATES = new Set(['requested', 'received', 'untasted', 'tasted', 'favorite', 'ordering', 'ordered', 'passed']);
export function compassStateForSample(status: string): CompassSampleState {
  if (!SAMPLE_STATES.has(status)) throw new Error('Invalid sample status');
  return status === 'requested' ? 'requested' : status === 'received' || status === 'untasted' ? 'received' : 'tasted';
}
async function stableId(kind: string, parts: string[]) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parts)));
  return `${kind}-${Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join('')}`;
}
/** Read real column defaults rather than assuming schema.sql matches the live
 * ledger (sample tea_key and set panel_account_ids have differed in the past). */
async function newSnapshot(db:D1Database,table:'tea_samples'|'tea_sample_sets'|'tea_compass_entries',supplied:Record<string,any>) {
 const columns=(await db.prepare(`PRAGMA table_info(${table})`).all<{name:string;dflt_value:string|null}>()).results;
 const defaults=await db.prepare(`SELECT ${columns.map(c=>`${c.dflt_value??'NULL'} AS "${c.name}"`).join(',')}`).first<Record<string,any>>();
 return {...defaults,...Object.fromEntries(Object.entries(supplied).filter(([key])=>columns.some(c=>c.name===key)))};
}
export async function prepareCompassSampleWrite(
  db: D1Database,
  scope: { accountId: string; userId: string; pendingVendorId?: string },
  entry: Record<string, any>,
  input: { entryId: string; state?: CompassSampleState; grams?: number; preferredSetId?: string; preferredSampleId?: string },
): Promise<{ statements: D1PreparedStatement[]; sampleId: string; setId: string; changes: CurateRecordedChange[]; guards: CurateGuard[]; teaAfter: Record<string,any> }> {
  const { accountId, userId } = scope;
  if (!accountId || !userId || (entry.id && entry.id !== input.entryId) || (entry.account_id && entry.account_id !== accountId) || (entry.user_id && entry.user_id !== userId)) throw new Error('Curate tea is outside this account or owner');
  const stored = await db.prepare('SELECT * FROM tea_compass_entries WHERE id = ?').bind(input.entryId).first<Record<string, any>>();
  if (stored && (stored.account_id !== accountId || stored.user_id !== userId)) throw new Error('Curate tea is outside this account or owner');
  const state = input.state ?? entry.sample_state ?? 'requested';
  if (!['requested', 'received', 'tasted'].includes(state)) throw new Error('Invalid sample_state');
  if (input.grams !== undefined && (typeof input.grams !== 'number' || !Number.isFinite(input.grams) || input.grams < 0)) throw new Error('sample_grams must be a non-negative finite number');
  const vendorId = entry.vendor_id || null;
  if (vendorId && scope.pendingVendorId !== vendorId && !await db.prepare('SELECT id FROM customers WHERE id = ? AND account_id = ?').bind(vendorId, accountId).first()) throw new Error('Sample vendor is outside this account');
  const productId = entry.draft_product_id || null;
  if (productId && !await db.prepare('SELECT id FROM products WHERE id = ? AND account_id = ?').bind(productId, accountId).first()) throw new Error('Sample product is outside this account');
  let sample: Record<string, any> | null = null;
  if (input.preferredSampleId) {
    const preferred = await db.prepare('SELECT * FROM tea_samples WHERE id = ?').bind(input.preferredSampleId).first<Record<string, any>>();
    if (preferred && (preferred.account_id !== accountId || preferred.compass_entry_id !== input.entryId)) throw new Error('Sample link is outside this Curate tea');
  }
  sample = await db.prepare(`SELECT s.* FROM tea_samples s JOIN tea_sample_sets ss ON ss.id = s.set_id AND ss.account_id = s.account_id
    WHERE s.account_id = ? AND s.compass_entry_id = ? AND s.archived_at IS NULL AND ss.archived = 0 AND ss.purpose = 'sourcing' ORDER BY s.created_at, s.id LIMIT 1`).bind(accountId, input.entryId).first<Record<string, any>>();
  let set: Record<string, any> | null = null;
  if (input.preferredSetId) {
    set = await db.prepare('SELECT * FROM tea_sample_sets WHERE id = ?').bind(input.preferredSetId).first<Record<string, any>>();
    if (!set || set.account_id !== accountId || set.archived || set.purpose !== 'sourcing' || set.source_id !== vendorId) throw new Error('Sample set is not an open sourcing set for this account/vendor');
  }
  if (sample && !set) {
    const existingSet = await db.prepare('SELECT * FROM tea_sample_sets WHERE id = ? AND account_id = ?').bind(sample.set_id, accountId).first<Record<string, any>>();
    if (existingSet?.source_id === vendorId) set = existingSet;
  }
  if (!set && vendorId) set = await db.prepare("SELECT * FROM tea_sample_sets WHERE account_id = ? AND source_id = ? AND purpose = 'sourcing' AND archived = 0 ORDER BY created_at, id LIMIT 1").bind(accountId, vendorId).first<Record<string, any>>();
  const group = vendorId ?? `entry:${input.entryId}`;
  // Archived batches remain history. Their stable identities select a new generation.
  const history = !set
    ? await db.prepare(vendorId
      ? "SELECT id FROM tea_sample_sets WHERE account_id = ? AND purpose = 'sourcing' AND archived = 1 AND source_id = ? ORDER BY id"
      : `SELECT ss.id FROM tea_sample_sets ss
           WHERE ss.account_id = ? AND ss.purpose = 'sourcing' AND ss.archived = 1 AND ss.source_id IS NULL
             AND EXISTS (SELECT 1 FROM tea_samples s WHERE s.set_id = ss.id AND s.account_id = ss.account_id AND s.compass_entry_id = ?)
           ORDER BY ss.id`)
      .bind(accountId, vendorId ?? input.entryId).all<{ id: string }>()
    : { results: [] };
  const setId = set?.id ?? await stableId('curate-set', [accountId, group, ...history.results.map(r => r.id)]);
  const archivedPortions = !sample ? (await db.prepare('SELECT id FROM tea_samples WHERE account_id = ? AND compass_entry_id = ? AND archived_at IS NOT NULL ORDER BY id').bind(accountId,input.entryId).all<{id:string}>()).results : [];
  const sampleId = sample?.id ?? await stableId('curate-sample', [accountId, input.entryId, setId,...archivedPortions.map(p=>p.id)]);
  // Deterministic IDs make retries converge; they are not proof of ownership.
  // A pre-existing collision must fail before any entry/link mutation is queued.
  const candidateSet = await db.prepare('SELECT * FROM tea_sample_sets WHERE id = ?')
    .bind(setId).first<Record<string, any>>();
  if (candidateSet && (candidateSet.account_id !== accountId || candidateSet.source_id !== vendorId || candidateSet.purpose !== 'sourcing' || candidateSet.archived)) {
    throw new Error('Generated sample set identity conflicts with this account/vendor');
  }
  const candidateSample = await db.prepare('SELECT * FROM tea_samples WHERE id = ?')
    .bind(sampleId).first<Record<string, any>>();
  if (candidateSample && (candidateSample.account_id !== accountId || candidateSample.compass_entry_id !== input.entryId || candidateSample.archived_at)) {
    throw new Error('Generated sample identity conflicts with this account/Curate tea');
  }
  const now=new Date().toISOString();
  const setBefore=set??candidateSet;
  const sampleBefore=sample??candidateSample;
  const setAfter:Record<string,any>=setBefore ? {...setBefore} : await newSnapshot(db,'tea_sample_sets',{
    id:setId,name:entry.vendor_name?`${entry.vendor_name} samples`:'Curate samples',source_id:vendorId,source_name:entry.vendor_name??null,
    purpose:'sourcing',notes:null,shared_with:'[]',account_id:accountId,panel_account_ids:null,archived:0,created_at:now,updated_at:now,user_id:userId,
  });
  if(vendorId && setAfter.source_id==null) Object.assign(setAfter,{source_id:vendorId,source_name:entry.vendor_name??null,updated_at:now});
  const photos=typeof entry.photos==='string'?entry.photos:JSON.stringify(entry.photos??[]);
  const sampleAfter:Record<string,any>=sampleBefore ? {...sampleBefore} : await newSnapshot(db,'tea_samples',{
    id:sampleId,name:'',chinese_name:null,type:null,form:null,year:null,origin_region:null,source_id:null,source_name:null,source_contact:null,
    product_id:null,compass_entry_id:input.entryId,set_id:setId,status:state,grams:input.grams??10,grams_known:input.grams===undefined?0:1,notes:null,photos:'[]',account_id:accountId,
    tea_key:null,created_at:now,updated_at:now,created_by:userId,user_id:userId,archived_at:null,
  });
  const currentStatus=sampleAfter.status;
  Object.assign(sampleAfter,{name:entry.name??'',chinese_name:entry.chinese_name??null,type:entry.type??null,form:entry.form??null,year:entry.year??null,
    origin_region:entry.origin_region??null,source_id:vendorId,source_name:entry.vendor_name??null,product_id:productId,photos,set_id:setId,
    status:['favorite','ordering','ordered','passed','tasted'].includes(currentStatus)?currentStatus:state==='tasted'?'tasted':state==='received'?'received':currentStatus,
    grams:input.grams??sampleAfter.grams,grams_known:input.grams===undefined?sampleAfter.grams_known:1,updated_at:now});
  const finalTea={...stored,...entry,id:input.entryId,account_id:accountId,user_id:userId,sample_set_id:setId,sample_state:compassStateForSample(sampleAfter.status),updated_at:now};
  const teaAfter=stored?finalTea:await newSnapshot(db,'tea_compass_entries',finalTea);
  const changes:CurateRecordedChange[]=[
    {entityType:'sample_set',entityId:setId,before:setBefore,after:setAfter},
    {entityType:'sample',entityId:sampleId,before:sampleBefore,after:sampleAfter},
    {entityType:'tea',entityId:input.entryId,before:stored,after:teaAfter},
  ];
  // Keep direct callers idempotent. Audited callers instead execute `.changes`
  // through the guarded ledger builder, which owns all three writes together.
  const statements:D1PreparedStatement[]=[];
  const insert=(table:string,row:Record<string,any>)=>{
    const keys=Object.keys(row);
    return db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')}) ON CONFLICT(id) DO NOTHING`).bind(...keys.map(k=>row[k]));
  };
  if(!setBefore) statements.push(insert('tea_sample_sets',setAfter));
  else if(setAfter.updated_at!==setBefore.updated_at) statements.push(db.prepare('UPDATE tea_sample_sets SET source_id = ?, source_name = ?, updated_at = ? WHERE id = ? AND account_id = ? AND source_id IS NULL').bind(vendorId,entry.vendor_name??null,now,setId,accountId));
  if(!sampleBefore) statements.push(insert('tea_samples',sampleAfter));
  const copied=['name','chinese_name','type','form','year','origin_region','source_id','source_name','product_id','photos','set_id','status','grams','grams_known','updated_at'];
  statements.push(db.prepare(`UPDATE tea_samples SET ${copied.map(k=>`${k} = ?`).join(',')} WHERE id = ? AND account_id = ? AND compass_entry_id = ? AND archived_at IS NULL`).bind(...copied.map(k=>sampleAfter[k]),sampleId,accountId,input.entryId));
  statements.push(db.prepare('UPDATE tea_compass_entries SET sample_set_id = ?, sample_state = ?, updated_at = ? WHERE id = ? AND account_id = ? AND user_id = ?').bind(setId,teaAfter.sample_state,now,input.entryId,accountId,userId));
  const guards=await captureCurateSampleGuards(db,accountId,sampleId,productId);
  return {statements,sampleId,setId,changes,guards,teaAfter};
}
export async function prepareSampleLifecycleSync(db: D1Database, accountId: string, input: { sampleId: string; status: string; hasTasting?: boolean }): Promise<D1PreparedStatement[]> {
  const state = input.hasTasting ? 'tasted' : compassStateForSample(input.status);
  const row = await db.prepare('SELECT compass_entry_id FROM tea_samples WHERE id = ? AND account_id = ? AND archived_at IS NULL').bind(input.sampleId, accountId).first<{compass_entry_id: string | null}>();
  if (!row) throw new Error('No sample in this account');
  const statements: D1PreparedStatement[] = [];
  if (input.hasTasting) statements.push(db.prepare("UPDATE tea_samples SET status = CASE WHEN status IN ('requested','received','untasted') THEN 'tasted' ELSE status END, updated_at = datetime('now') WHERE id = ? AND account_id = ?").bind(input.sampleId, accountId));
  statements.push(db.prepare("UPDATE tea_compass_entries SET sample_state = ?, sample_set_id = (SELECT set_id FROM tea_samples WHERE id = ? AND account_id = ?), updated_at = datetime('now') WHERE id = (SELECT compass_entry_id FROM tea_samples WHERE id = ? AND account_id = ? AND archived_at IS NULL) AND account_id = ?").bind(state, input.sampleId, accountId, input.sampleId, accountId, accountId));
  return statements;
}
