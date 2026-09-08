import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../src/index';
import { mcpFetch } from '../src/mcp';
import { costCurrencySourceFor, stampCostCurrencySource } from '../src/costCurrency';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * A currency somebody stated is marked as stated, at every door, on both tables.
 *
 * `cost_currency` carries `DEFAULT 'USD'`, so a row that never stated one and a
 * row that chose dollars are the same three letters. Migration 0014 added
 * `cost_currency_source` to make the difference legible going forward: what
 * stays NULL is the backlog, and `list_unstated_costs` reports it so
 * `set_cost_currency` can work it off one vendor at a time.
 *
 * That only holds if EVERY door stamps. Two did. The bulk create and the agent
 * door wrote a currency the caller had stated and left the column NULL, and
 * both listing mirrors did the same even behind the doors that stamped, so a
 * tea imported with a correctly stated HKD cost appeared in the backlog with
 * `stored_currency_was_stated: false`. A vendor-wide answer of yuan would then
 * have overwritten a currency somebody chose, and the ×3 carries a currency
 * change straight to the shelf. The rule is written down in CLAUDE.md, under
 * "A number without its unit is not a number".
 *
 * What is NOT stamped matters just as much. Three intake doors land teas whose
 * cost this shop genuinely does not know, and the compass promotion carries a
 * currency out of a row that is itself `DEFAULT 'NT'`. None of them is Adrian
 * answering the question, so all of them stay in the backlog.
 */

const SECRET = 'stated-currency-secret';
const TOKEN = 'tea_stated_currency_token';
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

async function post(db: SqliteD1, path: string, body: unknown) {
  const token = await signedToken(SECRET, {
    sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
    active_account_id: ACCOUNT, platform_role: null,
  });
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: 'POST',
    headers: new Headers({
      Authorization: `Bearer ${token}`,
      'X-Teajia-Account': ACCOUNT,
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

async function mintMcpToken(db: SqliteD1, scopes: string[]) {
  db.sqlite.prepare(`INSERT OR REPLACE INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
    VALUES ('tok-stated',?,?,?,'stated',?,?,?,'account_owner')`)
    .run(ACCOUNT, OWNER, `${OWNER}@test.dev`, await tokenHash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(scopes));
}

async function callTool(db: SqliteD1, name: string, args: Record<string, unknown>) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: new AsyncD1(db) as any } as any);
  const rpc = await response.json() as any;
  return JSON.parse(rpc.result.content[0].text);
}

const productRow = (db: SqliteD1, name: string) => db.sqlite.prepare(
  'SELECT id, cost_currency, cost_currency_source FROM products WHERE product_name = ?'
).get(name) as any;

const listingRow = (db: SqliteD1, productId: string) => db.sqlite.prepare(
  'SELECT cost_currency, cost_currency_source FROM product_listings WHERE legacy_product_id = ?'
).get(productId) as any;

describe('the rule itself', () => {
  it('marks a currency somebody stated, and nothing else', () => {
    expect(costCurrencySourceFor('HKD')).toBe('stated');
    expect(costCurrencySourceFor('Yuan')).toBe('stated');
    for (const nothing of [undefined, null, '', '   ', 123]) {
      expect(costCurrencySourceFor(nothing), `${String(nothing)} was marked stated`).toBeNull();
    }
    // 'UNK' is this shop's sentinel for a currency nobody recorded.
    expect(costCurrencySourceFor('UNK')).toBeNull();
    expect(costCurrencySourceFor('unk')).toBeNull();
  });

  it('drops a provenance the caller sent, because provenance a caller can set is not provenance', () => {
    const body: Record<string, unknown> = { cost_currency: 'HKD', cost_currency_source: 'recovered' };
    stampCostCurrencySource(body);
    expect(body.cost_currency_source).toBe('stated');

    const unstated: Record<string, unknown> = { cost_currency_source: 'stated' };
    stampCostCurrencySource(unstated);
    expect(unstated.cost_currency_source).toBeUndefined();
  });
});

describe('every door that states a currency marks it, on the product and on its listing', () => {
  it('the single REST create', async () => {
    const db = database();
    const response = await post(db, '/api/products', {
      product_name: 'Single Shou', type: 'Pu-erh',
      cost_amount: 900, cost_currency: 'HKD', stock_grams: 100,
    });
    expect(response.status).toBe(201);

    const product = productRow(db, 'Single Shou');
    expect(product).toMatchObject({ cost_currency: 'HKD', cost_currency_source: 'stated' });
    expect(listingRow(db, product.id)).toEqual({ cost_currency: 'HKD', cost_currency_source: 'stated' });
  });

  it('the bulk create, which is how a CSV or xlsx import lands', async () => {
    const db = database();
    const response = await post(db, '/api/products/bulk', {
      products: [{
        product_name: 'Bulk Oolong', type: 'Oolong',
        cost_amount: 480, cost_currency: 'HKD', stock_grams: 200,
      }],
    });
    expect(response.status).toBe(200);

    const product = productRow(db, 'Bulk Oolong');
    expect(product).toMatchObject({ cost_currency: 'HKD', cost_currency_source: 'stated' });
    expect(listingRow(db, product.id)).toEqual({ cost_currency: 'HKD', cost_currency_source: 'stated' });
  });

  it('the agent door, which has no form and nobody watching', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const args = {
      product_name: 'Agent Sheng', type: 'Pu-erh',
      cost_amount: 1200, cost_currency: 'HKD', stock_grams: 357,
    };
    const preview = await callTool(db, 'create_tea', args);
    const committed = await callTool(db, 'create_tea', { ...args, confirm: preview.confirmation_token });
    expect(committed.committed).toBe(true);

    const product = productRow(db, 'Agent Sheng');
    expect(product).toMatchObject({ cost_currency: 'HKD', cost_currency_source: 'stated' });
    expect(listingRow(db, product.id)).toEqual({ cost_currency: 'HKD', cost_currency_source: 'stated' });
  });

  it('the REST update, when an edit is what states the currency', async () => {
    const db = database();
    const created = await post(db, '/api/products', {
      product_name: 'Edited Dancong', type: 'Oolong',
      cost_amount: 300, cost_currency: 'HKD', stock_grams: 50,
    });
    const { id } = await created.json() as { id: string };
    db.sqlite.prepare('UPDATE products SET cost_currency_source = NULL WHERE id = ?').run(id);
    db.sqlite.prepare('UPDATE product_listings SET cost_currency_source = NULL WHERE legacy_product_id = ?').run(id);

    const response = await worker.fetch(new Request(`https://worker.test/api/products/${id}/commercial`, {
      method: 'PUT',
      headers: new Headers({
        Authorization: `Bearer ${await signedToken(SECRET, {
          sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
          active_account_id: ACCOUNT, platform_role: null,
        })}`,
        'X-Teajia-Account': ACCOUNT,
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ cost_amount: 320, cost_currency: 'Yuan' }),
    }), { DB: db as any, JWT_SECRET: SECRET } as any);
    expect(response.status).toBe(200);

    expect(productRow(db, 'Edited Dancong'))
      .toMatchObject({ cost_currency: 'Yuan', cost_currency_source: 'stated' });
    expect(listingRow(db, id)).toEqual({ cost_currency: 'Yuan', cost_currency_source: 'stated' });
  });
});

describe('a door that cannot know the currency leaves the mark off', () => {
  it('the cellar placement lands somebody else\'s tea with no cost and no claim about it', async () => {
    const db = database();
    db.sqlite.prepare(`INSERT INTO personal_cellar_items
      (id, owner_user_id, name, type, grams, placement_status, placement_account_id)
      VALUES ('cellar-1', ?, 'Borrowed Liu Bao', 'Pu-erh', 250, 'requested', ?)`)
      .run(OWNER, ACCOUNT);

    const response = await post(db, '/api/cellar-placements/cellar-1/approve', {});
    expect(response.status).toBe(200);

    const product = productRow(db, 'Borrowed Liu Bao');
    /* NULL, not 'stated'. This shop did not buy the tea, so nobody here has
       said what it cost or in what, and the row has to stay findable in the
       backlog rather than claim an answer it never had. */
    expect(product.cost_currency_source).toBeNull();
    expect(listingRow(db, product.id).cost_currency_source).toBeNull();
  });

  it('so the backlog reports the unanswered row and leaves the stated one alone', async () => {
    const db = database();
    await mintMcpToken(db, ['inventory:read', 'catalog:write']);
    await post(db, '/api/products', {
      product_name: 'Answered Tea', type: 'Oolong', vendor: 'Kowloon Co',
      cost_amount: 480, cost_currency: 'HKD', stock_grams: 100,
    });
    /* A row from before the rule existed: a cost, a currency the schema
       defaulted for it, and nobody ever asked. */
    db.sqlite.prepare(`INSERT INTO products
      (id, account_id, type, product_name, given_name, vendor, cost_amount, cost_currency)
      VALUES ('legacy-1', ?, 'Oolong', 'Unanswered Tea', 'Unanswered Tea', 'Kowloon Co', 480, 'USD')`)
      .run(ACCOUNT);

    const backlog = await callTool(db, 'list_unstated_costs', { include_teas: true });
    expect(backlog.teas.map((t: any) => t.name)).toEqual(['Unanswered Tea']);

    /* And a vendor-wide correction reaches only that one. Before the stamp, the
       tea whose HKD cost was stated would have been repriced with it. */
    const preview = await callTool(db, 'set_cost_currency', { vendor: 'Kowloon Co', currency: 'Yuan' });
    expect(preview.preview.teas).toBe(1);
    expect(preview.preview.sample[0].name).toBe('Unanswered Tea');
  });
});

describe('the guard against the next door', () => {
  const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
  /* Comments are stripped before the scan. A guard that reads its own
     explanation can only be satisfied by deleting the reason it exists, and the
     comments beside these inserts are the note a future reader needs most. */
  const stripComments = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

  /* Every INSERT into products or product_listings, with the column list that
     follows it. A statement that names `cost_currency` has taken a position on
     what the currency is, and it has to take one on where that came from too:
     silence there is not neutral, it is the value that puts the row in the
     backlog. Doors that write no currency at all are not scanned, because they
     have said nothing and NULL is the honest record of that. */
  function currencyInsertsWithoutProvenance(source: string) {
    const stripped = stripComments(source);
    const offences: string[] = [];
    const pattern = /INSERT (?:OR IGNORE )?INTO (products|product_listings)\s*\(([^)]*)\)/g;
    for (const match of stripped.matchAll(pattern)) {
      const columns = match[2];
      if (!/\bcost_currency\b/.test(columns)) continue;
      if (/\bcost_currency_source\b/.test(columns)) continue;
      offences.push(`${match[1]}: ${columns.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
    }
    return offences;
  }

  /* Every worker source file, recursively: CLAUDE.md says tools added after
     mcp.ts got long live under mcpTools/, so a list of three named files would
     let the next door in silently. The scan only sees LITERAL column lists.
     The single create, the bulk create, create_tea and the compass promotion
     build their INSERTs from a column bag at runtime, so the regex cannot see
     them; those four doors are held by the behavioural tests above, and a
     green scan says nothing about them. */
  const workerSourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? workerSourceFiles(full) : full.endsWith('.ts') ? [full] : [];
    });
  it.each(workerSourceFiles(here('../src')).map(f => relative(here('..'), f)))(
    '%s writes no cost currency without saying where it came from',
    file => {
      expect(currencyInsertsWithoutProvenance(readFileSync(here('../' + file), 'utf8'))).toEqual([]);
    },
  );

  it('would catch a new insert that named the currency and skipped the mark', () => {
    /* The scan has to be able to fail, or it is decoration. */
    expect(currencyInsertsWithoutProvenance(
      'INSERT INTO product_listings (id, account_id, cost_amount, cost_currency) VALUES (?, ?, ?, ?)'
    )).toHaveLength(1);
    expect(currencyInsertsWithoutProvenance(
      'INSERT INTO products (id, cost_currency, cost_currency_source) VALUES (?, ?, ?)'
    )).toEqual([]);
  });

  it('the two listing mirrors carry the mark across rather than working it out again', () => {
    /* Re-deriving it from the currency beside it would be wrong, not merely
       different. The case the rule is written against: a door that writes a
       currency it did not have stated to it (the compass promotion copies one
       from a compass row and deliberately leaves the mark off) and a mirror that
       read the currency would stamp the listing while the product stayed
       honest. No door does both today; the rule is what keeps it that way. */
    const rest = stripComments(readFileSync(here('../src/index.ts'), 'utf8'));
    expect(rest).toMatch(/body\.cost_currency_source \?\? null/);
    const mcp = stripComments(readFileSync(here('../src/mcp.ts'), 'utf8'));
    expect(mcp).toMatch(/buildCreateTeaMirrorInserts\(env, id, m, costCurrencySource\)/);
  });

  it('the stamp is decided in one place, so no door can reach a different answer', () => {
    const rule = stripComments(readFileSync(here('../src/costCurrency.ts'), 'utf8'));
    expect(rule).toMatch(/export function costCurrencySourceFor/);
    for (const file of ['../src/index.ts', '../src/mcp.ts', '../src/mcpTools/costCurrency.ts']) {
      const source = stripComments(readFileSync(here(file), 'utf8'));
      /* The literal belongs to the rule module. A door typing 'stated' for
         itself is how one constant becomes several that drift. */
      expect(source, `${file} types the provenance value by hand`).not.toMatch(/'stated'/);
    }
  });
});
