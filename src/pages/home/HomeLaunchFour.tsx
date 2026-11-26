import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { mediaUrl } from '../../lib/mediaUrl';
import { recapPath } from '../../lib/publicSitConnections';
import { teaTableOpen } from '../../lib/teaTable';
import { teaTableApi } from '../../lib/teaTableApi';
import { teaTableKey, type TeaTableItem } from '../../lib/teaTableContract';
import { teaHousesOpen } from '../../lib/teaHouses';
import { useTeaHouseWork } from '../../lib/teaHousesApi';
import { teaHousePagePath } from '../../lib/teaHousesContract';
import { housesDoor } from '../../components/navSections';

/**
 * Home's Launch 4 parts (slice K7 of
 * todo/plans/guests-and-tea-masters-launch-4-run.md; the order is in
 * todo/plans/guests-and-tea-masters.md, "Home"). HomeV2Page shows them only
 * with HOME_BAR_OPEN on; closed, Home is exactly as it was.
 *
 * Each strip is shown only when it has something real, and is never filled
 * with made-up items. No counts anywhere.
 */

/** Today's four lines under the opener. */
export const HOME_LINES_TODAY = [
  { accent: 'Source', rest: ' your tea.', to: '/shop' },
  { accent: 'Discover', rest: ' the stories.', to: '/read' },
  { accent: 'Deepen', rest: ' your practice.', to: '/craft' },
  { accent: 'Create', rest: ' the spaces to share.', to: '/advise' },
] as const;

/** The four lines with the new bar: also the four words, in bar order. */
export function homeLinesLaunchFour() {
  return [
    { accent: 'Learn', rest: ' tea.', to: '/read' },
    { accent: 'Sit', rest: ' at a table.', to: '/events' },
    { accent: 'Find', rest: ' a tea house.', to: '/tea-houses/visit' },
    { accent: 'Find', rest: ' good tea.', to: '/shop' },
  ];
}

/** Where the consult plate leads with the new bar: Tea Houses once its pages are open, otherwise the consult as today. */
export function consultPlatePath(): string {
  return teaHousesOpen() ? housesDoor() : '/advise';
}

const STRIP_LINK = 'group block min-w-0 rounded-md border border-tea-border bg-tea-surface p-4 hover:border-tea-gold focus-visible:outline-tea-gold';

/** The door beside "Host a table": the sessions coming up, at tables and tea houses. */
export const ComeToATable: React.FC<{ edge: string }> = ({ edge }) => (
  <div className={`${edge} mt-8 px-6 sm:px-10`} data-testid="home-come-to-a-table">
    <Link to="/events" className={STRIP_LINK}>
      <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text group-hover:text-tea-gold`}>Come to a table</h2>
      <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 italic text-tea-text-sec`}>The sessions coming up, at tables and tea houses.</p>
    </Link>
  </div>
);

function pieceLine(item: TeaTableItem): { to: string; title: string; by: string | null } {
  if (item.kind === 'recap') {
    return { to: recapPath(item.slug), title: item.title, by: item.host ? `Hosted by ${item.host}` : null };
  }
  return { to: item.tea.path, title: item.tea.name, by: `Tasted by ${item.person.name}` };
}

/** What happened at the tables: the latest three pieces on the Tea Table, while it is open and has any. */
export const FromTheTeaTable: React.FC<{ edge: string }> = ({ edge }) => {
  const open = teaTableOpen();
  const { data } = useQuery({
    queryKey: ['tea-table', 'home'],
    queryFn: ({ signal }) => teaTableApi.page('all', null, signal),
    enabled: open,
    staleTime: 0,
    retry: false,
  });
  if (!open || !data) return null;
  // Only what happened at a table: a "Does anyone know this tea?" question is not a piece here.
  const pieces = [...data.held, ...data.items].filter((item): item is TeaTableItem => item.kind !== 'question').slice(0, 3);
  if (pieces.length === 0) return null;
  return (
    <section aria-labelledby="home-tea-table-heading" data-testid="home-tea-table" className={`${edge} mt-[var(--space-8)] px-6 sm:px-10`}>
      <h2 id="home-tea-table-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>What happened at the tables</h2>
      <ul className="mt-[var(--space-3)] grid gap-[var(--space-3)] md:grid-cols-3">
        {pieces.map(item => {
          const line = pieceLine(item);
          return (
            <li key={teaTableKey(item)} className="min-w-0">
              <Link to={line.to} className={STRIP_LINK}>
                <span className={`${TYPOGRAPHY_CLASSES.h3} block break-words text-tea-text group-hover:text-tea-gold`}>{line.title}</span>
                {line.by && <span className={`${TYPOGRAPHY_CLASSES.accountMeta} mt-1 block break-words`}>{line.by}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <Link to="/tea-table" className={`${TYPOGRAPHY_CLASSES.link} tap-target mt-[var(--space-2)] inline-flex items-center`}>More on the Tea Table</Link>
    </section>
  );
};

/** Tea houses as Adrian's portfolio: up to three houses in his order, while the portfolio is open and shows any. */
export const TeaHousesStrip: React.FC<{ edge: string }> = ({ edge }) => {
  const { data } = useTeaHouseWork();
  if (!teaHousesOpen()) return null;
  const houses = (data?.houses ?? []).slice(0, 3);
  if (houses.length === 0) return null;
  return (
    <section aria-labelledby="home-tea-houses-heading" data-testid="home-tea-houses" className={`${edge} mt-[var(--space-8)] px-6 sm:px-10`}>
      <h2 id="home-tea-houses-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Tea houses Adrian has worked on</h2>
      <ul className="mt-[var(--space-3)] grid gap-[var(--space-3)] md:grid-cols-3">
        {houses.map(house => (
          <li key={house.slug} className="min-w-0">
            <Link to={teaHousePagePath(house.slug)} className={STRIP_LINK}>
              {house.photograph && (
                <img src={mediaUrl(house.photograph)} alt="" loading="lazy" className="mb-3 aspect-[3/2] w-full rounded-md bg-tea-elevated object-cover" />
              )}
              <span className={`${TYPOGRAPHY_CLASSES.h3} block break-words text-tea-text group-hover:text-tea-gold`}>{house.name}</span>
              {house.place && <span className={`${TYPOGRAPHY_CLASSES.accountMeta} mt-1 block break-words`}>{house.place}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/tea-houses/work" className={`${TYPOGRAPHY_CLASSES.link} tap-target mt-[var(--space-2)] inline-flex items-center`}>All the houses</Link>
    </section>
  );
};
