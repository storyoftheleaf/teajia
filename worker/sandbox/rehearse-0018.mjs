/**
 * Read the local sandbox database and print what migration 0018 has to leave
 * alone: the two tables' defaults, their indexes and triggers, their row counts,
 * a checksum over every stored value, and the row counts of every table whose
 * foreign key points at them.
 *
 * Run it once before `wrangler d1 migrations apply --local` and once after, and
 * diff the two. Everything except the six default lines and the position of
 * three columns has to be identical.
 *
 *   node --experimental-sqlite worker/sandbox/rehearse-0018.mjs <path to .sqlite>
 *
 * The path is the file under worker/.wrangler/state/v3/d1/. This reads it
 * directly rather than going through wrangler, because a checksum over 560 rows
 * is not something to page through JSON.
 */
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.argv[2], { readOnly: true });
const TABLES = ['products', 'product_listings'];
const THE_THREE = ['shipping_rate_per_kg', 'markup_multiplier', 'cost_amount'];

for (const table of TABLES) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  console.log(`\n=== ${table} ===`);
  console.log(`columns: ${info.length}`);
  for (const column of THE_THREE) {
    const found = info.find(c => c.name === column);
    console.log(`  ${column.padEnd(22)} position ${String(found.cid).padStart(3)}  default ${found.dflt_value === null ? 'NULL' : found.dflt_value}`);
  }
  const objects = db.prepare(
    `SELECT type, name, sql FROM sqlite_master WHERE tbl_name = ? AND type IN ('index','trigger') ORDER BY type, name`,
  ).all(table);
  console.log(`indexes and triggers: ${objects.length}`);
  for (const object of objects) console.log(`  ${object.type.padEnd(8)} ${object.name}`);
  console.log(`sqlite_master digest: ${createHash('sha256').update(JSON.stringify(objects)).digest('hex').slice(0, 16)}`);

  const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
  console.log(`rows: ${rows.length}`);
  // Sorted keys, so the three columns moving to the end of the table does not
  // change the digest. What must not change is the VALUES.
  const canonical = rows.map(row => Object.keys(row).sort().map(key => `${key}=${String(row[key])}`).join(''));
  console.log(`row digest: ${createHash('sha256').update(canonical.join('')).digest('hex')}`);
  const stated = db.prepare(
    `SELECT COUNT(*) AS n FROM ${table} WHERE shipping_rate_per_kg IS NOT NULL`,
  ).get().n;
  const zeros = db.prepare(
    `SELECT COUNT(*) AS n FROM ${table} WHERE shipping_rate_per_kg = 0`,
  ).get().n;
  console.log(`rows carrying a freight rate: ${stated}, of which zero: ${zeros}`);
}

console.log('\n=== every table that points at these two ===');
for (const table of db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
).all()) {
  for (const fk of db.prepare(`PRAGMA foreign_key_list(${table.name})`).all()) {
    if (!TABLES.includes(fk.table)) continue;
    const count = db.prepare(`SELECT COUNT(*) AS n FROM ${table.name}`).get().n;
    console.log(`  ${table.name.padEnd(28)} ${fk.from.padEnd(22)} -> ${fk.table.padEnd(17)} on_delete=${String(fk.on_delete).padEnd(10)} rows=${count}`);
  }
}
