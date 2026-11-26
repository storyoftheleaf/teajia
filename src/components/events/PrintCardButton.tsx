import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';

// The card for the table (Launch 5, M3). It reads the public session answer,
// so it is offered only for a published public session.
export function PrintCardButton({ slug }: { slug: string }) {
  return (
    <Link
      className="tap-target flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
      to={`/admin/events/${encodeURIComponent(slug)}/card`}
    >
      <Printer size={12} /> Print a card for the table
    </Link>
  );
}
