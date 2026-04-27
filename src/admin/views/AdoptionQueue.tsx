// AdoptionQueue — Platform-tier review of partner-suggested profiles.
// Step 6 of the Network Rollout. Per docs/NETWORK_UI_BRIEF.md shared
// vocabulary (no toasts, no chrome, editorial register, bronze rare).
//
// A partner who originates a tea profile flags it via PartnerListingEdit.
// Adrian sees pending suggestions here and either adopts (curated_by
// transfers to Teajia, profile becomes visible in every partner's catalog)
// or declines with an optional note returned to the originator.

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import type { AdoptionQueueEntry, AdoptionDecision } from '../../types';

const FILTERS: Array<{ key: AdoptionDecision; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'adopted', label: 'Adopted' },
  { key: 'declined', label: 'Declined' },
];

interface AdoptionQueueProps {
  /** When rendered inside the Network hub, drop the page-level top/bottom padding. */
  embedded?: boolean;
}

export const AdoptionQueue: React.FC<AdoptionQueueProps> = ({ embedded = false }) => {
  const [filter, setFilter] = useState<AdoptionDecision>('pending');
  const outerClass = embedded
    ? 'px-4 md:px-8 max-w-3xl mx-auto'
    : 'px-4 md:px-8 pt-8 pb-nav-gap-lg max-w-3xl mx-auto';

  const queryClient = useQueryClient();
  const queryKey = ['network', 'adoption-queue', filter] as const;
  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => api.network.adoptionQueue(filter),
    staleTime: 30_000,
  });
  const entries: AdoptionQueueEntry[] | null = data?.profiles ?? null;
  const error = queryError ? ((queryError as Error).message || "Couldn't load the adoption queue.") : null;

  const refetchAll = () =>
    queryClient.invalidateQueries({ queryKey: ['network', 'adoption-queue'] });

  return (
    <div className={outerClass}>
      {/* Header */}
      <header className="mb-8">
        {!embedded && (
          <Link
            to="/admin/access/platform"
            className="text-tea-text-sec hover:text-tea-text transition-colors text-ui-13 mb-5 inline-flex items-center gap-1"
          >
            ← Platform access
          </Link>
        )}

        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>
          Adoption queue
        </h1>
        <p className="font-body italic text-ui-15 text-tea-text-sec leading-[1.7]">
          Partners can flag teas they originated for the Teajia network catalog.
          Adopting transfers curation to you; declining keeps it with the originator.
        </p>
      </header>

      {/* Filter tabs */}
      <div className="flex items-center gap-5 mb-8 text-ui-13">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? 'text-tea-gold tracking-[0.04em]'
                : 'text-tea-text-sec hover:text-tea-text transition-colors tracking-[0.04em]'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {error && (
        <p className="font-body italic text-ui-14 text-tea-text-sec">{error}</p>
      )}

      {!error && (entries === null || isLoading) && (
        <p className="font-body italic text-ui-14 text-tea-text-sec">Loading…</p>
      )}

      {!error && entries && entries.length === 0 && (
        <p className="font-body italic text-ui-14 text-tea-text-sec leading-[1.7]">
          {filter === 'pending'
            ? 'Nothing is waiting. Tea Masters will appear here when they offer a profile up for the network.'
            : filter === 'adopted'
            ? 'No profiles have been adopted yet. Adopted teas appear in every partner\'s catalog.'
            : 'No profiles have been declined. Declined originators can revise and re-suggest.'}
        </p>
      )}

      {!error && entries && entries.length > 0 && (
        <ul className="space-y-8">
          {entries.map(entry => (
            <li key={entry.id}>
              <AdoptionRow entry={entry} onChange={refetchAll} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

interface AdoptionRowProps {
  entry: AdoptionQueueEntry;
  onChange: () => void | Promise<void>;
}

const AdoptionRow: React.FC<AdoptionRowProps> = ({ entry, onChange }) => {
  const [showDecline, setShowDecline] = useState(false);
  const [declineNote, setDeclineNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isPending = entry.adoption_decision === 'pending';

  const decideMutation = useMutation({
    mutationFn: (input: { decision: 'adopted' | 'declined'; note?: string }) =>
      api.network.decideAdoption(entry.id, input.decision, input.note),
    onSuccess: async () => { await onChange(); },
    onError: (err: any) => {
      setError(err?.message || "Couldn't save the decision. Try again.");
    },
  });

  const busy: 'adopted' | 'declined' | null = decideMutation.isPending
    ? (decideMutation.variables?.decision ?? null)
    : null;

  const handleAdopt = () => {
    setError(null);
    decideMutation.mutate({ decision: 'adopted' });
  };

  const handleDecline = () => {
    setError(null);
    decideMutation.mutate({ decision: 'declined', note: declineNote.trim() || undefined });
  };

  // Build a concise origin line from country/region/varietal/year.
  const originParts: string[] = [];
  if (entry.origin_region) originParts.push(entry.origin_region);
  else if (entry.origin_country) originParts.push(entry.origin_country);
  if (entry.varietal) originParts.push(entry.varietal);
  if (entry.harvest_year) originParts.push(String(entry.harvest_year));
  const originLine = originParts.join(' · ');

  const suggestedDate = entry.suggested_for_network_at
    ? new Date(entry.suggested_for_network_at).toLocaleDateString(undefined, {
        day: 'numeric', month: 'long',
      })
    : null;

  return (
    <article className="border-b border-tea-border pb-8 last:border-b-0">
      {/* Tea name + chinese name */}
      <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text mb-1`}>
        {entry.name}
      </h2>
      {entry.chinese_name && (
        <p className="font-body text-ui-14 text-tea-text-sec mb-2">{entry.chinese_name}</p>
      )}

      {/* Origin line + originator attribution */}
      {originLine && (
        <p className="font-body text-ui-13 text-tea-text-sec mb-1">{originLine}</p>
      )}
      <p className="text-ui-11 text-tea-text-dim tracking-[0.04em] mb-4">
        Originated by {entry.originator_account_name}
        {entry.suggested_by_user_name && ` · suggested by ${entry.suggested_by_user_name}`}
        {suggestedDate && ` · ${suggestedDate}`}
      </p>

      {/* Description */}
      {entry.description && (
        <p className="font-body text-ui-15 text-tea-text leading-[1.7] mb-4">
          {entry.description}
        </p>
      )}

      {/* Originator note */}
      {entry.suggested_for_network_note && (
        <blockquote className="font-body italic text-ui-14 text-tea-text-sec leading-[1.7] mb-5 pl-4 border-l border-tea-border">
          "{entry.suggested_for_network_note}"
        </blockquote>
      )}

      {/* Already-decided state */}
      {!isPending && (
        <div className="text-ui-13 text-tea-text-sec">
          {entry.adoption_decision === 'adopted' ? (
            <span>Adopted{entry.adoption_decided_at ? ` on ${new Date(entry.adoption_decided_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` : ''}.</span>
          ) : (
            <>
              <span>Declined{entry.adoption_decided_at ? ` on ${new Date(entry.adoption_decided_at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` : ''}.</span>
              {entry.adoption_decline_note && (
                <p className="italic mt-1">"{entry.adoption_decline_note}"</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Pending — actions */}
      {isPending && !showDecline && (
        <div className="flex items-center gap-5 text-ui-13">
          <button
            type="button"
            onClick={handleAdopt}
            disabled={busy !== null}
            className="text-tea-text-sec hover:text-tea-gold transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {busy === 'adopted' ? 'Adopting…' : 'Adopt to network →'}
          </button>
          <button
            type="button"
            onClick={() => { setShowDecline(true); setError(null); }}
            disabled={busy !== null}
            className="text-tea-text-sec hover:text-tea-text transition-colors"
          >
            Decline
          </button>
        </div>
      )}

      {/* Pending — decline form */}
      {isPending && showDecline && (
        <div className="space-y-3">
          <textarea
            value={declineNote}
            onChange={e => setDeclineNote(e.target.value.slice(0, 1000))}
            placeholder={`Optional note for ${entry.originator_account_name}`}
            rows={2}
            className="w-full px-3 py-2 bg-tea-bg border border-tea-border rounded-sm text-ui-14 text-tea-text font-body placeholder:text-tea-text-dim placeholder:italic focus:outline-none focus:border-tea-gold/40"
            maxLength={1000}
          />
          <div className="flex items-center gap-5 text-ui-13">
            <button
              type="button"
              onClick={() => { setShowDecline(false); setDeclineNote(''); setError(null); }}
              disabled={busy !== null}
              className="text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDecline}
              disabled={busy !== null}
              className="text-tea-text-sec hover:text-tea-text transition-colors disabled:opacity-50 disabled:cursor-wait"
            >
              {busy === 'declined' ? 'Sending…' : 'Send decline'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="font-body italic text-ui-13 text-tea-text-sec mt-3">{error}</p>
      )}
    </article>
  );
};
