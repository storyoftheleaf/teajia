import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ContributorIdentityMark } from '../components/shared/ContributorIdentityMark';
import { useContributors } from '../hooks/useContributor';
import type { ContributorListItem } from '../types';

// /people. The directory: a room full of people doing the work, not a staff
// wall. Built to the "Directory · /people" board of the Creator Profiles
// canvas (2026-09-19): a light title with a subtitle, a three-cell hairline
// filter row (All with count, Hosts, Writers, the active one underlined in
// gold), then a two-column grid of cards. Each card is one link: a 4:5 image
// above the words, never text on the photo; the identity mark fills the same
// box when a person has no photo yet.

type Filter = 'all' | 'hosts' | 'writers';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'hosts', label: 'Hosts' },
  { key: 'writers', label: 'Writers' },
];

function matches(person: ContributorListItem, filter: Filter): boolean {
  if (filter === 'hosts') return person.is_host === true;
  if (filter === 'writers') return (person.article_count ?? 0) > 0;
  return true;
}

/** The second line under a name: role, then business or place. */
function cardLines(person: ContributorListItem): { role: string | null; where: string | null } {
  const where = [person.business_name, person.location_line?.split(',')[0]?.trim()].filter(Boolean).join(' · ') || null;
  return { role: person.role ?? null, where };
}

export default function ContributorsIndexPage() {
  const { data, isLoading } = useContributors();
  const [filter, setFilter] = useState<Filter>('all');

  const people = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [data],
  );
  const shown = useMemo(() => people.filter(person => matches(person, filter)), [people, filter]);

  if (isLoading) return null;

  const isEmpty = people.length === 0;

  return (
    <article className="mx-auto w-full max-w-2xl pb-nav-gap-lg" data-testid="people-directory">
      <style>{`
        @keyframes contribIndexFade { from { opacity: 0; } to { opacity: 1; } }
        .contrib-index-heading { opacity: 0; animation: contribIndexFade 600ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        @media (prefers-reduced-motion: reduce) { .contrib-index-heading { animation: contribIndexFade 200ms ease-out forwards; } }
      `}</style>

      <header className="px-4 pt-12 md:px-6">
        <h1 className="contrib-index-heading font-display text-[44px] font-light leading-none tracking-[-0.02em] text-tea-text md:text-[56px]">People</h1>
        <p className="subtitle mt-2.5">Tea masters, hosts and writers on Teajia</p>
      </header>

      {!isEmpty && (
        <nav aria-label="Filter" className="mt-6 grid grid-cols-3 border-y border-tea-border">
          {FILTERS.map((entry, index) => {
            const active = entry.key === filter;
            const count = entry.key === 'all' ? people.length : people.filter(person => matches(person, entry.key)).length;
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => setFilter(entry.key)}
                aria-pressed={active}
                className={`-mb-px flex min-h-[52px] items-center justify-center font-sans text-ui-11 uppercase tracking-[0.15em] transition-colors ${index < FILTERS.length - 1 ? 'border-r border-tea-border' : ''} ${active ? 'border-b border-b-tea-gold text-tea-text' : 'text-tea-text-sec hover:text-tea-text'}`}
              >
                {entry.key === 'all' ? `All · ${count}` : entry.label}
              </button>
            );
          })}
        </nav>
      )}

      <main className="px-4 pt-6 md:px-6">
        {isEmpty ? (
          <p className="subtitle py-20 text-center">No profiles yet.</p>
        ) : shown.length === 0 ? (
          <p className="subtitle py-16 text-center text-tea-text-sec">Nobody here yet under that filter.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-3">
            {shown.map(person => {
              const lines = cardLines(person);
              return (
                <li key={person.id}>
                  <Link to={`/people/${encodeURIComponent(person.id)}`} className="group block text-tea-text" data-testid="people-card">
                    <span className="block aspect-[4/5] w-full overflow-hidden rounded-[2px] bg-tea-elevated">
                      {person.card_image_url ? (
                        <img src={person.card_image_url} alt={person.display_name} loading="lazy" className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-90" />
                      ) : (
                        <ContributorIdentityMark name={person.display_name} decorative={false} />
                      )}
                    </span>
                    <span className="mt-3 block font-display text-[22px] leading-[1.1] tracking-[-0.01em] transition-colors group-hover:text-tea-gold-lt">{person.display_name}</span>
                    {(lines.role || lines.where) && (
                      <span className="mt-1.5 block font-sans text-ui-12 leading-[1.45] text-tea-text-sec">
                        {lines.role}
                        {lines.role && lines.where && <br />}
                        {lines.where}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {!isEmpty && (
          <div className="mt-14 border-t border-tea-border pt-5 pb-16">
            <span className="font-sans text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">
              {people.length === 1 ? '1 person' : `${people.length} people`} · more are invited each season
            </span>
          </div>
        )}
      </main>
    </article>
  );
}
