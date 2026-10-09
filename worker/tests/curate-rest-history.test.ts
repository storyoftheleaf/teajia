import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { previewCurateUndo, confirmCurateMutation } from '../src/curateMutations';
import { curatePhotoTools } from '../src/mcpTools/curatePhotos';
const databases: SqliteD1[] = [];
afterEach(() => { for (const db of databases.splice(0)) db.close(); });
const auth = { accountId: 'a', userId: 'owner', userEmail: 'owner@test.dev', tokenId: 'test-token', creatorTier: 'account_owner' } as any;
function setup() {
  const db = new SqliteD1('migrations'); databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'a', role: 'owner' });
  seedIdentity(db, { userId: 'author', accountId: 'a', role: 'staff', bundles: ['gather','catalog'] });
  seedIdentity(db, { userId: 'foreign', accountId: 'b', role: 'owner' });
  db.sqlite.prepare("INSERT INTO customers (id,account_id,name,tags) VALUES ('vendor','a','Vendor','[\"vendor\"]')").run();
  db.sqlite.prepare("INSERT INTO tea_compass_entries(id,account_id,user_id,name,type,vendor_id,vendor_name,photos) VALUES ('tea','a','author','Tea','Oolong','vendor','Vendor','[]'),('foreign-tea','b','foreign','Foreign','Oolong',NULL,NULL,'[]')").run();
  return db;
}
async function call(db: SqliteD1, path: string, method = 'GET', body?: any, user = 'owner', account = 'a') {
  const token = await signedToken('test-jwt', { sub: user, email: `${user}@test.dev`, active_account_id: account, platform_role: null });
  return worker.fetch(new Request(`https://worker.test${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': account, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { DB: db as any, JWT_SECRET: 'test-jwt' } as any);
}
async function checked(response: Response, status = 200) {
  const body = await response.json() as any; expect(response.status, JSON.stringify(body)).toBe(status); return body;
}
async function undo(db: SqliteD1) {
  const preview = await previewCurateUndo({ DB: db } as any, auth);
  return confirmCurateMutation({ DB: db } as any, auth, preview.confirmation_token);
}
describe('real REST shop Curate writes share atomic history and original attribution', () => {
  it('creates a sampled tea with one audit and undoes all related rows safely', async () => {
    const db = setup();
    const created = await checked(await call(db, '/api/compass/entries', 'POST', { id: 'new-tea', name: 'New tea', vendor_id: 'vendor', vendor_name: 'Vendor', sample_state: 'received' }), 201);
    expect(created).toMatchObject({ user_id: 'owner', sample_state: 'received', price_amount: null, price_currency: null });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_mutations').get()).toMatchObject({ n: 1 });
    await undo(db);
    expect((db.sqlite.prepare("SELECT archived_at FROM tea_compass_entries WHERE id='new-tea'").get() as any).archived_at).toBeTruthy();
    expect((db.sqlite.prepare("SELECT archived_at FROM tea_samples WHERE compass_entry_id='new-tea'").get() as any).archived_at).toBeTruthy();
    const list = await checked(await call(db, '/api/compass/entries'));
    expect(list.entries.map((entry: any) => entry.id)).not.toContain('new-tea');
    const samples = await checked(await call(db, '/api/admin/samples'));
    expect(samples.samples).toEqual([]);
  });
  it('keeps sourcing vendor metadata private on a shared sample-set page',async()=>{
    const db=setup();await checked(await call(db,'/api/compass/entries/tea','PUT',{sample_state:'received'}));
    const row=db.prepare('SELECT id FROM tea_sample_sets').first<any>();
    db.prepare('UPDATE tea_sample_sets SET notes=? WHERE id=?').bind('Private procurement terms',row.id).run();
    const response=await worker.fetch(new Request(`https://worker.test/api/samples/set/${row.id}`),{DB:db as any} as any);
    const body=await checked(response);expect(body.set.name).toBe('Tea samples');
    for(const key of ['source_id','source_name','notes','user_id','shared_with','panel_account_ids'])expect(body.set).not.toHaveProperty(key);
    expect(body.samples[0]).not.toHaveProperty('source_name');
    const owned=await checked(await call(db,`/api/samples/set/${row.id}`));expect(owned.set.source_name).toBe('Vendor');
  });
  it('edits another author and undo restores both tea state and sample metadata', async () => {
    const db = setup();
    const updated = await checked(await call(db, '/api/compass/entries/tea', 'PUT', { age_quoted: '20 years', sample_state: 'received', photos: ['https://media.teajia.co/leaf.jpg'] }));
    expect(updated).toMatchObject({ user_id: 'author', age_quoted: '20 years', sample_state: 'received' });
    expect(db.sqlite.prepare("SELECT user_id,status FROM tea_samples WHERE compass_entry_id='tea'").get()).toMatchObject({ user_id: 'author', status: 'received' });
    await undo(db);
    expect(db.sqlite.prepare("SELECT age_quoted,sample_state,user_id FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ age_quoted: null, sample_state: null, user_id: 'author' });
    const sample = db.sqlite.prepare("SELECT id,archived_at FROM tea_samples WHERE compass_entry_id='tea'").get() as any;
    expect(sample.archived_at).toBeTruthy();
    expect((await call(db, `/api/samples/${sample.id}`)).status).toBe(404);
  });
  it('sync preserves source ownership, audits accepted rows and conflicts on foreign/inactive IDs', async () => {
    const db = setup();
    const result = await checked(await call(db, '/api/compass/sync', 'POST', { entries: [{ id: 'tea', grade: '1' }, { id: 'foreign-tea', name: 'Stolen' }] }));
    expect(result).toEqual({ synced: 1, syncedIds: ['tea'], conflicts: ['foreign-tea'] });
    expect(db.sqlite.prepare("SELECT user_id,grade FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ user_id: 'author', grade: '1' });
    expect(db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='foreign-tea'").get()).toMatchObject({ name: 'Foreign' });
    await checked(await call(db, '/api/compass/entries/tea', 'DELETE'));
    const resurrect = await checked(await call(db, '/api/compass/sync', 'POST', { entries: [{ id: 'tea', name: 'Resurrected' }] }));
    expect(resurrect).toEqual({ synced: 0, syncedIds: [], conflicts: ['tea'] });
    await undo(db);
    expect(db.sqlite.prepare("SELECT deleted_at,name FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ deleted_at: null, name: 'Tea' });
  });
  it('a staff member without curate_manage cannot edit another author or steal attribution', async () => {
    const db = setup();
    expect((await call(db, '/api/compass/entries/tea', 'PUT', { grade: '2' }, 'foreign', 'b')).status).toBe(404);
    const denied = await call(db, '/api/compass/entries/tea', 'PUT', { grade: '2' }, 'owner', 'b');
    expect([403,404]).toContain(denied.status);
    expect(db.sqlite.prepare("SELECT user_id,grade FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ user_id: 'author', grade: null });
  });
  it('promotes another shop author without changing attribution or received stock', async () => {
    const db = setup();
    const promoted = await checked(await call(db, '/api/compass/entries/tea/promote', 'POST'), 201);
    expect(promoted.id).toBeTruthy();
    expect(db.sqlite.prepare("SELECT user_id,draft_product_id FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ user_id: 'author', draft_product_id: promoted.id });
    expect(db.sqlite.prepare('SELECT stock_grams,is_public,shown_in_shop FROM products WHERE id=?').get(promoted.id)).toMatchObject({ stock_grams: 0, is_public: 0, shown_in_shop: 0 });
  });
  it('legacy photo alias previews and attaches privately to another author with no public upload', async () => {
    const db = setup(); const privatePut = vi.fn(async () => {}); const publicPut = vi.fn(async () => {});
    const env = { DB: db, ATLAS_BUCKET: { put: privatePut }, MEDIA_BUCKET: { put: publicPut } } as any;
    const args = { tea_id: 'tea', image_base64: btoa(String.fromCharCode(255,216,255,1)), mime_type: 'image/jpeg', filename: 'quote.jpg', role: 'pricelist', agent: 'Builder' };
    const preview = await curatePhotoTools.handlers.curate_add_photo(env, auth, args) as any;
    expect(privatePut).not.toHaveBeenCalled(); expect(preview.confirmation_token).toBeTruthy();
    const result = await curatePhotoTools.handlers.curate_add_photo(env, auth, { ...args, confirm: preview.confirmation_token }) as any;
    expect(result.confirmed).toBe(true); expect(privatePut).toHaveBeenCalledTimes(1); expect(publicPut).not.toHaveBeenCalled();
    expect(db.sqlite.prepare("SELECT user_id,photos FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ user_id: 'author', photos: '[]' });
    expect(db.sqlite.prepare("SELECT role FROM curate_attachments WHERE entity_id='tea'").get()).toMatchObject({ role: 'pricelist' });
  });
});
