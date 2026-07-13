import React, { useMemo, useState } from 'react';
import type { CurateJourney } from '../types';
import { filterImportJourneys } from './importReviewDomain';

interface Props {
  journeys: CurateJourney[];
  journeyId: string | null;
  busy: boolean;
  onSelect: (journeyId: string | null) => Promise<boolean>;
  onCreate: (input: { name: string; season?: string; year?: number }) => Promise<boolean>;
}

const controlClass = 'min-h-11 w-full rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold lg:text-ui-13';

export const ImportJourneyPicker: React.FC<Props> = ({ journeys, journeyId, busy, onSelect, onCreate }) => {
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState('');
  const [year, setYear] = useState('');
  const visible = useMemo(() => filterImportJourneys(journeys, query), [journeys, query]);
  const create = async () => {
    const ok = await onCreate({ name: name.trim(), season: season.trim() || undefined, year: year ? Number(year) : undefined });
    if (ok) { setName(''); setSeason(''); setYear(''); setQuery(''); setCreating(false); }
  };
  return (
    <div className="space-y-2">
      <label className="block text-ui-11 text-tea-text-sec"><span className="mb-1 block uppercase tracking-[1.2px] text-tea-text-dim">Sourcing run · optional</span>
        <input aria-label="Search sourcing runs" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sourcing runs" className={controlClass} />
      </label>
      <select aria-label="Sourcing run" value={journeyId || ''} disabled={busy} onChange={event => void onSelect(event.target.value || null)} className={controlClass}>
        <option value="">No sourcing run</option>
        {visible.map(journey => <option key={journey.id} value={journey.id}>{[journey.name, journey.season, journey.year].filter(Boolean).join(' · ')}</option>)}
      </select>
      {!creating ? <button type="button" onClick={() => setCreating(true)} className="tap-target min-h-11 text-ui-11 text-tea-gold">Create new sourcing run</button> : (
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
