import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useContributors } from '../hooks/useContributor';
import type { ContributorListItem } from '../types';

// /people. The directory. v1 is a typeset alphabetical list, not a card
// grid. The relational map upgrade is deferred (see step 13 in
// docs/CONTRIBUTOR_PROFILES_PLAN.md).

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
    <article
      className="w-full min-h-screen flex-1 mx-auto px-4 md:px-6 lg:px-10"
      style={{ maxWidth: 'min(880px, 100%)' }}
    >
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

      <header className="pt-12 md:pt-20 lg:pt-24">
        <h1
          className="contrib-index-heading text-tea-text"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 300,
            fontSize: 'clamp(40px, 6vw, 72px)',
            letterSpacing: '-0.01em',
            lineHeight: 1,
          }}
        >
          People
        </h1>
      </header>

      {isEmpty ? (
        <div
          className="flex justify-center"
          style={{ marginTop: 'clamp(80px, 14vh, 160px)', marginBottom: 'clamp(96px, 18vh, 200px)' }}
        >
          <p
            className="text-tea-text-sec italic text-center"
            style={{ fontFamily: 'var(--font-body)', fontWeight: 300, fontSize: '15px', lineHeight: 1.6 }}
          >
            No profiles yet.
          </p>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 'clamp(48px, 8vh, 96px)' }}>
            {groups.map(([letter, rows], gi) => (
              <section
                key={letter}
                className={gi === 0 ? '' : 'mt-[clamp(48px,8vh,80px)]'}
              >
                <h2
                  className="text-tea-gold/40 uppercase text-ui-13 mb-6"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 400,
                    letterSpacing: '0.3em',
                  }}
                >
                  {letter}
                </h2>

                <ul className="flex flex-col" style={{ gap: 'clamp(20px, 3vh, 36px)' }}>
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
                          <span
                            className="block text-tea-text-sec italic"
                            style={{
                              fontFamily: 'var(--font-body)',
                              fontWeight: 400,
                              fontSize: '14px',
                              marginTop: '4px',
                              lineHeight: 1.5,
                            }}
                          >
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

          <div style={{ height: 'clamp(64px, 10vh, 120px)' }} />
        </>
      )}
    </article>
  );
}
