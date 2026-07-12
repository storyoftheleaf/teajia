import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { CurateImportItem } from '../../../lib/api';

interface ImportItemRowProps {
  item: CurateImportItem;
  busy: boolean;
  onAccept: () => void;
  onMerge: () => void;
}

export const ImportItemRow: React.FC<ImportItemRowProps> = ({ item, busy, onAccept, onMerge }) => {
  const [expanded, setExpanded] = useState(false);
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button type="button" disabled={busy} onClick={onMerge} aria-label={`Merge ${label}`} className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text">Merge with active entry</button>
              <button type="button" disabled={busy} onClick={onAccept} aria-label={`Accept ${label}`} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg">Accept</button>
            </div>
          )}
        </div>
      )}
    </article>
  );
};

