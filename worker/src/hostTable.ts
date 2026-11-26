// Host a table on one screen (Launch 2, slice H3). A STUB written with the
// contract (slice H1) so the route exists; Sol builds the body in H3.
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H3".
//
// The route (POST /api/me/tables in index.ts) has already checked the Launch 2
// switch, the caller's host approval and the input, refused door 'open', and
// made the caller's personal account. This makes one session in that account.
// A hosted table always sets door, requires_approval to match it,
// public_visibility = 'unlisted', network_discovery = 0 and host_user_id.

export type HostedTableDoor = 'request' | 'link';

export type HostedTableInput = {
  accountId: string;
  hostUserId: string;
  hostName: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24 hour */
  time: string;
  /** An IANA time zone name. */
  timezone: string;
  /** A whole number of seats. A number is always stored (hard question 9). */
  seats: number;
  door: HostedTableDoor;
  /** The table's name, when the host gave one. */
  name: string | null;
  appOrigin: string;
};

export type HostedTable = { id: string; slug: string; link: string };

/** A plain refusal the route answers with 400, e.g. a day already past. */
export type HostedTableRefusal = { refused: { code: string; error: string } };

/** Makes one hosted table, or refuses it. Returns null until H3 builds it. */
export async function createHostedTable(_db: D1Database, _input: HostedTableInput): Promise<HostedTable | HostedTableRefusal | null> {
  return null;
}
