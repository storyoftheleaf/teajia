import { Link } from 'react-router-dom';

const destinations = [
  { key: 'journal', label: 'Journal', to: '/account/journal' },
  { key: 'favorites', label: 'Favorites', to: '/account/collection' },
  { key: 'cellar', label: 'Cellar', to: '/account/cellar' },
] as const;

type PersonalTeaModel = (typeof destinations)[number]['key'];

export function PersonalTeaLinks({ current }: { current: PersonalTeaModel }) {
  return (
    <nav aria-label="Your tea" className="flex flex-wrap gap-x-4 gap-y-2 border-t border-tea-border pt-4">
      {destinations.filter(item => item.key !== current).map(item => (
        <Link
          key={item.key}
          to={item.to}
          className="tap-target text-ui-12 text-tea-text-sec transition-colors hover:text-tea-text"
        >
          {item.label} →
        </Link>
      ))}
    </nav>
  );
}
