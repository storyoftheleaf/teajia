// AdoptionQueue — Platform-tier review of partner-suggested profiles.
// Step 6 of the Network Rollout. Per docs/NETWORK_UI_BRIEF.md shared
// vocabulary (no toasts, no chrome, editorial register, bronze rare).
//
// A partner who originates a tea profile flags it via PartnerListingEdit.
// Adrian sees pending suggestions here and either adopts (curated_by
// transfers to Teajia, profile becomes visible in every partner's catalog)
// or declines with an optional note returned to the originator.

import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import type { AdoptionQueueEntry, AdoptionDecision } from '../../types';

const FILTERS: Array<{ key: AdoptionDecision; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'adopted', label: 'Adopted' },
  { key: 'declined', label: 'Declined' },
];

export const AdoptionQueue: React.FC = () => {
  const [filter, setFilter] = useState<AdoptionDecision>('pending');
  const [entries, setEntries] = useState<AdoptionQueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(null);
    setError(null);
    try {
      const { profiles } = await api.network.adoptionQueue(filter);
      setEntries(profiles);
    } catch (err: any) {
      setError(err?.message || "Couldn't load the adoption queue.");
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-4 md:px-8 pt-8 pb-nav-gap-lg max-w-3xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <Link
          to="/admin/access/platform"
          className="text-tea-text-sec hover:text-tea-text transition-colors text-[13px] mb-5 inline-flex items-center gap-1"
        >
          ← Platform access
        </Link>

        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>
          Adoption queue
        </h1>
        <p className="font-body italic text-[15px] text-tea-text-sec leading-[1.7]">
          Partners can flag teas they originated for the Teajia network catalog.
          Adopting transfers curation to you; declining keeps it with the originator.
        </p>
      </header>

      {/* Filter tabs */}
      <div className="flex items-center gap-5 mb-8 text-[13px]">
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
        <p className="font-body italic text-[14px] text-tea-text-sec">{error}</p>
      )}

      {!error && entries === null && (
        <p className="font-body italic text-[14px] text-tea-text-sec">Loading…</p>
      )}

      {!error && entries && entries.length === 0 && (
        <p className="font-body italic text-[14px] text-tea-text-sec leading-[1.7]">
          {filter === 'pending'
            ? 'No teas are waiting for review.'
            : filter === 'adopted'
            ? 'No teas have been adopted yet.'
            : 'No teas have been declined.'}
        </p>
      )}

      {!error && entries && entries.length > 0 && (
        <ul className="space-y-8">
          {entries.map(entry => (
            <li key={entry.id}>
              <AdoptionRow entry={entry} onChange={load} />
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
  const [busy, setBusy] = useState<'adopted' | 'declined' | null>(null);
  const [showDecline, setShowDecline] = useState(false);
  const [declineNote, setDeclineNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isPending = entry.adoption_decision === 'pending';

  const handleAdopt = async () => {
    setBusy('adopted');
    setError(null);
    try {
      await api.network.decideAdoption(entry.id, 'adopted');
      await onChange();
    } catch (err: any) {
      setError(err?.message || "Couldn't adopt. Try again.");
      setBusy(null);
    }
  };

  const handleDecline = async () => {
    setBusy('declined');
    setError(null);
    try {
      await api.network.decideAdoption(entry.id, 'declined', declineNote.trim() || undefined);
      await onChange();
    } catch (err: any) {
      setError(err?.message || "Couldn't decline. Try again.");
      setBusy(null);
    }
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
        <p className="font-body text-[14px] text-tea-text-sec mb-2">{entry.chinese_name}</p>
      )}

      {/* Origin line + originator attribution */}
      {originLine && (
        <p className="font-body text-[13px] text-tea-text-sec mb-1">{originLine}</p>
      )}
      <p className="text-[11px] text-tea-text-dim tracking-[0.04em] mb-4">
        Originated by {entry.originator_account_name}
        {entry.suggested_by_user_name && ` · suggested by ${entry.suggested_by_user_name}`}
        {suggestedDate && ` · ${suggestedDate}`}
      </p>

      {/* Description */}
      {entry.description && (
        <p className="font-body text-[15px] text-tea-text leading-[1.7] mb-4">
          {entry.description}
        </p>
      )}

      {/* Originator note */}
      {entry.suggested_for_network_note && (
        <blockquote className="font-body italic text-[14px] text-tea-text-sec leading-[1.7] mb-5 pl-4 border-l border-tea-border">
          "{entry.suggested_for_network_note}"
        </blockquote>
      )}

      {/* Already-decided state */}
      {!isPending && (
        <div className="text-[13px] text-tea-text-sec">
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
        <div className="flex items-center gap-5 text-[13px]">
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
            className="w-full px-3 py-2 bg-tea-bg border border-tea-border rounded-sm text-[14px] text-tea-text font-body placeholder:text-tea-text-dim placeholder:italic focus:outline-none focus:border-tea-gold/40"
            maxLength={1000}
          />
          <div className="flex items-center gap-5 text-[13px]">
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
        <p className="font-body italic text-[13px] text-tea-text-sec mt-3">{error}</p>
      )}
    </article>
  );
};
