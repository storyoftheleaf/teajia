/**
 * Finds queries that ask the database for columns and tables it does not have.
 *
 * Run via: npm run audit:sql   (from worker/)
 *
 * Why this exists. A missing column is not a soft failure in SQLite: the whole
 * statement is rejected, so the page 500s rather than coming back empty. On
 * 2026-08-31 nine such queries were live at once, across the customer account
 * pages, the public event page, the customer tea history, and the whole
 * tea-review feature, which had never once worked. Nothing caught them, because
 * the tests that cover those routes supply a hand-written database that matches
 * SQL by substring, and a fake like that answers a question about a column that
 * does not exist perfectly happily.
 *
 * How it works. SQLite resolves every table and column name at PREPARE time, so
 * preparing a statement is a complete answer to "would the database reject
 * this", without running it. Statements are read out of the source as literals
 * and prepared against worker/schema.sql. Nothing is executed and no data is
 * touched.
 *
 * The second pass covers statements assembled at runtime, which are not
 * complete statements in the source and so cannot be prepared. Their table and
 * alias.column names are still there in plain text, and those are checked
 * directly. One of the nine was only reachable this way.
 *
 * This is only as true as schema.sql. It is the baseline the tests share, and
 * build-plan.md requires every migration to be reflected in it; `npm run
 * sandbox:refresh` reports when production and this repo have drifted apart.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const WORKER = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(WORKER, 'src');

const db = new DatabaseSync(':memory:');
try {
  db.exec(readFileSync(join(WORKER, 'schema.sql'), 'utf8'));
} catch (error) {
  console.error(`schema.sql did not load, so this audit would be meaningless:\n  ${error.message}`);
  process.exit(1);
}

const tables = new Map();
for (const row of db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table','view')").all()) {
  tables.set(row.name.toLowerCase(), new Set(
    db.prepare(`SELECT name FROM pragma_table_info('${row.name}')`).all().map(r => r.name.toLowerCase()),
  ));
}

/**
 * Every string and template literal in a file, with its line and whether it
 * interpolated anything. Comments are skipped so commented-out SQL is ignored.
 */
function literals(source) {
  const found = [];
  let line = 1;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '\n') { line++; continue; }
    if (c === '/' && source[i + 1] === '/') { while (i < source.length && source[i] !== '\n') i++; line++; continue; }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) { if (source[i] === '\n') line++; i++; }
      i++; continue;
    }
    if (c !== '`' && c !== '"' && c !== "'") continue;
    const quote = c;
    const startLine = line;
    let body = '';
    let dynamic = false;
    i++;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '\\') { body += source[i + 1] === 'n' ? '\n' : source[i + 1]; i++; continue; }
      if (ch === '\n') { line++; body += ch; continue; }
      if (quote === '`' && ch === '$' && source[i + 1] === '{') {
        dynamic = true;
        let depth = 1; i += 2;
        for (; i < source.length && depth > 0; i++) {
          if (source[i] === '{') depth++;
          else if (source[i] === '}') depth--;
          else if (source[i] === '\n') line++;
        }
        i--;
        body += ' /*EXPR*/ ';
        continue;
      }
      if (ch === quote) break;
      body += ch;
    }
    found.push({ body, dynamic, line: startLine });
  }
  return found;
}

const SQL_START = /^\s*(WITH|SELECT|INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\b/i;
const NOT_A_COLUMN = new Set(['*', 'rowid', 'oid', '_rowid_']);
const KEYWORD = /^(on|where|group|order|left|inner|join|set|values|limit|having|union|as|using|and|or)$/;
const BARE_NOISE = new RegExp('^(select|from|where|and|or|not|null|is|in|like|order|by|group|limit|set|update|insert'
  + '|into|values|case|when|then|else|end|count|sum|max|min|avg|coalesce|datetime|date|json_extract|lower|upper'
  + '|cast|as|desc|asc|distinct|on|left|join|having|union|all|exists|between|true|false)$');

const statics = [];
const dynamics = [];
for (const file of readdirSync(SRC).filter(f => f.endsWith('.ts'))) {
  for (const lit of literals(readFileSync(join(SRC, file), 'utf8'))) {
    if (!SQL_START.test(lit.body)) continue;
    (lit.dynamic ? dynamics : statics).push({ file, line: lit.line, sql: lit.body });
  }
}

const faults = [];

// Pass one: complete statements, answered by SQLite itself.
for (const s of statics) {
  try {
    db.prepare(s.sql);
  } catch (error) {
    const message = String(error.message);
    // Only schema faults. A complaint about parameters or syntax is about how
    // the string was written, not about what the database holds.
    if (/no such column|no such table/i.test(message)) {
      faults.push({ ...s, what: message.replace(/^.*?(no such \w+: \S+).*$/is, '$1') });
    }
  }
}

// Pass two: statements assembled at runtime, checked by name.
for (const entry of dynamics) {
  const flat = entry.sql.replace(/\s+/g, ' ');
  const alias = new Map();
  const sources = [];
  // The table an UPDATE, INSERT or DELETE writes to counts as a source. Without
  // it, `UPDATE mcp_tokens ... WHERE EXISTS (SELECT 1 FROM account_members ...)`
  // looks like a single-table read of account_members, and every column of
  // mcp_tokens gets reported against the wrong table.
  for (const m of flat.matchAll(/\b(?:UPDATE|INSERT\s+(?:OR\s+\w+\s+)?INTO|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_]*)/gi)) {
    const table = m[1].toLowerCase();
    if (!tables.has(table)) { faults.push({ ...entry, what: `no such table: ${m[1]}` }); continue; }
    sources.push(table);
    alias.set(table, table);
  }
  for (const m of flat.matchAll(/\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*)?/gi)) {
    const table = m[1].toLowerCase();
    if (!tables.has(table)) {
      // A name defined by a WITH clause in the same statement is not a fault.
      if (!new RegExp(`\\b${m[1]}\\s+AS\\s*\\(`, 'i').test(flat)) {
        faults.push({ ...entry, what: `no such table: ${m[1]}` });
      }
      continue;
    }
    sources.push(table);
    const next = (m[2] || '').toLowerCase();
    if (next && !KEYWORD.test(next)) alias.set(next, table);
    alias.set(table, table);
  }

  const seen = new Set();
  for (const m of flat.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b/g)) {
    const [, a, col] = m;
    const table = alias.get(a.toLowerCase());
    if (!table || NOT_A_COLUMN.has(col.toLowerCase())) continue;
    const key = `${a}.${col}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!tables.get(table).has(col.toLowerCase())) {
      faults.push({ ...entry, what: `no such column: ${a}.${col} (${table})` });
    }
  }

  // Unqualified names are only checked when one table is in play and nothing
  // is joined, so the owner is not a guess. Anything else is noise, and noise
  // in an audit is worse than a gap: it teaches people to skip the output.
  if (new Set(sources).size === 1 && !/\bJOIN\b/i.test(flat)) {
    const cols = tables.get(sources[0]);
    const body = flat.replace(/'[^']*'/g, "''").replace(/\/\*EXPR\*\//g, ' ');
    for (const m of body.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|!=|<>|>=|<=|>|<|\bIS\b|\bIN\b|\bLIKE\b)/gi)) {
      const col = m[1].toLowerCase();
      if (cols.has(col) || NOT_A_COLUMN.has(col) || BARE_NOISE.test(col)) continue;
      if (seen.has(`bare:${col}`)) continue;
      seen.add(`bare:${col}`);
      faults.push({ ...entry, what: `no such column: ${col} (${sources[0]})` });
    }
  }
}

console.log(`${tables.size} tables in the baseline`);
console.log(`${statics.length} complete statements prepared, ${dynamics.length} runtime-built statements read`);

if (!faults.length) {
  console.log('\nNo query asks for anything the schema does not have.');
  process.exit(0);
}

console.log(`\n${faults.length} fault(s). Each one is a 500 on whatever page reaches it:\n`);
for (const f of faults) console.log(`  ${f.file}:${f.line}  ${f.what}`);
console.log('');
process.exit(1);
