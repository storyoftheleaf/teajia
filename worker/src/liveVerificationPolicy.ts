/** Platform-controlled flag: ordinary account settings cannot set this override. */
export const LIVE_VERIFICATION_FEATURE = 'live_verification_notifications_suppressed';
export const LIVE_VERIFICATION_POLICY = 'isolated-flow-v1';
export async function suppressVerificationNotifications(db: D1Database, accountId: string): Promise<boolean> {
  if (!/^acc_live_flow_[a-z0-9_]{8,80}$/.test(accountId)) return false;
  const row = await db.prepare('SELECT enabled FROM account_features WHERE account_id = ? AND feature = ?')
    .bind(accountId, LIVE_VERIFICATION_FEATURE).first<{enabled:number}>();
  return row?.enabled === 1;
}
