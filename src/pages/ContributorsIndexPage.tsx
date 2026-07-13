import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useContributors } from '../hooks/useContributor';
import type { ContributorListItem } from '../types';

// /people. The directory. v1 is a typeset alphabetical list, not a card
// grid. The relational map upgrade is deferred (see step 13 in
// docs/ARCHITECTURE.md).

function groupAlphabetical(rows: ContributorListItem[]): Array<[string, ContributorListItem[]]> {
  const map = new Map<string, ContributorListItem[]>();
  for (const r of rows) {
    const letter = (r.display_name?.[0] ?? '#').toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.display_name.localeCompare(b.display_name));
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });
}

export default function ContributorsIndexPage() {
  const { data, isLoading } = useContributors();

  const groups = useMemo(() => groupAlphabetical(data ?? []), [data]);

  if (isLoading) return null;

  const isEmpty = !data || data.length === 0;

  return (
    <article className="w-full min-h-screen flex-1 mx-auto px-4 md:px-6 lg:px-10 max-w-3xl">
      <style>{`
        @keyframes contribIndexFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .contrib-index-heading {
          opacity: 0;
          animation: contribIndexFade 600ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .contrib-index-heading {
            animation: contribIndexFade 200ms ease-out forwards;
          }
        }
      `}</style>

      <header className="pt-12 pb-3">
        <h1 className="contrib-index-heading h2">
          People
        </h1>
        <p className="label-caps text-tea-text-dim mt-1">
          Contributors, sources, and table-keepers
        </p>
      </header>

      {isEmpty ? (
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <p className="subtitle">
            No profiles yet.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-10">
            {groups.map(([letter, rows], gi) => (
              <section
                key={letter}
                className={gi === 0 ? '' : 'mt-16 md:mt-20'}
              >
                <h2 className="label-caps text-tea-readgold/60 mb-6">
                  {letter}
                </h2>

                <ul className="flex flex-col gap-6 md:gap-8">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <Link
                        to={`/people/${r.id}`}
                        className="group block"
                        style={{ textDecoration: 'none' }}
                      >
                        <span
                          className="inline-block border-b border-transparent group-hover:border-tea-gold/40 group-focus-visible:border-tea-gold/40 transition-[border-color] duration-300 text-tea-text"
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 400,
                            fontSize: 'clamp(28px, 3.5vw, 40px)',
                            lineHeight: 1.05,
                            letterSpacing: '-0.01em',
                          }}
                        >
                          {r.display_name}
                        </span>
                        {r.role && (
                          <span className="block subtitle text-ui-14 mt-1">
                            {r.role}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="h-20 md:h-28" />
        </>
      )}
    </article>
  );
}
