import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { SITE_INCIDENTS_KEY, useSiteIncidents } from '../lib/useSiteIncidents';
import {
  QUIET_AFTER_DAYS, countPhrase, describeIncident, relativeTime, splitIncidents,
  type IncidentRow,
} from '../lib/incidentWords';

/**
 * SiteFixesPage, "Needs fixing". Problems on the live site are the builder's
 * to resolve, so they live here, inside Your Table, and never as a banner a
 * visitor can see. Platform owner only, at the route and at the tile.
 *
 * Active problems were seen in the last two weeks. Quiet ones have not been
 * seen since, and are tucked away behind one button that clears them together.
 */

const RESOLUTION_NOTE = 'marked fixed in Your Table';

const IncidentItem: React.FC<{
  row: IncidentRow;
  busy: boolean;
  onFixed: (id: string) => void;
}> = ({ row, busy, onFixed }) => (
  <li className="border-b border-tea-border py-4 flex items-start gap-3">
    <div className="min-w-0 flex-1">
      <p className="font-serif text-ui-15 text-tea-text leading-[1.5]">{describeIncident(row)}</p>
      <p className="font-sans text-ui-12 text-tea-text-sec mt-1 leading-[1.5]">
        First seen {relativeTime(row.first_seen)}, last seen {relativeTime(row.last_seen)}, {countPhrase(row.occurrence_count)}.
      </p>
      {/* Stale rates clear themselves on the next good refresh; until then the
          rates screen is where one can be corrected by hand. */}
      {row.error_code === 'rates_stale' && (
        <Link
          to="/admin/currency"
          className="inline-block mt-2 font-sans text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2"
        >
          Check rates
        </Link>
      )}
    </div>
    <button
      type="button"
      onClick={() => onFixed(row.id)}
      disabled={busy}
      className="tap-target shrink-0 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2 disabled:opacity-50"
    >
      Mark fixed
    </button>
  </li>
);

const SiteFixesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quietOpen, setQuietOpen] = useState(false);
  const { data, isLoading, isError } = useSiteIncidents(isAdmin);

  const resolve = useMutation({
    mutationFn: (ids: string[]) => Promise.all(
      ids.map(id => api.incidents.update(id, { status: 'resolved', resolution_ref: RESOLUTION_NOTE })),
    ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: SITE_INCIDENTS_KEY }),
  });

  const { active, quiet } = useMemo(() => splitIncidents(data ?? []), [data]);

  if (!isAdmin) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center pb-nav">
        <div className="font-display text-[22px] text-tea-text mb-2">Not available</div>
        <p className="font-serif text-ui-15 text-tea-text-sec max-w-[320px]">This list is visible to the platform owner only.</p>
        <button onClick={() => navigate('/account')} className="tap-target mt-6 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2">Back to Your Table</button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-tea-bg pb-nav-gap-lg">
      <div className="max-w-[720px] mx-auto px-6 lg:px-8 pt-8">
        <button onClick={() => navigate('/account')} className="flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text mb-6 tap-target">
          <ArrowLeft className="w-4 h-4" weight="bold" />
          <span className="text-ui-13">Your Table</span>
        </button>

        <h1 className="font-display text-ui-26 text-tea-text tracking-[0.01em]">Needs fixing</h1>
        <p className="font-serif text-ui-15 text-tea-text-sec mt-3 mb-8 leading-[1.65]">
          Problems the site has run into. Visitors never see these; they come here instead.
        </p>

        {isLoading && <p className="font-serif text-ui-15 text-tea-text-sec">Loading.</p>}
        {isError && <p className="font-serif text-ui-15 text-tea-text-sec">The list could not be loaded just now.</p>}

        {!isLoading && !isError && active.length === 0 && quiet.length === 0 && (
          <p className="font-serif text-ui-15 text-tea-text-sec">Nothing needs fixing.</p>
        )}

        {active.length > 0 && (
          <section aria-label="Active problems">
            <div className="font-sans text-ui-11 text-tea-text-dim uppercase tracking-[0.18em]">Active</div>
            <ul className="mt-1">
              {active.map(row => (
                <IncidentItem key={row.id} row={row} busy={resolve.isPending} onFixed={id => resolve.mutate([id])} />
              ))}
            </ul>
          </section>
        )}

        {quiet.length > 0 && (
          <section aria-label="Quiet problems" className="mt-10">
            <button
              type="button"
              onClick={() => setQuietOpen(open => !open)}
              aria-expanded={quietOpen}
              className="tap-target font-sans text-ui-11 text-tea-text-sec hover:text-tea-text uppercase tracking-[0.18em]"
            >
              Quiet ({quiet.length}) {quietOpen ? '–' : '+'}
            </button>
            {quietOpen && (
              <>
                <p className="font-sans text-ui-12 text-tea-text-sec mt-1 leading-[1.5]">
                  Not seen for {QUIET_AFTER_DAYS} days or more.
                </p>
                <ul className="mt-1">
                  {quiet.map(row => (
                    <IncidentItem key={row.id} row={row} busy={resolve.isPending} onFixed={id => resolve.mutate([id])} />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => resolve.mutate(quiet.map(r => r.id))}
                  disabled={resolve.isPending}
                  className="tap-target mt-4 text-ui-13 text-tea-text-sec hover:text-tea-text underline underline-offset-2 disabled:opacity-50"
                >
                  Clear all quiet
                </button>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default SiteFixesPage;
