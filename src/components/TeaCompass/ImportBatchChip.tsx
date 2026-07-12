import React from 'react';
import { FileText } from 'lucide-react';
import type { CurateImportDetail } from '../../lib/api';

export const ImportBatchChip: React.FC<{ detail: CurateImportDetail; onOpen: () => void }> = ({ detail, onOpen }) => {
  const reviewed = detail.items.filter(item => item.review_state === 'accepted' || item.review_state === 'merged').length;
  const remaining = detail.items.length - reviewed;
  const errors = detail.items.filter(item => Object.keys(item.uncertainty || {}).length > 0).length;
  const source = detail.sources[0]?.kind === 'paste' ? 'Imported list' : detail.sources[0]?.kind || 'Import';
  const accessible = `${source}: ${detail.items.length} items, ${reviewed} reviewed, ${remaining} remaining, 0 errors${errors ? `, ${errors} uncertain` : ''}`;
  return <button type="button" onClick={onOpen} aria-label={accessible} className="tap-target flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md border border-tea-border bg-tea-surface px-3 text-left hover:border-tea-gold">
    <FileText size={15} className="shrink-0 text-tea-gold" /><span className="min-w-0 flex-1 truncate text-ui-12 text-tea-text">{source}</span><span className="shrink-0 text-ui-11 text-tea-text-dim">{reviewed}/{detail.items.length}{errors ? ` · ${errors} uncertain` : ''}</span>
  </button>;
};
