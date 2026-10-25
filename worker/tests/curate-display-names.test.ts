/**
 * A supplier line and a sample set's name, both written in English.
 *
 * Thirteen shelf records showed Chinese where the shop prints a supplier and no
 * Curate tool could reach either field. These tests DRIVE both doors against a
 * database seeded from the migration ledger - the one the live database was
 * actually built from - rather than scanning the source for the right words: a
 * guard that only matches text stays green when the throw is deleted, which is
 * how the agent door shipped free teas while its own test file passed.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { curateDisplayNameTools } from '../src/mcpTools/curateDisplayNames';
import { curateManageModule } from '../src/mcpTools/curateManage';

const dbs: SqliteD1[] = [];
afterEach(() => { for (const db of dbs.splice(0)) db.close(); });

const auth = { accountId: 'a', userId: 'owner', userEmail: 'owner@test.dev', tokenId: 'token-one', creatorTier: 'account_owner' } as any;

function setup() {
  const db = new SqliteD1('migrations');
  dbs.push(db);
  seedIdentity(db, { accountId: 'a', userId: 'owner' });
  seedIdentity(db, { accountId: 'b', userId: 'other' });
  db.sqlite.prepare("INSERT INTO customers(id,account_id,name,chinese_name,tags) VALUES('vendor-card','a','Xi Wu Tang','惜物堂','[\"vendor\"]')").run();
  db.sqlite.prepare("INSERT INTO customers(id,account_id,name,tags) VALUES('chinese-card','a','惜物堂','[\"vendor\"]')").run();
  db.sqlite.prepare("INSERT INTO products(id,account_id,type,product_name,given_name,vendor,cost_amount,cost_currency) VALUES ('p1','a','Oolong','Aged Liubao','Aged Liubao','惜物堂',10,'Yuan')").run();
  db.sqlite.prepare("INSERT INTO products(id,account_id,type,product_name,given_name,vendor,cost_amount,cost_currency) VALUES ('p2','a','Oolong','Yiwu Gushu','Yiwu Gushu','惜物堂',20,'Yuan')").run();
  db.sqlite.prepare("INSERT INTO products(id,account_id,type,product_name,vendor) VALUES ('foreign','b','Oolong','Foreign','Someone')").run();
  db.sqlite.prepare("INSERT INTO tea_profiles(id,slug,originated_by_account_id,curated_by_account_id,name) VALUES('prof_p1','aged-liubao','a','a','Aged Liubao')").run();
  db.sqlite.prepare("INSERT INTO product_listings(id,account_id,profile_id,legacy_product_id,vendor) VALUES('list_p1','a','prof_p1','p1','惜物堂')").run();
  db.sqlite.prepare("INSERT INTO tea_sample_sets(id,account_id,name,source_id,source_name,user_id) VALUES ('curate-set-abc123','a','惜物堂 samples','vendor-card','惜物堂','owner')").run();
  db.sqlite.prepare("INSERT INTO tea_sample_sets(id,account_id,name,source_name,user_id) VALUES ('11111111-2222-3333-4444-555555555555','a','Spring box',NULL,'owner')").run();
  return { db, env: { DB: db } as any };
}

const call = (env: any, name: string, args: any, who = auth) =>
  curateDisplayNameTools.handlers[name](env, who, args) as Promise<any>;
const manage = (env: any, name: string, args: any, who = auth) =>
  curateManageModule.handlers[name](env, who, args) as Promise<any>;

const product = (db: SqliteD1, id: string) =>
  db.sqlite.prepare('SELECT vendor, vendor_id FROM products WHERE id = ?').get(id) as any;
const set = (db: SqliteD1, id: string) =>
  db.sqlite.prepare('SELECT name, source_name, source_id FROM tea_sample_sets WHERE id = ?').get(id) as any;
const mutations = (db: SqliteD1) =>
  db.sqlite.prepare('SELECT id, command_type, agent_name, actor_user_id FROM curate_mutations ORDER BY rowid').all() as any[];

describe('curate_set_product_vendor', () => {
  it('previews before and after without writing anything', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_set_product_vendor', { product_ids: ['p1', 'p2'], vendor: 'Xi Wu Tang', agent: 'GrokBot' });
    expect(preview.confirmation_token).toBeTruthy();
    expect(preview.preview.products).toEqual([
      { product_id: 'p1', product: 'Aged Liubao', vendor: { from: '惜物堂', to: 'Xi Wu Tang' }, vendor_id: { from: null, to: null }, changes: true },
      { product_id: 'p2', product: 'Yiwu Gushu', vendor: { from: '惜物堂', to: 'Xi Wu Tang' }, vendor_id: { from: null, to: null }, changes: true },
    ]);
    expect(preview.preview.product_count).toBe(2);
    expect(product(db, 'p1').vendor).toBe('惜物堂');
    expect(product(db, 'p2').vendor).toBe('惜物堂');
    expect(mutations(db)).toHaveLength(0);
  });

  it('writes the supplier line, the listing mirror and an attributed mutation on confirm', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_set_product_vendor', { product_ids: ['p1', 'p2'], vendor: 'Xi Wu Tang', agent: 'GrokBot' });
    const done = await call(env, 'curate_set_product_vendor', { product_ids: ['p1', 'p2'], vendor: 'Xi Wu Tang', confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, product_count: 2, listings_mirrored: 1, vendor: 'Xi Wu Tang' });
    expect(product(db, 'p1').vendor).toBe('Xi Wu Tang');
    expect(product(db, 'p2').vendor).toBe('Xi Wu Tang');
    expect((db.sqlite.prepare("SELECT vendor FROM product_listings WHERE id='list_p1'").get() as any).vendor).toBe('Xi Wu Tang');
    const recorded = mutations(db);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ command_type: 'product:set_vendor', agent_name: 'GrokBot', actor_user_id: 'owner' });
    const records = db.sqlite.prepare('SELECT entity_type, entity_id FROM curate_mutation_records WHERE mutation_id = ? ORDER BY entity_type, entity_id').all(recorded[0].id) as any[];
    expect(records).toEqual([
      { entity_type: 'product', entity_id: 'p1' },
      { entity_type: 'product', entity_id: 'p2' },
      { entity_type: 'product_listing', entity_id: 'list_p1' },
    ]);
  });

  it('is single use', async () => {
    const { env, db } = setup();
    const first = await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang' });
    await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang', confirm: first.confirmation_token });
    expect(product(db, 'p1').vendor).toBe('Xi Wu Tang');
    expect(await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang', confirm: first.confirmation_token })).toEqual({ error: 'invalid_or_expired_confirmation_token' });
    expect(mutations(db)).toHaveLength(1);
  });

  it('cannot be committed by a sibling token, another user or another shop', async () => {
    const { env, db } = setup();
    for (const override of [{ tokenId: 'other-token' }, { userId: 'sibling' }, { accountId: 'b', userId: 'other' }]) {
      const preview = await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang' });
      expect(await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang', confirm: preview.confirmation_token }, { ...auth, ...override }))
        .toEqual({ error: 'invalid_or_expired_confirmation_token' });
    }
    expect(product(db, 'p1').vendor).toBe('惜物堂');
    expect(mutations(db)).toHaveLength(0);
  });

  it('refuses a supplier line that moved since the preview', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang' });
    db.sqlite.prepare("UPDATE products SET vendor='Someone else' WHERE id='p1'").run();
    expect(await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang', confirm: preview.confirmation_token }))
      .toMatchObject({ error: 'product_changed_since_preview' });
    expect(product(db, 'p1').vendor).toBe('Someone else');
  });

  it('takes the English name off a vendor card and links the product to it', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_set_product_vendor', { product_ids: ['p1'], vendor_id: 'vendor-card' });
    expect(preview.preview.vendor).toBe('Xi Wu Tang');
    expect(preview.preview.vendor_from_card).toEqual({ id: 'vendor-card', name: 'Xi Wu Tang', chinese_name: '惜物堂' });
    expect(preview.preview.products[0].vendor_id).toEqual({ from: null, to: 'vendor-card' });
    await call(env, 'curate_set_product_vendor', { product_ids: ['p1'], vendor_id: 'vendor-card', confirm: preview.confirmation_token });
    expect(product(db, 'p1')).toEqual({ vendor: 'Xi Wu Tang', vendor_id: 'vendor-card' });
  });
});

describe('Chinese is refused, on both doors', () => {
  it('refuses an explicit Chinese supplier line and writes nothing', async () => {
    const { env, db } = setup();
    await expect(call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: '惜物堂' }))
      .rejects.toThrow(/English.*chinese_name on the vendor card/);
    expect(product(db, 'p1').vendor).toBe('惜物堂');
    expect(mutations(db)).toHaveLength(0);
  });

  it('refuses a vendor card whose own name is Chinese, naming the fix', async () => {
    const { env, db } = setup();
    const result = await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor_id: 'chinese-card' });
    expect(result.error).toBe('vendor_card_name_is_chinese');
    expect(result.message).toMatch(/rename_supplier/);
    expect(product(db, 'p1').vendor_id).toBeNull();
  });

  it('refuses a Chinese sample set name and a Chinese source_name', async () => {
    const { env, db } = setup();
    for (const args of [{ set_id: 'curate-set-abc123', name: '惜物堂 samples' }, { set_id: 'curate-set-abc123', source_name: '惜物堂' }]) {
      await expect(call(env, 'curate_update_sample_set', args)).rejects.toThrow(/English/);
    }
    expect(set(db, 'curate-set-abc123').name).toBe('惜物堂 samples');
  });
});

describe('curate_update_sample_set', () => {
  it('renames name and source_name together, leaving source_id alone', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', name: 'Xi Wu Tang samples', source_name: 'Xi Wu Tang', agent: 'GrokBot' });
    expect(preview.preview).toMatchObject({
      name: { from: '惜物堂 samples', to: 'Xi Wu Tang samples' },
      source_name: { from: '惜物堂', to: 'Xi Wu Tang' },
      source_id_unchanged: 'vendor-card',
    });
    expect(set(db, 'curate-set-abc123').name).toBe('惜物堂 samples');
    const done = await call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', name: 'Xi Wu Tang samples', source_name: 'Xi Wu Tang', confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, name: 'Xi Wu Tang samples', source_name: 'Xi Wu Tang', source_id: 'vendor-card' });
    expect(set(db, 'curate-set-abc123')).toEqual({ name: 'Xi Wu Tang samples', source_name: 'Xi Wu Tang', source_id: 'vendor-card' });
    expect(mutations(db)[0]).toMatchObject({ command_type: 'sample_set:rename', agent_name: 'GrokBot' });
  });

  it('renames a plain uuid set and clears a source_name on request', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_update_sample_set', { set_id: '11111111-2222-3333-4444-555555555555', name: 'Spring box 2026', source_name: null });
    expect(preview.preview.name).toEqual({ from: 'Spring box', to: 'Spring box 2026' });
    await call(env, 'curate_update_sample_set', { set_id: '11111111-2222-3333-4444-555555555555', name: 'Spring box 2026', source_name: null, confirm: preview.confirmation_token });
    expect(set(db, '11111111-2222-3333-4444-555555555555')).toEqual({ name: 'Spring box 2026', source_name: null, source_id: null });
  });

  it('refuses a set in another shop, a blank name and a no-op', async () => {
    const { env } = setup();
    expect(await call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', name: 'Anything' }, { ...auth, accountId: 'b', userId: 'other' }))
      .toMatchObject({ error: 'sample_set_not_found' });
    await expect(call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', name: '   ' })).rejects.toThrow(/a set needs one/);
    expect(await call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', name: '惜物堂 samples'.replace('惜物堂', 'X') })).toBeTruthy();
    expect(await call(env, 'curate_update_sample_set', { set_id: '11111111-2222-3333-4444-555555555555', name: 'Spring box' }))
      .toMatchObject({ error: 'nothing_to_change' });
  });

  it('refuses a rename that moved since the preview', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_update_sample_set', { set_id: '11111111-2222-3333-4444-555555555555', name: 'Spring box 2026' });
    db.sqlite.prepare("UPDATE tea_sample_sets SET name='Someone else renamed it' WHERE id='11111111-2222-3333-4444-555555555555'").run();
    expect(await call(env, 'curate_update_sample_set', { set_id: '11111111-2222-3333-4444-555555555555', name: 'Spring box 2026', confirm: preview.confirmation_token }))
      .toMatchObject({ error: 'sample_set_changed_since_preview' });
  });
});

describe('curate_undo puts both names back', () => {
  it('reverses a supplier line across the shelf and its mirror', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_set_product_vendor', { product_ids: ['p1', 'p2'], vendor: 'Xi Wu Tang', agent: 'GrokBot' });
    const done = await call(env, 'curate_set_product_vendor', { product_ids: ['p1', 'p2'], vendor: 'Xi Wu Tang', confirm: preview.confirmation_token });
    const undoPreview = await manage(env, 'curate_undo', { mutation_id: done.mutation_id, agent: 'GrokBot' });
    expect(undoPreview.confirmation_token).toBeTruthy();
    expect(product(db, 'p1').vendor).toBe('Xi Wu Tang');
    const undone = await manage(env, 'curate_undo', { confirmation_token: undoPreview.confirmation_token });
    expect(undone).toMatchObject({ confirmed: true, undo_of: done.mutation_id });
    expect(product(db, 'p1').vendor).toBe('惜物堂');
    expect(product(db, 'p2').vendor).toBe('惜物堂');
    expect((db.sqlite.prepare("SELECT vendor FROM product_listings WHERE id='list_p1'").get() as any).vendor).toBe('惜物堂');
  });

  it('reverses a sample set rename', async () => {
    const { env, db } = setup();
    const preview = await call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', name: 'Xi Wu Tang samples', source_name: 'Xi Wu Tang' });
    const done = await call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', name: 'Xi Wu Tang samples', source_name: 'Xi Wu Tang', confirm: preview.confirmation_token });
    const undoPreview = await manage(env, 'curate_undo', { mutation_id: done.mutation_id });
    await manage(env, 'curate_undo', { confirmation_token: undoPreview.confirmation_token });
    expect(set(db, 'curate-set-abc123')).toEqual({ name: '惜物堂 samples', source_name: '惜物堂', source_id: 'vendor-card' });
  });

  it('shows both changes in curate_history under the entity that moved', async () => {
    const { env } = setup();
    const preview = await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang', agent: 'GrokBot' });
    await call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang', confirm: preview.confirmation_token });
    const history = await manage(env, 'curate_history', { entity_type: 'product', entity_id: 'p1' });
    expect(history.history).toHaveLength(1);
    expect(history.history[0]).toMatchObject({ command_type: 'product:set_vendor', agent_name: 'GrokBot' });
  });
});

describe('the seam', () => {
  it('registers both tools on a write scope so a read-only token cannot reach them', () => {
    for (const def of curateDisplayNameTools.defs) {
      expect(def.scope).toBe('stock:write');
      expect(curateDisplayNameTools.handlers[def.name]).toBeTypeOf('function');
    }
    expect(curateDisplayNameTools.defs.map(d => d.name).sort())
      .toEqual(['curate_set_product_vendor', 'curate_update_sample_set']);
  });

  it('refuses a field it does not know rather than ignoring it', async () => {
    const { env } = setup();
    await expect(call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'X', chinese_name: '惜物堂' } as any))
      .rejects.toThrow(/chinese_name has no field/);
    await expect(call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', source_id: 'vendor-card' } as any))
      .rejects.toThrow(/source_id has no field/);
  });

  it('refuses more than fifty products in one call', async () => {
    const { env } = setup();
    const ids = Array.from({ length: 51 }, (_, i) => `p${i}`);
    await expect(call(env, 'curate_set_product_vendor', { product_ids: ids, vendor: 'X' })).rejects.toThrow(/Up to 50 products/);
  });

  it('requires Curate management, not merely the write scope', async () => {
    const { env, db } = setup();
    db.sqlite.prepare("UPDATE account_members SET role='staff', permissions='{}' WHERE account_id='a' AND user_id='owner'").run();
    await expect(call(env, 'curate_set_product_vendor', { product_id: 'p1', vendor: 'Xi Wu Tang' })).rejects.toThrow(/Curate management/);
    await expect(call(env, 'curate_update_sample_set', { set_id: 'curate-set-abc123', name: 'X' })).rejects.toThrow(/Curate management/);
  });
});
