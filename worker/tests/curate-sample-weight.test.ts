import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { prepareCompassSampleWrite } from '../src/curateSampleBridge';
import { readCurateHoldings } from '../src/curateHoldings';
import { previewCurateMutation } from '../src/curateMutations';
import { writingToolModule } from '../src/mcpTools/writing';
const databases: SqliteD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const auth = { accountId: 'a', userId: 'owner', userEmail: 'owner@test.dev', tokenId: 'token', creatorTier: 'account_owner' } as any;
function setup(through?: string) {
  const db = new SqliteD1('migrations', through); databases.push(db);
  seedIdentity(db, { accountId: 'a', userId: 'owner', role: 'owner' });
  db.sqlite.prepare("INSERT INTO customers (id,account_id,name,tags) VALUES ('vendor','a','Vendor','[\"vendor\"]')").run();
  db.sqlite.prepare("INSERT INTO tea_compass_entries (id,account_id,user_id,name,vendor_id,vendor_name,sample_state) VALUES ('tea','a','owner','Tea','vendor','Vendor','received')").run();
  return db;
}
async function create(db: SqliteD1, grams?: number) {
  const entry = db.sqlite.prepare("SELECT * FROM tea_compass_entries WHERE id='tea'").get() as any;
  const planned = await prepareCompassSampleWrite(db as any, auth, entry, { entryId: 'tea', state: 'received', ...(grams === undefined ? {} : { grams }) });
  db.batch(planned.statements as any); return planned;
}
async function request(db: SqliteD1, path: string, method = 'GET', body?: any) {
  const token = await signedToken('test-secret', { sub: 'owner', email: auth.userEmail, active_account_id: 'a', platform_role: null });
  return worker.fetch(new Request(`https://worker.test${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'a', 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { DB: db as any, JWT_SECRET: 'test-secret' } as any);
}
describe('unknown sample weight is never a reported ten grams', () => {
  it('Samples-only, public/admin/MCP reads show null and consumption refuses unmeasured portions', async () => {
    const db = setup(); const portion = await create(db);
    expect(db.sqlite.prepare('SELECT grams,grams_known FROM tea_samples WHERE id=?').get(portion.sampleId)).toMatchObject({ grams: 10, grams_known: 0 });
    const holding = (await readCurateHoldings(db as any, 'a', { samplesOnly: true }))[0];
    expect(holding.sample_grams).toBeNull(); expect(holding.samples[0]).toMatchObject({ grams: null, status: 'received' });
    const publicSample = await worker.fetch(new Request(`https://worker.test/api/samples/${portion.sampleId}`), { DB: db as any } as any);
    expect(await publicSample.json()).toMatchObject({ grams: null, grams_known: false });
    const admin = await request(db, '/api/admin/samples');
    expect((await admin.json() as any).samples[0]).toMatchObject({ grams: null, grams_known: false });
    const mcp = await writingToolModule.handlers.get_sample({ DB: db } as any, auth, { sample_id: portion.sampleId }) as any;
    expect(mcp.sample).toMatchObject({ grams: null, grams_known: false });
    await expect(previewCurateMutation({ DB: db } as any, auth, { action: 'taste_sample', entity: 'sample', id: portion.sampleId, consumed_grams: 1 })).rejects.toThrow(/Record.*grams|unknown/);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_mutations').get()).toMatchObject({ n: 0 });
  });
  it('explicit zero is known, omitted retries preserve unknown, and a stated PUT records the measurement', async () => {
    const db = setup(); const portion = await create(db); await create(db);
    expect(db.sqlite.prepare('SELECT grams_known FROM tea_samples WHERE id=?').get(portion.sampleId)).toMatchObject({ grams_known: 0 });
    const response = await request(db, `/api/admin/samples/${portion.sampleId}`, 'PUT', { grams: 0 });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ grams: 0, grams_known: true });
    expect((await readCurateHoldings(db as any, 'a', { samplesOnly: true }))[0].sample_grams).toBe(0);
    await create(db);
    expect(db.sqlite.prepare('SELECT grams,grams_known FROM tea_samples WHERE id=?').get(portion.sampleId)).toMatchObject({ grams: 0, grams_known: 1 });
    await create(db, 5);
    expect(db.sqlite.prepare('SELECT grams,grams_known FROM tea_samples WHERE id=?').get(portion.sampleId)).toMatchObject({ grams: 5, grams_known: 1 });
  });
  it('a mixed known/unknown family does not invent a total', async () => {
    const db = setup(); const portion = await create(db);
    db.sqlite.prepare("INSERT INTO tea_samples (id,account_id,set_id,compass_entry_id,grams,status) VALUES ('known','a',?,'tea',5,'received')").run(portion.setId);
    const holding = (await readCurateHoldings(db as any, 'a', { samplesOnly: true }))[0];
    expect(holding.samples.map(sample => sample.grams).sort()).toEqual([5, null]);
    expect(holding.sample_grams).toBeNull();
  });
  it('the additive migration leaves all legacy reported gram balances intact', () => {
    const db = setup('0036');
    db.sqlite.prepare("INSERT INTO tea_sample_sets(id,account_id) VALUES ('legacy-set','a')").run();
    db.sqlite.prepare("INSERT INTO tea_samples(id,account_id,set_id,grams,status) VALUES ('legacy-portion','a','legacy-set',7,'received')").run();
    db.exec(readFileSync('worker/migrations/0037_curate_history.sql', 'utf8'));
    expect(db.sqlite.prepare("SELECT grams,grams_known FROM tea_samples WHERE id='legacy-portion'").get()).toMatchObject({ grams: 7, grams_known: 1 });
  });
});
