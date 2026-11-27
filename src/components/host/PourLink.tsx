// The small way from a tea table or a tea space to the pour page (Adrian,
// 2026-11-27: "small little button"). Pouring takes tea off the shop's shelf,
// so only someone who runs sessions for the shop sees it; for anyone else
// nothing is drawn. A table opens Pour on its own day; a tea space opens today
// with the sit placed there (src/admin/views/PourView.tsx reads `place`).
import { Link } from 'react-router-dom';
import { selectHasBundle, useAppStore } from '../../lib/store';

/** The table's day, on the table's own clock, as the pour page writes a day. */
export function pourDay(eventDate: string, timezone: string | null): string | null {
  const at = new Date(eventDate);
  if (Number.isNaN(at.getTime())) return null;
  const format = (zone?: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  try { return format(timezone ?? undefined); } catch { return format(); }
}

export function pourPath({ day, placeId }: { day?: string | null; placeId?: string | null }): string {
  const query = new URLSearchParams();
  if (day) query.set('day', day);
  if (placeId) query.set('place', placeId);
  const text = query.toString();
  return text ? `/admin/pour?${text}` : '/admin/pour';
}

export function PourLink(props: { day?: string | null; placeId?: string | null }) {
  const pours = useAppStore(state => selectHasBundle(state, 'gather'));
  if (!pours) return null;
  return <Link to={pourPath(props)} className="btn-secondary btn-sm tap-target" data-pour-link>Pour</Link>;
}
