import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Build a scratch database the way the LIVE one was built.
 *
 * `worker/schema.sql` is a hand-maintained description of the database and it
 * has been wrong about at least one column default for months: it says
 * `products.shipping_rate_per_kg REAL DEFAULT NULL` while the live column,
 * created by migration `0000`, says `DEFAULT 0`. A test seeded from schema.sql
 * therefore asks a friendlier question than production does, and passes while
 * every new tea ships free.
 *
 * The migrations are the record of what actually ran, so anything asking "what
 * does the live table DO" seeds from here instead. Applied in filename order,
 * one statement at a time: `0000` is a dump of the live schema taken in August
 * 2026, so the feature migrations numbered below it re-add columns it already
 * carries. Wrangler tolerated that on the way through because those ALTERs had
 * already applied before the dump existed; here the duplicate is skipped and
 * everything else still has to succeed.
 */

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

export function migrationFiles(dir = MIGRATIONS_DIR): string[] {
  return readdirSync(dir).filter(file => file.endsWith('.sql')).sort();
}

/**
 * Split a migration into statements on semicolons that are not inside a string
 * literal or a line comment. Deliberately simple: no migration in this repo
 * contains a trigger body, and a `BEGIN ... END` would need real parsing.
 */
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = '';
  let index = 0;
  while (index < sql.length) {
    const character = sql[index];
    if (character === "'") {
      let end = index + 1;
      while (end < sql.length) {
        if (sql[end] === "'") {
          if (sql[end + 1] === "'") { end += 2; continue; }
          break;
        }
        end += 1;
      }
      buffer += sql.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (character === '-' && sql[index + 1] === '-') {
      const newline = sql.indexOf('\n', index);
      const end = newline === -1 ? sql.length : newline;
      buffer += sql.slice(index, end);
      index = end;
      continue;
    }
    if (character === ';') { statements.push(buffer); buffer = ''; index += 1; continue; }
    buffer += character;
    index += 1;
  }
  if (buffer.trim()) statements.push(buffer);
  return statements
    .map(statement => statement.trim())
    .filter(statement => statement
      && !statement.split('\n').every(line => line.trim() === '' || line.trim().startsWith('--')));
}

export interface MigratedDatabase {
  db: DatabaseSync;
  /** Statements skipped because the 0000 dump already carried the column. */
  skipped: string[];
  /** Files applied, in the order wrangler would apply them. */
  applied: string[];
}

/**
 * @param through highest migration number to apply, as a four-character string.
 *        `'0017'` gives the database as it stands before `0018` runs.
 */
export function seedFromMigrations(
  { through = '9999', dir = MIGRATIONS_DIR }: { through?: string; dir?: string } = {},
): MigratedDatabase {
  const db = new DatabaseSync(':memory:');
  // OFF for the seed only. The 0000 dump lists tables alphabetically, so a
  // foreign key can name a table that does not exist yet.
  db.exec('PRAGMA foreign_keys = OFF');
  const skipped: string[] = [];
  const applied: string[] = [];
  for (const file of migrationFiles(dir)) {
    if (file.slice(0, 4) > through) continue;
    applied.push(file);
    const sql = readFileSync(join(dir, file), 'utf8');
    for (const statement of splitStatements(sql)) {
      try {
        db.exec(statement);
      } catch (error) {
        const message = String((error as Error).message ?? error);
        if (/duplicate column name|already exists/i.test(message)) {
          skipped.push(`${file}: ${message}`);
          continue;
        }
        throw new Error(`${file}: ${message}\n--- statement ---\n${statement.slice(0, 400)}`);
      }
    }
  }
  return { db, skipped, applied };
}

export interface ColumnInfo { name: string; type: string; notnull: number; dflt_value: string | null; pk: number }

export function tableInfo(db: DatabaseSync, table: string): ColumnInfo[] {
  return db.prepare(`PRAGMA table_info(${table})`).all() as unknown as ColumnInfo[];
}

export function columnDefault(db: DatabaseSync, table: string, column: string): string | null {
  const found = tableInfo(db, table).find(info => info.name === column);
  if (!found) throw new Error(`${table}.${column} does not exist`);
  return found.dflt_value;
}

/** Every index and trigger sqlite_master holds for a table, autoindexes included. */
export function schemaObjects(db: DatabaseSync, table: string) {
  return db.prepare(
    `SELECT type, name, sql FROM sqlite_master
      WHERE tbl_name = ? AND type IN ('index', 'trigger')
      ORDER BY type, name`,
  ).all(table) as unknown as Array<{ type: string; name: string; sql: string | null }>;
}
