import { afterEach, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import worker from '../src/index';
import { mcpFetch } from '../src/mcp';
import { COLUMNS_A_PRODUCT_MUST_NAME, nameProductColumns } from '../src/productDefaults';
import { storedRatePerKg } from '../../src/lib/shippingRate';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { columnDefault, seedFromMigrations } from './helpers/migratedSqlite';

/**
 * Every new tea follows the shop, and no door leaves that to the table.
 *
 * `worker/schema.sql` says `products.shipping_rate_per_kg REAL DEFAULT NULL`.
 * The live column says `DEFAULT 0`, because migration `0000` created it that
 * way and SQLite cannot alter a default in place: 0007, 0010, 0013 and 0016 all
 * wrote over existing ROWS and none of them could touch what the next INSERT
 * gets. `markup_multiplier` is the same fault on the number the shop stopped
 * using, and `cost_amount` on the one where zero means free.
 *
 * So five of the ten doors that write these two tables named none of the three
 * and landed 0, 2.5 and 0: a tea that ships free, prices at a markup nobody
 * chose, and cost nothing. The Add Product form was the only one holding the
 * line, and none of this failed anywhere. It looked like a cheap tea.
 *
 * THE WHOLE POINT OF THIS FILE IS WHICH DATABASE IT ASKS. Every other test here
 * seeds from `worker/schema.sql`, which is right for almost everything and
 * exactly wrong for this: it describes the shipping default as NULL when the
 * live one is 0. `SqliteD1('migrations')` replays the ledger the live database
 * was actually built from.
 *
 * Measured, because it is worth knowing exactly how much cover the wrong
 * fixture gives: seed from schema.sql, put the `create_tea` bug back, and the
 * freight assertion passes while the markup one still fails. So schema.sql
 * hides precisely the half that costs money and leaves the other half visible,
 * which is the most dangerous shape a fixture can have. It looks like a working
 * guard.
 *
 * Migration `0018` clears the three defaults. This file is what keeps them
 * unreachable regardless, because a door added after the migration will forget
 * again and the next dump-derived baseline could carry the old shape back.
 */

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(here(rel), 'utf8');
/* Comments stripped before every scan. A guard satisfied by its own explanation
   can only be passed by deleting the reason it exists, and the notes at these
   doors are the ones a future reader needs most. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const SECRET = 'a-new-tea-follows-the-shop-secret';
const TOKEN = 'a_new_tea_follows_the_shop_token';
const ACCOUNT = 'account-a';
const OWNER = 'account-owner';

const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

/**
 * The database the shop HAD when these doors were written, not the one the file
 * claimed it had.
 *
 * Pinned at 0017 on purpose. 0018 removes the three defaults, and seeded past
 * it every test below would pass with every fix reverted, because the table
 * would hand back NULL whatever the door said. A test that cannot fail is not
 * looking at the code. What these tests assert is that a door NAMES its
 * columns, and the only way to see that is to ask a table whose silence is
 * dangerous.
 */
function liveShapedDatabase() {
  const db = new SqliteD1('migrations', '0017');
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  db.sqlite.prepare(
    "INSERT OR IGNORE INTO exchange_rates (currency, rate_to_usd, last_updated) VALUES ('Yuan', 7.12, datetime('now'))",
  ).run();
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

const ownerToken = () => signedToken(SECRET, {
  sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
  active_account_id: ACCOUNT, platform_role: null,
});

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

async function callTool(db: SqliteD1, name: string, args: Record<string, unknown>) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: new AsyncD1(db) as any } as any);
  return await response.json() as any;
}

const row = (db: SqliteD1, table: string, name: string) => db.sqlite.prepare(
  table === 'products'
    ? 'SELECT shipping_rate_per_kg, markup_multiplier, cost_amount FROM products WHERE product_name = ?'
    : `SELECT l.shipping_rate_per_kg, l.markup_multiplier, l.cost_amount
         FROM product_listings l JOIN tea_profiles p ON p.id = l.profile_id WHERE p.name = ?`,
).get(name) as Record<string, number | null>;

/**
 * Freight and markup NULL, and the cost exactly what the caller said.
 *
 * The cost is the one of the three a create door is REQUIRED to state, so it is
 * checked against what was sent rather than against NULL. The other two are
 * policy the shop owns, and a row that carries a copy of policy stops following
 * it the moment Adrian renegotiates.
 */
function followsTheShop(found: Record<string, number | null>, where: string, cost: number | null) {
  expect(found, `${where}: no row was written at all`).toBeTruthy();
  for (const column of ['shipping_rate_per_kg', 'markup_multiplier'] as const) {
    expect(found[column], `${where}: ${column} is ${found[column]}, not NULL. `
      + 'The row now carries a number nobody chose, and it stops following the shop.').toBeNull();
  }
  expect(found.cost_amount, `${where}: the cost is not what was entered`).toBe(cost);
}

describe('why the rule has to exist', () => {
  it('the table answered 0, 2.5 and 0 to an INSERT that left the columns out', () => {
    /* Measured against the migration ledger, not quoted from schema.sql, which
       is the file that was wrong about the first of these for months.

       Seeded THROUGH 0017, which is the state the doors were written against
       and the state this rule exists for. 0018 removes the three defaults; that
       is a second line of defence and it is rehearsed in its own file. This one
       has to keep holding if a future dump-derived baseline carries the old
       shape back, so it asks the question at the point where the answer was
       wrong rather than at today's HEAD. */
    const { db } = seedFromMigrations({ through: '0017' });
    try {
      expect(columnDefault(db, 'products', 'shipping_rate_per_kg')).toBe('0');
      expect(columnDefault(db, 'products', 'markup_multiplier')).toBe('2.5');
      expect(columnDefault(db, 'products', 'cost_amount')).toBe('0');
      expect(columnDefault(db, 'product_listings', 'shipping_rate_per_kg')).toBe('0');
      expect(columnDefault(db, 'product_listings', 'markup_multiplier')).toBe('2.5');
      expect(columnDefault(db, 'product_listings', 'cost_amount')).toBe('0');

      db.exec("INSERT INTO accounts (id, slug, name) VALUES ('acc-silent', 'silent', 'Silent')");
      db.exec(`INSERT INTO products (id, account_id, type, product_name, given_name)
               VALUES ('silent', 'acc-silent', 'Puerh', 'Nobody Said', 'Nobody Said')`);
      const silent = db.prepare(
        'SELECT shipping_rate_per_kg, markup_multiplier, cost_amount FROM products WHERE id = ?',
      ).get('silent') as any;
      expect(silent.shipping_rate_per_kg).toBe(0);
      expect(silent.markup_multiplier).toBe(2.5);
      expect(silent.cost_amount).toBe(0);
    } finally {
      db.close();
    }
  });

});

describe('the rule, stated once', () => {
  it('fills in only what nobody said', () => {
    expect(nameProductColumns({})).toEqual({
      shipping_rate_per_kg: null, markup_multiplier: null, cost_amount: null,
    });
  });

  it('keeps a deliberate zero, because a tea really can ship free', () => {
    const stated = nameProductColumns({ shipping_rate_per_kg: 0, cost_amount: 0 } as Record<string, unknown>);
    expect(stated.shipping_rate_per_kg).toBe(0);
    expect(stated.cost_amount).toBe(0);
    expect(stated.markup_multiplier).toBeNull();
  });

  it('keeps a rate somebody entered', () => {
    expect(nameProductColumns({ shipping_rate_per_kg: 85 } as Record<string, unknown>).shipping_rate_per_kg).toBe(85);
  });
});

describe('the doors, driven against the shape the shop actually has', () => {
  it('the Add Product form lands a tea that follows the shop on all three', async () => {
    const db = liveShapedDatabase();
    const response = await post(db, '/api/products', {
      type: 'Sheng', product_name: 'Form Tea', given_name: 'Form Tea',
      cost_amount: 120, cost_currency: 'Yuan', stock_grams: 500,
    });
    expect(response.status).toBeLessThan(300);
    followsTheShop(row(db, 'products', 'Form Tea'), 'single create, products', 120);
    followsTheShop(row(db, 'product_listings', 'Form Tea'), 'single create, listing mirror', 120);
  });

  it('a rate the operator DID enter still lands, so the fix does not flatten a decision', async () => {
    const db = liveShapedDatabase();
    await post(db, '/api/products', {
      type: 'Sheng', product_name: 'Pinned Tea', given_name: 'Pinned Tea',
      cost_amount: 120, cost_currency: 'Yuan', stock_grams: 500, shipping_rate_per_kg: 85,
    });
    expect(row(db, 'products', 'Pinned Tea').shipping_rate_per_kg).toBe(85);
  });

  it('a deliberate zero still lands, because that is Adrian saying this one ships free', async () => {
    const db = liveShapedDatabase();
    await post(db, '/api/products', {
      type: 'Teaware', product_name: 'Free Freight Pot', given_name: 'Free Freight Pot',
      cost_amount: 40, cost_currency: 'Yuan', quantity_units: 1, shipping_rate_per_kg: 0,
    });
    expect(row(db, 'products', 'Free Freight Pot').shipping_rate_per_kg).toBe(0);
  });

  it('the bulk import lands teas that follow the shop, even though it strips empty cells', async () => {
    const db = liveShapedDatabase();
    const response = await post(db, '/api/products/bulk', {
      receipt_label: 'A spreadsheet',
      products: [{
        type: 'Sheng', product_name: 'Imported Tea', given_name: 'Imported Tea',
        cost_amount: 90, cost_currency: 'Yuan', stock_grams: 250,
        // The cell the operator left blank. The door drops it before the
        // INSERT, so this is the case that used to be unrepresentable.
        shipping_rate_per_kg: '',
      }],
    });
    expect(response.status).toBeLessThan(300);
    followsTheShop(row(db, 'products', 'Imported Tea'), 'bulk create, products', 90);
    followsTheShop(row(db, 'product_listings', 'Imported Tea'), 'bulk create, listing mirror', 90);
  });

  it('the agent door lands a tea that follows the shop, on the row and on its listing', async () => {
    const db = liveShapedDatabase();
    db.sqlite.prepare(`INSERT OR REPLACE INTO mcp_tokens
      (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
      VALUES ('tok-follows',?,?,?,'follows',?,?,?,'account_owner')`)
      .run(ACCOUNT, OWNER, `${OWNER}@test.dev`, await tokenHash(TOKEN), TOKEN.slice(0, 8),
        JSON.stringify(['inventory:read', 'stock:write', 'catalog:write']));

    const preview = await callTool(db, 'create_tea', {
      product_name: 'Agent Tea', type: 'Sheng', cost_amount: 120, cost_currency: 'Yuan', stock_grams: 500,
    });
    expect(preview.result, JSON.stringify(preview)).toBeTruthy();
    const token = JSON.parse(preview.result.content[0].text).confirmation_token;
    const committed = await callTool(db, 'create_tea', {
      product_name: 'Agent Tea', type: 'Sheng', cost_amount: 120, cost_currency: 'Yuan', stock_grams: 500,
      confirm: token,
    });
    expect(committed.error, JSON.stringify(committed)).toBeUndefined();
    followsTheShop(row(db, 'products', 'Agent Tea'), 'create_tea, products', 120);
    followsTheShop(row(db, 'product_listings', 'Agent Tea'), 'create_tea, listing mirror', 120);
  });

  it('and the agent door carries a rate it was given onto the listing as well as the product', async () => {
    const db = liveShapedDatabase();
    db.sqlite.prepare(`INSERT OR REPLACE INTO mcp_tokens
      (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
      VALUES ('tok-follows',?,?,?,'follows',?,?,?,'account_owner')`)
      .run(ACCOUNT, OWNER, `${OWNER}@test.dev`, await tokenHash(TOKEN), TOKEN.slice(0, 8),
        JSON.stringify(['inventory:read', 'stock:write', 'catalog:write']));

    const args = {
      product_name: 'Pinned Agent Tea', type: 'Sheng', cost_amount: 120, cost_currency: 'Yuan',
      stock_grams: 500, shipping_rate_per_kg: 60,
    };
    const preview = await callTool(db, 'create_tea', args);
    const token = JSON.parse(preview.result.content[0].text).confirmation_token;
    await callTool(db, 'create_tea', { ...args, confirm: token });
    expect(row(db, 'products', 'Pinned Agent Tea').shipping_rate_per_kg).toBe(60);
    expect(row(db, 'product_listings', 'Pinned Agent Tea').shipping_rate_per_kg).toBe(60);
  });
});

describe('and the admin has to be able to tell the two apart', () => {
  /* The columns landing NULL is only half the job, because NULL that the admin
     reads as 0 is 0. `useAdminData` mapped the column with
     `Number(p.shipping_rate_per_kg) || 0`, so every tea following the shop rate
     arrived in the model pinned at zero: the inventory list drew a gold dot
     beside a dash on the whole shelf, with a title saying the tea was "pinned
     to this tea in Yuan", about teas nobody had pinned. That dot is the only
     thing in the list separating a rate a tea OWNS from one it is BORROWING,
     which is Adrian's own check on this work, and it was saying the opposite of
     the truth on every row. */
  it('reads a rate nobody entered as nothing, not as zero', () => {
    expect(storedRatePerKg(null)).toBeNull();
    expect(storedRatePerKg(undefined)).toBeNull();
    expect(storedRatePerKg('')).toBeNull();
  });

  it('keeps a deliberate zero, which is what the dot exists to mark', () => {
    expect(storedRatePerKg(0)).toBe(0);
    expect(storedRatePerKg('0')).toBe(0);
  });

  it('keeps a rate somebody entered', () => {
    expect(storedRatePerKg(85)).toBe(85);
    expect(storedRatePerKg('12.63')).toBe(12.63);
  });

  it('refuses a value that is not a number rather than calling it free', () => {
    expect(storedRatePerKg('abc')).toBeNull();
  });

  it('is what the admin actually uses, so the mapping cannot quietly go back', () => {
    const hook = stripComments(read('../../src/admin/hooks/useAdminData.ts'));
    expect(hook, 'the admin mapper is collapsing an unset rate to zero again')
      .not.toMatch(/Number\(\s*p\.shipping_rate_per_kg\s*\)\s*\|\|/);
    expect(hook, 'the admin mapper stopped going through storedRatePerKg')
      .toMatch(/shippingRatePerKg:\s*storedRatePerKg\(/);
  });
});

describe('every door, including the ones no test drives', () => {
  /* Ten INSERTs across three files reach these two tables, and the four the
     suite above drives are the four somebody thought of. The rest are intake
     paths that need a receipt, a wholesale order or a partner publication to
     reach, so they are held to the rule by reading rather than by running. That
     is the weaker guard and it is deliberately the second one, not the only
     one. */
  const sources: Array<[string, string]> = [
    ['index.ts', stripComments(read('../src/index.ts'))],
    ['mcp.ts', stripComments(read('../src/mcp.ts'))],
    ['curateImports.ts', stripComments(read('../src/curateImports.ts'))],
  ];

  it('names all three columns, or passes its column bag through nameProductColumns', () => {
    const offences: string[] = [];
    let found = 0;
    for (const [file, source] of sources) {
      const inserts = source.matchAll(
        /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(products|product_listings)\s*(?:\n\s*)?\(([\s\S]*?)\)\s*(?:\n\s*)?(?:VALUES|SELECT)/gi,
      );
      for (const match of inserts) {
        found += 1;
        const columns = match[2];
        const line = source.slice(0, match.index).split('\n').length;
        // A column list built from a JS bag reaches the table through the
        // helper, so the bag is what has to be checked, not this string.
        const builtFromABag = /\$\{/.test(columns);
        if (builtFromABag) {
          /* Two ways to satisfy the rule, and both are real. A door that
             assembles a body from a request calls the helper, because it cannot
             know in advance which keys arrived. A door that writes its own
             column bag out longhand names the three in it, which is just as
             explicit and reads better at the site. What is refused is a door
             that does neither. */
          const before = source.slice(Math.max(0, match.index - 3000), match.index);
          const missing = COLUMNS_A_PRODUCT_MUST_NAME.filter(column => !new RegExp(`\\b${column}\\b`).test(before));
          if (!/nameProductColumns\s*\(/.test(before) && missing.length) {
            offences.push(`${file}:${line} INSERT INTO ${match[1]} builds its columns and neither `
              + `calls nameProductColumns nor names ${missing.join(', ')}`);
          }
          continue;
        }
        for (const column of COLUMNS_A_PRODUCT_MUST_NAME) {
          if (!new RegExp(`\\b${column}\\b`).test(columns)) {
            offences.push(`${file}:${line} INSERT INTO ${match[1]} does not name ${column}`);
          }
        }
      }
    }
    expect(found, 'the scan matched no INSERT at all, so it is proving nothing').toBeGreaterThanOrEqual(9);
    expect(offences, 'a door would let the table answer for it; the answers are 0, 2.5 and 0').toEqual([]);
  });

  it('the bulk import names the columns AFTER it strips empty cells, not before', () => {
    /* Ordering, not presence. That door builds its body by dropping every null,
       undefined and empty string, so a call placed above the strip is undone by
       it and the column goes back to being omitted. */
    const source = stripComments(read('../src/index.ts'));
    const strip = source.indexOf("if (v !== null && v !== undefined && v !== '') body[k] = v;");
    expect(strip, 'the strip this ordering is about has moved; re-read the door').toBeGreaterThan(0);
    const insert = source.indexOf('INSERT INTO products (id, ${cols.join', strip);
    const call = source.indexOf('nameProductColumns(body)', strip);
    expect(call, 'the bulk import stopped naming the columns').toBeGreaterThan(0);
    expect(call, 'nameProductColumns runs before the strip, so the strip undoes it').toBeGreaterThan(strip);
    expect(call, 'nameProductColumns runs after the INSERT is built').toBeLessThan(insert);
  });
});
