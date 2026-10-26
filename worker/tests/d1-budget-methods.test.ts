import { describe, expect, it, vi } from 'vitest';
import { withD1ReadBudget, d1BudgetUsage, d1BudgetFailure, settleD1Budget, D1ReadBudgetExceededError, D1UnmeteredOperationError } from '../src/d1Budget';

function database(results: any[]) {
  const execute = vi.fn(async () => results.shift() ?? { results: [], meta: { rows_read: 0 } });
  const raw = vi.fn(async () => [['same', 'same'], [1, 2]]);
  const exec = vi.fn(async () => ({ count: 2, duration: 0 }));
  const makeStatement = (): any => ({ bind: () => makeStatement(), all: execute, run: execute, raw,
    first: vi.fn(() => { throw new Error('first must use the metadata-bearing result'); }) });
  const db: any = { prepare: () => makeStatement(), batch: vi.fn(async () => results.splice(0)), exec,
    withSession: vi.fn(() => ({ prepare: () => makeStatement(), batch: db.batch,
      bookmark: 'bookmark', getBookmark() { return this.bookmark; } })) };
  return { db, execute, raw, exec };
}
const result = (rows: number, changes = 0, results: any[] = []) => ({ results, success: true,
  meta: { rows_read: rows, rows_written: changes, changes, changed_db: changes > 0 } });

describe('D1 convenience methods cannot escape the read budget', () => {
  it('meters first(), retaining row, column, null and missing-column behavior', async () => {
    const inner = database([
      result(3, 0, [{ value: 0, empty: null }]), result(4, 0, [{ value: 0 }]),
      result(5, 0, [{ empty: null }]), result(6), result(7, 0, [{ value: 9 }]),
    ]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 10 });
    expect(await db.prepare('SELECT').first()).toEqual({ value: 0, empty: null });
    expect(await db.prepare('SELECT').first('value')).toBe(0);
    expect(await db.prepare('SELECT').first('empty')).toBeNull();
    expect(await db.prepare('SELECT').first('missing')).toBeNull();
    await expect(db.prepare('SELECT').first('missing')).rejects.toThrow('D1_COLUMN_NOTFOUND: Column not found (missing)');
    expect(d1BudgetUsage(db)).toMatchObject({ rowsRead: 25, statements: 5, writesCommitted: false });
    expect(inner.execute).toHaveBeenCalledTimes(5);
  });

  it('refuses a later query before execution after first() spends the read allowance', async () => {
    const inner = database([result(101, 0, [{ total: 100 }])]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 10 });
    await expect(db.prepare('SELECT COUNT(*)').first('total')).rejects.toBeInstanceOf(D1ReadBudgetExceededError);
    await expect(db.prepare('SELECT 1').all()).rejects.toMatchObject({ writesCommitted: false });
    expect(inner.execute).toHaveBeenCalledTimes(1);
    expect(d1BudgetFailure(db)).toMatchObject({ kind: 'rows', used: 101 });
  });

  it('refuses unused metadata-free methods before they run; budget-off retains native raw duplicates', async () => {
    const inner = database([]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 10 });
    await expect(db.prepare('SELECT 1 AS same,2 AS same').raw({ columnNames: true })).rejects.toBeInstanceOf(D1UnmeteredOperationError);
    expect(d1BudgetFailure(db)).toMatchObject({ operation: 'raw', retryable: false });
    await expect(db.exec('INSERT INTO t VALUES(1);\nINSERT INTO t VALUES(2);')).rejects.toBeInstanceOf(D1UnmeteredOperationError);
    expect(d1BudgetFailure(db)).toMatchObject({ operation: 'exec', retryable: false });
    expect(inner.raw).not.toHaveBeenCalled(); expect(inner.exec).not.toHaveBeenCalled();
    const unbudgeted = withD1ReadBudget(inner.db, null);
    expect(unbudgeted).toBe(inner.db);
    expect(await unbudgeted.prepare('SELECT').raw({ columnNames: true })).toEqual([['same', 'same'], [1, 2]]);
    expect(await unbudgeted.exec('INSERT')).toEqual({ count: 2, duration: 0 });
  });

  it('shares row and statement allowances and refusal state with sessions', async () => {
    const inner = database([result(60), result(50)]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 10 });
    const session = db.withSession('first-primary');
    expect(session.getBookmark()).toBe('bookmark');
    await db.prepare('SELECT').all();
    await expect(session.prepare('SELECT').first()).rejects.toMatchObject({ used: 110 });
    expect(d1BudgetUsage(session)).toEqual(d1BudgetUsage(db));
    expect(d1BudgetFailure(session)).toBe(d1BudgetFailure(db));
    await expect(db.withSession().prepare('SELECT').all()).rejects.toBeInstanceOf(D1ReadBudgetExceededError);
    expect(inner.execute).toHaveBeenCalledTimes(2);
  });
});

describe('a budget cannot misreport committed writes as a retryable failure', () => {
  it.each(['run', 'all', 'first'] as const)('returns committed %s result, then flags a subsequent refused operation as partial completion', async method => {
    const write = result(101, 1, [{ id: 'created' }]);
    const inner = database([write]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 10 });
    const response = await db.prepare('INSERT RETURNING id')[method]();
    expect(response).toEqual(method === 'first' ? { id: 'created' } : write);
    expect(d1BudgetFailure(db)).toBeNull();
    expect(d1BudgetUsage(db)).toMatchObject({ rowsRead: 101, writesCommitted: true, budgetExceeded: true });
    await expect(db.prepare('UPDATE next').run()).rejects.toMatchObject({ writesCommitted: true });
    expect(inner.execute).toHaveBeenCalledTimes(1);
    expect(d1BudgetFailure(db)?.writesCommitted).toBe(true);
  });

  it('accounts for all committed batch results before testing its read cost', async () => {
    const outputs = [result(101), result(1, 1)];
    const inner = database([...outputs]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 10 });
    expect(await db.batch([db.prepare('SELECT'), db.prepare('INSERT')])).toEqual(outputs);
    expect(d1BudgetUsage(db)).toMatchObject({ rowsRead: 102, writesCommitted: true, budgetExceeded: true });
    expect(d1BudgetFailure(db)).toBeNull();
    await expect(db.prepare('SELECT next').all()).rejects.toMatchObject({ writesCommitted: true });
    expect(inner.db.batch).toHaveBeenCalledTimes(1);
  });

  it('refuses an oversized batch before executing any of it', async () => {
    const inner = database([result(1, 1), result(1, 1)]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 1 });
    await expect(db.batch([db.prepare('INSERT'), db.prepare('INSERT')])).rejects.toMatchObject({ kind: 'statements', writesCommitted: false });
    expect(inner.db.batch).not.toHaveBeenCalled();
    await expect(db.prepare('INSERT fallback').run()).rejects.toMatchObject({ kind: 'statements' });
    expect(inner.execute).not.toHaveBeenCalled();
  });

  it('preserves prior committed state when a subsequent statement allowance is exhausted', async () => {
    const inner = database([result(1, 1)]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 1 });
    await db.prepare('INSERT').run();
    await expect(db.withSession().prepare('INSERT next').run()).rejects.toMatchObject({ kind: 'statements', writesCommitted: true });
    expect(inner.execute).toHaveBeenCalledTimes(1);
  });

  it('returns an already completed follow-up read; only a further operation is refused', async () => {
    const inner = database([result(1, 1), result(100, 0, [{ id: 'created' }])]);
    const db = withD1ReadBudget(inner.db, { rows: 100, statements: 10 });
    await db.prepare('INSERT').run();
    expect(await db.prepare('SELECT saved').first()).toEqual({ id: 'created' });
    expect(d1BudgetFailure(db)).toBeNull();
    await expect(db.prepare('SELECT again').all()).rejects.toMatchObject({ writesCommitted: true });
    expect(inner.execute).toHaveBeenCalledTimes(2);
  });
  it('waits for an already-started write before classifying a concurrent read refusal', async () => {
    let finishWrite!: (value: unknown) => void;
    const writeResult = new Promise(resolve => { finishWrite = resolve; });
    const db = withD1ReadBudget({ prepare: (sql: string) => ({
      all: async () => result(101), run: () => writeResult,
    }) }, { rows: 100, statements: 10 });
    const writing = db.prepare('INSERT').run();
    await expect(db.prepare('SELECT').all()).rejects.toMatchObject({ writesCommitted: false });
    let settled = false;
    const settlement = settleD1Budget(db).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finishWrite(result(1, 1));
    await writing;
    await settlement;
    expect(d1BudgetFailure(db)).toMatchObject({ writesCommitted: true });
    expect(d1BudgetUsage(db)).toMatchObject({ rowsRead: 102, writesCommitted: true });
  });

});
