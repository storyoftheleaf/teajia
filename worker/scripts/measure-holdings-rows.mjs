/**
 * Rows read by the holdings reading, before and after, measured rather than
 * reasoned about.
 *
 * It boots Miniflare's D1 — the same workerd implementation `wrangler dev`
 * runs — so `meta.rows_read` is D1's own count, not an estimate, and it is the
 * number Cloudflare bills. Nothing here touches the live database or the
 * network: the whole measurement is a temporary D1 in a temp directory.
 *
 *   node worker/scripts/measure-holdings-rows.mjs            # the default sizes
 *   node worker/scripts/measure-holdings-rows.mjs 300 1000   # other sizes
 *
 * The four tables carry their real column counts and their real indexes from
 * `worker/schema.sql`, because the plan the query gets depends on which
 * indexes exist and a four-column stand-in would flatter it.
 */
import { Miniflare } from 'miniflare';

const ACCOUNT = 'acc-measure';
/** A second shop, so every query is also proving its account scoping. */
const OTHER = 'acc-other';

/** Canonical teas to measure at. Prod's own shelf sits in the low hundreds. */
const SIZES = process.argv.slice(2).map(Number).filter(n => Number.isFinite(n) && n > 0);
const DEFAULT_SIZES = [100, 300, 1000];

// ── the shapes ────────────────────────────────────────────────────────────────
// Trimmed to the columns these queries touch plus enough padding to keep the
// row widths honest; the INDEXES are verbatim from worker/schema.sql, which is
// the half that decides the plan.
const SCHEMA = `
CREATE TABLE tea_compass_entries (
  id TEXT PRIMARY KEY, user_id TEXT, account_id TEXT, name TEXT, chinese_name TEXT,
  vendor_name TEXT, vendor_id TEXT, vendor_item_number TEXT, origin_region TEXT, year TEXT,
  status TEXT, decision TEXT, verdict TEXT, cultivar TEXT, sample_state TEXT,
  sample_set_id TEXT, source_entry_id TEXT, session_id TEXT, import_item_id TEXT,
  journey_id TEXT, visit_id TEXT, draft_product_id TEXT, notes TEXT, description TEXT,
  price_currency TEXT DEFAULT 'NT', created_at TEXT, updated_at TEXT,
  archived_at TEXT, deleted_at TEXT, merged_into_id TEXT
);
CREATE INDEX idx_compass_user_id ON tea_compass_entries(user_id);
CREATE INDEX idx_compass_status ON tea_compass_entries(status);
CREATE INDEX idx_compass_entries_source ON tea_compass_entries(source_entry_id);
CREATE INDEX idx_compass_entries_session ON tea_compass_entries(session_id);
CREATE INDEX idx_compass_entries_verdict ON tea_compass_entries(verdict);
CREATE INDEX idx_compass_account_decision ON tea_compass_entries(account_id, decision);
CREATE INDEX idx_compass_account_sample_state ON tea_compass_entries(account_id, sample_state);
CREATE INDEX idx_compass_account_sample_set ON tea_compass_entries(account_id, sample_set_id);
CREATE UNIQUE INDEX idx_compass_import_item ON tea_compass_entries(account_id, user_id, import_item_id) WHERE import_item_id IS NOT NULL;
CREATE INDEX idx_compass_cultivar ON tea_compass_entries(cultivar);
CREATE INDEX idx_compass_entries_journey ON tea_compass_entries(account_id, journey_id);
CREATE INDEX idx_compass_entries_visit ON tea_compass_entries(account_id, visit_id);

CREATE TABLE products (
  id TEXT PRIMARY KEY, account_id TEXT, slug TEXT, given_name TEXT, product_name TEXT,
  status TEXT, cultivar TEXT, owner_user_id TEXT, shown_in_shop INTEGER,
  sourced_by TEXT, roasted_by TEXT, vouched_by TEXT,
  source_compass_entry_id TEXT, stock_grams REAL, inventory_purpose TEXT
);
CREATE UNIQUE INDEX idx_products_slug ON products(slug);
CREATE UNIQUE INDEX idx_products_account_compass_identity ON products(account_id, source_compass_entry_id) WHERE source_compass_entry_id IS NOT NULL;
CREATE INDEX idx_products_account_status ON products(account_id, status);
CREATE INDEX idx_products_cultivar ON products(cultivar);
CREATE INDEX idx_products_account_owner ON products(account_id, owner_user_id);
CREATE INDEX idx_products_account_shown ON products(account_id, shown_in_shop);

CREATE TABLE tea_sample_sets (id TEXT PRIMARY KEY, account_id TEXT, purpose TEXT, archived INTEGER);
CREATE INDEX idx_sample_sets_purpose ON tea_sample_sets(purpose);

CREATE TABLE tea_samples (
  id TEXT PRIMARY KEY, account_id TEXT, compass_entry_id TEXT, set_id TEXT, source_id TEXT,
  tea_key TEXT, name TEXT, grams REAL, grams_known INTEGER NOT NULL DEFAULT 1,
  status TEXT, created_at TEXT, archived_at TEXT
);
CREATE INDEX idx_samples_set_id ON tea_samples(set_id);
CREATE INDEX idx_samples_status ON tea_samples(status);
CREATE INDEX idx_samples_source_id ON tea_samples(source_id);
CREATE INDEX idx_tea_samples_tea_key ON tea_samples(tea_key);
`;

/** Migration 0050, the two indexes under test. */
const INDEXES_0050 = [
  'CREATE INDEX IF NOT EXISTS idx_compass_merged_into ON tea_compass_entries(merged_into_id, account_id)',
  "CREATE INDEX IF NOT EXISTS idx_compass_account_shelf_order ON tea_compass_entries(account_id, COALESCE(vendor_name,''), COALESCE(name,''), id)",
];
/** What the branch proposed first, kept so the comparison is on the page. */
const INDEX_0050_FIRST_TRY = 'CREATE INDEX IF NOT EXISTS idx_compass_account_merged_into ON tea_compass_entries(account_id, merged_into_id)';

// ── the two readings, as SQL ──────────────────────────────────────────────────
// OLD: worker/src/curateHoldings.ts at main 6b0965ea. One listing query with a
// correlated SUM per row, then ONE MORE query per row for that row's portions.
const OLD_ROWS = `WITH RECURSIVE family(root,id,depth) AS (
  SELECT id,id,0 FROM tea_compass_entries WHERE account_id=? AND deleted_at IS NULL AND merged_into_id IS NULL AND archived_at IS NULL
  UNION ALL SELECT f.root,e.id,f.depth+1 FROM tea_compass_entries e JOIN family f ON e.merged_into_id=f.id
    WHERE e.account_id=? AND f.depth<20
) SELECT e.*,
  COALESCE((SELECT SUM(p.stock_grams) FROM products p WHERE p.account_id=e.account_id AND (p.inventory_purpose IS NULL OR p.inventory_purpose!='sample')
    AND (p.source_compass_entry_id IN (SELECT id FROM family WHERE root=e.id)
      OR p.id IN (SELECT t.draft_product_id FROM tea_compass_entries t JOIN family f ON f.id=t.id WHERE f.root=e.id AND t.account_id=e.account_id))),0) AS stock_grams
  FROM tea_compass_entries e WHERE e.account_id=? AND e.deleted_at IS NULL AND e.archived_at IS NULL AND e.merged_into_id IS NULL
  ORDER BY e.vendor_name,e.name,e.id`;

const OLD_PORTIONS = `WITH RECURSIVE ids(id,depth) AS (
  SELECT id,0 FROM tea_compass_entries WHERE id=? AND account_id=?
  UNION ALL SELECT e.id,i.depth+1 FROM tea_compass_entries e JOIN ids i ON e.merged_into_id=i.id WHERE e.account_id=? AND i.depth<20
) SELECT s.id,s.name,s.grams,s.grams_known,s.status,s.set_id,s.compass_entry_id FROM tea_samples s
  JOIN tea_sample_sets st ON st.id=s.set_id AND st.account_id=s.account_id
  WHERE s.archived_at IS NULL AND s.account_id=? AND s.compass_entry_id IN (SELECT id FROM ids) AND COALESCE(st.archived,0)=0 ORDER BY s.created_at,s.id`;

// NEW: worker/src/curateHoldings.ts on this branch. Two set-based queries,
// sharing one bounded `roots` page.
const familyCte = `WITH RECURSIVE roots(id,sort_vendor,sort_name) AS (
  SELECT id,COALESCE(vendor_name,''),COALESCE(name,'') FROM tea_compass_entries
   WHERE account_id=? AND deleted_at IS NULL AND merged_into_id IS NULL AND archived_at IS NULL
   ORDER BY COALESCE(vendor_name,''),COALESCE(name,''),id
   LIMIT ?
), family(root,id,depth) AS (
  SELECT id,id,0 FROM roots
  UNION ALL SELECT f.root,e.id,f.depth+1 FROM family f JOIN tea_compass_entries e ON e.merged_into_id=f.id
    WHERE +e.account_id=? AND f.depth<20
)`;

/**
 * The same two queries with the recursive join order NOT pinned, so the value
 * of the `+` is measured rather than claimed.
 */
const unpinned = sql => sql.replace(
  'FROM family f JOIN tea_compass_entries e ON e.merged_into_id=f.id',
  'FROM tea_compass_entries e JOIN family f ON e.merged_into_id=f.id',
).replace('WHERE +e.account_id=?', 'WHERE e.account_id=?');

const NEW_ROWS = `${familyCte}, family_entries(root,id,draft_product_id) AS (
  SELECT f.root,t.id,t.draft_product_id FROM family f JOIN tea_compass_entries t ON t.id=f.id AND t.account_id=?
), links(root,product_id,grams) AS (
  SELECT fe.root,p.id,p.stock_grams FROM products p JOIN family_entries fe ON fe.id=p.source_compass_entry_id
    WHERE p.account_id=? AND (p.inventory_purpose IS NULL OR p.inventory_purpose!='sample')
  UNION
  SELECT fe.root,p.id,p.stock_grams FROM family_entries fe JOIN products p ON p.id=fe.draft_product_id
    WHERE p.account_id=? AND (p.inventory_purpose IS NULL OR p.inventory_purpose!='sample')
), stock(root,grams) AS (
  SELECT root,SUM(grams) FROM links GROUP BY root
) SELECT e.*,COALESCE(s.grams,0) AS stock_grams
  FROM roots r JOIN tea_compass_entries e ON e.id=r.id
  LEFT JOIN stock s ON s.root=e.id
  ORDER BY r.sort_vendor,r.sort_name,e.id`;

const NEW_PORTIONS = `${familyCte}
  SELECT f.root AS holding_root,s.id,s.name,s.grams,s.grams_known,s.status,s.set_id,s.compass_entry_id FROM tea_samples s
    JOIN family f ON f.id=s.compass_entry_id
    JOIN tea_sample_sets st ON st.id=s.set_id AND st.account_id=s.account_id
    WHERE s.archived_at IS NULL AND s.account_id=? AND COALESCE(st.archived,0)=0 ORDER BY f.root,s.created_at,s.id`;

// ── the harness ───────────────────────────────────────────────────────────────
// No `d1Persist`: each boot gets its own empty in-memory D1, which is what
// makes one size's measurement independent of the last one's.
async function boot() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch: () => new Response("measurement harness") };',
    d1Databases: { DB: 'measure' },
  });
  return { mf, db: await mf.getD1Database('DB') };
}

const rowsRead = result => Number(result?.meta?.rows_read ?? 0);

async function seed(db, canonical) {
  // D1's `exec` wants one statement per LINE, and these are written across
  // several for legibility, so each is run on its own instead.
  for (const statement of SCHEMA.split(';').map(part => part.trim()).filter(Boolean)) {
    await db.prepare(statement).run();
  }

  // Proportions from the shop as it stands: roughly one product per five
  // canonical teas, one duplicate merged into every twentieth tea, one sample
  // portion per three teas, and a second shop holding a third as much again
  // so the account filter is doing real work.
  const chunk = async (statements) => {
    for (let at = 0; at < statements.length; at += 200) await db.batch(statements.slice(at, at + 200));
  };

  const entries = [];
  for (let i = 0; i < canonical; i++) {
    const id = `tea-${String(i).padStart(6, '0')}`;
    entries.push(db.prepare(
      `INSERT INTO tea_compass_entries (id,user_id,account_id,name,vendor_name,sample_state,draft_product_id,created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).bind(id, 'owner', ACCOUNT, `Tea ${String(i).padStart(6, '0')}`, `Vendor ${i % 40}`, i % 3 === 0 ? 'received' : 'requested', null, '2026-01-01'));
    if (i % 20 === 0) {
      entries.push(db.prepare(
        `INSERT INTO tea_compass_entries (id,user_id,account_id,name,vendor_name,sample_state,merged_into_id,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
      ).bind(`${id}-dup`, 'owner', ACCOUNT, `Tea ${i} duplicate`, `Vendor ${i % 40}`, 'received', id, '2026-01-02'));
    }
  }
  for (let i = 0; i < Math.ceil(canonical / 3); i++) {
    entries.push(db.prepare(
      `INSERT INTO tea_compass_entries (id,user_id,account_id,name,vendor_name,sample_state,created_at)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(`other-${String(i).padStart(6, '0')}`, 'other', OTHER, `Other ${i}`, 'Other vendor', 'received', '2026-01-01'));
  }
  await chunk(entries);

  const products = [];
  for (let i = 0; i < Math.ceil(canonical / 5); i++) {
    products.push(db.prepare(
      `INSERT INTO products (id,account_id,slug,status,source_compass_entry_id,stock_grams,inventory_purpose)
       VALUES (?,?,?,?,?,?,?)`,
    ).bind(`p-${i}`, ACCOUNT, `slug-${i}`, 'working', `tea-${String(i * 5).padStart(6, '0')}`, 100 + i, 'working'));
  }
  await chunk(products);

  const samples = [db.prepare("INSERT INTO tea_sample_sets (id,account_id,purpose,archived) VALUES ('set',?,'tasting',0)").bind(ACCOUNT)];
  for (let i = 0; i < Math.ceil(canonical / 3); i++) {
    samples.push(db.prepare(
      `INSERT INTO tea_samples (id,account_id,compass_entry_id,set_id,name,grams,grams_known,status,created_at)
       VALUES (?,?,?,'set',?,?,1,'received',?)`,
    ).bind(`s-${i}`, ACCOUNT, `tea-${String(i * 3).padStart(6, '0')}`, `Bag ${i}`, 5 + (i % 20), '2026-02-01'));
  }
  await chunk(samples);

  const count = async (table, where = '1=1') =>
    Number((await db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).first()).n);
  return {
    compass_total: await count('tea_compass_entries'),
    compass_this_account: await count('tea_compass_entries', `account_id='${ACCOUNT}'`),
    canonical_this_account: await count('tea_compass_entries', `account_id='${ACCOUNT}' AND merged_into_id IS NULL`),
    products: await count('products'),
    samples: await count('tea_samples'),
  };
}

async function measureOld(db) {
  const listing = await db.prepare(OLD_ROWS).bind(ACCOUNT, ACCOUNT, ACCOUNT).all();
  let read = rowsRead(listing);
  let statements = 1;
  for (const entry of listing.results) {
    const portions = await db.prepare(OLD_PORTIONS).bind(entry.id, ACCOUNT, ACCOUNT, ACCOUNT).all();
    read += rowsRead(portions);
    statements += 1;
  }
  return { rows_read: read, statements, returned: listing.results.length };
}

async function measureNew(db, limit, withoutPin = false) {
  const shape = withoutPin ? unpinned : (sql => sql);
  const rows = await db.prepare(shape(NEW_ROWS)).bind(ACCOUNT, limit, ACCOUNT, ACCOUNT, ACCOUNT, ACCOUNT).all();
  const portions = await db.prepare(shape(NEW_PORTIONS)).bind(ACCOUNT, limit, ACCOUNT, ACCOUNT).all();
  return {
    rows_read: rowsRead(rows) + rowsRead(portions),
    statements: 2,
    returned: rows.results.length,
  };
}

async function plan(db, sql, binds) {
  const { results } = await db.prepare(`EXPLAIN QUERY PLAN ${sql}`).bind(...binds).all();
  return results.map(row => String(row.detail));
}

async function main() {
  const sizes = SIZES.length ? SIZES : DEFAULT_SIZES;
  const report = { sizes: [], plans: {} };

  for (const canonical of sizes) {
    const { mf, db } = await boot();
    try {
      const counts = await seed(db, canonical);
      // Without migration 0050 first, which is the state the live database was
      // in when the quota ran out.
      // No indexes yet: the state the live database was in when the quota ran
      // out, and the state this code has to be safe in, since the index is
      // only a perf aid.
      const oldNoIndex = await measureOld(db);
      const newUnpinnedNoIndex = await measureNew(db, 201, true);
      const newNoIndex = await measureNew(db, 201);

      // What the branch proposed first, measured on its own so the claim can
      // be checked rather than believed.
      await db.prepare(INDEX_0050_FIRST_TRY).run();
      const newUnpinnedFirstTry = await measureNew(db, 201, true);
      await db.prepare('DROP INDEX idx_compass_account_merged_into').run();

      for (const statement of INDEXES_0050) await db.prepare(statement).run();
      const oldWith0050 = await measureOld(db);
      const newWith0050 = await measureNew(db, 201);
      // And the page the code actually asks for by default.
      const newDefaultPage = await measureNew(db, 51);

      report.sizes.push({
        canonical, counts,
        oldNoIndex, oldWith0050,
        newUnpinnedNoIndex, newUnpinnedFirstTry,
        newNoIndex, newWith0050, newDefaultPage,
      });
      console.log(JSON.stringify(report.sizes.at(-1), null, 2));
    } finally {
      await mf.dispose();
    }
  }

  // Plans at one size, with and without the index, for the three statements
  // that matter.
  const { mf, db } = await boot();
  try {
    await seed(db, 300);
    const everything = async () => ({
      old_listing: await plan(db, OLD_ROWS, [ACCOUNT, ACCOUNT, ACCOUNT]),
      old_portions: await plan(db, OLD_PORTIONS, ['tea-000000', ACCOUNT, ACCOUNT, ACCOUNT]),
      new_rows_unpinned: await plan(db, unpinned(NEW_ROWS), [ACCOUNT, 201, ACCOUNT, ACCOUNT, ACCOUNT, ACCOUNT]),
      new_rows: await plan(db, NEW_ROWS, [ACCOUNT, 201, ACCOUNT, ACCOUNT, ACCOUNT, ACCOUNT]),
      new_portions: await plan(db, NEW_PORTIONS, [ACCOUNT, 201, ACCOUNT, ACCOUNT]),
    });
    report.plans.without_0050 = await everything();
    for (const statement of INDEXES_0050) await db.prepare(statement).run();
    report.plans.with_0050 = await everything();
  } finally {
    await mf.dispose();
  }

  console.log('\n===== REPORT =====');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
