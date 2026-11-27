// What every part of the host's page for one table shares (Launch 2, H4).
// Each part of /account/host/:id (?part=guests|teas|way|after) is one
// component taking these props. Other slices fill the empty ones:
//   teas  -> HostTeaPicker      (src/components/host/HostTeaPicker.tsx, H6)
//   way   -> WalkthroughEditor  (src/components/host/WalkthroughEditor.tsx, H8)
//   after -> HostTableAfter     (src/components/host/HostTableAfter.tsx), which
//            mounts GuestBookPrivate (src/components/host/GuestBookPrivate.tsx, H9)
import type { HostedTableDetail, HostedTableDoor, HostedTableGuest } from '../../lib/hostingApi';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

export interface HostTablePartProps {
  tableId: string;
  detail: HostedTableDetail;
}

export const HOST_TABLE_PARTS = ['guests', 'teas', 'way', 'after'] as const;
export type HostTablePart = typeof HOST_TABLE_PARTS[number];

export const hostTableQueryKey = (id: string) => ['host-table', id] as const;

export const hostText = `${TYPOGRAPHY_CLASSES.body} text-tea-text-sec`;
export const hostSmallText = `${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`;

/** Under the Area field: what it is for, and that it is never the way in (H13 finding 1). */
export const TABLE_AREA_HINT = 'Shown to anyone with the link, such as a neighbourhood. Never the address.';

export const DOOR_WORDS: Record<HostedTableDoor, string> = {
  request: 'I say yes to each guest',
  link: 'Anyone with the link has a seat',
  // Launch 3, J10: found more widely; the host still says yes to each guest.
  open: 'People on Teajia can find it, and I say yes to each guest',
};

export function doorWords(door: HostedTableDetail['table']['door']): string {
  return door === 'link' || door === 'open' ? DOOR_WORDS[door] : DOOR_WORDS.request;
}

/** The stored door as one of the three, an older NULL read as by request. */
export const doorOf = (door: HostedTableDetail['table']['door']): HostedTableDoor =>
  door === 'link' || door === 'open' ? door : 'request';

/** The table's day and time, in the table's own time zone. */
export function tableWhen(eventDate: string, timezone: string | null): string {
  const at = new Date(eventDate);
  if (Number.isNaN(at.getTime())) return eventDate;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short', timeZone: timezone ?? undefined }).format(at);
  } catch {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(at);
  }
}

/** Whether the table's time has come. */
export function tableHasBegun(eventDate: string, now = Date.now()): boolean {
  const at = Date.parse(eventDate);
  return Number.isFinite(at) && at <= now;
}

/** A WhatsApp link to one guest, only when they gave a phone number. */
export function guestWhatsApp(guest: Pick<HostedTableGuest, 'phone'>): string | null {
  const digits = guest.phone?.replace(/\D/g, '') ?? '';
  return digits.length >= 6 ? `https://wa.me/${digits}` : null;
}

export interface TableLink { key: 'recap' | 'tea-table' | 'card'; to: string; label: string }

/**
 * Where a table's own page leads on (review U1-2, U1-14): the recap in Manage, the Tea Table, and
 * the card to print. One tap each from the page of the table, shown only when the part's own switch
 * is open and the person can use the place (Manage and the card are the shop owner's).
 */
export function tableLinks(
  table: { id: string; slug: string; public_visibility: string; lifecycle_status: string },
  open: { isAdmin: boolean; teaTable: boolean; card: boolean },
): TableLink[] {
  const links: TableLink[] = [];
  if (open.isAdmin) {
    links.push({
      key: 'recap',
      to: `/admin/events/${encodeURIComponent(table.id)}?tab=post-session`,
      label: open.teaTable ? 'Write the recap and share it on the Tea Table' : 'Write the recap',
    });
  }
  if (open.teaTable) links.push({ key: 'tea-table', to: '/tea-table', label: 'See the Tea Table' });
  if (open.isAdmin && open.card && table.slug && table.public_visibility === 'public'
    && !['cancelled', 'archived'].includes(table.lifecycle_status)) {
    links.push({ key: 'card', to: `/admin/events/${encodeURIComponent(table.slug)}/card`, label: 'Print a card for the table' });
  }
  return links;
}
