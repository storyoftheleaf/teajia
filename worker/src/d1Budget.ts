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
 * `first()` uses the same native query as `all()` and then projects its first
 * row; keeping that projection here makes its real row cost visible too.
 * `raw()` and `exec()` expose no metadata and have no application callsites.
 * Under an active budget they are refused before execution, rather than
 * silently escaping the budget or changing raw column/duplicate semantics.
 *
 * A successful write is never turned into an error by post-execution billing.
 * Its result is returned; if a later operation exceeds the remaining allowance,
 * the refusal records that earlier writes committed. Callers must expose that
 * as partial completion without automatic retry, not pretend nothing happened.

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
export type D1BudgetUsage = {
  rowsRead: number;
  statements: number;
  caps: D1BudgetCaps;
  writesCommitted: boolean;
  budgetExceeded: boolean;
};

const LEDGER = Symbol.for('teajia.d1.budget.ledger');
const INNER_STATEMENT = Symbol.for('teajia.d1.budget.inner');
const failures = new WeakMap<object, D1ReadBudgetExceededError | D1UnmeteredOperationError>();
const pending = new WeakMap<object, Set<Promise<unknown>>>();

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
  writesCommitted: boolean;
  constructor(kind: 'rows' | 'statements', used: number, budget: number, writesCommitted = false) {
    super(kind === 'rows'
      ? `Database read budget exceeded for this request: ${used} rows read, budget ${budget}`
      : `Database read budget exceeded for this request: ${used} statements, budget ${budget}`);
    this.name = 'D1ReadBudgetExceededError';
    this.kind = kind;
    this.used = used;
    this.budget = budget;
    this.writesCommitted = writesCommitted;
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

/** These unused convenience methods discard D1's billing metadata. */
export class D1UnmeteredOperationError extends Error {
  readonly retryable = false;
  constructor(readonly operation: 'raw' | 'exec', public writesCommitted = false) {
    super(`Database ${operation} is unavailable with an active read budget; use metadata-bearing prepared statements or batch instead.`);
    this.name = 'D1UnmeteredOperationError';
  }
}

export function isD1UnmeteredOperationError(error: unknown): error is D1UnmeteredOperationError {
  return error instanceof D1UnmeteredOperationError
    || (!!error && typeof error === 'object' && (error as { name?: unknown }).name === 'D1UnmeteredOperationError');
}

/** Actual refusal, including one swallowed by an older route's catch block. */
export function d1BudgetFailure(db: unknown): D1ReadBudgetExceededError | D1UnmeteredOperationError | null {
  const ledger = (db as Record<symbol, D1BudgetUsage> | null | undefined)?.[LEDGER];
  const failure = ledger ? failures.get(ledger) ?? null : null;
  if (failure && ledger?.writesCommitted) failure.writesCommitted = true;
  return failure;
}

/** Let already-started operations settle before deciding whether retry is safe. */
export async function settleD1Budget(db: unknown): Promise<void> {
  const ledger = (db as Record<symbol, D1BudgetUsage> | null | undefined)?.[LEDGER];
  if (!ledger) return;
  const active = pending.get(ledger);
  while (active?.size) await Promise.allSettled([...active]);
  d1BudgetFailure(db);
}

async function tracked<T>(ledger: D1BudgetUsage, action: () => Promise<T>, results: (value: T) => any[]): Promise<T> {
  const active = pending.get(ledger) ?? new Set<Promise<unknown>>();
  pending.set(ledger, active);
  const operation = (async () => {
    const value = await action();
    recordResults(ledger, results(value));
    return value;
  })();
  active.add(operation);
  try { return await operation; } finally { active.delete(operation); }
}

function refuseUnmetered(ledger: D1BudgetUsage, operation: 'raw' | 'exec'): never {
  const error = new D1UnmeteredOperationError(operation, ledger.writesCommitted);
  failures.set(ledger, error);
  throw error;
}

function refuse(ledger: D1BudgetUsage, kind: 'rows' | 'statements', used: number, budget: number): never {
  ledger.budgetExceeded = true;
  const error = new D1ReadBudgetExceededError(kind, used, budget, ledger.writesCommitted);
  failures.set(ledger, error);
  throw error;
}

function reserveStatements(ledger: D1BudgetUsage, count: number) {
  const previous = failures.get(ledger);
  if (previous) {
    if (ledger.writesCommitted) previous.writesCommitted = true;
    throw previous;
  }
  // Check before sending anything, including after an earlier write exceeded
  // the observed row allowance. An exhausted ledger cannot run one more scan.
  if (ledger.rowsRead > ledger.caps.rows) refuse(ledger, 'rows', ledger.rowsRead, ledger.caps.rows);
  const next = ledger.statements + count;
  if (next > ledger.caps.statements) refuse(ledger, 'statements', next, ledger.caps.statements);
  ledger.statements = next;
}

function recordResults(ledger: D1BudgetUsage, results: any[]) {
  // Record the entire batch before deciding: a SELECT may precede a committed
  // INSERT, and throwing on that SELECT's meta would misreport the whole batch.
  for (const result of results) {
    const meta = result?.meta;
    const read = Number(meta?.rows_read);
    if (Number.isFinite(read) && read > 0) ledger.rowsRead += read;
    if (meta?.changed_db === true || Number(meta?.rows_written) > 0 || Number(meta?.changes) > 0) {
      ledger.writesCommitted = true;
      const priorFailure = failures.get(ledger);
      if (priorFailure) priorFailure.writesCommitted = true;
    }
  }
  if (ledger.rowsRead > ledger.caps.rows) {
    ledger.budgetExceeded = true;
    // Do not turn a committed mutation (or its completed follow-up read) into
    // a retryable failure. A subsequent operation is stopped before it runs.
    if (!ledger.writesCommitted) refuse(ledger, 'rows', ledger.rowsRead, ledger.caps.rows);
  }
}

function wrapStatement(statement: any, ledger: D1BudgetUsage): any {
  const execute = async (method: 'all' | 'run', args: unknown[]): Promise<any> => {
    reserveStatements(ledger, 1);
    return tracked(ledger, () => statement[method](...args), result => [result]);
  };
  return {
    [INNER_STATEMENT]: statement,
    bind: (...values: unknown[]) => wrapStatement(statement.bind(...values), ledger),
    first: async (column?: string) => {
      // Native workerd first() performs the same query as all(), then applies
      // this projection; it does not implicitly add LIMIT 1. Preserve null,
      // named-column, missing-column and duplicate-column object semantics.
      const result = await execute('all', []);
      const row = result.results?.[0];
      if (!row) return null;
      if (column === undefined) return row;
      if (row[column] === undefined) {
        throw new Error(`D1_COLUMN_NOTFOUND: Column not found (${column})`, { cause: new Error('Column not found') });
      }
      return row[column];
    },
    all: (...args: unknown[]) => execute('all', args),
    run: (...args: unknown[]) => execute('run', args),
    raw: async () => refuseUnmetered(ledger, 'raw'),
  };
}

const unwrap = (statement: any) => statement?.[INNER_STATEMENT] ?? statement;

function wrapDatabase<T>(db: T, ledger: D1BudgetUsage): T {
  const inner = db as any;
  const wrapped: any = Object.create(inner);
  wrapped[LEDGER] = ledger;
  wrapped.prepare = (sql: string) => wrapStatement(inner.prepare(sql), ledger);
  wrapped.batch = async (statements: any[]) => {
    const list = Array.isArray(statements) ? statements : [];
    reserveStatements(ledger, list.length);
    return tracked(ledger, () => inner.batch(list.map(unwrap)), results => Array.isArray(results) ? results : []);
  };
  if (typeof inner.exec === 'function') {
    wrapped.exec = async () => refuseUnmetered(ledger, 'exec');
  }
  if (typeof inner.withSession === 'function') {
    // Sessions change routing/bookmarks, not the request's allowance.
    wrapped.withSession = (...args: unknown[]) => wrapDatabase(inner.withSession(...args), ledger);
  }
  for (const key of ['dump', 'close', 'sqlite', 'getBookmark']) {
    if (key in inner) {
      const value = inner[key];
      wrapped[key] = typeof value === 'function' ? value.bind(inner) : value;
    }
  }
  return wrapped as T;
}

/** One request ledger, shared by nested wrappers and every database session. */
export function withD1ReadBudget<T>(db: T, caps: D1BudgetCaps | null): T {
  if (!db || !caps || d1BudgetUsage(db)) return db;
  return wrapDatabase(db, {
    rowsRead: 0, statements: 0, caps: { ...caps }, writesCommitted: false, budgetExceeded: false,
  });
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
