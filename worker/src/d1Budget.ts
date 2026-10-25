/**
 * A request may not read the whole database. One budget, at the one place the
 * database enters a request.
 *
 * On 2026-10-24 the D1 free tier's 5,000,000 daily row reads were exhausted at
 * about 5.54M and the whole API stopped answering — not slowly, not partly, and
 * not with a message anybody could act on. The cause was a single reading
 * (`readCurateHoldings`) that scanned about 93,817 rows per call behind
 * `search_tea`, so roughly sixty ordinary agent calls spent a day's allowance.
 * That reading is fixed, but the shape of the failure is the thing worth
 * guarding: one query nobody measured, on a path called often, with no ceiling
 * anywhere between it and the quota that keeps the shop online.
 *
 * So every statement a request runs is counted here, and a request that has
 * read more than its share is refused the NEXT query rather than being allowed
 * to spend the day. Two numbers, both deliberate:
 *
 * - **Rows read** is the one D1 actually bills, and the one that took the site
 *   down. It is summed from each result's `meta.rows_read`, which is D1's own
 *   count, not an estimate of ours.
 * - **Statements** is the second shape of the same fault: ten thousand cheap
 *   point lookups in a loop read few rows each and still exhaust a day. An
 *   N+1 that each reads one row is invisible to a rows-only budget.
 *
 * **It charges after the fact, and that is a real limit, not an oversight.**
 * Nothing can know what a query will read before it runs, so a single
 * unbounded scan still lands once; what this stops is the second one, and the
 * request. That is why the hard page caps on the holdings and search paths
 * exist alongside it: the caps bound one query, the budget bounds one request,
 * and neither does the other's job.
 *
 * **`first()` carries no meta, so only its statement is counted.** D1's
 * `.first()` returns the row and nothing else; the row count is available on
 * `.all()`, `.run()` and `batch()`. Rewriting `first()` to go through `all()`
 * would buy the number at the price of fetching every row of a query written
 * to want one, so it is counted as a statement and documented here instead.
 * Every unbounded read in this codebase is an `.all()`.
 */

/** Rows read one request may bill to D1 before it is refused. */
export const DEFAULT_D1_ROWS_READ_BUDGET = 50_000;
/**
 * Statements one request may run. High enough that a bulk import of fifty
 * products with their listing mirrors and ledger rows is nowhere near it, low
 * enough that a loop which forgot its bound cannot run all day.
 */
export const DEFAULT_D1_STATEMENT_BUDGET = 2_000;

export type D1BudgetCaps = { rows: number; statements: number };
export type D1BudgetUsage = { rowsRead: number; statements: number; caps: D1BudgetCaps };

const LEDGER = Symbol.for('teajia.d1.budget.ledger');
const INNER_STATEMENT = Symbol.for('teajia.d1.budget.inner');

/**
 * Thrown by the wrapper, caught at the request boundary. `name` is checked as
 * well as the prototype because the worker bundle and the test harness can
 * hold separate copies of this module and `instanceof` would then be false for
 * an error that is plainly ours.
 */
export class D1ReadBudgetExceededError extends Error {
  readonly kind: 'rows' | 'statements';
  readonly used: number;
  readonly budget: number;
  constructor(kind: 'rows' | 'statements', used: number, budget: number) {
    super(kind === 'rows'
      ? `Database read budget exceeded for this request: ${used} rows read, budget ${budget}`
      : `Database read budget exceeded for this request: ${used} statements, budget ${budget}`);
    this.name = 'D1ReadBudgetExceededError';
    this.kind = kind;
    this.used = used;
    this.budget = budget;
  }
}

export function isD1ReadBudgetExceeded(error: unknown): error is D1ReadBudgetExceededError {
  return error instanceof D1ReadBudgetExceededError
    || (!!error && typeof error === 'object' && (error as { name?: unknown }).name === 'D1ReadBudgetExceededError');
}

/**
 * The caps for this deploy. A positive finite override wins; the string `off`
 * disables the budget entirely, because a guardrail with no off-switch is a
 * new way to take the shop down and the person who needs it off at 3am should
 * not need a deploy. Anything else — blank, absent, zero, a word — is the
 * default, since a budget of zero rows refuses every request.
 */
export function resolveD1Budget(env: Record<string, unknown> | undefined | null): D1BudgetCaps | null {
  const read = (key: string, fallback: number): number | null => {
    const raw = env?.[key];
    if (typeof raw === 'string' && raw.trim().toLowerCase() === 'off') return null;
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : NaN;
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const rows = read('D1_ROWS_READ_BUDGET', DEFAULT_D1_ROWS_READ_BUDGET);
  if (rows === null) return null;
  const statements = read('D1_STATEMENT_BUDGET', DEFAULT_D1_STATEMENT_BUDGET);
  if (statements === null) return null;
  return { rows, statements };
}

/** What a request has spent so far, or null for a database nobody wrapped. */
export function d1BudgetUsage(db: unknown): D1BudgetUsage | null {
  const ledger = (db as Record<symbol, D1BudgetUsage> | null | undefined)?.[LEDGER];
  return ledger ? { ...ledger, caps: { ...ledger.caps } } : null;
}

function chargeStatements(ledger: D1BudgetUsage, count: number) {
  ledger.statements += count;
  if (ledger.statements > ledger.caps.statements) {
    throw new D1ReadBudgetExceededError('statements', ledger.statements, ledger.caps.statements);
  }
}

function chargeRows(ledger: D1BudgetUsage, meta: unknown) {
  const read = Number((meta as { rows_read?: unknown } | null | undefined)?.rows_read);
  if (Number.isFinite(read) && read > 0) ledger.rowsRead += read;
  if (ledger.rowsRead > ledger.caps.rows) {
    throw new D1ReadBudgetExceededError('rows', ledger.rowsRead, ledger.caps.rows);
  }
}

function wrapStatement(statement: any, ledger: D1BudgetUsage): any {
  return {
    [INNER_STATEMENT]: statement,
    bind: (...values: unknown[]) => wrapStatement(statement.bind(...values), ledger),
    first: async (...args: unknown[]) => {
      chargeStatements(ledger, 1);
      return statement.first(...args);
    },
    all: async (...args: unknown[]) => {
      chargeStatements(ledger, 1);
      const result = await statement.all(...args);
      chargeRows(ledger, result?.meta);
      return result;
    },
    run: async (...args: unknown[]) => {
      chargeStatements(ledger, 1);
      const result = await statement.run(...args);
      chargeRows(ledger, result?.meta);
      return result;
    },
    raw: async (...args: unknown[]) => {
      chargeStatements(ledger, 1);
      return statement.raw(...args);
    },
  };
}

const unwrap = (statement: any) => statement?.[INNER_STATEMENT] ?? statement;

/**
 * The same database, counting. Idempotent: handed a database already under a
 * budget it returns it unchanged, so the request entry point and the MCP
 * handler can each ask for one without the request paying twice.
 *
 * `caps` of null means no budget, and the database is returned untouched.
 */
export function withD1ReadBudget<T>(db: T, caps: D1BudgetCaps | null): T {
  if (!db || !caps) return db;
  if (d1BudgetUsage(db)) return db;
  const inner = db as any;
  const ledger: D1BudgetUsage = { rowsRead: 0, statements: 0, caps: { ...caps } };
  const wrapped: any = Object.create(inner);
  wrapped[LEDGER] = ledger;
  wrapped.prepare = (sql: string) => wrapStatement(inner.prepare(sql), ledger);
  wrapped.batch = async (statements: any[]) => {
    const list = Array.isArray(statements) ? statements : [];
    chargeStatements(ledger, list.length);
    const results = await inner.batch(list.map(unwrap));
    for (const result of Array.isArray(results) ? results : []) chargeRows(ledger, result?.meta);
    return results;
  };
  if (typeof inner.exec === 'function') {
    wrapped.exec = async (sql: string) => {
      chargeStatements(ledger, 1);
      const result = await inner.exec(sql);
      chargeStatements(ledger, Math.max(1, Number(result?.count) || 1) - 1);
      return result;
    };
  }
  if (typeof inner.withSession === 'function') {
    wrapped.withSession = (...args: unknown[]) => withD1ReadBudget(inner.withSession(...args), caps);
  }
  for (const key of ['dump', 'close', 'sqlite']) {
    if (key in inner) {
      const value = inner[key];
      wrapped[key] = typeof value === 'function' ? value.bind(inner) : value;
    }
  }
  return wrapped as T;
}

/**
 * Why the database could not answer — because the three answers need
 * different words, and for months they all got the same ones.
 *
 * The MCP auth path caught every failure of its three `mcp_tokens`, `users`
 * and `account_members` reads and answered `-32002 Authentication dependency
 * unavailable`. On 2026-10-24 that was the only thing the one connected agent
 * could see while D1 refused every query in the account: the token was
 * perfectly good, the quota was gone, and the message sent whoever read it to
 * mint a second token that failed identically. A quota failure reported as an
 * auth failure is worse than no message, because it is confidently wrong about
 * which half is broken.
 *
 * `quota` is the daily row-read allowance, which comes back tomorrow and is
 * fixed by reading less. `budget` is this request's own ceiling, which is
 * fixed by asking for less. `database` is D1 being unreachable or refusing,
 * which is fixed by waiting. `auth` is everything else, which may genuinely be
 * the token.
 */
export type D1FailureKind = 'budget' | 'quota' | 'database' | 'auth';

const QUOTA_PATTERNS = [
  /free[ -]tier daily row read/i,
  /daily (row )?read limit/i,
  /row read limit/i,
  /exceeded .*(limit|quota)/i,
  /\bquota\b/i,
  /too many (api )?requests/i,
];

const DATABASE_PATTERNS = [
  /\bD1_(ERROR|EXEC_ERROR|TYPE_ERROR|COLUMN_NOTFOUND|DUMP_ERROR)\b/i,
  /network connection lost/i,
  /storage (operation|error|limit)/i,
  /database is locked/i,
  /\bSQLITE_/i,
  /internal error in D1/i,
  /cannot (connect|reach) .*database/i,
];

/**
 * Reads the message and the `cause` chain, and D1's numeric `code` (7500 is
 * `D1_ERROR`). A wrapped error carries the useful half in `cause`, which is
 * where the quota message actually arrives.
 */
export function classifyD1Failure(error: unknown): D1FailureKind {
  if (isD1ReadBudgetExceeded(error)) return 'budget';
  const texts: string[] = [];
  const codes: number[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const record = current as { message?: unknown; code?: unknown; cause?: unknown };
    if (typeof record.message === 'string') texts.push(record.message);
    const code = Number(record.code);
    if (Number.isFinite(code)) codes.push(code);
    current = record.cause;
  }
  if (typeof error === 'string') texts.push(error);
  const text = texts.join(' | ');
  if (QUOTA_PATTERNS.some(pattern => pattern.test(text))) return 'quota';
  if (codes.includes(7500) || DATABASE_PATTERNS.some(pattern => pattern.test(text))) return 'database';
  return 'auth';
}
