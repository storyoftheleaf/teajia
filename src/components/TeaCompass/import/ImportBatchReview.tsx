import React, { useMemo, useState } from 'react';
import type { CurateImportDetail, CurateImportItem } from '../../../lib/api';
import { ImportItemRow } from './ImportItemRow';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';

interface ImportBatchReviewProps {
  detail: CurateImportDetail;
  busyId: string | null;
  onUpdate: (item: CurateImportItem, updates: Partial<CurateImportItem>) => void;
  onAccept: (item: CurateImportItem) => void;
  onMerge: (item: CurateImportItem) => void;
  onAcceptAll: () => void;
  onDefer: () => void;
}

export const ImportBatchReview: React.FC<ImportBatchReviewProps> = ({ detail, busyId, onUpdate, onAccept, onMerge, onAcceptAll, onDefer }) => {
  const [visibleCount, setVisibleCount] = useState(10);
  const remaining = useMemo(() => detail.items.filter(item => item.review_state === 'pending' || item.review_state === 'reviewing'), [detail.items]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{detail.items.length} items to review</h3>
          <p className="text-ui-12 text-tea-text-dim">{detail.items.length - remaining.length} reviewed · {remaining.length} remaining</p>
        </div>
        {remaining.length > 0 && <button type="button" onClick={onAcceptAll} className="tap-target min-h-11 rounded-md border border-tea-gold px-3 text-ui-12 text-tea-gold">Accept all remaining</button>}
      </div>
      {detail.sources.filter(source => source.r2_object_key).length > 0 && (
        <div className="space-y-2" aria-label="Saved evidence">
          {detail.sources.filter(source => source.r2_object_key).map(source => <div key={source.id} className="rounded-md border border-tea-border bg-tea-surface px-3 py-2"><p className="truncate text-ui-13 text-tea-text">{String(source.metadata?.filename || 'Evidence')}</p><p className="text-ui-11 text-tea-text-dim">Saved · extraction not available · needs review</p></div>)}
        </div>
      )}
      <div className="space-y-2">
        {detail.items.slice(0, visibleCount).map(item => <ImportItemRow key={item.id} item={item} busy={busyId === item.id} onUpdate={updates => onUpdate(item, updates)} onAccept={() => onAccept(item)} onMerge={() => onMerge(item)} />)}
      </div>
      {visibleCount < detail.items.length && <button type="button" onClick={() => setVisibleCount(count => Math.min(count + 10, detail.items.length))} className="tap-target w-full min-h-11 rounded-md border border-tea-border text-ui-12 text-tea-text-sec hover:text-tea-text">Show {Math.min(10, detail.items.length - visibleCount)} more</button>}
      <button type="button" onClick={onDefer} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Review later</button>
    </div>
  );
};
