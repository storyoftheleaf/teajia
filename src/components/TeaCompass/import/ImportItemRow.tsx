import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CurateImportItem } from '../../../lib/api';

interface ImportItemRowProps {
  item: CurateImportItem;
  busy: boolean;
  onUpdate: (updates: Partial<CurateImportItem>) => void;
  onAccept: () => void;
  onMerge: () => void;
}

export const ImportItemRow: React.FC<ImportItemRowProps> = ({ item, busy, onUpdate, onAccept, onMerge }) => {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(item.name || '');
  const [category, setCategory] = useState(item.category);
  const [origin, setOrigin] = useState(String(item.parsed_data?.originRegion || ''));
  const [price, setPrice] = useState(String(item.parsed_data?.priceAmount || ''));
  const [uncertaintyReviewed, setUncertaintyReviewed] = useState(false);
  const uncertainty = Object.values(item.uncertainty || {}).map(String).filter(Boolean);
  const reviewed = item.review_state === 'accepted' || item.review_state === 'merged';
  const label = item.name || item.raw_text || `Item ${item.position + 1}`;
  return (
    <article data-testid="import-item-row" className="rounded-md border border-tea-border bg-tea-surface">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="tap-target flex min-h-11 w-full min-w-0 items-center gap-3 px-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui-14 text-tea-text">{label}</span>
          <span className="text-ui-11 uppercase tracking-[0.1em] text-tea-text-dim">{item.category}{reviewed ? ` · ${item.review_state}` : ''}</span>
        </span>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {(expanded || uncertainty.length > 0) && (
        <div className="space-y-3 border-t border-tea-border px-3 py-3">
          <p className="break-words text-ui-12 text-tea-text-sec">{item.raw_text}</p>
          {uncertainty.map(message => <p key={message} className="text-ui-12 text-tea-gold">Uncertain: {message}</p>)}
          {!reviewed && (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-ui-11 text-tea-text-sec">Corrected name<input value={name} onChange={event => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none" /></label>
                <label className="text-ui-11 text-tea-text-sec">Category<select value={category} onChange={event => setCategory(event.target.value as 'tea' | 'teaware')} className="mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none"><option value="tea">Tea</option><option value="teaware">Teaware</option></select></label>
                <label className="text-ui-11 text-tea-text-sec">Origin<input value={origin} onChange={event => setOrigin(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none" /></label>
                <label className="text-ui-11 text-tea-text-sec">Price<input value={price} onChange={event => setPrice(event.target.value)} inputMode="decimal" className="mt-1 min-h-11 w-full rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none" /></label>
              </div>
              <button type="button" disabled={busy || !name.trim()} onClick={() => onUpdate({ name: name.trim(), category, parsed_data: { ...item.parsed_data, originRegion: origin.trim() || null, priceAmount: price ? Number(price) : null } })} className="tap-target min-h-11 text-ui-12 text-tea-gold">Save corrections</button>
              {uncertainty.length > 0 && <label className="flex min-h-11 items-center gap-2 text-ui-12 text-tea-text-sec"><input type="checkbox" checked={uncertaintyReviewed} onChange={event => { setUncertaintyReviewed(event.target.checked); if (event.target.checked) onUpdate({ uncertainty: {} }); }} /> Reviewed uncertain fields</label>}
              <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" disabled={busy} onClick={onMerge} aria-label={`Merge ${label}`} className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text">Merge with active entry</button>
              <button type="button" disabled={busy || (uncertainty.length > 0 && !uncertaintyReviewed)} onClick={onAccept} aria-label={`Accept ${label}`} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg disabled:opacity-50">Accept</button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
};
