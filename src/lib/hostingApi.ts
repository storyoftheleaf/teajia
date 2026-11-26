// Launch 2, a few hosts (todo/plans/guests-and-tea-masters-launch-2-run.md,
// "The contract"). Reached as api.hosting and api.tables. Every route answers
// 404 until src/lib/fewHosts.ts opens, and the table routes answer 404 to
// anyone who may not host yet (in Launch 2, anyone Adrian has not approved).

/** 'open' exists in the table's check but every route refuses it until Launch 3. */
export type HostedTableDoor = 'request' | 'link';
/** doors: what this person may give a table, or null when they may not host yet. */
export interface HostingStatus { approved: boolean; account_id: string | null; doors: HostedTableDoor[] | null }
export interface HostedTableInput {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24 hour */
  time: string;
  /** An IANA time zone name. */
  timezone: string;
  /** Defaults to 6. */
  seats?: number;
  /** Defaults to 'request'. */
  door?: HostedTableDoor;
  name?: string | null;
}
export interface HostedTableCreated { id: string; slug: string; link: string }
export interface HostedTableSummary {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  timezone: string | null;
  /** NULL only on an older session; a hosted table always sets it. */
  door: HostedTableDoor | 'open' | null;
  seats: number;
  lifecycle_status: string;
  guests: { confirmed: number; requested: number; waitlist: number };
  link: string;
}
export interface HostedTableGuest {
  id: string;
  full_name: string;
  status: 'confirmed' | 'waitlist' | 'cancelled' | 'requested' | 'denied';
  plus_one: number | null;
  attended: number | null;
  created_at: string | null;
  /** What the guest wrote when they asked for a seat. */
  note: string | null;
  /** The phone number the guest gave, for the host's own WhatsApp. */
  phone: string | null;
  /** The guest asked not to be photographed. */
  no_photographs: boolean;
}
export interface HostedTableTea { id: string; name: string | null; product_id: string | null; brew_order: number | null }
export interface HostedTableDetail {
  table: Omit<HostedTableSummary, 'guests'> & { requires_approval: number; public_visibility: string; seats_taken: number };
  guests: HostedTableGuest[];
  teas: HostedTableTea[];
  /** The doors this host may give the table. */
  doors: HostedTableDoor[];
}
export interface HostedTableChange { door?: HostedTableDoor; seats?: number }
/** The host's private line about one guest (slice H9). Never shown to the guest. */
export interface HostGuestNote { attendee_id: string; note: string; updated_at: string }

interface HostingApiDependencies {
  apiUrl: string;
  authedFetch: (url: string, init?: RequestInit) => Promise<any>;
}

export function createHostingApi({ apiUrl, authedFetch }: HostingApiDependencies) {
  return {
    get: (): Promise<HostingStatus> => authedFetch(`${apiUrl}/api/me/hosting`),
  };
}

export function createTablesApi({ apiUrl, authedFetch }: HostingApiDependencies) {
  return {
    create: (input: HostedTableInput): Promise<HostedTableCreated> => authedFetch(`${apiUrl}/api/me/tables`, {
      method: 'POST', body: JSON.stringify(input),
    }),
    list: (): Promise<{ tables: HostedTableSummary[] }> => authedFetch(`${apiUrl}/api/me/tables`),
    get: (id: string): Promise<HostedTableDetail> => authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}`),
    // The host's page for one table (slice H4). Every call is the table's host's alone.
    change: (id: string, change: HostedTableChange): Promise<{ ok: true }> => authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}`, {
      method: 'PUT', body: JSON.stringify(change),
    }),
    sayYes: (id: string, guestId: string): Promise<{ ok: true; status: 'confirmed' }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/yes`, { method: 'PUT', body: '{}' }),
    sayNo: (id: string, guestId: string): Promise<{ ok: true; status: 'denied' }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/no`, { method: 'PUT', body: '{}' }),
    markWhoCame: (id: string, attendeeIds: string[]): Promise<{ ok: true }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/came`, { method: 'PUT', body: JSON.stringify({ attendee_ids: attendeeIds }) }),
    thanksLink: (id: string, guestId: string): Promise<{ credential: string; expires_at: string }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/thanks-link`, { method: 'POST', body: '{}' }),
    // The host's private guest book (slice H9).
    notes: (id: string): Promise<{ notes: HostGuestNote[] }> => authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/notes`),
    saveNote: (id: string, guestId: string, note: string): Promise<{ note: HostGuestNote | null }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/note`, {
        method: 'PUT', body: JSON.stringify({ note }),
      }),
  };
}
