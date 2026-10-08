import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { curateIntakeTools, markTodoDone, pickSuggestions, readQuotedPrice, teaMissing } from '../src/mcpTools/curateIntake';

/*
 * Adrian's rule for these tools: whether he talks to an agent or types in the
 * app, the result lands in the same place. So every test here asks the
 * database the app reads, not the tool's own answer: a Curate tea is a
 * tea_compass_entries row under the token's user, a vendor is a customers row
 * tagged vendor, a transcript is a notes row on the tea.
 *
 * And the money rules: a price carries its currency and its unit, or it is
 * refused; nothing the agent did not say is written as a number; the compass
 * table's DEFAULT 'NT' never answers for a price nobody gave.
 */

const ACCOUNT = 'acc-curate';
const OTHER = 'acc-other';
type R = Record<string, any>;

function makeDb(schema: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(schema);
  seedIdentity(db, { userId: 'adrian', accountId: ACCOUNT, role: 'owner' });
  seedIdentity(db, { userId: 'stranger', accountId: OTHER, role: 'owner' });
  return db;
}

const auth = (over: Record<string, string> = {}) => ({
  accountId: ACCOUNT, userId: 'adrian', userEmail: 'adrian@test.dev', tokenId: 'tok-1', creatorTier: 'account_owner', ...over,
}) as any;

const call = (db: SqliteD1, name: string, args: any, who = auth()): Promise<R> =>
  curateIntakeTools.handlers[name]({ DB: db } as any, who, args) as Promise<R>;

/** Preview, then confirm with the token the preview handed back. */
async function confirm(db: SqliteD1, name: string, args: any, who = auth()) {
  const preview = await call(db, name, args, who);
  expect(preview.confirmation_token, JSON.stringify(preview)).toBeTruthy();
  return { preview, result: await call(db, name, { ...args, confirm: preview.confirmation_token }, who) };
}

const entries = (db: SqliteD1) => db.sqlite.prepare('SELECT * FROM tea_compass_entries ORDER BY created_at').all() as R[];
const vendors = (db: SqliteD1) => db.sqlite.prepare("SELECT * FROM customers WHERE tags LIKE '%vendor%'").all() as R[];

describe('a price is read the way the vendor said it', () => {
  it('stores jin as 500 g, liang as 50 g, a cake as a piece', () => {
    expect(readQuotedPrice({ amount: 240, currency: 'Yuan', per: 'jin' })).toMatchObject({ price_amount: 240, price_currency: 'Yuan', price_per_unit_grams: 500 });
    expect(readQuotedPrice({ amount: 30, currency: 'cny', per: 'liang' })).toMatchObject({ price_currency: 'Yuan', price_per_unit_grams: 50 });
    expect(readQuotedPrice({ amount: 1200, currency: 'RMB', per: 'piece' })).toMatchObject({ price_per_unit_grams: null });
    expect(readQuotedPrice({ amount: 900, currency: 'NT', per_grams: 100 })).toMatchObject({ price_currency: 'NT', price_per_unit_grams: 100 });
  });

  it('refuses a price with no currency, rather than letting the table say NT', () => {
    expect(() => readQuotedPrice({ amount: 1200, per: 'piece' })).toThrow(/currency/);
    expect(() => readQuotedPrice({ amount: 1200, currency: 'UNK', per: 'piece' })).toThrow(/UNK/);
    expect(() => readQuotedPrice({ amount: 1200, currency: 'doubloons', per: 'piece' })).toThrow(/live rate/);
  });

  it('refuses a price that does not say what it is for', () => {
    expect(() => readQuotedPrice({ amount: 1200, currency: 'Yuan' })).toThrow(/per/);
  });

  it('keeps a typed 0 as free, and an empty amount as no price at all', () => {
    expect(readQuotedPrice({ amount: 0, currency: 'Yuan', per: 'piece' })?.price_amount).toBe(0);
    expect(() => readQuotedPrice({ amount: '', currency: 'Yuan', per: 'piece' })).toThrow(/no amount/);
    expect(readQuotedPrice(undefined)).toBeNull();
  });
});

describe('a tea needs only a name', () => {
  it('lands in Curate under the token user, with no invented price or currency', async () => {
    const db = makeDb();
    const { preview, result } = await confirm(db, 'curate_add_tea', { name: 'Old oolong', agent: 'Hermes' });
    expect(preview.preview.still_missing).toContain('cost');
    expect(result.committed).toBe(true);
    const [row] = entries(db);
    expect(row).toMatchObject({ name: 'Old oolong', user_id: 'adrian', account_id: ACCOUNT, status: 'noted', price_amount: null, price_currency: null });
  });

  it('does nothing until confirmed', async () => {
    const db = makeDb();
    await call(db, 'curate_add_tea', { name: 'Old oolong' });
    expect(entries(db)).toHaveLength(0);
  });

  it('files everything said about it: fields, price, tasting, the transcript, a vendor note, a to-do', async () => {
    const db = makeDb();
    const said = 'Yiwu, spring 2019, gushu. Twelve hundred a cake. Full, honey, long finish. He will have the 2018 in spring, remind me to ask.';
    await confirm(db, 'curate_add_tea', {
      name: '2019 Yiwu Gushu', agent: 'GrokBot', vendor_name: 'Wang Laoshi',
      year: '2019', season: 'Spring', origin_region: 'Yiwu', origin_country: 'China', type: 'Sheng', form: 'Cake',
      price: { amount: 1200, currency: 'yuan', per: 'piece' },
      tasting: { body: ['full'], flavor: ['honey'], finish: ['finish-long'] }, score: 8,
      note: 'Trees about 300 years old', said,
      vendor_note: 'Will have the 2018 in spring', todo: 'Ask Wang about the 2018',
    });
    const [row] = entries(db);
    expect(row).toMatchObject({ year: 2019, origin_region: 'Yiwu', price_amount: 1200, price_currency: 'Yuan', price_per_unit_grams: null, vendor_name: 'Wang Laoshi' });
    expect(JSON.parse(row.tasting)).toEqual({ body: ['full'], flavor: ['honey'], finish: ['finish-long'], quality: 8 });
    const [vendor] = vendors(db);
    expect(row.vendor_id).toBe(vendor.id);
    expect(vendor.notes).toMatch(/Will have the 2018 in spring/);
    const notes = db.sqlite.prepare('SELECT * FROM notes WHERE compass_entry_id = ? ORDER BY source_type').all(row.id) as R[];
    expect(notes.map(n => n.source_type)).toEqual(['manual', 'voice']);
    expect(notes.find(n => n.source_type === 'voice')!.text).toBe(said);
    const todo = db.sqlite.prepare('SELECT * FROM curate_todos').get() as R;
    expect(todo).toMatchObject({ text: 'Ask Wang about the 2018', compass_entry_id: row.id, vendor_id: vendor.id, done_at: null });
  });

  it('refuses a tasting term that is not in the taxonomy, by name, at preview', async () => {
    const db = makeDb();
    await expect(call(db, 'curate_add_tea', { name: 'X', tasting: { flavor: ['marmalade-ish'] } })).rejects.toThrow(/marmalade-ish/);
  });

  it('a 1990s tea keeps its era instead of a made-up year', async () => {
    const db = makeDb();
    await confirm(db, 'curate_add_tea', { name: 'Old shou', year: '1990s' });
    expect(entries(db)[0]).toMatchObject({ year: null, era: '1990s' });
  });
});

describe('filling in later changes only what is given', () => {
  it('a price added later leaves the rest alone, and appears in the missing list until it is', async () => {
    const db = makeDb();
    await confirm(db, 'curate_add_tea', { name: 'Old oolong', vendor_name: 'Chen', origin_region: 'Wuyi' });
    const id = entries(db)[0].id;
    let missing = await call(db, 'curate_whats_missing', {});
    expect(missing.teas[0]).toMatchObject({ id, missing: expect.arrayContaining(['cost']) });
    expect(missing.teas[0].ask).toMatch(/cost/);
    await confirm(db, 'curate_update_tea', { tea_id: id, price: { amount: 380, currency: 'Yuan', per: 'jin' } });
    expect(entries(db)[0]).toMatchObject({ origin_region: 'Wuyi', vendor_name: 'Chen', price_amount: 380, price_per_unit_grams: 500 });
    missing = await call(db, 'curate_whats_missing', {});
    expect(missing.teas.find((t: R) => t.id === id)?.missing ?? []).not.toContain('cost');
  });

  it('tasting merges by category and keeps the score and the others', async () => {
    const db = makeDb();
    await confirm(db, 'curate_add_tea', { name: 'T', tasting: { flavor: ['honey'] }, score: 7 });
    const id = entries(db)[0].id;
    await confirm(db, 'curate_update_tea', { tea_id: id, tasting: { body: ['smooth'] } });
    expect(JSON.parse(entries(db)[0].tasting)).toEqual({ flavor: ['honey'], quality: 7, body: ['smooth'] });
  });

  it('clearing is explicit: clear price empties all three price columns', async () => {
    const db = makeDb();
    await confirm(db, 'curate_add_tea', { name: 'T', price: { amount: 10, currency: 'Yuan', per: 'gram' } });
    const id = entries(db)[0].id;
    await confirm(db, 'curate_update_tea', { tea_id: id, clear: ['price'] });
    expect(entries(db)[0]).toMatchObject({ price_amount: null, price_currency: null, price_per_unit_grams: null });
  });

  it('cannot reach a tea in another shop', async () => {
    const db = makeDb();
    await confirm(db, 'curate_add_tea', { name: 'Theirs' }, auth({ accountId: OTHER, userId: 'stranger' }));
    const theirs = entries(db)[0].id;
    expect(await call(db, 'curate_update_tea', { tea_id: theirs, note: 'x' })).toEqual({ error: 'not_found' });
  });

  it('a ticket is spent once, and only by the tool that issued it', async () => {
    const db = makeDb();
    const preview = await call(db, 'curate_add_tea', { name: 'Once' });
    expect(await call(db, 'curate_save_vendor', { name: 'X', confirm: preview.confirmation_token })).toMatchObject({ error: expect.any(String) });
    await call(db, 'curate_add_tea', { name: 'Once', confirm: preview.confirmation_token });
    expect(await call(db, 'curate_add_tea', { name: 'Once', confirm: preview.confirmation_token })).toMatchObject({ error: expect.any(String) });
    expect(entries(db)).toHaveLength(1);
  });
});

describe('vendors start as a name and grow', () => {
  it('a name alone makes a vendor the app lists', async () => {
    const db = makeDb();
    await confirm(db, 'curate_save_vendor', { name: "Chen's shop", agent: 'Claude' });
    const [v] = vendors(db);
    expect(v).toMatchObject({ name: "Chen's shop", account_id: ACCOUNT });
    expect(JSON.parse(v.tags)).toContain('vendor');
  });

  it('adding a WeChat later keeps the phone and the notes (the old tool wiped them)', async () => {
    const db = makeDb();
    await confirm(db, 'curate_save_vendor', { name: 'Wang Laoshi', phone: '+86 138', note: 'Fangcun market' });
    await confirm(db, 'curate_save_vendor', { name: 'Wang Laoshi', wechat: 'wang_tea', website: 'https://wangtea.cn' });
    const [v] = vendors(db);
    expect(v.phone).toBe('+86 138');
    expect(v.notes).toMatch(/Fangcun market/);
    const contacts = JSON.parse(v.contacts);
    expect(contacts).toContainEqual({ channel: 'wechat', handle: 'wang_tea' });
    expect(contacts).toContainEqual({ channel: 'phone', handle: '+86 138' });
    expect(contacts).toContainEqual({ channel: 'other', handle: 'https://wangtea.cn', label: 'website' });
    expect(vendors(db)).toHaveLength(1);
  });

  it('a customer who shares the name is not turned into a vendor', async () => {
    const db = makeDb();
    db.sqlite.prepare("INSERT INTO customers (id, account_id, name, tags) VALUES ('cust', ?, 'Chen', '[\"retail\"]')").run(ACCOUNT);
    const { preview } = await confirm(db, 'curate_save_vendor', { name: 'Chen' });
    expect(preview.preview.mode).toBe('create_new');
    const cust = db.sqlite.prepare("SELECT tags FROM customers WHERE id = 'cust'").get() as R;
    expect(cust.tags).toBe('["retail"]');
  });

  it('the missing list names a vendor with no WeChat', async () => {
    const db = makeDb();
    await confirm(db, 'curate_save_vendor', { name: 'No Chat', whatsapp: '+62 1' });
    const out = await call(db, 'curate_whats_missing', {});
    expect(out.vendors[0]).toMatchObject({ name: 'No Chat', missing: ['WeChat', 'where they are'] });
    expect(out.vendors[0].ask).toMatch(/WeChat/);
  });

  it('reads a WeChat written by the older tool in its older shape', async () => {
    const db = makeDb();
    db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, tags, contacts, city) VALUES ('old', ?, 'Old Shape', '["vendor"]', '[{"type":"wechat","value":"old_w"}]', 'Puer')`).run(ACCOUNT);
    const out = await call(db, 'curate_whats_missing', {});
    expect(out.vendors.find((v: R) => v.id === 'old')).toBeUndefined();
  });
});

describe('the GrokBot example: ten teas found, three picked', () => {
  const tenTeas = [
    { name: '2019 Yiwu Gushu', type: 'Sheng', form: 'Cake', price: { amount: 1200, currency: 'CNY', per: 'piece' } },
    { name: '2020 Bulang', price: { amount: 560, currency: 'CNY', per: 'piece' } },
    { name: '2016 Purple Leaf', price: { amount: 680, currency: 'CNY', per: 'piece' } },
    { name: '2021 Jingmai', price: { amount: 240, currency: 'CNY', per: 'jin' } },
    { name: '2008 Fuding White', type: 'White' },
    { name: 'Zhuni teapot', category: 'teaware', capacity_ml: 120 },
    { name: 'Menghai 7542' }, { name: 'Lao Banzhang' }, { name: 'Mengku' }, { name: 'Nannuo' },
  ];
  const from = { url: 'https://wangtea.cn', vendor_name: 'Wang Laoshi', contact: 'WeChat wang_tea' };

  it('suggestions wait, nothing enters Curate, and picks become samples with the source attached', async () => {
    const db = makeDb();
    const out = await call(db, 'curate_suggest_teas', { agent: 'GrokBot', from, teas: tenTeas });
    expect(out.added).toBe(10);
    expect(entries(db)).toHaveLength(0);
    expect(vendors(db)).toHaveLength(0);

    const list = await call(db, 'curate_list_suggestions', {});
    expect(list.waiting[0]).toMatchObject({ found_by: 'GrokBot', url: 'https://wangtea.cn', vendor: 'Wang Laoshi' });
    const ids = list.waiting[0].teas.map((t: R) => t.id);
    const byName = (n: string) => list.waiting[0].teas.find((t: R) => t.name === n).id;
    const pick = [byName('2019 Yiwu Gushu'), byName('2016 Purple Leaf'), byName('2008 Fuding White')];
    const drop = ids.filter((id: string) => !pick.includes(id));

    const { preview, result } = await confirm(db, 'curate_pick_suggestions', { pick, drop, agent: 'GrokBot' });
    expect(preview.preview.read_back).toMatch(/3 to Curate as samples to request, 7 dropped/);
    expect(result.in_curate).toHaveLength(3);

    const rows = entries(db);
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toMatchObject({ user_id: 'adrian', sample_state: 'requested', vendor_name: 'Wang Laoshi', status: 'noted' });
    const yiwu = rows.find(r => r.name === '2019 Yiwu Gushu')!;
    expect(yiwu).toMatchObject({ price_amount: 1200, price_currency: 'Yuan', type: 'Sheng', form: 'Cake' });
    // Fuding White had no price: nothing invented.
    expect(rows.find(r => r.name === '2008 Fuding White')).toMatchObject({ price_amount: null, price_currency: null });

    const [vendor] = vendors(db);
    expect(JSON.parse(vendor.contacts)).toContainEqual({ channel: 'other', handle: 'https://wangtea.cn', label: 'website' });
    expect(vendor.notes).toMatch(/wang_tea/);
    const note = db.sqlite.prepare('SELECT text FROM notes WHERE compass_entry_id = ?').get(yiwu.id) as R;
    expect(note.text).toMatch(/Suggested by GrokBot from https:\/\/wangtea.cn/);

    expect((await call(db, 'curate_list_suggestions', {})).waiting).toHaveLength(0);
  });

  it('a tea Adrian turned down is not suggested again', async () => {
    const db = makeDb();
    await call(db, 'curate_suggest_teas', { agent: 'GrokBot', from, teas: [{ name: 'Nannuo' }] });
    const id = (await call(db, 'curate_list_suggestions', {})).waiting[0].teas[0].id;
    await confirm(db, 'curate_pick_suggestions', { drop: [id] });
    const again = await call(db, 'curate_suggest_teas', { agent: 'GrokBot', from, teas: [{ name: 'Nannuo' }] });
    expect(again.added).toBe(0);
    expect(again.skipped[0].why).toMatch(/turned this one down/);
  });

  it('a suggested price without a currency is refused by name', async () => {
    const db = makeDb();
    await expect(call(db, 'curate_suggest_teas', { agent: 'GrokBot', from, teas: [{ name: 'Bulang', price: { amount: 560, per: 'piece' } }] }))
      .rejects.toThrow(/Bulang has no currency/);
  });

  it('picking twice does not make two teas', async () => {
    const db = makeDb();
    await call(db, 'curate_suggest_teas', { agent: 'GrokBot', from, teas: [{ name: 'Mengku' }] });
    const id = (await call(db, 'curate_list_suggestions', {})).waiting[0].teas[0].id;
    const a = await call(db, 'curate_pick_suggestions', { pick: [id] });
    const b = await call(db, 'curate_pick_suggestions', { pick: [id] });
    await call(db, 'curate_pick_suggestions', { pick: [id], confirm: a.confirmation_token });
    const second = await call(db, 'curate_pick_suggestions', { pick: [id], confirm: b.confirmation_token });
    expect(second.skipped).toEqual([id]);
    expect(entries(db)).toHaveLength(1);
  });
});

describe('a pick in the app lands the same rows as a pick through an agent', () => {
  it('pickSuggestions and curate_pick_suggestions write identical teas, vendor and note', async () => {
    const from = { url: 'https://wangtea.cn', vendor_name: 'Wang Laoshi', contact: 'WeChat wang_tea' };
    const shape = (db: SqliteD1) => ({
      tea: (({ id, created_at, updated_at, vendor_id, sample_set_id, ...rest }) => rest)(entries(db)[0]),
      vendor: (({ id, created_at, updated_at, notes, ...rest }) => rest)(vendors(db)[0]),
      note: (db.sqlite.prepare('SELECT text, source_type FROM notes').get() as R),
    });

    const viaAgent = makeDb();
    await call(viaAgent, 'curate_suggest_teas', { agent: 'GrokBot', from, teas: [{ name: '2019 Yiwu', price: { amount: 1200, currency: 'Yuan', per: 'piece' } }] });
    const a = (await call(viaAgent, 'curate_list_suggestions', {})).waiting[0].teas[0].id;
    await confirm(viaAgent, 'curate_pick_suggestions', { pick: [a], agent: 'GrokBot' });

    const viaApp = makeDb();
    await call(viaApp, 'curate_suggest_teas', { agent: 'GrokBot', from, teas: [{ name: '2019 Yiwu', price: { amount: 1200, currency: 'Yuan', per: 'piece' } }] });
    const b = (await call(viaApp, 'curate_list_suggestions', {})).waiting[0].teas[0].id;
    const out = await pickSuggestions({ DB: viaApp } as any, { accountId: ACCOUNT, userId: 'adrian' }, { pick: [b] });

    expect(out.in_curate).toHaveLength(1);
    expect(shape(viaApp)).toEqual(shape(viaAgent));
  });

  it('markTodoDone ticks a to-do once, only in its own shop', async () => {
    const db = makeDb();
    const added = await call(db, 'curate_todo', { action: 'add', text: 'Ask Wang' });
    expect(await markTodoDone({ DB: db } as any, { accountId: OTHER }, added.todo_id)).toBe(false);
    expect(await markTodoDone({ DB: db } as any, { accountId: ACCOUNT }, added.todo_id)).toBe(true);
    expect(await markTodoDone({ DB: db } as any, { accountId: ACCOUNT }, added.todo_id)).toBe(false);
  });
});

describe('to-dos', () => {
  it('are added, listed as open, and ticked off', async () => {
    const db = makeDb();
    const added = await call(db, 'curate_todo', { action: 'add', text: 'Ask Wang about the 2018', agent: 'Hermes' });
    expect((await call(db, 'curate_whats_missing', {})).todos).toHaveLength(1);
    await call(db, 'curate_todo', { action: 'done', todo_id: added.todo_id });
    expect((await call(db, 'curate_whats_missing', {})).todos).toHaveLength(0);
  });
});

describe('against the live database shape (the migration ledger, including 0031)', () => {
  it('the compass DEFAULT NT is still there, and an agent-added tea never takes it', async () => {
    const db = makeDb('migrations');
    db.sqlite.prepare("INSERT INTO tea_compass_entries (id, user_id, account_id, name) VALUES ('raw', 'adrian', ?, 'raw')").run(ACCOUNT);
    expect((db.sqlite.prepare("SELECT price_currency FROM tea_compass_entries WHERE id = 'raw'").get() as R).price_currency).toBe('NT');
    await confirm(db, 'curate_add_tea', { name: 'Named only' });
    expect((db.sqlite.prepare("SELECT price_currency FROM tea_compass_entries WHERE name = 'Named only'").get() as R).price_currency).toBeNull();
    await call(db, 'curate_suggest_teas', { agent: 'GrokBot', from: { vendor_name: 'V' }, teas: [{ name: 'S' }] });
    const id = (await call(db, 'curate_list_suggestions', {})).waiting[0].teas[0].id;
    await confirm(db, 'curate_pick_suggestions', { pick: [id] });
    expect((db.sqlite.prepare("SELECT price_currency, sample_state FROM tea_compass_entries WHERE name = 'S'").get() as R))
      .toEqual({ price_currency: null, sample_state: 'requested' });
  });
});

describe('the missing list orders by what matters', () => {
  it('cost before origin before the rest', () => {
    expect(teaMissing({ name: 'x' })).toEqual(['cost', 'where it is from', 'who sold it', 'type', 'year']);
    expect(teaMissing({ name: 'pot', category: 'teaware', price_amount: 800, price_currency: 'Yuan', vendor_name: 'W' })).toEqual([]);
  });
});

describe('through the real MCP endpoint, the way an agent reaches it', () => {
  // A made-up bearer for an in-memory database, not a credential.
  const FAKE = 'fake-curate-endpoint-test';

  async function seedBearer(db: SqliteD1, id: string, scopes: string[]) {
    const { sha256Hex } = await import('../src/inquiryDomain');
    db.sqlite.prepare(
      `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier, expires_at)
       VALUES (?, ?, 'adrian', 'adrian@test.dev', 'test', ?, 'fake', ?, 'account_owner', ?)`
    ).run(id, ACCOUNT, await sha256Hex(`${FAKE}-${id}`), JSON.stringify(scopes), Math.floor(Date.now() / 1000) + 3600);
    return `${FAKE}-${id}`;
  }

  /* The live D1 returns a promise from run(); the shim returns a plain object,
     and mcp.ts bumps last_used_at with a floating run().catch(). */
  function asD1(db: SqliteD1) {
    const wrap = (stmt: any): any => ({
      bind: (...v: unknown[]) => wrap(stmt.bind(...v)),
      run: () => Promise.resolve(stmt.run()),
      first: (col?: string) => Promise.resolve(stmt.first(col)),
      all: () => Promise.resolve(stmt.all()),
      raw: stmt,
    });
    return {
      prepare: (sql: string) => wrap(db.prepare(sql)),
      batch: (stmts: any[]) => Promise.resolve(db.batch(stmts.map(s => s.raw))),
    };
  }

  async function rpc(db: SqliteD1, bearer: string, method: string, params: any = {}) {
    const { mcpFetch } = await import('../src/mcp');
    const res = await mcpFetch(new Request('https://api.test/mcp', {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }), { DB: asD1(db) } as any);
    return res.json() as Promise<R>;
  }

  const structured = (out: R) => out.result?.structuredContent ?? JSON.parse(out.result?.content?.[0]?.text ?? '{}');

  it('lists the curate tools, marks the reads read-only, and runs add_tea preview then confirm', async () => {
    const db = makeDb();
    const bearer = await seedBearer(db, 'full', ['inventory:read', 'stock:write']);
    const list = await rpc(db, bearer, 'tools/list');
    const names = list.result.tools.map((t: R) => t.name);
    for (const n of ['curate_find', 'curate_get_tea', 'curate_whats_missing', 'curate_add_tea', 'curate_update_tea', 'curate_save_vendor',
      'curate_suggest_teas', 'curate_list_suggestions', 'curate_pick_suggestions', 'curate_todo']) expect(names).toContain(n);
    expect(list.result.tools.find((t: R) => t.name === 'curate_find').annotations.readOnlyHint).toBe(true);
    expect(list.result.tools.find((t: R) => t.name === 'curate_add_tea').annotations.readOnlyHint).toBe(false);

    const preview = structured(await rpc(db, bearer, 'tools/call', { name: 'curate_add_tea', arguments: { name: 'Endpoint tea', agent: 'Hermes' } }));
    expect(preview.confirmation_token).toBeTruthy();
    const done = structured(await rpc(db, bearer, 'tools/call', { name: 'curate_add_tea', arguments: { name: 'Endpoint tea', confirm: preview.confirmation_token } }));
    expect(done.committed).toBe(true);
    expect(entries(db)[0]).toMatchObject({ name: 'Endpoint tea', user_id: 'adrian' });
  });

  it('a read-only connection can ask what is missing but cannot add a tea', async () => {
    const db = makeDb();
    const bearer = await seedBearer(db, 'ro', ['inventory:read']);
    const missing = await rpc(db, bearer, 'tools/call', { name: 'curate_whats_missing', arguments: {} });
    expect(structured(missing).counts).toBeDefined();
    const refused = await rpc(db, bearer, 'tools/call', { name: 'curate_add_tea', arguments: { name: 'Nope' } });
    expect(JSON.stringify(refused)).toMatch(/scope|stock:write|not allowed|forbidden/i);
    expect(entries(db)).toHaveLength(0);
  });
});
