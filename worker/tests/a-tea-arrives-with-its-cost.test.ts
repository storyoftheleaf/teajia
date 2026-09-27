import { afterEach, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index';
import { mcpFetch } from '../src/mcp';
import { createMissingCost, COST_REQUIRED_ON_CREATE } from '../src/costCurrency';
import { enteredCostCell } from '../../src/admin/productUpdatePayload';
import { rowToStaged, stagedToProduct } from '../../src/admin/lib/intakeMapping';
import { csvRowToProduct, type CsvStagingRow } from '../../src/admin/lib/csvImportRows';
import { compassEntryToProductDraft, createEmptyEntry } from '../../src/components/TeaCompass/types';
import {
  GRADUATION_FALLBACK_CURRENCY, graduationCurrencyDefault, graduationNeedsCost, graduationPayload,
} from '../../src/samples/graduation';
import { plainCostWords } from '../../src/lib/costRefusalWords';
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

/** An empty staged line, so a CSV test names only the cells it is about. */
const BLANK_CSV_ROW: CsvStagingRow = {
  id: '', type: '', givenName: '', chineseName: '', productName: '', form: '', year: '',
  grams: '', costAmount: '', currency: '', stockAmount: '', vendor: '', originCountry: '',
  originRegion: '', status: 'Draft', isPersonal: false, purpose: 'working', canReorder: false,
  description: '', lore: '', tastingNotes: '', processingNotes: '', terroir: '', mood: '',
  experience: '', material: '', capacityMl: '', teawareCategory: '', quantityUnits: '',
  isValid: true, errors: [],
};

describe('why the rule has to exist', () => {
  it('the LIVE table answers a cost nobody sent with zero, and a currency with dollars', () => {
    /* Measured, not quoted. The rest of this file drives the doors against
       `worker/schema.sql`, which is what `SqliteD1` loads; this one asks the
       migration ledger the live database was actually built from, because the
       two are known to disagree elsewhere and the whole premise of the rule is
       what the column does when nobody names it.
       Both halves are here: zero is not "unknown", it is FREE, and `'USD'` on a
       row nobody asked is a guess worth whatever the exchange rate is. */
    const live = new DatabaseSync(':memory:');
    try {
      live.exec(readFileSync(here('../migrations/0000_initial_schema.sql'), 'utf8'));
      live.exec(`INSERT INTO products (id, account_id, type, product_name, given_name, origin_country)
                 VALUES ('silent-row', 'account-a', 'Oolong', 'Nobody Said', 'Nobody Said', 'Unknown')`);
      const row = live.prepare('SELECT cost_amount, cost_currency FROM products WHERE id = ?').get('silent-row') as any;
      expect(row.cost_amount).toBe(0);
      expect(row.cost_currency).toBe('USD');
    } finally {
      live.close();
    }
  });
});

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
      product_name: 'Agent Nameless', type: 'Sheng', cost_currency: 'HKD', stock_grams: 357,
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
      product_name: 'Agent Blank', type: 'Sheng', cost_amount: '', cost_currency: 'HKD', stock_grams: 357,
    });
    expect(rpc.result, 'a blank cost was read as a free tea').toBeUndefined();
    expect(rpc.error.message).toContain('missing: amount');
    expect(productRow(db, 'Agent Blank')).toBeUndefined();
  });

  it('the agent door keeps a deliberate zero', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const args = {
      product_name: 'Agent Gift', type: 'Sheng', cost_amount: 0, cost_currency: 'HKD', stock_grams: 100,
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

  it('the bulk create refuses an unstated CURRENCY per row too, not per request', async () => {
    /* Half the rule was still asked of the whole request. `costMissingItsCurrency`
       sat in the capability check, above the loop, so one row whose currency the
       import could not read refused the file entire and landed NOTHING, saying
       only that a cost needs a currency. That row is not hypothetical: the CSV
       import writes `UNK` for any token its map does not recognise, which is
       what an unstated currency looks like on the wire. */
    const db = database();
    const response = await post(db, '/api/products/bulk', {
      products: [
        { client_row_id: 'r1', product_name: 'Stated Currency', type: 'Oolong', cost_amount: 480, cost_currency: 'HKD', stock_grams: 100 },
        { client_row_id: 'r2', product_name: 'Unstated Currency', type: 'Oolong', cost_amount: 480, cost_currency: 'UNK', stock_grams: 100 },
      ],
    });
    expect(response.status, 'one unreadable currency cell refused the whole file').toBe(200);
    const body = await response.json() as any;

    expect(body.inserted).toBe(1);
    expect(body.skipped).toBe(1);
    const refused = body.results.find((row: any) => row.client_row_id === 'r2');
    expect(refused.status).toBe('skipped');
    expect(refused.reason, 'the refusal did not say WHICH half was missing').toContain('missing: currency');

    expect(productRow(db, 'Stated Currency')).toMatchObject({ cost_amount: 480, cost_currency: 'HKD' });
    expect(productRow(db, 'Unstated Currency'), 'a cost with no unit landed anyway').toBeUndefined();
  });

  it('the single create still refuses the whole request, and names the same half', async () => {
    /* There a request IS one tea, so there is nothing to save by refusing part
       of it. Same rule, same words, same named half. */
    const db = database();
    const response = await post(db, '/api/products', {
      product_name: 'Lone Unstated', type: 'Oolong', cost_amount: 480, cost_currency: 'UNK', stock_grams: 100,
    });
    expect(response.status).toBe(400);
    const body = await response.json() as any;
    expect(body.code).toBe('cost_currency_required');
    expect(body.details.missing).toBe('currency');
    expect(productRow(db, 'Lone Unstated')).toBeUndefined();
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
    /* The guard is the gate on the whole computation: no stated currency, or
       no grams to divide the batch total by, and costUsd stays null. The
       per-gram half is driven, not scanned, in mcp-margin-warning-per-gram. */
    expect(mcp).toMatch(/if \(currencyStated\(newCostCurrency\) && newQuantity > 0\)/);
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
       nothing, and the create then had a well formed zero to agree with.

       The entry's own currency travels as it stands and WITHOUT a fallback,
       which is deliberate rather than an oversight: it is chosen in a picker
       sitting immediately left of the price input on the capture card, so an
       operator typing a price sees the unit they are typing it in. A fallback
       here would be a currency chosen where nobody can see it. */
    const entry = createEmptyEntry('tea');
    entry.name = 'Scouted Tea';
    const draft = compassEntryToProductDraft(entry as any);
    expect(draft.cost_amount, 'an unpriced compass entry became a free tea').toBeNull();

    const priced = createEmptyEntry('tea');
    priced.name = 'Bought Tea';
    (priced as any).priceAmount = 1200;
    // Setting the field is not the same as choosing it: the currency only
    // travels once `touchedFields` says the operator actually picked it,
    // the same "inherited defaults never become content" rule the prompt
    // default already follows (see `graduationCurrencyDefault` below). An
    // untouched currency used to travel unconditionally, which is how an
    // inherited default got stamped `cost_currency_source: 'stated'` on the
    // server and excluded from `list_unstated_costs` for good.
    (priced as any).priceCurrency = 'Yuan';
    priced.touchedFields = ['priceAmount', 'priceCurrency'];
    const pricedDraft = compassEntryToProductDraft(priced as any);
    expect(pricedDraft.cost_amount).toBe(1200);
    expect(pricedDraft.cost_currency).toBe('Yuan');

    // The same figure, untouched, sends no currency at all: the server's own
    // refusal does the asking rather than an inherited default being recorded
    // as though it were a decision.
    const untouched = createEmptyEntry('tea');
    untouched.name = 'Bought Tea, currency never touched';
    (untouched as any).priceAmount = 1200;
    (untouched as any).priceCurrency = 'Yuan';
    expect(compassEntryToProductDraft(untouched as any).cost_currency).toBeUndefined();
  });

  it('the CSV import sends a blank price cell as nothing said, and a typed zero as zero', () => {
    /* Driven, not scanned. This used to be three regexes against
       `CsvImportModal.tsx`, and the reviewer showed what that was worth:
       appending `?? 0` to the cost reader put every blank price cell back to a
       free tea and left all twenty-five tests green. The conversion is now its
       own exported function, so the question can be asked directly. */
    const cell = (costAmount: string) => csvRowToProduct({
      ...BLANK_CSV_ROW, id: 'row-1', type: 'Oolong', productName: 'Sheet Tea',
      costAmount, currency: 'HKD', stockAmount: '100', grams: '100',
    });

    expect(Object.prototype.hasOwnProperty.call(cell(''), 'cost_amount'),
      'a blank price cell travelled as a figure').toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cell('unknown'), 'cost_amount'),
      'a cell saying nobody knows travelled as a figure').toBe(false);
    // A gift is a real tea, and typing 0 says so.
    expect(cell('0').cost_amount).toBe(0);
    expect(cell('12.5').cost_amount).toBe(12.5);
    // Hand-typed cells: currency symbol, thousands separator, two bags on one line.
    expect(cell('HK$1,200').cost_amount).toBe(1200);
    expect(cell('4+8').cost_amount).toBe(12);
  });

  it('the CSV import writes UNK for a currency it cannot read, which is refused per row', () => {
    /* `UNK` is the sentinel for a currency nobody recorded, so the row is
       refused, by name, on its own. It used to fail the whole request. */
    const row = csvRowToProduct({
      ...BLANK_CSV_ROW, id: 'row-2', type: 'Oolong', productName: 'Odd Currency',
      costAmount: '480', currency: 'Galleons', stockAmount: '100', grams: '100',
    });
    expect(row.cost_currency).toBe('UNK');
    expect(createMissingCost({ amount: row.cost_amount, currency: row.cost_currency })).toBe('currency');
  });

  it('the sample graduation asks for the cost, and sends what was answered', () => {
    /* `cost_amount: 0, cost_currency: 'NT'` was two inventions at once: a free
       tea priced in Taiwan dollars nobody chose, sold at zero times three.
       Sending nothing instead is honest and the server refuses it by name,
       which on its own would make EVERY graduation fail, so the screen asks. */
    const sample = { id: 's1', name: 'Envelope Sample', setId: 'set-1' } as any;

    const blank = createEmptyEntry('tea');
    expect(graduationNeedsCost(blank), 'a sample with no recorded price was graduated unasked').toBe(true);
    expect(graduationNeedsCost(null), 'a sample with no entry at all was graduated unasked').toBe(true);

    // Asked and answered: the figure travels, zero included.
    expect(graduationPayload(sample, blank, { amount: 480, currency: 'Yuan' }))
      .toMatchObject({ cost_amount: 480, cost_currency: 'Yuan' });
    expect(graduationPayload(sample, blank, { amount: 0, currency: 'Yuan' }))
      .toMatchObject({ cost_amount: 0, cost_currency: 'Yuan' });
    expect(graduationPayload(sample, null, { amount: 0, currency: 'Yuan' }))
      .toMatchObject({ cost_amount: 0, cost_currency: 'Yuan' });

    // Unanswered stays absent, so the server refuses rather than storing free.
    expect(graduationPayload(sample, blank, { amount: null, currency: 'Yuan' }).cost_amount).toBeNull();
    expect(createMissingCost({
      amount: graduationPayload(sample, blank, null).cost_amount,
      currency: graduationPayload(sample, blank, null).cost_currency,
    })).toBe('amount');
  });

  it('the graduation prompt is skipped when the capture card already holds the price', () => {
    /* Asking again for a figure already on screen is the system failing to know
       what it knows, which is the same fault in the other direction. */
    const priced = createEmptyEntry('tea');
    (priced as any).priceAmount = 1200;
    expect(graduationNeedsCost(priced)).toBe(false);

    const bought = createEmptyEntry('tea');
    (bought as any).buyTotal = 3400;
    expect(graduationNeedsCost(bought)).toBe(false);

    // And a recorded price is never overwritten by a prompt that did not run.
    const sample = { id: 's2', name: 'Priced Sample', setId: 'set-1' } as any;
    expect(graduationPayload(sample, priced, null).cost_amount).toBe(1200);
  });

  it('the graduation prompt opens on Yuan unless a currency was actually chosen', () => {
    /* `createEmptyEntry` stamps every entry with the shelf's own default
       (Yuan, Adrian's rule of 2026-09-07 that the shelf is bought in China),
       so the stored value alone still cannot tell a choice from a default,
       and a sample added in the samples screen never passes the capture
       card's currency picker. `touchedFields` is this codebase's own answer
       to that question. */
    const inherited = createEmptyEntry('tea');
    expect(inherited.priceCurrency).toBe('Yuan');
    expect(graduationCurrencyDefault(inherited), 'an inherited default was presented as a decision')
      .toBe(GRADUATION_FALLBACK_CURRENCY);
    expect(GRADUATION_FALLBACK_CURRENCY).toBe('Yuan');

    const chosen = createEmptyEntry('tea');
    chosen.touchedFields = ['priceCurrency'];
    (chosen as any).priceCurrency = 'HKD';
    expect(graduationCurrencyDefault(chosen)).toBe('HKD');
  });

  it('a refusal reaches the screen in words, never in column names', () => {
    /* The server answers in the vocabulary of two pieces of code talking, which
       is right there and wrong on a screen: it hands Adrian the bug report
       instead of the thing to do next. Which half is missing is a fact only the
       server has, so the server's string stays the source of truth and this is
       where it becomes a sentence. */
    const amountRefusal = `${COST_REQUIRED_ON_CREATE} (missing: amount)`;
    const currencyRefusal = 'A cost needs the currency it was paid in. Send cost_currency alongside cost_amount. (missing: currency)';

    for (const said of [amountRefusal, currencyRefusal]) {
      const words = plainCostWords(said);
      expect(words, `an identifier reached the screen: ${words}`).not.toMatch(/cost_amount|cost_currency|missing:/);
      expect(words.length, 'the refusal said nothing').toBeGreaterThan(0);
    }
    // Each names its own half, and says what to do next.
    expect(plainCostWords(amountRefusal)).toMatch(/gift/);
    expect(plainCostWords(currencyRefusal)).toMatch(/currency/i);
    expect(plainCostWords(currencyRefusal)).not.toMatch(/gift/);
    // Anything that is not a cost refusal passes through as it was written.
    expect(plainCostWords('A product with this type and name already exists'))
      .toBe('A product with this type and name already exists');
  });

  it('the form Adrian types into does not turn a blank cost into zero on its way to the wire', () => {
    /* A SCAN, not coverage. The Add Product form builds its payload inside its
       own submit handler with no seam to call, and extracting one is a change
       to a screen this item was not sent to touch. Read it as "the source still
       says the right thing", which is all a scan can ever mean: it cannot fail
       for a behaviour, only for a rewording. The behaviour it stands in for is
       covered where the same rule is driven, in `enteredNumber` above and at
       the REST door. */
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
