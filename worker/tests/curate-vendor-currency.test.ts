import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { curateIntakeTools } from '../src/mcpTools/curateIntake';
import { curateManageModule } from '../src/mcpTools/curateManage';
import { confirmCurateMutation, previewCurateUndo, readCurateHistory } from '../src/curateMutations';

const auth = { accountId: 'a', userId: 'owner', tokenId: 'token', creatorTier: 'owner', userEmail: 'owner@test.dev' };
function setup() {
  const db = new SqliteD1('migrations');
  seedIdentity(db, { accountId: 'a', userId: 'owner' });
  seedIdentity(db, { accountId: 'other', userId: 'stranger' });
  seedIdentity(db, { accountId: 'a', userId: 'reader', role: 'staff' });
  db.prepare(`INSERT INTO customers(id,account_id,name,type,tags,preferred_currency) VALUES('xwt','a','XWT','vendor','["vendor"]','USD'),('foreign','other','Foreign','vendor','["vendor"]','USD')`).run();
  db.prepare(`INSERT INTO curate_vendor_profiles(vendor_id,account_id,price_currency) VALUES('xwt','a','Yuan')`).run();
  db.prepare(`INSERT INTO tea_compass_entries(id,account_id,user_id,name,vendor_id,price_currency) VALUES('tea','a','owner','Tea','xwt',NULL),('private','other','stranger','Other tea','foreign',NULL),('reader-tea','a','reader','Reader tea',NULL,NULL)`).run();
  return { db, env: { DB: db as any } };
}
const row = (db: SqliteD1) => db.prepare("SELECT * FROM customers WHERE id='xwt'").first<any>();
const save = (env: any, args: any, who = auth): Promise<any> => curateIntakeTools.handlers.curate_save_vendor(env, who, args);
const correct = (env: any, args: any, who = auth): Promise<any> => curateManageModule.handlers.curate_correct(env, who, args);
const getTea = (env: any, id = 'tea', who = auth): Promise<any> => curateIntakeTools.handlers.curate_get_tea(env, who, { tea_id: id });

describe('explicit vendor contact currency', () => {
  it('previews without writing, saves the canonical currency on customers, records history and undoes it', async () => {
    const { db, env } = setup();
    const p = await save(env, { vendor_id: 'xwt', preferred_currency: 'cny', agent: 'Hermes' });
    expect(p.preview.will_file).toContain('preferred currency on contact: Yuan');
    expect(p.preview.already_on_card.preferred_currency).toBe('USD');
    expect(row(db).preferred_currency).toBe('USD');
    const result = await save(env, { confirm: p.confirmation_token });
    expect(result).toMatchObject({ committed: true, vendor: { preferred_currency: 'Yuan' } });
    expect(row(db).preferred_currency).toBe('Yuan');
    const h = await readCurateHistory(env, auth, { entity_type: 'vendor', entity_id: 'xwt' });
    expect(h.history[0]).toMatchObject({ id: result.mutation_id, agent_name: 'Hermes' });
    expect(JSON.parse(h.history[0].records[0].before_json).preferred_currency).toBe('USD');
    expect(JSON.parse(h.history[0].records[0].after_json).preferred_currency).toBe('Yuan');
    const undo = await previewCurateUndo(env, auth, 'Hermes', result.mutation_id);
    await confirmCurateMutation(env, auth, undo.confirmation_token);
    expect(row(db).preferred_currency).toBe('USD');
  });

  it('keeps profile quote currency and underlying contact preference independent', async () => {
    const { db, env } = setup();
    const p = await save(env, { vendor_id: 'xwt', price_currency: 'hkd' });
    await save(env, { confirm: p.confirmation_token });
    expect(row(db).preferred_currency).toBe('USD');
    expect(db.prepare("SELECT price_currency FROM curate_vendor_profiles WHERE vendor_id='xwt'").first<any>().price_currency).toBe('HKD');
    const p2 = await save(env, { vendor_id: 'xwt', preferred_currency: 'rmb' });
    await save(env, { confirm: p2.confirmation_token });
    expect(row(db).preferred_currency).toBe('Yuan');
    expect(db.prepare("SELECT price_currency FROM curate_vendor_profiles WHERE vendor_id='xwt'").first<any>().price_currency).toBe('HKD');
  });

  it('sets the contact currency on create and accepts an explicit null on save', async () => {
    const { db, env } = setup();
    const p = await save(env, { name: 'New vendor', preferred_currency: 'hkd' });
    const result = await save(env, { confirm: p.confirmation_token });
    expect(db.prepare('SELECT preferred_currency FROM customers WHERE id=?').bind(result.vendor.id).first<any>().preferred_currency).toBe('HKD');
    const clear = await save(env, { vendor_id: 'xwt', preferred_currency: null });
    await save(env, { confirm: clear.confirmation_token });
    expect(row(db).preferred_currency).toBeNull();
  });

  it('clears explicitly via save clear list and via correction null, with reversible before/after', async () => {
    const { db, env } = setup();
    const p = await save(env, { vendor_id: 'xwt', clear: ['preferred_currency'] });
    await save(env, { confirm: p.confirmation_token });
    expect(row(db).preferred_currency).toBeNull();
    const set = await correct(env, { action: 'edit', entity: 'vendor', id: 'xwt', fields: { preferred_currency: 'twd' } });
    expect(set.preview.changes[0].after.preferred_currency).toBe('NT');
    await correct(env, { confirmation_token: set.confirmation_token });
    expect(row(db).preferred_currency).toBe('NT');
    const clear = await correct(env, { action: 'edit', entity: 'vendor', id: 'xwt', fields: { preferred_currency: null } });
    const result = await correct(env, { confirmation_token: clear.confirmation_token });
    expect(row(db).preferred_currency).toBeNull();
    const undo = await previewCurateUndo(env, auth, 'Hermes', result.mutation_id);
    await confirmCurateMutation(env, auth, undo.confirmation_token);
    expect(row(db).preferred_currency).toBe('NT');
  });

  it('rejects unknown, empty, sentinel and non-string currencies at either preview door', async () => {
    const { db, env } = setup();
    for (const preferred_currency of ['doubloons', 'UNK', '', 12]) {
      await expect(save(env, { vendor_id: 'xwt', preferred_currency })).rejects.toThrow(/supported currency/);
      await expect(correct(env, { action: 'edit', entity: 'vendor', id: 'xwt', fields: { preferred_currency } })).rejects.toThrow(/supported currency/);
    }
    expect(row(db).preferred_currency).toBe('USD');
  });

  it('refuses other-account vendors and unauthorized writes', async () => {
    const { db, env } = setup();
    await expect(save(env, { vendor_id: 'foreign', preferred_currency: 'Yuan' })).rejects.toThrow(/in this shop/);
    await expect(correct(env, { action: 'edit', entity: 'vendor', id: 'foreign', fields: { preferred_currency: 'Yuan' } })).rejects.toThrow(/in this shop/);
    const reader = { ...auth, userId: 'reader' };
    await expect(correct(env, { action: 'edit', entity: 'vendor', id: 'xwt', fields: { preferred_currency: 'Yuan' } }, reader)).rejects.toThrow(/ownership/);
    const p = await save(env, { vendor_id: 'xwt', preferred_currency: 'Yuan' }, reader);
    await expect(save(env, { confirm: p.confirmation_token }, reader)).rejects.toThrow(/ownership/);
    expect(row(db).preferred_currency).toBe('USD');
  });
});

describe('short recent history on a tea read', () => {
  it('includes the tea child history and excludes unrelated and other-account changes', async () => {
    const { db, env } = setup();
    db.prepare("INSERT INTO curate_todos(id,account_id,compass_entry_id,text,created_by_user_id) VALUES('todo','a','tea','Ask price','owner')").run();
    const p = await correct(env, { action: 'edit', entity: 'todo', id: 'todo', fields: { text: 'Ask currency' }, agent: 'Hermes' });
    const result = await correct(env, { confirmation_token: p.confirmation_token });
    const foreignAuth = { ...auth, accountId: 'other', userId: 'stranger' };
    const foreign = await correct(env, { action: 'edit', entity: 'tea', id: 'private', fields: { name: 'Foreign change' } }, foreignAuth);
    await correct(env, { confirmation_token: foreign.confirmation_token }, foreignAuth);
    const vendor = await save(env, { vendor_id: 'xwt', preferred_currency: 'Yuan' });
    await save(env, { confirm: vendor.confirmation_token });
    const tea = await getTea(env);
    expect(tea.recent_history).toHaveLength(1);
    expect(tea.recent_history[0]).toMatchObject({ mutation_id: result.mutation_id, action: 'todo:edit', changes: [{ entity_type: 'todo', entity_id: 'todo', fields: expect.arrayContaining(['text']) }] });
  });

  it('shows five newest tea-related changes with author, changed fields, and undo attribution', async () => {
    const { env } = setup();
    for (let i = 0; i < 6; i++) {
      const p = await correct(env, { action: 'edit', entity: 'tea', id: 'tea', fields: { name: `Tea ${i}` }, agent: 'Hermes' });
      await correct(env, { confirmation_token: p.confirmation_token });
    }
    const result = await getTea(env);
    expect(result.recent_history).toHaveLength(5);
    expect(result.recent_history[0]).toMatchObject({ action: 'tea:edit', agent: 'Hermes', undo_of: null, undone_by: null });
    expect(result.recent_history[0].changes[0]).toMatchObject({ entity_type: 'tea', entity_id: 'tea', fields: expect.arrayContaining(['name']) });
    expect(result.recent_history[0].changes[0]).not.toHaveProperty('before_json');
    const newest = result.recent_history[0].mutation_id;
    const undo = await previewCurateUndo(env, auth, 'Hermes', newest);
    const undone = await confirmCurateMutation(env, auth, undo.confirmation_token);
    const after = await getTea(env);
    expect(after.recent_history[0].undo_of).toBe(newest);
    expect(after.recent_history[1].undone_by).toBe(undone.mutation_id);
  });

  it('keeps ordinary readers out of manager history and other-account tea reads', async () => {
    const { env } = setup();
    expect(await getTea(env, 'private')).toEqual({ error: 'not_found' });
    expect((await getTea(env, 'reader-tea', { ...auth, userId: 'reader' })).recent_history).toEqual([]);
  });
});
