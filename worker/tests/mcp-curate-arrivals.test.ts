import { afterEach, describe, expect, it, vi } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { curateArrivalTools } from '../src/mcpTools/curateArrivals';
import { curatePhotoTools } from '../src/mcpTools/curatePhotos';
import worker from '../src/index';
import { sha256Hex } from '../src/inquiryDomain';
import { prepareCompassSampleWrite } from '../src/curateSampleBridge';
const dbs: SqliteD1[] = [];
afterEach(() => { for (const db of dbs.splice(0))
  db.close(); });
const auth = { accountId: 'a', userId: 'owner', userEmail: 'owner@test.dev', tokenId: 'token-one', creatorTier: 'account_owner' } as any;
function setup() {
  const db = new SqliteD1('migrations');
  dbs.push(db);
  seedIdentity(db, { accountId: 'a', userId: 'owner' });
  seedIdentity(db, { accountId: 'b', userId: 'other' });
  db.sqlite.prepare("INSERT INTO customers(id,account_id,name,tags) VALUES('vendor','a','Vendor','[\"vendor\"]')").run();
  db.sqlite.prepare("INSERT INTO tea_compass_entries(id,account_id,user_id,name,vendor_id,vendor_name,photos,sample_state) VALUES('tea','a','owner','Tea','vendor','Vendor','[]','requested')").run();
  db.sqlite.prepare("INSERT INTO curate_receipt_proposals(id,account_id,compass_entry_id,product_name,product_type,purpose,quantity,unit,acquisition_kind,idempotency_key,proposed_by_user_id) VALUES ('arrival','a','tea','Tea','Oolong','working',100,'g','purchase','manual','owner'),('foreign','b',NULL,'Foreign','Oolong','working',100,'g','purchase','foreign','other')").run();
  const accept = vi.fn(async (scope: any, id: string) => { db.sqlite.prepare("UPDATE curate_receipt_proposals SET status='accepted' WHERE id=? AND account_id=?").run(id, scope.accountId); return new Response(JSON.stringify({ product_id: 'product', ledger_id: 'ledger' }), { status: 200 }); });
  return { db, accept, env: { DB: db, curateReceipts: { accept } } as any };
}
const invoke = (env: any, name: string, args: any, who = auth) => curateArrivalTools.handlers[name](env, who, args) as Promise<any>;
describe('Curate arrivals read and confirmed stock service', () => {
  it('lists pending arrivals only within account, preserving unknown paid cost', async () => {
    const { env, accept } = setup();
    const result = await invoke(env, 'curate_list_arrivals', { agent: 'Builder' });
    expect(result).toMatchObject({ count: 1, arrivals: [{ arrival_id: 'arrival', name: 'Tea', quantity: 100, unit: 'g', cost: null }] });
    expect(accept).not.toHaveBeenCalled();
  });
  it('writes nothing during preview then calls shared service with bound identity exactly once', async () => {
    const { env, db, accept } = setup();
    const preview = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival', agent: 'Builder' });
    expect(preview.preview.arrival).toMatchObject({ quantity: 100, purpose: 'working', creates_private_draft: true });
    expect(accept).not.toHaveBeenCalled();
    expect(db.sqlite.prepare("SELECT status FROM curate_receipt_proposals WHERE id='arrival'").get()).toMatchObject({ status: 'pending' });
    const result = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival', confirm: preview.confirmation_token });
    expect(result).toMatchObject({ committed: true, product_id: 'product' });
    expect(accept).toHaveBeenCalledWith({ accountId: 'a', userId: 'owner', email: 'owner@test.dev' }, 'arrival');
    await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival', confirm: preview.confirmation_token });
    expect(accept).toHaveBeenCalledTimes(1);
  });
  it.each(['quantity', 'purpose', 'unit', 'product_id', 'compass_entry_id', 'acquisition_kind', 'idempotency_key'] as const)('rejects changed %s since preview', async (field) => {
    const { env, db, accept } = setup();
    const preview = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival' });
    const value = field === 'quantity' ? 50 : field === 'purpose' ? 'personal' : field === 'unit' ? 'unit' : field === 'product_id' ? 'different' : field === 'compass_entry_id' ? null : field === 'acquisition_kind' ? 'free_sample' : 'different';
    if (field === 'product_id')
      db.sqlite.prepare("INSERT INTO products(id,account_id,type,product_name) VALUES ('different','a','Oolong','Different')").run();
    db.sqlite.prepare(`UPDATE curate_receipt_proposals SET ${field}=? WHERE id='arrival'`).run(value);
    const result = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival', confirm: preview.confirmation_token });
    expect(result.error).toBe('arrival_changed_since_preview');
    expect(accept).not.toHaveBeenCalled();
  });
  it('rejects separately edited order costs and linked photo metadata', async () => {
    const { env, db, accept } = setup();
    db.sqlite.prepare("UPDATE curate_receipt_proposals SET idempotency_key='order:po:tea' WHERE id='arrival'").run();
    const items = [{ compass_entry_id: 'tea', quantity_grams: 100, line_total: 80, currency: 'CNY' }];
    db.sqlite.prepare("INSERT INTO purchase_orders(id,account_id,items_json,created_at,updated_at) VALUES('po','a',?,datetime('now'),datetime('now'))").run(JSON.stringify(items));
    const preview = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival' });
    expect(preview.preview.arrival.cost).toMatchObject({ amount: 80, currency: 'Yuan' });
    items[0].line_total = 160;
    db.sqlite.prepare("UPDATE purchase_orders SET items_json=? WHERE id='po'").run(JSON.stringify(items));
    expect((await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival', confirm: preview.confirmation_token })).error).toBe('arrival_changed_since_preview');
    const again = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival' });
    db.sqlite.prepare("UPDATE tea_compass_entries SET photos='[\"https://media.teajia.co/new.jpg\"]' WHERE id='tea'").run();
    expect((await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival', confirm: again.confirmation_token })).error).toBe('arrival_changed_since_preview');
    expect(accept).not.toHaveBeenCalled();
  });
  it('binds confirmations to originating account, token and user', async () => {
    const { env, accept } = setup();
    for (const override of [{ accountId: 'b', userId: 'other' }, { tokenId: 'different' }, { userId: 'sibling' }]) {
      const preview = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival' });
      const result = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival', confirm: preview.confirmation_token }, { ...auth, ...override });
      expect(result.error).toBeTruthy();
    }
    expect(accept).not.toHaveBeenCalled();
  });
  it('surfaces shared service validation errors without claiming committed', async () => {
    const { env, accept } = setup();
    accept.mockImplementationOnce(async () => new Response(JSON.stringify({ error: 'purpose_conflict' }), { status: 409 }));
    const preview = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival' });
    const result = await invoke(env, 'curate_approve_arrival', { arrival_id: 'arrival', confirm: preview.confirmation_token });
    expect(result).toEqual({ error: 'purpose_conflict', status: 409 });
    expect(result).not.toHaveProperty('committed');
  });
  it('legacy photo tool previews then stores role-labelled private evidence without public copying', async () => {
    const { env, db } = setup();
    const entry = db.sqlite.prepare("SELECT * FROM tea_compass_entries WHERE id='tea'").get() as any;
    db.batch((await prepareCompassSampleWrite(db as any, auth, entry, { entryId: 'tea' })).statements as any);
    const put = vi.fn(async () => undefined);
    const publicPut = vi.fn(async () => undefined);
    const args = { tea_id: 'tea', image_base64: btoa(String.fromCharCode(255, 216, 255, 1)), mime_type: 'image/jpeg', role: 'pricelist', filename: 'quote.jpg' };
    const privateEnv = { ...env, ATLAS_BUCKET: { put }, MEDIA_BUCKET: { put: publicPut } };
    const preview = await curatePhotoTools.handlers.curate_add_photo(privateEnv, auth, args) as any;
    expect(preview.confirmation_token).toBeTruthy();
    expect(put).not.toHaveBeenCalled();
    const result = await curatePhotoTools.handlers.curate_add_photo(privateEnv, auth, { ...args, confirm: preview.confirmation_token }) as any;
    expect(result.confirmed).toBe(true);
    expect(result.attachment).toMatchObject({ role: 'pricelist', entity_type: 'tea', entity_id: 'tea' });
    expect(put).toHaveBeenCalledTimes(1);
    expect(publicPut).not.toHaveBeenCalled();
    expect(db.sqlite.prepare("SELECT photos FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ photos: '[]' });
    expect(db.sqlite.prepare("SELECT photos FROM tea_samples WHERE compass_entry_id='tea'").get()).toMatchObject({ photos: '[]' });
  });
});
describe('arrival tools through the authenticated HTTP MCP route', () => {
  it('accepts through the injected real service and creates one private stock holding', async () => {
    const { db } = setup();
    const bearer = 'fake-arrival-mcp-bearer';
    db.sqlite.prepare(`INSERT INTO mcp_tokens
   (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier,expires_at)
   VALUES ('arrival-token','a','owner','owner@test.dev','test',?,'fake','["inventory:read","stock:write"]','account_owner',?)`)
      .run(await sha256Hex(bearer), Math.floor(Date.now() / 1000) + 3600);
    const wrap = (statement: any): any => ({
      bind: (...values: unknown[]) => wrap(statement.bind(...values)),
      run: () => Promise.resolve(statement.run()),
      first: () => Promise.resolve(statement.first()),
      all: () => Promise.resolve(statement.all()),
      raw: statement,
    });
    const d1 = {
      prepare: (sql: string) => wrap(db.prepare(sql)),
      batch: (statements: any[]) => Promise.resolve(db.batch(statements.map(statement => statement.raw))),
    };
    async function rpc(name: string, args: any) {
      const response = await worker.fetch(new Request('https://worker.test/mcp', {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      }), { DB: d1, JWT_SECRET: 'test-jwt' } as any);
      const output = await response.json() as any;
      expect(response.status).toBe(200);
      expect(output.error, JSON.stringify(output)).toBeUndefined();
      return output.result.structuredContent ?? JSON.parse(output.result.content[0].text);
    }
    expect((await rpc('curate_list_arrivals', {})).count).toBe(1);
    const preview = await rpc('curate_approve_arrival', { arrival_id: 'arrival', agent: 'Builder' });
    expect(preview.confirmation_token).toBeTruthy();
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE account_id=?').get('a')).toMatchObject({ n: 0 });
    const accepted = await rpc('curate_approve_arrival', { arrival_id: 'arrival', confirm: preview.confirmation_token });
    expect(accepted.committed, JSON.stringify(accepted)).toBe(true);
    expect(db.sqlite.prepare('SELECT stock_grams,is_public,shown_in_shop,cost_amount FROM products WHERE id=?').get(accepted.product_id))
      .toMatchObject({ stock_grams: 100, is_public: 0, shown_in_shop: 0, cost_amount: null });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger WHERE account_id=?').get('a')).toMatchObject({ n: 1 });
    expect(db.sqlite.prepare("SELECT status FROM tea_compass_entries WHERE id='tea'").get()).toMatchObject({ status: 'in_stock' });
  });
});
