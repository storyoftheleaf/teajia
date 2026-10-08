import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { prepareCompassSampleWrite, prepareSampleLifecycleSync } from '../src/curateSampleBridge';
import { curateIntakeTools } from '../src/mcpTools/curateIntake';
const scope = { accountId: 'a', userId: 'owner' };
function setup(shape: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(shape);
  seedIdentity(db, { accountId: 'a', userId: 'owner' });
  seedIdentity(db, { accountId: 'b', userId: 'other' });
  db.sqlite.prepare("INSERT INTO customers (id, account_id, name, tags) VALUES ('vendor','a','Vendor','[\"vendor\"]')").run();
  return db;
}
const entry = (id = 'tea') => ({ id, account_id: 'a', user_id: 'owner', name: id, vendor_id: 'vendor', vendor_name: 'Vendor', sample_state: 'requested', photos: '["https://media.teajia.co/tea.jpg"]' });
function insert(db: SqliteD1, e = entry()) { db.sqlite.prepare('INSERT INTO tea_compass_entries (id,account_id,user_id,name,vendor_id,sample_state) VALUES (?,?,?,?,?,?)').run(e.id,e.account_id,e.user_id,e.name,e.vendor_id,e.sample_state); }
const readSample = (db: SqliteD1) => db.sqlite.prepare('SELECT * FROM tea_samples ORDER BY id').get() as any;
async function bridge(db: SqliteD1, e = entry(), input: Record<string, any> = {}) {
  const out = await prepareCompassSampleWrite(db as any, scope, e, { entryId: e.id, ...input });
  db.batch(out.statements as any); return out;
}
describe('Curate sample bridge on stored SQL', () => {
  it.each(['schema','migrations'] as const)('creates linked portions on %s with vendor, photos and explicit zero grams', async shape => {
    const db = setup(shape); insert(db); await bridge(db, entry(), { state: 'received', grams: 0 });
    expect(readSample(db)).toMatchObject({ compass_entry_id: 'tea', source_id: 'vendor', status: 'received', grams: 0, photos: entry().photos });
    expect(db.sqlite.prepare("SELECT sample_state,sample_set_id FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ sample_state: 'received', sample_set_id: readSample(db).set_id });
  });
  it('simultaneously prepared writes and retries create one sample and vendor batch', async () => {
    const db = setup(); insert(db);
    const writes = await Promise.all([1,2,3].map(() => prepareCompassSampleWrite(db as any, scope, entry(), { entryId: 'tea' })));
    for (const w of writes) db.batch(w.statements as any);
    await bridge(db); insert(db,entry('tea2')); await bridge(db,entry('tea2'));
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_samples').get()).toMatchObject({ n: 2 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_sample_sets').get()).toMatchObject({ n: 1 });
    expect(readSample(db).grams).toBe(10);
  });
  it('preserves received/tasted and richer shelf choices on repeated sample markers', async () => {
    const db = setup(); insert(db); await bridge(db,entry(),{state:'received',grams:15}); await bridge(db);
    expect(readSample(db)).toMatchObject({status:'received',grams:15});
    db.sqlite.prepare("UPDATE tea_samples SET status='favorite'").run();
    await bridge(db,entry(),{state:'tasted'});
    expect(readSample(db).status).toBe('favorite');
    expect(db.sqlite.prepare("SELECT sample_state FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({sample_state:'tasted'});
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_sample_tastings').get()).toMatchObject({n:0});
  });
  it('creates a new generation after archive without modifying history', async () => {
    const db=setup(); insert(db); const first=await bridge(db);
    db.sqlite.prepare('UPDATE tea_sample_sets SET archived=1 WHERE id=?').run(first.setId);
    const second=await bridge(db); expect(second.setId).not.toBe(first.setId); expect(second.sampleId).not.toBe(first.sampleId);
    await bridge(db); expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_samples').get()).toMatchObject({n:2});
  });
  it('rejects foreign owner, vendor, product and set links and invalid grams', async () => {
    const db=setup(); insert(db);
    await expect(prepareCompassSampleWrite(db as any,{...scope,userId:'other'},entry(),{entryId:'tea'})).rejects.toThrow(/owner/);
    await expect(bridge(db,{...entry(),vendor_id:'missing'})).rejects.toThrow(/vendor/);
    await expect(bridge(db,{...entry(),draft_product_id:'missing'} as any)).rejects.toThrow(/product/);
    await expect(bridge(db,entry(),{preferredSetId:'missing'})).rejects.toThrow(/set/);
    await expect(bridge(db,entry(),{grams:NaN})).rejects.toThrow(/grams/);
  });
  it.each([true, false])('unrelated unassigned archives leave generated IDs unchanged (known vendor: %s)', async knownVendor => {
    const db = setup();
    const target = knownVendor ? entry() : { ...entry(), vendor_id: null, vendor_name: null };
    insert(db, target as any);
    const before = await prepareCompassSampleWrite(db as any, scope, target, { entryId: target.id });
    db.sqlite.prepare("INSERT INTO tea_sample_sets (id, account_id, source_id, archived) VALUES ('curate-set-unrelated', 'a', NULL, 1)").run();
    db.sqlite.prepare("INSERT INTO tea_samples (id, account_id, set_id, compass_entry_id) VALUES ('unrelated-sample', 'a', 'curate-set-unrelated', 'unrelated-tea')").run();
    const after = await prepareCompassSampleWrite(db as any, scope, target, { entryId: target.id });
    expect(after.setId).toBe(before.setId);
    expect(after.sampleId).toBe(before.sampleId);
  });
  it('an unassigned tea gets a new generation only after its own batch is archived', async () => {
    const db = setup();
    const target = { ...entry(), vendor_id: null, vendor_name: null };
    insert(db, target as any);
    const first = await bridge(db, target as any);
    db.sqlite.prepare('UPDATE tea_sample_sets SET archived = 1 WHERE id = ?').run(first.setId);
    const next = await bridge(db, target as any);
    expect(next.setId).not.toBe(first.setId);
    expect(next.sampleId).not.toBe(first.sampleId);
  });
  it.each(['set', 'sample', 'entry'] as const)('fails closed on a generated %s identity occupied by a foreign row', async kind => {
    const db = setup();
    insert(db);
    const original = await bridge(db);
    if (kind === 'set') db.sqlite.prepare('UPDATE tea_sample_sets SET account_id = ? WHERE id = ?').run('b', original.setId);
    if (kind === 'sample') db.sqlite.prepare('UPDATE tea_samples SET account_id = ? WHERE id = ?').run('b', original.sampleId);
    if (kind === 'entry') {
      insert(db, entry('other-tea'));
      db.sqlite.prepare('UPDATE tea_samples SET compass_entry_id = ? WHERE id = ?').run('other-tea', original.sampleId);
    }
    await expect(bridge(db)).rejects.toThrow(/identity conflicts/);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_samples').get()).toMatchObject({ n: 1 });
  });
  it('refuses preferred sets for a different vendor or an unassigned vendor', async () => {
    const db = setup();
    insert(db);
    db.sqlite.prepare("INSERT INTO tea_sample_sets (id, account_id, source_id) VALUES ('wrong', 'a', 'another-vendor'), ('unassigned', 'a', NULL)").run();
    for (const preferredSetId of ['wrong', 'unassigned']) {
      await expect(bridge(db, entry(), { preferredSetId })).rejects.toThrow(/account\/vendor/);
    }
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_samples').get()).toMatchObject({ n: 0 });
  });
  it('executes shelf relink and state sync in one batch without crossing account boundaries', async () => {
    const db=setup(); insert(db); insert(db,entry('tea2')); await bridge(db); const sample=readSample(db);
    const sync=await prepareSampleLifecycleSync(db as any,'a',{sampleId:sample.id,status:'received'});
    db.batch([db.prepare('UPDATE tea_samples SET compass_entry_id=?,status=? WHERE id=?').bind('tea2','received',sample.id),...sync] as any);
    expect(db.sqlite.prepare("SELECT sample_state FROM tea_compass_entries WHERE id='tea2'").get()).toMatchObject({sample_state:'received'});
    await expect(prepareSampleLifecycleSync(db as any,'b',{sampleId:sample.id,status:'tasted'})).rejects.toThrow(/account/);
  });
});
describe('agent inputs stay previewed and confirmed', () => {
  const auth={...scope,userEmail:'owner@test.dev',tokenId:'token',creatorTier:'account_owner'} as any;
  async function confirm(db: SqliteD1, name:string,args:any) {
    const handler=curateIntakeTools.handlers[name]; const preview=await handler({DB:db} as any,auth,args) as any;
    await handler({DB:db} as any,auth,{...args,confirm:preview.confirmation_token}); return preview;
  }
  it('previews unmeasured default grams and writes photos with explicit append/replace semantics', async () => {
    const db=setup(); const preview=await confirm(db,'curate_add_tea',{name:'tea',sample_state:'received',vendor_id:'vendor',photos:['https://media.teajia.co/one.jpg']});
    expect(JSON.stringify(preview)).toContain('not measured'); const tea=db.sqlite.prepare('SELECT id FROM tea_compass_entries').get() as any;
    await confirm(db,'curate_update_tea',{tea_id:tea.id,photos:['https://media.teajia.co/two.jpg'],sample_grams:0});
    expect(JSON.parse(readSample(db).photos)).toHaveLength(2); expect(readSample(db).grams).toBe(0);
    await confirm(db,'curate_update_tea',{tea_id:tea.id,photos:[],photos_mode:'replace'}); expect(readSample(db).photos).toBe('[]');
  });
  it('refuses non-hosted photos before issuing a mutation', async () => {
    const db=setup(); await expect(curateIntakeTools.handlers.curate_add_tea({DB:db} as any,auth,{name:'tea',photos:['data:image/png;base64,x']})).rejects.toThrow(/HTTPS/);
  });
});
