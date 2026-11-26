import { Link } from 'react-router-dom';

export function PrintCardButton({ slug }: { slug: string }) {
  return (
    <Link className="btn-secondary tap-target" to={`/admin/events/${encodeURIComponent(slug)}/card`}>
      Print a card for the table
    </Link>
  );
}
