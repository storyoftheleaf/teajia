import { d1BudgetFailure, d1BudgetUsage, isD1ReadBudgetExceeded, isD1UnmeteredOperationError } from './d1Budget';

/** A refusal after a committed change is reconciliation, never a replay. */
export function budgetRefusal(db: unknown, caught?: unknown) {
  const failure = d1BudgetFailure(db) ?? caught;
  if (!isD1ReadBudgetExceeded(failure) && !isD1UnmeteredOperationError(failure)) return null;
  const usage = d1BudgetUsage(db);
  const committed = Boolean(usage?.writesCommitted || failure.writesCommitted);
  const unmetered = isD1UnmeteredOperationError(failure);
  return {
    status: committed ? 409 : 503,
    rpcCode: committed ? -32005 : -32003,
    body: {
      error: committed ? 'database_write_reconciliation_required' : unmetered ? 'database_unmetered_operation' : 'database_read_budget_exceeded',
      code: committed ? 'database_write_reconciliation_required' : unmetered ? 'database_unmetered_operation' : 'database_read_budget_exceeded',
      message: committed
        ? 'Earlier database changes may have completed. Refresh and check the result before making any further changes; do not repeat this request automatically.'
        : unmetered ? 'This database operation cannot be safely measured. The service needs a repair before this request can run.'
          : 'This request asked the database for more than any one request may read. Ask for a page, a single tea, or a shorter range, and try again.',
      reason: committed ? 'reconciliation_required' : unmetered ? 'unmetered_operation' : 'budget',
      retryable: false,
      writes_committed: committed,
      rows_read: usage?.rowsRead ?? null,
      statements: usage?.statements ?? null,
      rows_budget: usage?.caps.rows ?? null,
      statement_budget: usage?.caps.statements ?? null,
    },
  };
}
