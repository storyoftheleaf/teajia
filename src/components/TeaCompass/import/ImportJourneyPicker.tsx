import React, { useMemo, useState } from 'react';
import type { CurateJourney } from '../types';
import { filterImportJourneys } from './importReviewDomain';
import type { LookupState } from '../../../lib/api';

interface Props {
  lookup: LookupState<CurateJourney>;
  journeyId: string | null;
  busy: boolean;
  onRetry: () => void;
  onSelect: (journeyId: string | null) => Promise<boolean>;
  onCreate: (input: { name: string; season?: string; year?: number }) => Promise<boolean>;
}

const controlClass = 'min-h-11 w-full rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold lg:text-ui-13';

export const ImportJourneyPicker: React.FC<Props> = ({ lookup, journeyId, busy, onRetry, onSelect, onCreate }) => {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [year, setYear] = useState('');
  const visible = useMemo(() => filterImportJourneys(lookup.options, query), [lookup.options, query]);
  const lookupReady = lookup.status === 'ready' || lookup.status === 'empty';
  const create = async () => {
    const ok = await onCreate({ name: name.trim(), season: season.trim() || undefined, year: year ? Number(year) : undefined });
    if (ok) { setName(''); setSeason(''); setYear(''); setQuery(''); setCreating(false); }
  };
  return (
    <div className="space-y-2">
      <label className="block text-ui-11 text-tea-text-sec"><span className="mb-1 block uppercase tracking-[1.2px] text-tea-text-dim">Sourcing run · optional</span>
        <input aria-label="Search sourcing runs" disabled={busy || !lookupReady} value={query} onChange={event => setQuery(event.target.value)} placeholder={lookup.status === 'loading' ? 'Loading sourcing runs…' : lookup.status === 'error' ? 'Retry sourcing runs' : 'Search sourcing runs'} className={`${controlClass} disabled:opacity-50`} />
      </label>
      <select aria-label="Sourcing run" value={journeyId || ''} disabled={busy || !lookupReady} onChange={event => void onSelect(event.target.value || null)} className={`${controlClass} disabled:opacity-50`}>
        <option value="">No sourcing run</option>
        {visible.map(journey => <option key={journey.id} value={journey.id}>{[journey.name, journey.season, journey.year].filter(Boolean).join(' · ')}</option>)}
      </select>
      {lookup.status === 'error' && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-ui-11 text-tea-text-sec"><span>{lookup.error || 'Could not load sourcing runs.'}</span><button type="button" disabled={busy} onClick={onRetry} className="tap-target min-h-11 text-tea-gold disabled:opacity-50">Retry</button></div>}
      {lookup.status === 'empty' && <p className="text-ui-11 text-tea-text-sec">No existing sourcing runs.</p>}
      {!creating ? <button type="button" disabled={busy || !lookupReady} onClick={() => setCreating(true)} className="tap-target min-h-11 text-ui-11 text-tea-gold disabled:opacity-50">Create new sourcing run</button> : (
        <div className="space-y-2 border-l-2 border-tea-border pl-3">
          <label className="block text-ui-11 text-tea-text-sec">Run name<input aria-label="New sourcing run name" value={name} onChange={event => setName(event.target.value)} className={controlClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Season<input aria-label="New sourcing run season" value={season} onChange={event => setSeason(event.target.value)} className={controlClass} /></label>
          <label className="block text-ui-11 text-tea-text-sec">Year<input aria-label="New sourcing run year" inputMode="numeric" value={year} onChange={event => setYear(event.target.value)} className={controlClass} /></label>
          <div className="flex justify-between gap-3"><button type="button" onClick={() => setCreating(false)} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel</button><button type="button" disabled={busy || !name.trim()} onClick={() => void create()} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg disabled:opacity-50">Create run</button></div>
        </div>
      )}
    </div>
  );
};
