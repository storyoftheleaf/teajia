// Launch 2, a few hosts (todo/plans/guests-and-tea-masters-launch-2-run.md,
// "The contract"). Reached as api.hosting and api.tables. Every route answers
// 404 until src/lib/fewHosts.ts opens, and the table routes answer 404 to
// anyone who may not host yet (in Launch 2, anyone Adrian has not approved).
import type { VenueGuide } from '../types/events';

/**
 * 'open' (Launch 3, J10) is offered in `doors` only to a host Teajia chose to
 * show more widely; a seat there still needs the host's yes.
 */
export type HostedTableDoor = 'request' | 'link' | 'open';
/**
 * doors: what this person may give a table, or null when they may not host yet.
 * stopped (Launch 3): present and true only when Teajia paused their hosting; told to them alone.
 */
export interface HostingStatus { approved: boolean; account_id: string | null; doors: HostedTableDoor[] | null; stopped?: boolean }
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
  /** The area people are told, one short line, never the address. */
  area?: string | null;
}
/** The host's record: their own tables, the names guests gave, teas poured, their private lines. */
export interface HostRecordFile {
  kind: 'teajia-host-record';
  version: number;
  made_at: string;
  host: { name: string };
  tables: unknown[];
}
export interface HostedTableCreated { id: string; slug: string; link: string }
export interface HostedTableSummary {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  /** When the table ends, when the host set it (the detail answer carries it). */
  event_end_date?: string | null;
  timezone: string | null;
  /** NULL only on an older session; a hosted table always sets it. */
  door: HostedTableDoor | 'open' | null;
  seats: number;
  lifecycle_status: string;
  /** The area the public page shows, when the host gave one. In the list, so a new table can start from it. */
  area_hint?: string | null;
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
  /** A waiting guest offered a seat that opened: until when they may take it (J9). */
  offer_until?: string | null;
  /** A waiting guest whose offer ran out unclaimed (J9). */
  offer_lapsed?: boolean;
}
/** Where a tea on a table comes from (slice H6): Teajia's shop, the host's own Tea Chest, or the words they typed. */
export type HostedTableTeaSource = 'shop' | 'chest' | 'name';
/** A tea on one of the host's tables. No price, stock or cost, ever. */
export interface HostedTableTea {
  id: string;
  name: string | null;
  /** Older answers may leave it out; read it as 'name'. */
  source?: HostedTableTeaSource;
  product_id: string | null;
  brew_order: number | null;
  /** "Where it is from", in the host's words. */
  from?: string | null;
  /** The host's own photograph of the tea. */
  photo_url?: string | null;
}
/** A tea the host may add: Teajia's shop first, then their own chest. */
export interface HostedTableTeaMatch { source: 'shop' | 'chest'; id: string; name: string; type: string | null; year: string | null }
/** One tea of the list the host saves, in pouring order. A tea without an id is new. */
export interface HostedTableTeaInput {
  id?: string | null;
  source: HostedTableTeaSource;
  product_id?: string | null;
  name: string;
  from?: string | null;
  photo_url?: string | null;
}
/** What happened to a seat (J9), for the host to read. Nothing is ever sent. */
export interface SeatNotice {
  id: string;
  /** 'returned': a guest who waited went back to asking when a seat opened (a table where the host says yes). */
  kind: 'cancelled' | 'released' | 'offered' | 'offer_lapsed' | 'claimed' | 'returned';
  seats: number;
  guest_name: string | null;
  created_at: string;
}
export interface HostedTableDetail {
  table: Omit<HostedTableSummary, 'guests'> & {
    requires_approval: number; public_visibility: string; seats_taken: number;
    /** The area the public page shows; null when the host gave none. */
    area_hint?: string | null;
    /** Whether the table is a tasting; only while Launch 3 is open (J13 finding 4). */
    is_tasting?: boolean;
  };
  guests: HostedTableGuest[];
  /** What happened to the seats, newest first (J9). */
  notices?: SeatNotice[];
  teas: HostedTableTea[];
  /** The doors this host may give the table. */
  doors: HostedTableDoor[];
}
/** area: null clears it. */
export interface HostedTableChange { door?: HostedTableDoor; seats?: number; area?: string | null }
/** The way to the house for one table (slice H8). The guide is events.venue_guide. */
export interface HostedTableWay {
  address: string | null;
  map_link: string | null;
  venue_guide: VenueGuide | null;
  /** The saved place this table's way was last kept as. */
  place_id: string | null;
}
/** A place the host kept the way to, for the next table there. */
export interface HostedWayPlace { id: string; name: string; address: string | null; map_link: string | null; venue_guide: VenueGuide | null }
export interface HostedTableWayAnswer { way: HostedTableWay; places: HostedWayPlace[] }
export type HostedTableWayInput = Pick<HostedTableWay, 'address' | 'map_link' | 'venue_guide'>;
/** One of the host's saved places, by name, and whether it is their table (Launch 4, K4). */
export interface YourTablePlace { id: string; name: string; area_hint: string | null; is_table: boolean }
export interface YourTableAnswer { places: YourTablePlace[] }
/** The host's private line about one guest (slice H9). Never shown to the guest. */
export interface HostGuestNote { attendee_id: string; note: string; updated_at: string }

interface HostingApiDependencies {
  apiUrl: string;
  authedFetch: (url: string, init?: RequestInit) => Promise<any>;
}

export function createHostingApi({ apiUrl, authedFetch }: HostingApiDependencies) {
  return {
    get: (): Promise<HostingStatus> => authedFetch(`${apiUrl}/api/me/hosting`),
    // The host's own record (slice H11), saved by the page as one JSON file. Never a zip.
    record: (): Promise<HostRecordFile> => authedFetch(`${apiUrl}/api/me/record`),
    // "Add your table" (Launch 4, K4): name one saved place as the host's table, or undo it.
    yourTable: (): Promise<YourTableAnswer> => authedFetch(`${apiUrl}/api/me/your-table`),
    chooseYourTable: (choice: { place_id: string; area_hint: string }): Promise<YourTableAnswer> =>
      authedFetch(`${apiUrl}/api/me/your-table`, { method: 'PUT', body: JSON.stringify(choice) }),
    undoYourTable: (): Promise<YourTableAnswer> => authedFetch(`${apiUrl}/api/me/your-table`, { method: 'DELETE' }),
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
    /** Same table again (review A11-13): a copy with its teas and way, on the day given in the table's own zone. */
    again: (id: string, when: { date: string; time: string }): Promise<HostedTableCreated> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/again`, { method: 'POST', body: JSON.stringify(when) }),
    /** The host makes their own table a tasting, or clears it (J13 finding 4). */
    setTasting: (id: string, isTasting: boolean): Promise<{ ok: true; is_tasting: boolean }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/tasting`, { method: 'PUT', body: JSON.stringify({ is_tasting: isTasting }) }),
    sayYes: (id: string, guestId: string): Promise<{ ok: true; status: 'confirmed' }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/yes`, { method: 'PUT', body: '{}' }),
    sayNo: (id: string, guestId: string): Promise<{ ok: true; status: 'denied' }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/no`, { method: 'PUT', body: '{}' }),
    /** The host gives back a confirmed guest's seat; it is offered to the guest waiting longest (J9). */
    releaseSeat: (id: string, guestId: string): Promise<{ ok: true; status: 'cancelled'; seats_released: number; offered: number }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/release`, { method: 'PUT', body: '{}' }),
    markWhoCame: (id: string, attendeeIds: string[]): Promise<{ ok: true }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/came`, { method: 'PUT', body: JSON.stringify({ attendee_ids: attendeeIds }) }),
    thanksLink: (id: string, guestId: string): Promise<{ credential: string; expires_at: string }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/thanks-link`, { method: 'POST', body: '{}' }),
    // A tea for the table (slice H6). Teajia's shop first, the host's chest second.
    teaSearch: (id: string, query: string): Promise<{ matches: HostedTableTeaMatch[] }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/tea-search?q=${encodeURIComponent(query)}`),
    saveTeas: (id: string, teas: HostedTableTeaInput[]): Promise<{ teas: HostedTableTea[] }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/teas`, { method: 'PUT', body: JSON.stringify({ teas }) }),
    /** A photograph already framed in the shared photo editor. */
    uploadTeaPhoto: async (id: string, photo: File): Promise<{ url: string }> => {
      const form = new FormData();
      form.append('file', photo, photo.name || 'tea.jpg');
      return authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/teas/photo`, { method: 'POST', body: form });
    },
    // The host's private guest book (slice H9).
    notes: (id: string): Promise<{ notes: HostGuestNote[] }> => authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/notes`),
    saveNote: (id: string, guestId: string, note: string): Promise<{ note: HostGuestNote | null }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/guests/${encodeURIComponent(guestId)}/note`, {
        method: 'PUT', body: JSON.stringify({ note }),
      }),
    // The way to the house (slice H8). The host's alone; a guest receives it
    // only through their own page, once confirmed and until the session ends.
    way: (id: string): Promise<HostedTableWayAnswer> => authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/way`),
    saveWay: (id: string, way: HostedTableWayInput): Promise<HostedTableWayAnswer> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/way`, { method: 'PUT', body: JSON.stringify(way) }),
    keepWay: (id: string, name: string): Promise<{ place: HostedWayPlace }> =>
      authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/way/keep`, { method: 'POST', body: JSON.stringify({ name }) }),
    /** One step photograph, already framed in the shared photo editor. Kept under venue-guide/, served private. */
    uploadWayPhoto: (id: string, file: File | Blob): Promise<{ url: string; key: string }> => {
      const form = new FormData();
      form.append('file', file);
      return authedFetch(`${apiUrl}/api/me/tables/${encodeURIComponent(id)}/way/photos`, { method: 'POST', body: form });
    },
  };
}

/** Launch 3 (J10): by their link only, to people signed in to Teajia, or on the public sessions list. */
export type HostReach = 'invitation' | 'teajia' | 'listed';

/** Launch 3: the platform owner's hosting controls, spread into api.platform. */
export function createPlatformHostingApi({ apiUrl, authedFetch }: { apiUrl: string; authedFetch: (url: string, init?: RequestInit) => Promise<any> }) {
  return {
    // Launch 3: stop one host (no new table, no new seat), or let them host again.
    setHostingStopped: async (userId: string, stopped: boolean): Promise<{ ok: boolean; hosting_stopped: boolean }> => {
      return authedFetch(`${apiUrl}/api/platform/users/${userId}/hosting-stopped`, {
        method: 'PUT', body: JSON.stringify({ stopped }),
      });
    },
    // Launch 3 (J10): how far this host's open tables are shown. Platform owner only.
    setHostReach: async (userId: string, reach: HostReach): Promise<{ ok: boolean; host_reach: HostReach }> => {
      return authedFetch(`${apiUrl}/api/platform/users/${userId}/host-reach`, {
        method: 'PUT', body: JSON.stringify({ reach }),
      });
    },
  };
}
