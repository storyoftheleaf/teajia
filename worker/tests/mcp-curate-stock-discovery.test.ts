import { describe, expect, it } from 'vitest';
import { mcpFetch } from '../src/mcp';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const ACCOUNT = 'acc-holdings';
const TOKEN = 'tjmcp_holdings_test';
async function setup(role: 'owner' | 'viewer' | 'staff' = 'owner', managed = false, scopes = ['inventory:read']) {
  const db = new SqliteD1();
  seedIdentity(db, { userId: 'reader', accountId: ACCOUNT, role });
  seedIdentity(db, { userId: 'other', accountId: 'other-account', role: 'owner' });
  if (managed) db.sqlite.prepare('UPDATE account_members SET permissions=? WHERE account_id=? AND user_id=?')
    .run(JSON.stringify({ curate_manage: true, bundles: ['stock'] }), ACCOUNT, 'reader');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(TOKEN))))
    .map(value => value.toString(16).padStart(2, '0')).join('');
  db.sqlite.prepare(`INSERT INTO mcp_tokens (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier,expires_at)
    VALUES ('token',?,'reader','reader@test.dev','test',?,'tjmcp_',?,'read_only',?)`)
    .run(ACCOUNT, hash, JSON.stringify(scopes), Math.floor(Date.now() / 1000) + 3600);
  db.sqlite.prepare(`INSERT INTO products (id,account_id,type,product_name,given_name,stock_grams,status,source_compass_entry_id,low_stock_threshold)
    VALUES ('product',?,'Tea','Plum tea','Plum',120,'Active','known',200)`).run(ACCOUNT);
  db.sqlite.prepare('INSERT INTO tea_sample_sets (id,account_id,name) VALUES (?,?,?)').run('set', ACCOUNT, 'Vendor samples');
  for (const [id, grams, known] of [['known', 12, 1], ['unknown', 10, 0], ['zero', 0, 1]] as const) {
    db.sqlite.prepare(`INSERT INTO tea_compass_entries (id,account_id,user_id,name,vendor_name,vendor_item_number,sample_state)
      VALUES (?,?,'reader',?,'LKY',?,'received')`).run(id, ACCOUNT, `${id} tea`, `LKY-PE${id === 'known' ? 3 : id}`);
    db.sqlite.prepare(`INSERT INTO tea_samples (id,account_id,set_id,compass_entry_id,name,grams,grams_known)
      VALUES (?,?, 'set',?,?,?,?)`).run(`portion-${id}`, ACCOUNT, id, `${id} portion`, grams, known);
  }
  db.sqlite.prepare(`INSERT INTO tea_compass_entries (id,account_id,user_id,name,vendor_name)
    VALUES ('foreign','other-account','other','Foreign secret','LKY')`).run();
  return db;
}
async function rpc(db: SqliteD1, method: string, params?: unknown) {
  const response = await mcpFetch(new Request('https://api.test/mcp', {
    method: 'POST', headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), { DB: {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      const wrapper = {
        statement,
        bind(...values: unknown[]) { statement.bind(...values); return wrapper; },
        first: async () => statement.first(), all: async () => statement.all(),
        run: async () => statement.run(),
      };
      return wrapper;
    },
    batch: async (statements: any[]) => db.batch(statements.map(item => item.statement)),
  } } as any);
  expect(response.status).toBe(200);
  return await response.json() as any;
}
async function call(db: SqliteD1, name: string, args = {}) {
  const body = await rpc(db, 'tools/call', { name, arguments: args });
  expect(body.error).toBeUndefined();
  return body.result.structuredContent;
}

describe('ordinary inventory discovery includes separate Curate holdings', () => {
  it('finds vendor item numbers, exposes portion ids, and keeps sample grams separate from sale stock', async () => {
    const db = await setup();
    const result = await call(db, 'search_tea', { query: 'LKY-PE3', limit: 1 });
    expect(result.matches).toEqual([]);
    expect(result.curate_holdings).toEqual([expect.objectContaining({
      entity_type: 'curate_tea', curate_tea_id: 'known', sample_grams: 12, stock_grams: 120,
      sample_portions: [expect.objectContaining({ sample_id: 'portion-known', set_id: 'set', grams: 12 })],
    })]);
    expect(result.curate_holdings[0]).not.toHaveProperty('id');
    db.close();
  });
  it('preserves unknown and explicitly zero sample weights and refuses another shop', async () => {
    const db = await setup();
    expect(await call(db, 'get_tea', { id: 'unknown', source: 'curate' })).toMatchObject({ sample_grams: null, stock_grams: 0, sample_portions: [{ grams: null }] });
    expect(await call(db, 'get_tea', { id: 'zero', source: 'curate' })).toMatchObject({ sample_grams: 0, sample_portions: [{ grams: 0 }] });
    expect(await call(db, 'get_tea', { id: 'foreign', source: 'curate' })).toEqual({ error: 'not_found' });
    const all = await call(db, 'search_tea', { query: 'LKY' });
    expect(all.curate_holdings).toHaveLength(3);
    db.close();
  });
  it('requires Curate management even for a token with inventory read', async () => {
    const db = await setup('viewer');
    expect((await call(db, 'search_tea', { query: 'LKY' })).curate_holdings).toEqual([]);
    expect(await call(db, 'get_tea', { id: 'known', source: 'curate' })).toEqual({ error: 'curate_management_required' });
    expect((await call(db, 'search_tea', { query: 'Plum' })).matches[0]).toMatchObject({ id: 'product', stock_grams: 120 });
    db.close();
  });
  it('allows staff with explicit Curate permission and leaves product get/search and low-stock shapes intact', async () => {
    const db = await setup('staff', true);
    expect((await call(db, 'search_tea', { query: 'LKY' })).curate_holdings).toHaveLength(3);
    const product = await call(db, 'get_tea', { id: 'product' });
    expect(product).toMatchObject({ id: 'product', display_name: 'Plum', stock_grams: 120, recent_ledger: [] });
    expect(product).not.toHaveProperty('sample_grams');
    expect(await call(db, 'get_tea', { id: 'known' })).toEqual({ error: 'not_found' });
    const low = await call(db, 'list_low_stock');
    expect(low.count).toBe(1);
    expect(low.items[0].id).toBe('product');
    db.close();
  });
  it('advertises current Curate tools and asks clients to refresh the live list', async () => {
    const db = await setup();
    const initialized = await rpc(db, 'initialize');
    expect(initialized.result.serverInfo.version).toBe('0.7.0');
    expect(initialized.result.serverInfo.description).toContain('curate_correct');
    expect(initialized.result.instructions).toContain('tools/list');
    expect(initialized.result.capabilities.tools.listChanged).toBe(false);
    const listed = await rpc(db, 'tools/list');
    expect(listed.result.tools.find((tool: any) => tool.name === 'get_tea').inputSchema.properties.source.enum).toEqual(['product', 'curate']);
    db.close();
  });
});


describe('Curate corrections use the existing stock scope and live management gate', () => {
  const correction = { entity: 'tea', id: 'known', action: 'edit', fields: { name: 'Corrected tea' } };
  const defaults = ['inventory:read', 'stock:write', 'customers:read', 'sales:read', 'sales:write'];
  it('lists and previews corrections and undo with the default owner OAuth scope set', async () => {
    const db = await setup('owner', false, defaults);
    const listed = await rpc(db, 'tools/list');
    for (const name of ['curate_correct', 'curate_undo']) {
      expect(listed.result.tools.find((tool: any) => tool.name === name)?.annotations)
        .toMatchObject({ readOnlyHint: false, destructiveHint: true });
    }
    expect(listed.result.tools.some((tool: any) => tool.name === 'curate_promote_tea')).toBe(true);
    expect((await call(db, 'curate_promote_tea', { tea_id: 'unknown' })).preview.creates).toMatchObject({ status: 'Draft', stock_grams: 0, cost_amount: null });
    const preview = await call(db, 'curate_correct', correction);
    expect(preview.confirmation_token).toBeTruthy();
    expect((db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='known'").get() as any).name).toBe('known tea');
    expect(await call(db, 'curate_correct', { confirmation_token: preview.confirmation_token })).toMatchObject({ confirmed: true });
    expect((await call(db, 'curate_undo')).confirmation_token).toBeTruthy();
    db.close();
  });
  it('does not list either write to read-only tokens and rejects dispatch before the handler', async () => {
    const db = await setup();
    const listed = await rpc(db, 'tools/list');
    for (const name of ['curate_correct', 'curate_undo']) {
      expect(listed.result.tools.some((tool: any) => tool.name === name)).toBe(false);
      expect(await call(db, name, correction)).toMatchObject({ error: 'insufficient_mcp_scope', required_scope: 'stock:write' });
    }
    db.close();
  });
  it('allows staff with stock and explicit Curate management, but keeps catalog tools owner-only', async () => {
    const db = await setup('staff', true, ['inventory:read', 'stock:write']);
    expect((await call(db, 'curate_correct', correction)).confirmation_token).toBeTruthy();
    const listed = await rpc(db, 'tools/list');
    expect(listed.result.tools.some((tool: any) => tool.name === 'curate_correct')).toBe(true);
    expect(listed.result.tools.some((tool: any) => tool.name === 'set_archive_status')).toBe(false);
    expect(await call(db, 'set_archive_status', {})).toMatchObject({ error: 'insufficient_mcp_scope', required_scope: 'catalog:write' });
    db.close();
  });
  it('rejects staff with stock but no Curate management capability', async () => {
    const db = await setup('staff');
    db.sqlite.prepare('UPDATE account_members SET permissions=? WHERE account_id=? AND user_id=?')
      .run(JSON.stringify({ bundles: ['stock'] }), ACCOUNT, 'reader');
    db.sqlite.prepare('UPDATE mcp_tokens SET scopes=?').run(JSON.stringify(['inventory:read', 'stock:write']));
    for (const name of ['curate_correct', 'curate_undo']) {
      const result = await rpc(db, 'tools/call', { name, arguments: correction });
      expect(result.error.message).toContain('Curate management requires');
    }
    db.close();
  });
  it('revoking Curate management after preview rejects confirmation without changing the record', async () => {
    const db = await setup('staff', true, ['inventory:read', 'stock:write']);
    const preview = await call(db, 'curate_correct', correction);
    db.sqlite.prepare('UPDATE account_members SET permissions=? WHERE account_id=? AND user_id=?')
      .run(JSON.stringify({ bundles: ['stock'] }), ACCOUNT, 'reader');
    const result = await rpc(db, 'tools/call', { name: 'curate_correct', arguments: { confirmation_token: preview.confirmation_token } });
    expect(result.error.message).toContain('Curate management requires');
    expect((db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='known'").get() as any).name).toBe('known tea');
    db.close();
  });
});


describe('private attachment upload follows the existing Curate stock grant', () => {
  const upload = { entity_type: 'tea', entity_id: 'known', role: 'pricelist', filename: 'prices.pdf',
    mime_type: 'application/pdf', data_base64: btoa('%PDF-1.4 test'), agent: 'Hermes' };
  it('lets default owner scopes and explicitly authorized stock staff preview private uploads', async () => {
    for (const role of ['owner','staff'] as const) {
      const db = await setup(role, role === 'staff', ['inventory:read','stock:write']);
      const listed = await rpc(db, 'tools/list');
      const schema = listed.result.tools.find((tool: any) => tool.name === 'curate_upload_attachment').inputSchema;
      expect(schema.properties.role.enum).toContain('pricelist');
      expect(schema.properties.role.enum).toContain('businesscard');
      expect((await call(db, 'curate_upload_attachment', upload)).confirmation_token).toBeTruthy();
      expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM curate_attachments').get()).toMatchObject({ n: 0 });
      db.close();
    }
  });
  it('hides and rejects the upload for read-only tokens', async () => {
    const db = await setup();
    const listed = await rpc(db, 'tools/list');
    expect(listed.result.tools.some((tool: any) => tool.name === 'curate_upload_attachment')).toBe(false);
    expect(await call(db, 'curate_upload_attachment', upload)).toMatchObject({ error: 'insufficient_mcp_scope', required_scope: 'stock:write' });
    db.close();
  });
  it('still refuses stock staff who lack Curate management', async () => {
    const db = await setup('staff');
    db.sqlite.prepare('UPDATE account_members SET permissions=? WHERE account_id=? AND user_id=?')
      .run(JSON.stringify({ bundles: ['stock'] }), ACCOUNT, 'reader');
    db.sqlite.prepare('UPDATE mcp_tokens SET scopes=?').run(JSON.stringify(['inventory:read','stock:write']));
    const result = await rpc(db, 'tools/call', { name: 'curate_upload_attachment', arguments: upload });
    expect(result.error.message).toContain('Curate management requires');
    db.close();
  });
});


describe('existing platform OAuth identity needs explicit shop Curate access', () => {
  it('unblocks the same token immediately when its own shop membership is granted, without broadening platform access', async () => {
    const db = await setup('owner', false, ['inventory:read', 'stock:write']);
    db.sqlite.prepare("UPDATE users SET platform_role='platform_owner' WHERE id='reader'").run();
    db.sqlite.prepare("DELETE FROM account_members WHERE user_id='reader' AND account_id=?").run(ACCOUNT);
    const listed = await rpc(db, 'tools/list');
    expect(listed.result.tools.some((tool: any) => tool.name === 'curate_correct')).toBe(true);
    for (const name of ['curate_history', 'curate_stock', 'curate_correct']) {
      const result = await rpc(db, 'tools/call', { name, arguments: { entity: 'tea', id: 'known', action: 'archive' } });
      expect(result.error.message).toContain('Curate management requires');
    }
    db.sqlite.prepare("INSERT INTO account_members(account_id,user_id,role,status,permissions) VALUES(?,'reader','staff','active',?)")
      .run(ACCOUNT, JSON.stringify({ curate_manage: true }));
    expect(await call(db, 'curate_history', { entity_type: 'tea', entity_id: 'known' })).toMatchObject({ history: [] });
    expect((await call(db, 'curate_stock', { tea_id: 'known' })).holdings[0]).toMatchObject({ sample_grams: 12, stock_grams: 120 });
    expect(await call(db, 'curate_list_attachments', { entity_type: 'tea', entity_id: 'known' })).toMatchObject({ attachments: [] });
    db.sqlite.prepare('UPDATE tea_compass_entries SET photos=? WHERE id=?').run(JSON.stringify(['https://example.com/leaf.jpg']), 'known');
    for (const action of ['delete', 'archive', 'merge', 'remove_photo']) {
      expect((await call(db, 'curate_correct', { entity: 'tea', id: 'known', action, target_id: 'unknown', photo: 'https://example.com/leaf.jpg' })).confirmation_token).toBeTruthy();
    }
    expect((db.sqlite.prepare("SELECT archived_at,deleted_at FROM tea_compass_entries WHERE id='known'").get())).toEqual({ archived_at: null, deleted_at: null });
    const edit = await call(db, 'curate_correct', { entity: 'tea', id: 'known', action: 'edit', fields: { name: 'Granted agent edit' } });
    expect(await call(db, 'curate_correct', { confirmation_token: edit.confirmation_token })).toMatchObject({ confirmed: true });
    const undo = await call(db, 'curate_undo');
    expect(undo.confirmation_token).toBeTruthy();
    db.sqlite.prepare("DELETE FROM account_members WHERE user_id='reader' AND account_id=?").run(ACCOUNT);
    const refused = await rpc(db, 'tools/call', { name: 'curate_undo', arguments: { confirmation_token: undo.confirmation_token } });
    expect(refused.error.message).toContain('Curate management requires');
    expect((db.sqlite.prepare("SELECT name FROM tea_compass_entries WHERE id='known'").get() as any).name).toBe('Granted agent edit');
    db.close();
  });
});
