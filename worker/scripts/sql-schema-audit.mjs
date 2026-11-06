/**
 * Prepare statically known database statements against schema.sql, without
 * executing them. Run npm run audit:sql from worker/.
 *
 * A SQL-looking literal is not necessarily a database statement: correlated
 * fragments need their outer query, CTEs can define table names, and UPSERT has
 * an UPDATE SET clause that is not a table. TypeScript supplies call/lexical
 * context; SQLite, rather than SQL-shaped regexes, resolves complete statements.
 * Runtime-built SQL and unattached fragments are reported as unresolved with
 * their source sites. Exit 0 means no proven preparation faults, not complete
 * runtime coverage or agreement with the production migration state.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import ts from 'typescript';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--worker-dir')) {
  console.error('Usage: node sql-schema-audit.mjs [--worker-dir PATH]');
  process.exit(1);
}
const worker = args.length ? resolve(args[1]) : join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(worker, 'src');
const db = new DatabaseSync(':memory:');
try {
  db.exec(readFileSync(join(worker, 'schema.sql'), 'utf8'));
} catch (error) {
  console.error(`schema.sql did not load, so this audit would be meaningless:\n  ${error.message}`);
  process.exit(1);
}

// Match the existing audit's file boundary: top-level worker/src/*.ts only.
// noResolve/noLib keep this source inspection from traversing dependencies.
const files = readdirSync(src).filter(file => file.endsWith('.ts')).sort().map(file => join(src, file));
const program = ts.createProgram(files, { noResolve: true, noLib: true });
const checker = program.getTypeChecker();
const SQL_START = /^\s*(WITH|SELECT|INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\b/i;
const faults = [];
const unresolved = [];
let prepared = 0;
let calls = 0;
let sqlLiterals = 0;
let dynamicLiterals = 0;
let untracedLiterals = 0;

for (const file of files) {
  const source = program.getSourceFile(file);
  const literals = [];
  const callSites = [];
  const used = new Set();
  const site = node => ({ file: source.fileName.slice(src.length + 1), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 });
  const literalBody = node => ts.isTemplateExpression(node)
    ? node.head.text + node.templateSpans.map(span => ' /*EXPR*/ ' + span.literal.text).join('')
    : node.text;
  function visit(node) {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node))
      && SQL_START.test(literalBody(node))) {
      literals.push(node);
      sqlLiterals++;
      if (ts.isTemplateExpression(node)) dynamicLiterals++;
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'prepare' && node.arguments.length) callSites.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);

  // Resolve only immutable, statically known strings. The type checker's actual
  // lexical binding prevents a shadowed parameter from inheriting a same-named
  // const elsewhere. Calls, mutable variables and imported SQL remain unknown.
  function staticString(node, seen = new Set()) {
    if (seen.has(node)) return null;
    seen = new Set(seen).add(node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      used.add(node);
      return node.text;
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node)) return staticString(node.expression, seen);
    if (ts.isIdentifier(node)) {
      const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
      if (declaration && ts.isVariableDeclaration(declaration) && ts.isIdentifier(declaration.name)
        && ts.isVariableDeclarationList(declaration.parent) && (declaration.parent.flags & ts.NodeFlags.Const)
        && declaration.initializer) return staticString(declaration.initializer, seen);
      return null;
    }
    if (ts.isTemplateExpression(node)) {
      used.add(node);
      const spans = node.templateSpans.map(span => staticString(span.expression, seen));
      if (spans.some(value => value === null)) return null;
      return node.head.text + node.templateSpans.map((span, index) => spans[index] + span.literal.text).join('');
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = staticString(node.left, seen);
      const right = staticString(node.right, seen);
      return left !== null && right !== null ? left + right : null;
    }
    return null;
  }

  for (const call of callSites) {
    calls++;
    const sql = staticString(call.arguments[0]);
    if (sql === null) {
      unresolved.push({ ...site(call), what: 'runtime SQL: complete statement not statically available' });
      continue;
    }
    try {
      db.prepare(sql);
      prepared++;
    } catch (error) {
      const message = String(error.message);
      // SQLite extensions/UDFs need the runtime, so they are not evidence that
      // a table/column is absent. Every other preparation error is a real fault
      // in the statically known statement passed to prepare, syntax included.
      if (/no such function|no such module/i.test(message)) unresolved.push({ ...site(call), what: `runtime SQLite extension: ${message}` });
      else faults.push({ ...site(call), what: message });
    }
  }
  for (const literal of literals) {
    if (!used.has(literal)) {
      untracedLiterals++;
      unresolved.push({ ...site(literal), what: 'SQL-looking literal is not a complete database call; possible fragment, prose, or untraced SQL' });
    }
  }
}

const tables = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type IN ('table','view')").get().n;
console.log(`${tables} tables/views in schema.sql; ${files.length} top-level source files inspected`);
console.log(`${sqlLiterals} SQL-looking literals (${dynamicLiterals} interpolated); ${calls} prepare call sites`);
console.log(`${prepared} complete statements prepared; ${faults.length} preparation faults; ${unresolved.length} unresolved sites (${unresolved.length - untracedLiterals} calls, ${untracedLiterals} untraced SQL-looking literals)`);
if (unresolved.length) {
  console.log('\nUnresolved / NOT verified (no application SQL was executed):');
  for (const entry of unresolved) console.log(`  ${entry.file}:${entry.line}  ${entry.what}`);
}
if (faults.length) {
  console.log(`\n${faults.length} proven preparation fault(s):`);
  for (const fault of faults) console.log(`  ${fault.file}:${fault.line}  ${fault.what}`);
} else console.log('\nNo preparation faults in the statically verified calls. Unresolved sites are not a clean bill of health.');
db.close();
process.exitCode = faults.length ? 1 : 0;
