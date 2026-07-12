import React, { useMemo, useState } from 'react';
import type { CurateImportDetail, CurateImportItem } from '../../../lib/api';
import { ImportItemRow } from './ImportItemRow';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { ImportEvidenceCard } from './ImportEvidenceCard';

interface ImportBatchReviewProps {
  detail: CurateImportDetail;
  busyId: string | null;
  onUpdate: (item: CurateImportItem, updates: Partial<CurateImportItem>) => Promise<boolean>;
  onAccept: (item: CurateImportItem) => void;
  onMerge: (item: CurateImportItem) => void;
  onAcceptAll: () => void;
  onDefer: () => void;
  onNew: () => void;
  onAddItem: (name: string, category: 'tea' | 'teaware') => Promise<void>;
  onAbandon: () => Promise<void>;
}

export const ImportBatchReview: React.FC<ImportBatchReviewProps> = ({ detail, busyId, onUpdate, onAccept, onMerge, onAcceptAll, onDefer, onNew, onAddItem, onAbandon }) => {
  const [visibleCount, setVisibleCount] = useState(10);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState<'tea' | 'teaware'>('tea');
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
          {detail.sources.filter(source => source.r2_object_key).map(source => <ImportEvidenceCard key={source.id} source={source} />)}
        </div>
      )}
      <div className="space-y-2">
        {detail.items.slice(0, visibleCount).map(item => <ImportItemRow key={item.id} item={item} busy={busyId === item.id} onUpdate={updates => onUpdate(item, updates)} onAccept={() => onAccept(item)} onMerge={() => onMerge(item)} />)}
      </div>
      <div className="flex flex-wrap gap-2 rounded-md border border-tea-border bg-tea-surface p-3">
        <input aria-label="Manual review item name" value={manualName} onChange={event => setManualName(event.target.value)} placeholder="Add an item from this evidence" className="min-h-11 min-w-0 flex-1 rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-13 text-tea-text" />
        <select aria-label="Manual review item category" value={manualCategory} onChange={event => setManualCategory(event.target.value as 'tea' | 'teaware')} className="min-h-11 rounded-md border border-tea-border bg-tea-elevated px-3 text-ui-13 text-tea-text"><option value="tea">Tea</option><option value="teaware">Teaware</option></select>
        <button type="button" disabled={!manualName.trim() || !!busyId} onClick={async () => { await onAddItem(manualName.trim(), manualCategory); setManualName(''); }} className="tap-target min-h-11 text-ui-12 text-tea-gold disabled:opacity-50">Add review item</button>
      </div>
      {visibleCount < detail.items.length && <button type="button" onClick={() => setVisibleCount(count => Math.min(count + 10, detail.items.length))} className="tap-target w-full min-h-11 rounded-md border border-tea-border text-ui-12 text-tea-text-sec hover:text-tea-text">Show {Math.min(10, detail.items.length - visibleCount)} more</button>}
      <div className="flex flex-wrap justify-between gap-2"><button type="button" onClick={onAbandon} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Abandon import</button><div className="flex gap-2"><button type="button" onClick={onDefer} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Review later</button><button type="button" onClick={onNew} className="tap-target min-h-11 text-ui-12 text-tea-gold">New import</button></div></div>
    </div>
  );
};
