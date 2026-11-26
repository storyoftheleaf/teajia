// What happened to a session's seats (Launch 3, J9), for its host: on the
// host's own table page and in Manage. An in-app list only. Nothing here is
// sent to anyone, and it shows what happened, never a count to chase.
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { SeatNotice } from '../../lib/hostingApi';

const someone = (name: string | null) => (name && name.trim()) || 'A guest';
const seatWord = (seats: number) => (seats === 1 ? 'a seat' : `${seats} seats`);

/** One line in plain words for each thing that happened. */
export function seatNoticeWords(notice: SeatNotice, by: 'host' | 'shop' = 'host'): string {
  const name = someone(notice.guest_name);
  switch (notice.kind) {
    case 'cancelled':
      return notice.seats > 0 ? `${name} can't come, and gave back ${seatWord(notice.seats)}.` : `${name} withdrew their request.`;
    case 'released':
      return by === 'host'
        ? `You released ${seatWord(notice.seats)} held by ${name}.`
        : notice.seats === 1 ? `A seat held by ${name} was released.` : `${notice.seats} seats held by ${name} were released.`;
    case 'offered':
      return `${name} was offered a seat that opened.`;
    case 'offer_lapsed':
      return `${name} did not take the offered seat in time, so it moved on.`;
    case 'returned':
      return `A seat opened, and ${name}, who was waiting, is asking for it.`;
    case 'claimed':
      return `${name} took the offered seat.`;
    default:
      return `${name}'s seat changed.`;
  }
}

function noticeWhen(at: string): string {
  const parsed = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(at) ? at : `${at.replace(' ', 'T')}Z`);
  if (!Number.isFinite(parsed)) return at;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(parsed));
}

export function SeatNoticeList({ notices, by = 'host', headingId }: { notices: SeatNotice[]; by?: 'host' | 'shop'; headingId: string }) {
  if (notices.length === 0) return null;
  return (
    <section aria-labelledby={headingId} data-seat-notices className="space-y-2">
      <h3 id={headingId} className={TYPOGRAPHY_CLASSES.h3}>What changed</h3>
      <ul className="space-y-1">
        {notices.map(notice => (
          <li key={notice.id} data-seat-notice={notice.kind} className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec break-words`}>
            {seatNoticeWords(notice, by)} <span className="text-tea-text-sec">{noticeWhen(notice.created_at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
