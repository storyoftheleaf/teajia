import { afterEach, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import worker from '../src/index';
import { mcpFetch } from '../src/mcp';
import { createMissingCost, COST_REQUIRED_ON_CREATE } from '../src/costCurrency';
import { enteredCostCell } from '../../src/admin/productUpdatePayload';
import { rowToStaged, stagedToProduct } from '../../src/admin/lib/intakeMapping';
import { compassEntryToProductDraft, createEmptyEntry } from '../../src/components/TeaCompass/types';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * A tea is not added without saying what it cost.
 *
 * `cost_amount` is `REAL DEFAULT 0`. So a create that simply does not mention
 * the column does not fail: it stores ZERO, and zero is not "unknown", it is a
 * free tea. The shelf then prices it at zero times three and prints $0.00. A
 * missing cost looks exactly like a cheap tea, which is why the identical shape
 * ran unnoticed on freight until it had cost real money.
 *
 * Adrian's rule: the price is not optional when a tea is added, and the agent
 * door does not get a lesser requirement than the one with a form and somebody
 * watching. WHAT IS REFUSED IS ABSENCE, NOT ZERO. A tea that cost nothing is a
 * real thing: a gift, a vendor's sample. Typing 0 says so and is kept. That is
 * the same rule `enteredNumber()` enforces on every edit, applied at the one
 * moment a row comes into being.
 *
 * TWO ROUNDS OF DOORS, and the second is why this file now drives the code
 * instead of reading it. The first round was server side: the Add Product form,
 * `create_tea`, the listing mirror and three intake doors. The second round was
 * the browsers'. The CSV import, the spreadsheet intake, the sample graduation
 * and the compass promotion each turned a blank price into 0 BEFORE the request
 * left the page, so `createMissingCost` was handed a well formed zero, agreed
 * that a zero needs no unit, and waved it through. The guard was intact and
 * blind, and the audit reproduced it end to end: a row with an empty price cell
 * and a currency of HKD landed with `cost_amount` 0 and priced at zero.
 *
 * And this file could not have caught the guard being deleted. Every assertion
 * about `create_tea` matched TEXT in `mcp.ts`, so removing the `throw` left all
 * seventeen green, and so did the other 1,407 tests in the suite. A guard that
 * reads the source can only tell you the source still says the right thing. The
 * refusals below are now driven through the running code: the REST create, the
 * bulk create and the agent door are each called with a cost nobody entered and
 * each has to say no, and called with a deliberate 0 and each has to say yes.
 */

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(here(rel), 'utf8');
/* Comments are stripped before any scan below. A guard that reads its own
   explanation is a guard that can only be satisfied by deleting the reason the
   rule exists, and the comment quoting `Number(args?.cost_amount ?? 0)` is
   exactly the note a future reader needs most. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
const worker_ = stripComments(read('../src/index.ts'));
const mcp = stripComments(read('../src/mcp.ts'));

const SECRET = 'a-tea-arrives-secret';
const TOKEN = 'tea_arrives_with_its_cost_token';
const ACCOUNT = 'account-a';
const OWNER = 'account-owner';

const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function database() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  return db;
}

/* mcp.ts fires its last_used_at update without awaiting it, so the D1 it is
   handed has to return promises the way the real one does. */
class AsyncD1 {
  constructor(readonly inner: SqliteD1) {}
  prepare(sql: string) {
    const inner = this.inner.prepare(sql);
    const statement: any = {
      inner,
      bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
      first: async () => inner.first(),
      all: async () => inner.all(),
      run: async () => inner.run(),
    };
    return statement;
  }
  batch(statements: any[]) { return this.inner.batch(statements.map(s => s.inner)); }
}

const tokenHash = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');

async function ownerToken() {
  return signedToken(SECRET, {
    sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
    active_account_id: ACCOUNT, platform_role: null,
  });
}

async function post(db: SqliteD1, path: string, body: unknown) {
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: 'POST',
    headers: new Headers({
      Authorization: `Bearer ${await ownerToken()}`,
      'X-Teajia-Account': ACCOUNT,
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

async function mintMcpToken(db: SqliteD1, scopes: string[]) {
  db.sqlite.prepare(`INSERT OR REPLACE INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
    VALUES ('tok-arrives',?,?,?,'arrives',?,?,?,'account_owner')`)
    .run(ACCOUNT, OWNER, `${OWNER}@test.dev`, await tokenHash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(scopes));
}

/** The JSON-RPC envelope, so a refusal (which arrives as an error) is readable. */
async function callTool(db: SqliteD1, name: string, args: Record<string, unknown>) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: new AsyncD1(db) as any } as any);
  return await response.json() as any;
}

const toolPayload = (rpc: any) => JSON.parse(rpc.result.content[0].text);

const productRow = (db: SqliteD1, name: string) => db.sqlite.prepare(
  'SELECT id, cost_amount, cost_currency FROM products WHERE product_name = ?'
).get(name) as any;

describe('the rule itself', () => {
  it('refuses a cost nobody entered', () => {
    for (const amount of [undefined, null, '', '   ', 'abc', NaN]) {
      expect(createMissingCost({ amount, currency: 'Yuan' }), `${String(amount)} passed`).toBe('amount');
    }
  });

  it('keeps a deliberate zero, because a gift is a real tea', () => {
    expect(createMissingCost({ amount: 0, currency: 'Yuan' })).toBeNull();
    expect(createMissingCost({ amount: '0', currency: 'Yuan' })).toBeNull();
  });

  it('refuses a cost with no currency, since a number without its unit is not a cost', () => {
    expect(createMissingCost({ amount: 120, currency: undefined })).toBe('currency');
    expect(createMissingCost({ amount: 120, currency: '' })).toBe('currency');
    // 'UNK' is this shop's sentinel for a currency nobody recorded.
    expect(createMissingCost({ amount: 120, currency: 'UNK' })).toBe('currency');
  });

  it('names which half is missing, so the caller is not left guessing', () => {
    expect(createMissingCost({ amount: undefined, currency: undefined })).toBe('amount');
    expect(COST_REQUIRED_ON_CREATE).toMatch(/cost_amount/);
    expect(COST_REQUIRED_ON_CREATE).toMatch(/cost_currency/);
  });
});

describe('every door that adds a tea is driven, not read', () => {
  it('the REST create refuses a tea whose cost nobody named', async () => {
    const db = database();
    const response = await post(db, '/api/products', {
      product_name: 'Nameless Cost', type: 'Oolong', cost_currency: 'HKD', stock_grams: 100,
    });
    expect(response.status).toBe(400);
    const body = await response.json() as any;
    expect(body.code).toBe('cost_required');
    expect(body.details.missing).toBe('amount');
    expect(productRow(db, 'Nameless Cost')).toBeUndefined();
  });

  it('the REST create keeps a deliberate zero, because a vendor sample is a real tea', async () => {
    const db = database();
    const response = await post(db, '/api/products', {
      product_name: 'Free Sample', type: 'Oolong', cost_amount: 0, cost_currency: 'HKD', stock_grams: 20,
    });
    expect(response.status).toBe(201);
    expect(productRow(db, 'Free Sample')).toMatchObject({ cost_amount: 0, cost_currency: 'HKD' });
  });

  it('the agent door refuses it too, having no form and nobody watching', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const rpc = await callTool(db, 'create_tea', {
      product_name: 'Agent Nameless', type: 'Pu-erh', cost_currency: 'HKD', stock_grams: 357,
    });
    expect(rpc.result, 'create_tea accepted a tea with no cost').toBeUndefined();
    expect(rpc.error.message).toContain('cost_amount');
    expect(rpc.error.message).toContain('missing: amount');
    expect(productRow(db, 'Agent Nameless')).toBeUndefined();
  });

  it('the agent door asks the raw argument, so a blank cannot pass as a zero', async () => {
    /* The ordering used to be the bug. `Number(args?.cost_amount ?? 0) || 0`
       ran first, so the guard was handed a 0 and could not tell it from an
       answer. An empty string is the shape a form sends when nobody typed:
       `Number('')` is 0, so this passes only if the coercion has crept back
       above the guard. */
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const rpc = await callTool(db, 'create_tea', {
      product_name: 'Agent Blank', type: 'Pu-erh', cost_amount: '', cost_currency: 'HKD', stock_grams: 357,
    });
    expect(rpc.result, 'a blank cost was read as a free tea').toBeUndefined();
    expect(rpc.error.message).toContain('missing: amount');
    expect(productRow(db, 'Agent Blank')).toBeUndefined();
  });

  it('the agent door keeps a deliberate zero', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const args = {
      product_name: 'Agent Gift', type: 'Pu-erh', cost_amount: 0, cost_currency: 'HKD', stock_grams: 100,
    };
    const preview = toolPayload(await callTool(db, 'create_tea', args));
    const committed = toolPayload(await callTool(db, 'create_tea', { ...args, confirm: preview.confirmation_token }));
    expect(committed.committed).toBe(true);
    expect(productRow(db, 'Agent Gift')).toMatchObject({ cost_amount: 0, cost_currency: 'HKD' });
  });

  it('the bulk create refuses the ROW, and the rest of the spreadsheet lands', async () => {
    /* A file is many teas. Refusing the request over one empty price cell would
       throw away every complete row in it, and the import screens carry a
       per-row reason back to the review surface, so the operator is told which
       lines still need a figure and imports the rest. */
    const db = database();
    const response = await post(db, '/api/products/bulk', {
      products: [
        { client_row_id: 'r1', product_name: 'Priced Row', type: 'Oolong', cost_amount: 480, cost_currency: 'HKD', stock_grams: 100 },
        { client_row_id: 'r2', product_name: 'Blank Row', type: 'Oolong', cost_currency: 'HKD', stock_grams: 100 },
      ],
    });
    expect(response.status).toBe(200);
    const body = await response.json() as any;

    expect(body.inserted).toBe(1);
    expect(body.skipped).toBe(1);
    const refused = body.results.find((row: any) => row.client_row_id === 'r2');
    expect(refused.status).toBe('skipped');
    expect(refused.reason).toContain('cost_amount');
    expect(refused.reason).toContain('missing: amount');

    expect(productRow(db, 'Priced Row')).toMatchObject({ cost_amount: 480 });
    expect(productRow(db, 'Blank Row'), 'a row with no cost landed anyway').toBeUndefined();
  });

  it('a refused row does not hold its name against a later row that does say', async () => {
    /* The name is claimed to stop one file inserting the same tea twice. A row
       that never lands must not do the claiming, or the operator who fixes the
       price on the line below is told it is a duplicate of a tea that is not
       there. */
    const db = database();
    const response = await post(db, '/api/products/bulk', {
      products: [
        { client_row_id: 'r1', product_name: 'Same Tea', type: 'Oolong', cost_currency: 'HKD', stock_grams: 100 },
        { client_row_id: 'r2', product_name: 'Same Tea', type: 'Oolong', cost_amount: 480, cost_currency: 'HKD', stock_grams: 100 },
      ],
    });
    const body = await response.json() as any;
    expect(body.inserted).toBe(1);
    expect(productRow(db, 'Same Tea')).toMatchObject({ cost_amount: 480 });
  });

  it('the tool schema says the cost is required and offers no default currency', () => {
    const def = mcp.slice(mcp.indexOf("name: 'create_tea'"));
    const schema = def.slice(0, def.indexOf('\n  },'));
    expect(schema).toMatch(/required: \[[^\]]*'cost_amount'[^\]]*\]/);
    expect(schema).toMatch(/required: \[[^\]]*'cost_currency'[^\]]*\]/);
    /* A schema that advertises `default: 'USD'` on the currency is the model
       being TOLD to assume dollars, which is worse than it guessing. */
    expect(schema).not.toMatch(/cost_currency:\s*\{[^}]*default:/);
  });
});

describe('a door that cannot know the cost says so, rather than letting the default say free', () => {
  /*
   * These three land teas whose cost this shop genuinely does not have: a
   * receipt proposal, someone else's tea stored at Adrian's location, and a
   * tea imported from another shop's catalogue (whose cost is theirs, not his,
   * and is protected besides). Requiring them to invent a cost would be worse
   * than the bug. What they must not do is stay silent, because silence is
   * answered by `DEFAULT 0`, and 0 reads as free.
   */
  it('the receipt proposal names the column as NULL', () => {
    const door = worker_.slice(worker_.indexOf('handleAcceptReceiptProposal'));
    const insert = door.slice(door.indexOf('INSERT INTO products'), door.indexOf('INSERT INTO products') + 700);
    expect(insert, 'the insert stopped naming cost_amount, so the default answers again')
      .toMatch(/cost_amount/);
  });

  it('the cellar placement states a null cost in its body', () => {
    const door = worker_.slice(worker_.indexOf('handleApproveCellarPlacement'));
    expect(door.slice(0, 3000)).toMatch(/cost_amount: null/);
  });

  it('the inbound import states a null cost rather than omitting the column', () => {
    const door = worker_.slice(worker_.indexOf('const COPY_COLS'));
    expect(door.slice(0, 2000)).toMatch(/'cost_amount'/);
  });

  it('the compass promotion carries the entry price or nothing, never a zero or a dollar', () => {
    /* A tea Adrian scouted without a price became a tea that cost nothing:
       `Number(entry.price_amount ?? 0) || 0`. And `entry.price_currency ?? 'USD'`
       answered a missing unit with a guess, on a column that is itself
       `DEFAULT 'NT'`, so its silence was never evidence of anything. Both
       halves travel together or neither does: an amount with no currency is
       not a cost, and storing one would be read at a rate of 1. */
    const door = worker_.slice(worker_.indexOf('handlePromoteCompassEntry'));
    const body = door.slice(0, 4000);
    expect(body).not.toMatch(/Number\(entry\.price_amount \?\? 0\)/);
    expect(body).not.toMatch(/entry\.price_currency \?\? 'USD'/);
    expect(body).toMatch(/currencyStated\(entry\.price_currency\)/);
    expect(body).toMatch(/cost_amount: null, cost_currency: null/);
  });

  it('the margin warning declines rather than assume dollars', () => {
    /* A warning computed from a guessed currency is a confident number about
       money that is wrong by whatever the rate is. The block already declines
       when there is no rate; an unstated currency is the same case earlier. */
    expect(mcp).not.toMatch(/product\.cost_currency \?\? 'USD'/);
    expect(mcp).toMatch(/if \(!currencyStated\(newCostCurrency\)\)/);
  });

  it('the listing mirror copies what it was given instead of inventing a cost or a currency', () => {
    expect(worker_).not.toMatch(/body\.cost_amount \?\? 0/);
    expect(worker_).not.toMatch(/body\.cost_currency \?\? 'USD'/);
  });
});

describe('the browser doors, where a blank became a zero before the request left the page', () => {
  it('reads a cell nobody filled in as nothing said', () => {
    for (const nothing of ['', '   ', 'unknown', 'Unknown', 'n/a', '-', 'nan', 'null', null, undefined]) {
      expect(enteredCostCell(nothing), `${String(nothing)} was read as a number`).toBeNull();
    }
    // Not a number at all is a typo, not an answer.
    expect(enteredCostCell('abc')).toBeNull();
  });

  it('reads a typed zero as zero, and a written price as itself', () => {
    expect(enteredCostCell(0)).toBe(0);
    expect(enteredCostCell('0')).toBe(0);
    // A hand-typed cell: currency symbol, thousands separator, estimate mark,
    // and two bags on one line.
    expect(enteredCostCell('NT$300')).toBe(300);
    expect(enteredCostCell('2,100')).toBe(2100);
    expect(enteredCostCell('~235')).toBe(235);
    expect(enteredCostCell('4+8')).toBe(12);
  });

  it('the spreadsheet intake carries a blank price cell through as nothing said', () => {
    /* Driven end to end through the two functions the intake screen uses, the
       cell reader and the payload builder, because the bug can live in either:
       reading '' as 0, or adding the freight share to a cost nobody recorded. */
    const mapping = {
      'Product': 'product_name', 'Type': 'type',
      'Unit Price (HK$)': 'cost_amount', 'Stock': 'stock_grams',
    };
    const staged = (price: string, index: number) => rowToStaged(
      { Product: 'Sheet Tea', Type: 'Oolong', 'Unit Price (HK$)': price, Stock: '100' },
      mapping as any, 'file-1', index, false,
    );

    const blank = staged('', 0);
    expect(blank.costAmount, 'a blank price cell became a free tea').toBeNull();
    const blankPayload = stagedToProduct(blank, 12);
    expect(Object.prototype.hasOwnProperty.call(blankPayload, 'cost_amount'),
      'a cost nobody recorded still travelled, with the freight share added to it').toBe(false);

    // A written price keeps its freight share, which is what landed cost means.
    const priced = staged('480', 1);
    expect(priced.costAmount).toBe(480);
    expect(stagedToProduct(priced, 12).cost_amount).toBe(492);

    // And a typed zero is a vendor's gift, which survives every step.
    const free = staged('0', 2);
    expect(free.costAmount, 'a typed zero was read as nothing said').toBe(0);
    expect(stagedToProduct(free, 0).cost_amount).toBe(0);
  });

  it('the compass promotion sends no cost when the entry recorded no price', () => {
    /* `?? 0` turned a tea Adrian scouted without a price into a tea that cost
       nothing, and the create then had a well formed zero to agree with. The
       entry's own currency travels as it stands, because that field is on the
       capture form in front of him; what the promotion may not do is supply one
       for an entry that carries none. */
    const entry = createEmptyEntry('tea');
    entry.name = 'Scouted Tea';
    const draft = compassEntryToProductDraft(entry as any);
    expect(draft.cost_amount, 'an unpriced compass entry became a free tea').toBeNull();

    const cleared = createEmptyEntry('tea');
    cleared.name = 'No Currency';
    (cleared as any).priceAmount = 1200;
    (cleared as any).priceCurrency = '';
    expect(compassEntryToProductDraft(cleared as any).cost_currency,
      'an entry with no currency had one invented for it').toBeNull();

    const priced = createEmptyEntry('tea');
    priced.name = 'Bought Tea';
    (priced as any).priceAmount = 1200;
    (priced as any).priceCurrency = 'Yuan';
    const pricedDraft = compassEntryToProductDraft(priced as any);
    expect(pricedDraft.cost_amount).toBe(1200);
    expect(pricedDraft.cost_currency).toBe('Yuan');
  });

  it('the CSV import reads its price cell with the shared rule, not with `|| 0`', () => {
    /* No exported seam to drive: the row is built inside the component. The
       scan is for the one expression that carried the bug. */
    const modal = stripComments(read('../../src/admin/components/CsvImportModal.tsx'));
    expect(modal).not.toMatch(/const cost = parseNum\(/);
    expect(modal).toMatch(/const cost = enteredCostCell\(r\.costAmount\)/);
    expect(modal).toMatch(/cost_amount: cost,/);
  });

  it('the sample graduation states no cost rather than a zero and a guessed currency', () => {
    /* A sample record carries a name, a weight and a source, and nothing about
       what was paid, so `cost_amount: 0, cost_currency: 'NT'` was two
       inventions: a free tea, priced in Taiwan dollars nobody had chosen. The
       path that works is the compass entry, whose recorded price comes through
       `compassEntryToProductDraft` above. */
    const creator = stripComments(read('../../src/samples/SampleSetCreator.tsx'));
    expect(creator).not.toMatch(/cost_amount: 0/);
    expect(creator).not.toMatch(/cost_currency: 'NT'/);
  });

  it('the form Adrian types into does not turn a blank cost into zero on its way to the wire', () => {
    // `parseFloat('')` is NaN and `NaN || 0` is 0, which is the whole bug.
    const form = stripComments(read('../../src/admin/components/AddProductModal.tsx'));
    expect(form).not.toMatch(/cost_amount: parseFloat\([^)]*\) \|\| 0/);
    expect(form).toMatch(/cost_amount: enteredNumber\(formData\.costAmount\)/);
    // Refused at submit, not only at the server, so the refusal lands on the
    // field instead of as an error toast.
    expect(form).toMatch(/formData\.costAmount\.trim\(\) === ''/);
    const input = form.slice(form.indexOf('id="product-cost-input"'));
    expect(input.slice(0, 900)).not.toMatch(/placeholder="0\.00"/);
  });
});
