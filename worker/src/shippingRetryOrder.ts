// The hourly run reads at most a handful of notices. Notices waiting on setup
// or on a contact (config_required, needs_contact) are re-checked every hour
// and must never fill that handful ahead of a notice that can actually be
// sent, so sendable ones are read first.

export const SENDABLE_STATES = ['pending', 'retry_scheduled'] as const;

export function sendableFirst(stateColumn: string): string {
  return `CASE WHEN ${stateColumn} IN (${SENDABLE_STATES.map(s => `'${s}'`).join(',')}) THEN 0 ELSE 1 END`;
}
