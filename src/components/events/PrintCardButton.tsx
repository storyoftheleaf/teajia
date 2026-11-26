import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { tableCardOpen } from '../../lib/tableCard';

// The card for the table (Launch 5, M3). It reads the public session answer,
// so it is offered only for a published public session, and only once
// Launch 5's card is open (src/lib/tableCard.ts).
export function PrintCardButton({ slug }: { slug: string }) {
  if (!tableCardOpen()) return null;
  return (
    <Link
      className="tap-target flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
      to={`/admin/events/${encodeURIComponent(slug)}/card`}
    >
      <Printer size={12} /> Print a card for the table
    </Link>
  );
}
