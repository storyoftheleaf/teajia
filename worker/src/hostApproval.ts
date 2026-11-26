// Who may host their own table (Launch 2, "a few hosts":
// todo/plans/guests-and-tea-masters-launch-2-run.md, hard questions 2 and 3).
// Copied in shape from personalSellerApproval.ts. Adrian approves a host by
// hand. The mark lives on the person (users.host_approved_at), so it can be
// given before they open anything, and is copied onto their personal account
// (accounts.host_approved_at), which is where their tables live.
//
// Two gates stand together on every new host route in Launch 2: the switch
// (src/lib/fewHosts.ts) and this approval. The approval gate is a rollout
// step, not the lasting rule: hostDoorsFor below is where Launch 3 lifts it.

/**
 * True for a personal account whose owner Adrian approved as a host. A shop
 * account is never a small host's account, so this is false for it.
 */
export function hostApprovedSql(account: string): string {
  return `(${account}.personal_inventory_user_id IS NOT NULL
    AND ${account}.owner_user_id = ${account}.personal_inventory_user_id
    AND ${account}.host_approved_at IS NOT NULL)`;
}

/** True for a person's own private account (a Tea Chest), never for a shop. */
export function personalAccountSql(account: string): string {
  return `(${account}.personal_inventory_user_id IS NOT NULL
    AND ${account}.owner_user_id = ${account}.personal_inventory_user_id)`;
}

/**
 * Whether a session of this account may be read by its link. True for a
 * public active account, exactly as PUBLIC_EVENT_HOST in index.ts says today,
 * and also for an active personal account whose owner is an approved host,
 * which stays private in every other way. For direct session reads only (the
 * session page, its tea list, taking a seat, the guest's own page, the
 * after-sit link); never for store pages, product reads or any list.
 *
 * With `event` (the events alias), a private account's session opens only
 * when it is a hosted table of that account's own person
 * (events.host_user_id = the account owner, which the host table route
 * always sets). An older session kept in a Tea Chest stays closed.
 *
 * Adrian, 2026-11-26: anyone may make their own table; his approval is a
 * second level. Launch 2 opens to approved hosts only. When Launch 3's switch
 * (anyoneHostsOpen) is passed as `anyoneHosts`, any active personal account's
 * session opens by its link too, still found by nothing but that link.
 */
export function publicSessionHostSql(account: string, options: { anyoneHosts?: boolean; event?: string } = {}): string {
  const personal = options.anyoneHosts ? personalAccountSql(account) : hostApprovedSql(account);
  const hosted = options.event ? ` AND ${options.event}.host_user_id = ${account}.owner_user_id` : '';
  return `(${account}.status = 'active' AND (${account}.public_enabled = 1 OR (${personal}${hosted})))`;
}

export type HostDoor = 'request' | 'link';

/**
 * The doors a person may give their own table, or null when they may not host
 * at all. The one place the hosting gate lives. An approved host has both
 * doors. Anyone else may host only once `anyoneHosts` (Launch 3's switch,
 * anyoneHostsOpen) is true, and then by request only. 'open' is never offered
 * here; it arrives in Launch 3 with reach set by hand, for approved hosts.
 */
export function hostDoorsFor(approved: boolean, anyoneHosts: boolean): HostDoor[] | null {
  if (approved) return ['request', 'link'];
  return anyoneHosts ? ['request'] : null;
}

/** Whether this person carries Adrian's host approval. */
export async function hostApproved(db: D1Database, userId: string): Promise<boolean> {
  if (!userId) return false;
  const row = await db.prepare('SELECT 1 FROM users WHERE id = ? AND host_approved_at IS NOT NULL')
    .bind(userId).first();
  return Boolean(row);
}

/**
 * Approve or withdraw one host. The caller has already checked that the actor
 * is the platform owner. On withdrawal the person's tables stop opening by
 * link at once (publicSessionHostSql reads the account mark); their sessions,
 * guests and notes stay as they were.
 */
export async function setHostApproval(db: D1Database, userId: string, approved: boolean, actorId: string) {
  const now = new Date().toISOString();
  const [person] = await db.batch([
    db.prepare(approved
      ? 'UPDATE users SET host_approved_at = COALESCE(host_approved_at, ?), host_approved_by = COALESCE(host_approved_by, ?) WHERE id = ?'
      : 'UPDATE users SET host_approved_at = NULL, host_approved_by = NULL WHERE id = ?',
    ).bind(...(approved ? [now, actorId, userId] : [userId])),
    db.prepare(approved
      ? `UPDATE accounts SET host_approved_at = COALESCE(host_approved_at, ?), host_approved_by = COALESCE(host_approved_by, ?)
         WHERE personal_inventory_user_id = ? AND owner_user_id = personal_inventory_user_id`
      : `UPDATE accounts SET host_approved_at = NULL, host_approved_by = NULL
         WHERE personal_inventory_user_id = ? AND owner_user_id = personal_inventory_user_id`,
    ).bind(...(approved ? [now, actorId, userId] : [userId])),
  ]);
  if (!person.meta?.changes) return null;
  return { approved };
}
