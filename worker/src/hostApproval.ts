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

import { anyoneHostsOpen } from '../../src/lib/anyoneHosts';

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

// ── Launch 3, anyone can host (todo/plans/guests-and-tea-masters-launch-3-run.md,
// slice J1: the contract). Adrian, 2026-11-26:
//
// - Anyone signed in can host, from their own private account (made on first
//   use, as in Launch 2), by request only: every seat needs the host's yes.
// - His approval (host_approved_at) is a second level. It adds the by-link
//   door, and later reach (J10). It is never named or labelled on the site.
// - He can stop one host (users.hosting_stopped_at, migration 0141): no new
//   table and no new seat. Guests already confirmed keep what they had, and
//   stopping is never shown to a guest as a reason.
// - A host's first session is never listed anywhere, whatever reach says.
// - Reach (users.host_reach: 'invitation' | 'teajia' | 'listed', NULL read
//   as 'invitation') is set only by Adrian in Manage and read only by the
//   server. Its routes are J10's; nothing here reads it.
//
// The switch is ANYONE_HOSTS_OPEN (src/lib/anyoneHosts.ts), read through
// anyoneMayHost(env). It stands on Launch 2's switch (src/lib/fewHosts.ts):
// every host route still answers 404 while Launch 2 is closed. With the
// Launch 3 switch off, everything behaves exactly as Launch 2.

/** Whether Launch 3's switch lets anyone signed in host. */
export function anyoneMayHost(env: { ANYONE_HOSTS_OPEN?: string } | null | undefined): boolean {
  return anyoneHostsOpen(env);
}

/** What the server knows of a person as a host. Never sent to a guest. */
export type HostStanding = { approved: boolean; stopped: boolean };

/**
 * The doors a person may give their own table, or null when they may not host
 * at all. The one place the hosting gate lives. A stopped host has none. An
 * approved host has both doors. Anyone else may host only once `anyoneHosts`
 * (anyoneMayHost) is true, and then by request only. 'open' is never offered
 * here; it arrives with reach set by hand (J10), for approved hosts.
 *
 * `standing` may be the approval alone, as Launch 2 passed it.
 */
export function hostDoorsFor(standing: boolean | HostStanding, anyoneHosts: boolean): HostDoor[] | null {
  const { approved, stopped } = typeof standing === 'boolean' ? { approved: standing, stopped: false } : standing;
  if (stopped) return null;
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

/** The person's approval, and whether Adrian stopped them, in one read. */
export async function hostStanding(db: D1Database, userId: string): Promise<HostStanding> {
  if (!userId) return { approved: false, stopped: false };
  const row = await db.prepare(`SELECT host_approved_at IS NOT NULL AS approved, hosting_stopped_at IS NOT NULL AS stopped
      FROM users WHERE id = ?`).bind(userId).first<{ approved: number; stopped: number }>();
  return { approved: Number(row?.approved) === 1, stopped: Number(row?.stopped) === 1 };
}

/**
 * True when the owner of this personal account was stopped by Adrian. Needs
 * the accounts alias. Read where a new seat is made: a stopped host's table
 * still opens for the guests it already has, and takes no one new.
 */
export function hostingStoppedSql(account: string): string {
  return `(${personalAccountSql(account)} AND EXISTS (SELECT 1 FROM users stopped_host
    WHERE stopped_host.id = ${account}.owner_user_id AND stopped_host.hosting_stopped_at IS NOT NULL))`;
}

/**
 * The door a guest meets at this session. The by-link door is the approved
 * host's: a private account's table whose host no longer carries the approval
 * is met by request, so every seat needs their yes. Everything else is the
 * stored door as it is. Needs the accounts and events aliases.
 */
export function hostDoorSql(account: string, event: string): string {
  return `(CASE WHEN ${event}.door = 'link' AND ${personalAccountSql(account)} AND ${account}.host_approved_at IS NULL
    THEN 'request' ELSE ${event}.door END)`;
}

/**
 * False for a host's first session: the earliest made of the sessions that
 * name them as host. Every list a hosted session could appear in adds this
 * (A3 item 4), whatever reach says. A session with no host_user_id (a shop's
 * own session) is unaffected. Needs the events alias.
 */
export function listableHostedSessionSql(event: string): string {
  return `(${event}.host_user_id IS NULL OR EXISTS (SELECT 1 FROM events earlier_table
    WHERE earlier_table.host_user_id = ${event}.host_user_id
      AND (earlier_table.created_at < ${event}.created_at
        OR (earlier_table.created_at = ${event}.created_at AND earlier_table.id < ${event}.id))))`;
}

/**
 * Stop one host, or let them host again. The caller has already checked that
 * the actor is the platform owner. Nothing else changes: their sessions,
 * guests, notes and approval stay as they were.
 */
export async function setHostingStopped(db: D1Database, userId: string, stopped: boolean, actorId: string) {
  const result = await db.prepare(stopped
    ? `UPDATE users SET hosting_stopped_at = COALESCE(hosting_stopped_at, ?),
         hosting_stopped_by = COALESCE(hosting_stopped_by, ?) WHERE id = ?`
    : 'UPDATE users SET hosting_stopped_at = NULL, hosting_stopped_by = NULL WHERE id = ?',
  ).bind(...(stopped ? [new Date().toISOString(), actorId, userId] : [userId])).run();
  if (!result.meta?.changes) return null;
  return { stopped };
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
